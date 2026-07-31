import express from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { createHash } from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "berry_db.json");

// Allow large payloads for importing novels/covers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to load database
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (e) {
      console.error("Error reading database file, using empty:", e);
    }
  }
  return {};
}

// Helper to save database
function saveDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing to database file:", e);
  }
}

// Initialize default values if empty
const db = loadDb();
const defaults: any = {
  novels: [],
  news: [],
  teams: [],
  suggestions: [],
  comments: [],
  reviews: [],
  reservations: [],
  notifications: [],
  reports: [],
  translator_requests: [],
  chapters: [],
  ads: [],
  // Visitor messages sent from the "Contact us" page (owner inbox)
  contact_messages: [],
  // Owner-editable content of the "Contact us" page
  contact_settings: {
    subtitle: "تواصل مباشرة مع إدارة بيري مست وسنجيبك في أسرع وقت",
    intro: "إذا واجهتك مشكلة تقنية، أو رغبت في الاستفسار عن ترجمة أو شراكة، يمكنك استخدام النموذج المجاور أو مراسلتنا مباشرة عبر القنوات التالية:",
    email: "support@berrymist.com",
    discord: "تذكرة الديسكورد الرسمية",
    hours: "24 ساعة / طوال أيام الأسبوع"
  },
  // email(lowercase) -> role, so owner role approvals propagate across devices
  // without ever syncing account credentials (users_db stays private)
  role_assignments: {},
  // userId -> badges granted by the owner (admin panel)
  user_badges: {},
  // userId -> public profile + reading stats, published by each member's device
  user_directory: {},
  site_name: "BerryMist",
  site_logo: "🍇",
  site_banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200",
  footer_description: "منصة عربية رائدة تعنى بترجمة، اقتراح وقراءة الروايات الخفيفة وروايات الفانتازيا والويب المظلمة بأعلى دقة ومعايير حماية وجمالية بصرية فخمة للغاية.",
  footer_email: "support@berrymist.com",
  footer_support_text: "عبر تذكرة الديسكورد الرسمية بالأسفل",
  footer_community_text: "انضم لعائلتنا الروائية الكبرى لتصلك إشعارات الفصول فور صدورها قبل الجميع حياً!",
  footer_socials: [
    { id: "discord", name: "Discord", icon: "👾", url: "https://discord.gg/berrymist", active: true },
    { id: "telegram", name: "Telegram", icon: "📢", url: "https://t.me/berrymist", active: true },
    { id: "facebook", name: "Facebook", icon: "👥", url: "", active: false },
    { id: "twitter", name: "Twitter / X", icon: "🐦", url: "", active: false },
    { id: "instagram", name: "Instagram", icon: "📸", url: "", active: false },
    { id: "tiktok", name: "TikTok", icon: "🎵", url: "", active: false },
    { id: "youtube", name: "YouTube", icon: "📺", url: "", active: false },
    { id: "whatsapp", name: "WhatsApp", icon: "💬", url: "", active: false }
  ]
};

let dbChanged = false;
for (const key of Object.keys(defaults)) {
  if (!(key in db)) {
    db[key] = defaults[key];
    dbChanged = true;
  }
}
if (dbChanged) {
  saveDb(db);
}

// Per-user/private keys must never be stored in or served from the shared
// database — users_db in particular contains account credentials.
const PRIVATE_KEYS = new Set([
  "users_db",
  "current_user_data",
  "current_role",
  "bookmarks",
  "reading_history",
]);

// API Endpoints
app.get("/api/db", (req, res) => {
  const db = loadDb();
  for (const key of PRIVATE_KEYS) {
    delete db[key];
  }
  // Cheap conditional polling (matches api/db.php): empty 304 when the
  // client already holds the latest data.
  const body = JSON.stringify(db);
  const etag = '"' + createHash("md5").update(body).digest("hex") + '"';
  res.setHeader("ETag", etag);
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }
  sendMaybeGzip(req, res, "application/json; charset=utf-8", body);
});

