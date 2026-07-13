import express from "express";
import path from "path";
import fs from "fs";
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
  res.type("application/json").send(body);
});

app.post("/api/db", (req, res) => {
  const { key, value } = req.body;
  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "Missing key" });
  }
  if (PRIVATE_KEYS.has(key)) {
    return res.status(403).json({ error: "This key is private and cannot be synced" });
  }
  const currentDb = loadDb();
  currentDb[key] = value;
  saveDb(currentDb);
  res.json({ success: true });
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
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