// Comments are written by many visitors at once. A plain "replace the whole
// array" write makes the last writer erase everyone else's fresh comments,
// so instead the server merges: comments only the server knows about are
// kept, and for comments both sides know the newest version wins. Deleted
// comments arrive as tombstones ({deleted:true}) so deletions survive the
// merge; tombstones older than 30 days are purged.
function commentTime(c: any): number {
  const t = Date.parse(c?.updatedAt || c?.createdAt || "");
  if (Number.isNaN(t)) return 0;
  // A timestamp far in the FUTURE would win every merge forever, so no later
  // legitimate edit could ever overwrite it (and a tombstone stamped year 9999
  // would keep a record deleted permanently). Real clock drift is small, so
  // clamp anything more than a day ahead to now.
  return Math.min(t, Date.now() + 24 * 60 * 60 * 1000);
}

function mergeComments(stored: any, incoming: any): any[] {
  const storedList = Array.isArray(stored) ? stored : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const byId = new Map<string, any>();
  for (const c of storedList) {
    if (c && typeof c === "object" && typeof c.id === "string") byId.set(c.id, c);
  }
  for (const c of incomingList) {
    if (!c || typeof c !== "object" || typeof c.id !== "string") continue;
    const prev = byId.get(c.id);
    if (!prev || commentTime(c) >= commentTime(prev)) byId.set(c.id, c);
  }
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return [...byId.values()]
    .filter((c) => !c.deleted || commentTime(c) > cutoff)
    .sort((a, b) => commentTime(b) - commentTime(a));
}

// Novels and chapters used to be synced the naive way too: every client
// POSTed its whole local array and the server stored it as-is. Any device
// holding a stale list (a tab open since yesterday, a reader whose 30s
// view-counter fired before the first sync, another translator publishing)
// would silently erase every record it didn't know about — which is exactly
// how freshly published novels and scheduled chapters kept disappearing for
// visitors. Merge like comments instead: records only the server knows about
// are KEPT, for records both sides know the newest version
// (updatedAt/createdAt) wins, and deletions arrive as tombstones
// ({deleted:true}) so they propagate without letting stale clients wipe data;
// tombstones older than 30 days are purged.
// View counts are monotonic — they only ever go up. When two versions of the
// same novel/chapter meet in a merge, keep the HIGHER views so a stale array
// push (e.g. a translator editing a chapter with an old views value) can never
// reset a count that concurrent readers raised. Newest wins for everything else.
function mergeRecord(prev: any, incoming: any): any {
  const winner = commentTime(incoming) >= commentTime(prev) ? incoming : prev;
  const maxViews = Math.max(Number(prev?.views) || 0, Number(incoming?.views) || 0);
  return { ...winner, views: maxViews };
}

function mergeById(stored: any, incoming: any): any[] {
  const storedList = Array.isArray(stored) ? stored : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const byId = new Map<string, any>();
  for (const c of storedList) {
    if (c && typeof c === "object" && typeof c.id === "string") byId.set(c.id, c);
  }
  for (const c of incomingList) {
    if (!c || typeof c !== "object" || typeof c.id !== "string") continue;
    const prev = byId.get(c.id);
    byId.set(c.id, prev ? mergeRecord(prev, c) : c);
  }
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return [...byId.values()].filter((c) => !c.deleted || commentTime(c) > cutoff);
}

app.post("/api/db", (req, res) => {
  const { key, value } = req.body;
  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "Missing key" });
  }
  if (PRIVATE_KEYS.has(key)) {
    return res.status(403).json({ error: "This key is private and cannot be synced" });
  }
  const currentDb = loadDb();
  if (key === "comments") {
    currentDb[key] = mergeComments(currentDb[key], value);
  } else if (key === "chapters" || key === "novels" || key === "contact_messages") {
    currentDb[key] = mergeById(currentDb[key], value);
  } else if (key === "user_directory") {
    // Public profile directory: merge per-user keys so one member updating
    // their profile can never wipe another member's entry.
    const stored = currentDb[key] && typeof currentDb[key] === "object" ? currentDb[key] : {};
    const incoming = value && typeof value === "object" ? value : {};
    currentDb[key] = { ...stored, ...incoming };
  } else {
    currentDb[key] = value;
  }
  saveDb(currentDb);
  res.json({ success: true });
});

// Atomic view increment. The reader's browser calls this ONCE after 30s on a
// chapter (deduped per device). Incrementing on the server — rather than the
// client pushing a whole novels/chapters array — means concurrent readers each
// add exactly one view instead of overwriting each other's count.
app.post("/api/view", (req, res) => {
  const { novelId, chapterId } = req.body || {};
  const db = loadDb();
  if (Array.isArray(db.novels) && novelId) {
    db.novels = db.novels.map((n: any) => (n && n.id === novelId ? { ...n, views: (Number(n.views) || 0) + 1 } : n));
  }
  if (Array.isArray(db.chapters) && chapterId) {
    db.chapters = db.chapters.map((c: any) => (c && c.id === chapterId ? { ...c, views: (Number(c.views) || 0) + 1 } : c));
  }
  saveDb(db);
  res.json({ success: true });
});

// ---- Member account API (mirrors api/auth.php) ----
// Accounts live in a SEPARATE file that /api/db never serves, and only the
// public user object (password hash stripped) is ever returned.
const USERS_FILE = path.join(process.cwd(), "berry_users.json");
const OWNER_EMAIL = "berrymist11@gmail.com";
function loadUsers(): any[] {
  if (fs.existsSync(USERS_FILE)) {
    try { const d = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")); if (Array.isArray(d)) return d; } catch { /* corrupt — treat as empty */ }
  }
  return [];
}
function saveUsers(data: any[]) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf-8"); } catch (e) { console.error("Error writing users file:", e); }
}
function publicUser(u: any) {
  const { passwordHash, password, ...rest } = u || {};
  return rest;
}

function clampProgress(raw: any, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
// Same field ceilings the PHP endpoint enforces, so a browser cannot push an
// unbounded value into the accounts file through either server.
function clipField(field: string, value: any): any {
  if (typeof value !== "string") return value;
  const max = field === "avatar" || field === "banner" ? 1_500_000 : field === "bio" ? 1000 : field === "username" ? 40 : 300;
  return value.length > max ? value.slice(0, max) : value;
}

app.post("/api/auth", (req, res) => {
  const body = req.body || {};
  const action = body.action;
  const users = loadUsers();

  if (action === "register") {
    const acc = body.account && typeof body.account === "object" ? { ...body.account } : {};
    const email = (acc.email || "").toString().trim().toLowerCase();
    const username = (acc.username || "").toString().trim();
    const hash = (acc.passwordHash || "").toString();
    if (!email || !username || !hash) return res.status(400).json({ error: "missing_fields" });
    if (email === OWNER_EMAIL) return res.status(403).json({ error: "reserved" });
    if (users.some((u) => (u.email || "").toLowerCase() === email)) return res.status(409).json({ error: "exists" });
    // Store only known account fields — the raw request body used to be saved
    // as-is, so a crafted request could plant arbitrary properties on a member
    // record. Registration is also the migration path for accounts created
    // before this endpoint existed, so earned progress travels with them.
    const takenId = !acc.id || users.some((u) => u.id === acc.id);
    const account = {
      id: takenId ? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : acc.id,
      username: clipField("username", username),
      email,
      role: "MEMBER",
      xp: clampProgress(acc.xp, 0, 100_000_000),
      level: clampProgress(acc.level, 1, 1000),
      avatar: typeof acc.avatar === "string" ? clipField("avatar", acc.avatar) : "",
      bio: typeof acc.bio === "string" ? clipField("bio", acc.bio) : "",
      passwordHash: hash,
      createdAt: typeof acc.createdAt === "string" ? acc.createdAt : new Date().toISOString(),
    };
    users.push(account);
    saveUsers(users);
    return res.json({ user: publicUser(account) });
  }

  if (action === "login") {
    const email = (body.email || "").toString().trim().toLowerCase();
    const hash = (body.passwordHash || "").toString();
    if (!email || !hash) return res.status(400).json({ error: "missing_fields" });
    const u = users.find((x) => (x.email || "").toLowerCase() === email && x.passwordHash === hash);
    if (!u) return res.status(401).json({ error: "invalid" });
    return res.json({ user: publicUser(u) });
  }

  if (action === "update") {
    const email = (body.email || "").toString().trim().toLowerCase();
    const hash = (body.passwordHash || "").toString();
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
    const idx = users.findIndex((x) => (x.email || "").toLowerCase() === email && x.passwordHash === hash);
    if (idx === -1) return res.status(401).json({ error: "invalid" });
    for (const f of ["username", "avatar", "bio", "banner", "customStatus"]) {
      if (Object.prototype.hasOwnProperty.call(profile, f)) users[idx][f] = clipField(f, profile[f]);
    }
    saveUsers(users);
    return res.json({ user: publicUser(users[idx]) });
  }

  return res.status(400).json({ error: "unknown_action" });
});

// Compress a response when the browser accepts it.
//
// /api/db returns the WHOLE shared database, so it grows with the library —
// and every visitor downloads it on their first entry before a single chapter
// can be listed. Uncompressed, a real library made that a multi-second wait on
// mobile data: the page frame appeared but the chapters did not. Apache does
// this for the PHP endpoints in production; this keeps the Node server in step.
function sendMaybeGzip(req: any, res: any, contentType: string, body: string): void {
  res.set("Content-Type", contentType);
  const accepts = String(req.headers["accept-encoding"] || "").includes("gzip");
  if (!accepts) return void res.send(body);
  zlib.gzip(Buffer.from(body, "utf-8"), (err, buf) => {
    if (err) return void res.send(body);
    res.set("Content-Encoding", "gzip");
    res.set("Vary", "Accept-Encoding");
    res.end(buf);
  });
}

// ---------------------------------------------------------------------------
// Search-engine surfaces
// ---------------------------------------------------------------------------
// On Hostinger these paths are served by the PHP generators (api/sitemap.php,
// api/feed.php) via .htaccess. This Node server had no equivalent, so running
// the site here answered /sitemap.xml with the app shell — every chapter URL
// invisible to crawlers. Generate them from the same database instead, using
// the SAME Arabic slug rule the app builds its URLs with, so a chapter
// published a second ago is announced immediately and the address a crawler
// follows is the address a reader lands on.
const SITE_URL = "https://berrymist.online";

function slugifyTitle(raw: any): string {
  if (typeof raw !== "string" || raw === "") return "";
  return raw.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
function novelSlugOf(n: any): string {
  return slugifyTitle(n?.titleAr) || slugifyTitle(n?.titleEn) || String(n?.id || "");
}
function chapterNumberOf(c: any): number | null {
  const n = Number(c?.number ?? c?.chapterNumber);
  return Number.isFinite(n) ? n : null;
}
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function publishedChapters(): Array<{ novel: any; chapter: any; slug: string; num: number; ts: number }> {
  const db = loadDb();
  const novels = new Map<string, any>();
  for (const n of Array.isArray(db.novels) ? db.novels : []) {
    if (!n?.id || n.deleted) continue;
    if (n.status === "CANCELLED" || n.status === "PENDING" || n.status === "PENDING_APPROVAL") continue;
    novels.set(n.id, n);
  }
  const now = Date.now();
  const out: Array<{ novel: any; chapter: any; slug: string; num: number; ts: number }> = [];
  for (const c of Array.isArray(db.chapters) ? db.chapters : []) {
    const novel = c?.novelId ? novels.get(c.novelId) : null;
    if (!novel || c.deleted) continue;
    const num = chapterNumberOf(c);
    if (num === null) continue;
    const ts = Date.parse(c.publishAt || c.createdAt || "") || 0;
    if (c.publishAt && ts > now) continue; // scheduled, not out yet
    out.push({ novel, chapter: c, slug: novelSlugOf(novel), num, ts });
  }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

app.get(["/sitemap.xml", "/api/sitemap"], (_req, res) => {
  const db = loadDb();
  const fixed: Array<[string, string, string]> = [
    ["", "daily", "1.0"], ["library", "daily", "0.9"], ["suggestions", "daily", "0.7"],
    ["teams", "weekly", "0.6"], ["ads", "weekly", "0.5"], ["contact", "monthly", "0.4"],
    ["privacy", "yearly", "0.3"], ["terms", "yearly", "0.3"],
  ];
  const urls: Array<[string, string, string]> = fixed.map(([p, f, pr]) => [`${SITE_URL}/${p}`, f, pr]);
  const seenNovel = new Set<string>();
  for (const { novel, slug, num } of publishedChapters()) {
    if (!seenNovel.has(novel.id)) {
      seenNovel.add(novel.id);
      urls.push([`${SITE_URL}/novel/${encodeURIComponent(slug)}`, "daily", "0.8"]);
    }
    urls.push([`${SITE_URL}/novel/${encodeURIComponent(slug)}/chapter-${num}`, "weekly", "0.7"]);
  }
  for (const n of Array.isArray(db.novels) ? db.novels : []) {
    if (!n?.id || seenNovel.has(n.id) || n.deleted) continue;
    if (n.status === "CANCELLED" || n.status === "PENDING" || n.status === "PENDING_APPROVAL") continue;
    urls.push([`${SITE_URL}/novel/${encodeURIComponent(novelSlugOf(n))}`, "daily", "0.8"]);
  }
  const today = new Date().toISOString().slice(0, 10);
  res.set("Cache-Control", "no-cache, must-revalidate");
  sendMaybeGzip(_req, res, "application/xml; charset=utf-8", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([loc, freq, pri]) =>
      `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${today}</lastmod>\n` +
      `    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`).join("\n") +
    "\n</urlset>\n");
});

app.get(["/feed.xml", "/api/feed"], (_req, res) => {
  const db = loadDb();
  const siteName = typeof db.site_name === "string" && db.site_name.trim() ? db.site_name.trim() : "BerryMist";
  const items = publishedChapters().slice(0, 50);
  const asText = (raw: any) => String(raw || "").replace(/<img[^>]*>/gi, "").replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 400);
  res.set("Cache-Control", "no-cache, must-revalidate");
  sendMaybeGzip(_req, res, "application/rss+xml; charset=utf-8", '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n' +
    `  <title>${xmlEscape(siteName + " — أحدث الفصول")}</title>\n` +
    `  <link>${SITE_URL}/</link>\n` +
    `  <description>${xmlEscape("الفصول المنشورة حديثاً على " + siteName + ".")}</description>\n` +
    "  <language>ar</language>\n" +
    `  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />\n` +
    items.map(({ novel, chapter, slug, num, ts }) => {
      const link = `${SITE_URL}/novel/${encodeURIComponent(slug)}/chapter-${num}`;
      const display = novel.titleAr || novel.titleEn || "رواية";
      return "  <item>\n" +
        `    <title>${xmlEscape(display + " — " + (chapter.title || "الفصل " + num))}</title>\n` +
        `    <link>${xmlEscape(link)}</link>\n` +
        `    <guid isPermaLink="true">${xmlEscape(link)}</guid>\n` +
        `    <pubDate>${new Date(ts || Date.now()).toUTCString()}</pubDate>\n` +
        `    <description>${xmlEscape(asText(chapter.content))}</description>\n  </item>`;
    }).join("\n") +
    "\n</channel>\n</rss>\n");
});

// Mount Vite or static assets depending on environment
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // A path that looks like a FILE must 404 honestly instead of receiving
      // the app shell. Answering with the shell makes every missing file look
      // like a valid page — that is what made Google report "the verification
      // file contains incorrect content" rather than "not found", and search
      // engines treat such soft-404s as a site-wide quality problem. (The
      // .htaccess rules do the same on Hostinger.)
      if (/\.(html?|txt|xml|json|js|mjs|css|map|php|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|pdf|zip)$/i.test(req.path)) {
        return res.status(404).type("text/plain").send("Not found");
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
