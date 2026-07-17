import { Novel, Chapter, Suggestion, Reservation, Notification, Comment, Review, Report, TranslatorRequest, News, Team, User, UserRole, Ad } from './types';

// Unsplash Anime / Fantasy high-quality placeholders for covers
export const COVER_IMAGES = {
  shadow_king: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600', // Dark castle / moonlight
  solo_leveling: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600', // Cyber anime / neon sword
  beginning_after: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600', // Starry / cosmic magic
  beast_level: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600', // Fantasy beast
  want_to_live: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=600', // Golden gateway / magic forest
  emerald_knights: 'https://images.unsplash.com/photo-1535663116935-e39f41783312?q=80&w=600', // Knight / fantasy portal
  unconquered_one: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600', // Dark wanderer under stars
  dragon_master: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?q=80&w=600', // Astrolabe / Alchemist
};

// Clean states requested by user (removing all placeholder data)
export const INITIAL_ADS: Ad[] = [];
export const INITIAL_NEWS: News[] = [];
export const INITIAL_TEAMS: Team[] = [];
export const INITIAL_NOVELS: Novel[] = [];
export const INITIAL_SUGGESTIONS: Suggestion[] = [];
export const INITIAL_COMMENTS: Comment[] = [];
export const INITIAL_REVIEWS: Review[] = [];

export const generateChapters = (novelId: string, count: number): Chapter[] => {
  return [];
};

// Default Current User (Required for the role-simulator/evaluator)
export const DEFAULT_USERS: { [key in UserRole]: User } = {
  GUEST: {
    id: 'guest-user',
    username: 'زائر_الضباب',
    email: 'guest@berrymist.com',
    role: 'GUEST',
    xp: 0,
    level: 1,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=guest',
    bio: 'زائر غير مسجل يستمتع بقراءة الروايات والاطلاع على الفصول المجانية.'
  },
  MEMBER: {
    id: 'member-1',
    username: 'عضو_الضباب',
    email: 'member@berrymist.com',
    role: 'MEMBER',
    xp: 250,
    level: 3,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=member1',
    bio: 'قارئ شغوف للروايات الكورية والصينية، أهوى التفاعل وكتابة المراجعات العميقة.',
    discord: 'member_discord#1234',
    telegram: '@member_tele'
  },
  TRANSLATOR: {
    id: 'translator-1',
    username: 'مترجم_الظلال',
    email: 'translator@berrymist.com',
    role: 'TRANSLATOR',
    xp: 2450,
    level: 12,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=translator1',
    bio: 'مترجم روايات فانتازيا وأكشن بخبرة تزيد عن 3 سنوات. شعاري: الدقة والسرعة في النشر.',
    discord: 'shadow_trans#9999',
    telegram: '@shadow_trans',
    paypalEmail: 'shadow_donate@paypal.com'
  },
  SUPERVISOR: {
    id: 'supervisor-1',
    username: 'مشرف_بالموقع',
    email: 'supervisor@berrymist.com',
    role: 'SUPERVISOR',
    xp: 5600,
    level: 25,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=super',
    bio: 'مشرف على تدقيق الروايات وتسهيل عمل المترجمين ومراجعة البلاغات للحفاظ على فخامة البيئة.'
  },
  OWNER: {
    id: 'berrymist-owner',
    username: 'BERRYMIST',
    email: 'berrymist11@gmail.com',
    role: 'OWNER',
    xp: 15400,
    level: 50,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=berryowner',
    bio: 'مؤسس وصاحب منصة Berry Mist الفاخرة لروايات الخيال والأكشن المترجمة.',
    discord: 'berrymist_owner#0001',
    telegram: '@berrymist_admin'
  },
  WRITER: {
    id: 'writer-1',
    username: 'كاتب_الأساطير',
    email: 'writer@berrymist.com',
    role: 'WRITER',
    xp: 1200,
    level: 8,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=writer1',
    bio: 'كاتب ومؤلف قصص خيالية وفانتازيا عربية أصلية بمستويات شيقة ومثيرة.',
    discord: 'legend_writer#7777',
    telegram: '@legend_writer'
  }
};

// Keys that belong to THIS browser/user only and must never be pushed to the
// shared server database: users_db holds account credentials, and the rest
// are per-device session/preference data. Leaking users_db to /api/db would
// expose every registered email + password to any visitor.
const PRIVATE_LOCAL_KEYS = new Set([
  'users_db',
  'current_user_data',
  'current_role',
  'bookmarks',
  'reading_history'
]);

// ---------------------------------------------------------------------------
// Storage backend: in-memory cache + IndexedDB persistence.
//
// localStorage's ~5MB quota used to cap the ENTIRE site (novels, chapters,
// covers, user accounts). IndexedDB quotas are hundreds of MB to multiple GB,
// so the library and member base can grow far beyond the old limit. The
// in-memory Map keeps BerryDatabase.get() synchronous for all existing
// callers; BerryDatabase.hydrate() (awaited in main.tsx before the app
// renders) loads everything from IndexedDB — and migrates any pre-existing
// localStorage data — into the cache first.
// ---------------------------------------------------------------------------

const IDB_NAME = 'berry_mist_db';
const IDB_STORE = 'kv';

const memCache = new Map<string, string>();
let idbHandle: IDBDatabase | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPut(key: string, value: string): void {
  if (!idbHandle) return;
  try {
    const tx = idbHandle.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.onerror = () => console.error('IndexedDB write failed for', key, tx.error);
  } catch (e) {
    console.error('IndexedDB write failed for', key, e);
  }
}

function storeRead(fullKey: string): string | null {
  const v = memCache.get(fullKey);
  return v === undefined ? null : v;
}

function storeWrite(fullKey: string, value: string): void {
  memCache.set(fullKey, value);
  if (idbHandle) {
    idbPut(fullKey, value);
  } else {
    // Browsers without IndexedDB fall back to localStorage (old 5MB limit).
    try {
      localStorage.setItem(fullKey, value);
    } catch (e) {
      console.error('localStorage fallback write failed for', fullKey, e);
    }
  }
}

// Same per-id merge rules as the server (mergeById in server.ts /
// merge_by_id in api/db.php): records only one side knows are kept, and for
// records both sides know the newest updatedAt/createdAt wins — ties go to
// the LOCAL copy so un-stamped counter bumps survive. Server order comes
// first so the merged result converges byte-for-byte with what the server
// stores (otherwise ordering differences would trigger endless re-pushes).
function recordTime(r: any): number {
  const t = Date.parse(r?.updatedAt || r?.createdAt || '');
  return Number.isNaN(t) ? 0 : t;
}
function mergeRecordsById(serverList: any, localList: any): any[] {
  const byId = new Map<string, any>();
  for (const r of Array.isArray(serverList) ? serverList : []) {
    if (r && typeof r === 'object' && typeof r.id === 'string') byId.set(r.id, r);
  }
  for (const r of Array.isArray(localList) ? localList : []) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string') continue;
    const prev = byId.get(r.id);
    if (!prev || recordTime(r) >= recordTime(prev)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

// Database class handling storage safely with immediate cleanup migration
export class BerryDatabase {
  // Loads persisted data into the synchronous in-memory cache. MUST complete
  // before the first React render (awaited in main.tsx) because components
  // read state via BerryDatabase.get() in their useState initializers.
  static async hydrate(): Promise<void> {
    idbHandle = await openIdb();

    if (idbHandle) {
      await new Promise<void>((resolve) => {
        try {
          const tx = idbHandle!.transaction(IDB_STORE, 'readonly');
          const cursorReq = tx.objectStore(IDB_STORE).openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              if (typeof cursor.key === 'string' && typeof cursor.value === 'string') {
                memCache.set(cursor.key, cursor.value);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    // One-time migration: copy any pre-IndexedDB data that still lives in
    // localStorage (existing visitors' accounts, bookmarks, drafts…) into
    // the new store, then free the old quota-limited copies.
    try {
      const toMigrate: Array<[string, string]> = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('berry_mist_') && !memCache.has(k)) {
          const v = localStorage.getItem(k);
          if (v !== null) toMigrate.push([k, v]);
        }
      }
      for (const [k, v] of toMigrate) memCache.set(k, v);

      if (idbHandle && toMigrate.length > 0) {
        const migrated = await new Promise<boolean>((resolve) => {
          try {
            const tx = idbHandle!.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            for (const [k, v] of toMigrate) store.put(v, k);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
          } catch {
            resolve(false);
          }
        });
        // Only clear localStorage copies once IndexedDB durably holds them.
        // The tiny init flags stay: initialize() reads them synchronously.
        if (migrated) {
          for (const [k] of toMigrate) {
            if (k !== 'berry_mist_initialized' && k !== 'berry_mist_cleaned_v6') {
              try { localStorage.removeItem(k); } catch { /* ignore */ }
            }
          }
        }
      }
    } catch {
      // localStorage disabled — IndexedDB (or memory only) still works.
    }

    // Ask the browser to protect this origin's storage from automatic
    // eviction under disk pressure, so downloaded/offline data survives.
    try {
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }
    } catch { /* optional */ }
  }
  static get<T>(key: string, defaultValue: T): T {
    try {
      if (key === 'comments') {
        // Hide tombstoned (deleted) and malformed comments everywhere in the
        // UI. Tombstones stay in storage so the server-side merge propagates
        // the deletion to every device instead of resurrecting the comment.
        const data = storeRead('berry_mist_comments');
        if (data) {
          const rawList = JSON.parse(data);
          const list = (Array.isArray(rawList) ? rawList : [])
            .filter((c: any) => c && typeof c === 'object' && typeof c.id === 'string' && !c.deleted);
          return list as unknown as T;
        }
        return defaultValue;
      }

      if (key === 'chapters') {
        // Hide tombstoned (deleted) and malformed chapters everywhere in the
        // UI. Tombstones stay in storage so the server-side merge propagates
        // the deletion to every device instead of resurrecting the chapter —
        // and, crucially, so a stale device can never wipe other people's
        // freshly published/scheduled chapters.
        const data = storeRead('berry_mist_chapters');
        if (data) {
          const rawList = JSON.parse(data);
          const list = (Array.isArray(rawList) ? rawList : [])
            .filter((c: any) => c && typeof c === 'object' && typeof c.id === 'string' && !c.deleted);
          return list as unknown as T;
        }
        return defaultValue;
      }

      if (key === 'novels') {
        const data = storeRead(`berry_mist_novels`);
        if (data) {
          const rawList = JSON.parse(data);
          // Defensive normalization: the novels list is synced from a
          // world-writable endpoint, so a single malformed record (missing
          // views/genres/…) used to crash every page that rendered it,
          // leaving visitors with a blank white screen. Drop entries that
          // aren't novel-shaped and default the fields the UI dereferences.
          const novelsList: Novel[] = (Array.isArray(rawList) ? rawList : [])
            .filter((n: any) => n && typeof n === 'object' && typeof n.id === 'string' && !n.deleted)
            .map((n: any) => ({
              ...n,
              titleAr: typeof n.titleAr === 'string' ? n.titleAr : (typeof n.titleEn === 'string' ? n.titleEn : 'بدون عنوان'),
              titleEn: typeof n.titleEn === 'string' ? n.titleEn : '',
              author: typeof n.author === 'string' ? n.author : '',
              translatorId: typeof n.translatorId === 'string' ? n.translatorId : '',
              translatorName: typeof n.translatorName === 'string' ? n.translatorName : '',
              cover: typeof n.cover === 'string' ? n.cover : '',
              chaptersCount: typeof n.chaptersCount === 'number' ? n.chaptersCount : 0,
              views: typeof n.views === 'number' ? n.views : 0,
              likes: typeof n.likes === 'number' ? n.likes : 0,
              bookmarksCount: typeof n.bookmarksCount === 'number' ? n.bookmarksCount : 0,
              rating: typeof n.rating === 'number' ? n.rating : 0,
              ratingCount: typeof n.ratingCount === 'number' ? n.ratingCount : 0,
              status: typeof n.status === 'string' ? n.status : 'AVAILABLE',
              language: typeof n.language === 'string' ? n.language : '',
              genres: Array.isArray(n.genres) ? n.genres : [],
              description: typeof n.description === 'string' ? n.description : '',
              createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(0).toISOString()
            }));
          const chapsData = storeRead(`berry_mist_chapters`);
          const rawChaps = chapsData ? JSON.parse(chapsData) : [];
          const chapsList = (Array.isArray(rawChaps) ? rawChaps : [])
            .filter((c: any) => c && typeof c === 'object' && !c.deleted) as Chapter[];

          const updated = novelsList.map(n => {
            let nChaps = chapsList.filter(c => c.novelId === n.id);

            // Scheduled (future publishAt) chapters never count as
            // published — for anyone, owner and translator included. Until
            // their time arrives they exist only in the translator panel's
            // Activity & Scheduling page.
            nChaps = nChaps.filter(c => !c.publishAt || new Date(c.publishAt) <= new Date());
            
            const actualCount = nChaps.length;
            return { ...n, chaptersCount: actualCount };
          });
          return updated as unknown as T;
        }
      }

      const data = storeRead(`berry_mist_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  // Keys whose latest local write has NOT yet been confirmed by the server.
  // While a key is pending, syncWithServer must NOT pull the server's copy
  // over it — that pull is exactly what made freshly published novels
  // "disappear": the 4-second poll fetched the server's OLD list before the
  // publish POST finished (or after it failed) and overwrote localStorage.
  private static pendingSync = new Map<string, string>();

  private static pushToServer(key: string, serialized: string): void {
    this.pendingSync.set(key, serialized);
    fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: `{"key":${JSON.stringify(key)},"value":${serialized}}`
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        // Only clear if no newer local write replaced this one meanwhile
        if (this.pendingSync.get(key) === serialized) {
          this.pendingSync.delete(key);
        }
      })
      .catch((err) => {
        // Keep the key pending; syncWithServer retries it every cycle
        // instead of overwriting local data with the stale server copy.
        console.error(`Error syncing key "${key}" to backend (will retry):`, err);
      });
  }

  private static dispatchKeyEvent(key: string): void {
    if (key === 'novels') {
      window.dispatchEvent(new Event('novels-updated'));
    } else if (key === 'notifications') {
      window.dispatchEvent(new Event('notifications-updated'));
    } else if (key === 'ads') {
      window.dispatchEvent(new Event('ads-updated'));
    } else if (key === 'site_name' || key === 'site_logo' || key === 'site_banner') {
      window.dispatchEvent(new Event('site-settings-updated'));
    } else if (key.startsWith('footer_')) {
      window.dispatchEvent(new Event('footer-settings-updated'));
    } else {
      window.dispatchEvent(new Event(`${key}-updated`));
    }
  }

  static set<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      storeWrite(`berry_mist_${key}`, serialized);

      // Private per-user keys stay on this device only (no events, no server sync)
      if (PRIVATE_LOCAL_KEYS.has(key)) return true;

      // Dispatch standard custom events so that App.tsx updates reactively and instantly
      this.dispatchKeyEvent(key);

      // Sync shared site content to the backend server database asynchronously,
      // with retry protection against the polling overwrite race.
      this.pushToServer(key, serialized);
      return true;
    } catch (e) {
      // Most common cause: QuotaExceededError from oversized base64 images.
      // Callers can now detect the failure instead of showing a fake success.
      console.error("Error writing to localStorage", e);
      return false;
    }
  }

  // Delete a comment by writing a tombstone instead of removing it from the
  // array. get('comments') hides tombstones, and the server-side merge keeps
  // them, so the deletion reaches every device (a plain removal would be
  // "resurrected" by the merge with any device that still had the comment).
  static deleteComment(commentId: string): boolean {
    try {
      const raw = storeRead('berry_mist_comments');
      const list = raw ? JSON.parse(raw) : [];
      const updated = (Array.isArray(list) ? list : []).map((c: any) =>
        c && c.id === commentId
          ? { ...c, deleted: true, updatedAt: new Date().toISOString() }
          : c
      );
      const serialized = JSON.stringify(updated);
      storeWrite('berry_mist_comments', serialized);
      this.dispatchKeyEvent('comments');
      this.pushToServer('comments', serialized);
      return true;
    } catch (e) {
      console.error('Error deleting comment', e);
      return false;
    }
  }

  // Delete chapters by writing tombstones instead of removing them from the
  // array. get('chapters') hides tombstones, and the server-side merge keeps
  // them, so the deletion reaches every device — while a plain removal would
  // let any stale device "resurrect" the chapter (or worse, wipe chapters it
  // never knew about, which is how scheduled chapters used to disappear).
  static deleteChapters(chapterIds: string[]): boolean {
    try {
      const ids = new Set(chapterIds);
      const raw = storeRead('berry_mist_chapters');
      const list = raw ? JSON.parse(raw) : [];
      const updated = (Array.isArray(list) ? list : []).map((c: any) =>
        c && ids.has(c.id)
          ? { ...c, deleted: true, updatedAt: new Date().toISOString() }
          : c
      );
      const serialized = JSON.stringify(updated);
      storeWrite('berry_mist_chapters', serialized);
      this.dispatchKeyEvent('chapters');
      this.pushToServer('chapters', serialized);
      return true;
    } catch (e) {
      console.error('Error deleting chapters', e);
      return false;
    }
  }

  // Delete novels by writing tombstones instead of removing them from the
  // array — same rules as deleteChapters: get('novels') hides tombstones and
  // the server-side merge propagates the deletion without letting a stale
  // device resurrect the novel or wipe novels it never knew about.
  static deleteNovels(novelIds: string[]): boolean {
    try {
      const ids = new Set(novelIds);
      const raw = storeRead('berry_mist_novels');
      const list = raw ? JSON.parse(raw) : [];
      const updated = (Array.isArray(list) ? list : []).map((n: any) =>
        n && ids.has(n.id)
          ? { ...n, deleted: true, updatedAt: new Date().toISOString() }
          : n
      );
      const serialized = JSON.stringify(updated);
      storeWrite('berry_mist_novels', serialized);
      this.dispatchKeyEvent('novels');
      this.pushToServer('novels', serialized);
      return true;
    } catch (e) {
      console.error('Error deleting novels', e);
      return false;
    }
  }

  // Local-only write: never pushed to the shared server database.
  // Used during first-visit initialization so a fresh visitor's empty
  // defaults do not wipe the site's real content for everyone.
  static setLocal<T>(key: string, value: T): void {
    try {
      storeWrite(`berry_mist_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error("Error writing to storage", e);
    }
  }

  // ETag of the last database payload we processed; lets the fast poll
  // answer with an empty 304 when nothing changed on the server.
  private static lastSyncEtag: string | null = null;

  static async syncWithServer(): Promise<void> {
    try {
      const response = await fetch('/api/db', {
        headers: this.lastSyncEtag ? { 'If-None-Match': this.lastSyncEtag } : {}
      });
      if (response.status === 304) return; // nothing changed since last poll
      if (!response.ok) return;
      const etag = response.headers.get('etag');
      if (etag) this.lastSyncEtag = etag;
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn("Skipping database sync: Server did not return a JSON response (content-type:", contentType, ")");
        return;
      }

      const responseText = await response.text();
      const trimmedText = responseText.trim();
      if (!trimmedText || trimmedText.startsWith('<!doctype') || trimmedText.startsWith('<')) {
        console.warn("Skipping database sync: Received HTML or empty response instead of valid JSON database payload.");
        return;
      }
      
      const serverDb = JSON.parse(trimmedText);
      
      const keysToSync = [
        'novels', 'chapters', 'news', 'teams', 'suggestions', 'comments',
        'reviews', 'reservations', 'notifications', 'reports',
        'translator_requests', 'ads', 'role_assignments', 'user_badges', 'user_directory',
        'site_name', 'site_logo', 'site_banner',
        'footer_description', 'footer_email', 'footer_support_text',
        'footer_community_text', 'footer_socials',
        // Owner-editable "Contact us" page content + the inbox of messages
        // visitors send, so both sync across every device.
        'contact_settings', 'contact_messages'
      ];
      
      for (const key of keysToSync) {
        // A local write to this key hasn't been confirmed by the server yet
        // (publish POST still in flight, or it failed). Pulling the server's
        // stale copy now would erase the user's new data — retry the push
        // instead and skip this key for this cycle.
        const pendingValue = this.pendingSync.get(key);
        if (pendingValue !== undefined) {
          this.pushToServer(key, pendingValue);
          continue;
        }
        if (key in serverDb) {
          const localValStr = storeRead(`berry_mist_${key}`);
          const serverValStr = JSON.stringify(serverDb[key]);

          // Self-healing sync for the library: never blindly overwrite the
          // local novels/chapters with the server copy. If this device still
          // holds records the server lost (wiped by the old overwrite bug on
          // a not-yet-updated site), merge the two sides and push the result
          // back up — the owner just opening the site restores the content
          // for every visitor. Guests only merge locally; pushing recovered
          // data is reserved for signed-in members' devices.
          if (key === 'novels' || key === 'chapters') {
            let localList: any[] = [];
            try { localList = localValStr ? JSON.parse(localValStr) : []; } catch { localList = []; }
            const merged = mergeRecordsById(serverDb[key], localList);
            const mergedStr = JSON.stringify(merged);

            if (mergedStr !== serverValStr) {
              const u = this.get<{ role?: string } | null>('current_user_data', null);
              if (u && u.role && u.role !== 'GUEST') {
                this.pushToServer(key, mergedStr);
              }
            }
            if (mergedStr !== localValStr) {
              storeWrite(`berry_mist_${key}`, mergedStr);
              this.dispatchKeyEvent(key);
            }
            continue;
          }

          if (localValStr !== serverValStr) {
            storeWrite(`berry_mist_${key}`, serverValStr);

            // Dispatch standard custom events so that App.tsx receives updates reactive
            if (key === 'novels') {
              window.dispatchEvent(new Event('novels-updated'));
            } else if (key === 'notifications') {
              window.dispatchEvent(new Event('notifications-updated'));
            } else if (key === 'ads') {
              window.dispatchEvent(new Event('ads-updated'));
            } else if (key === 'site_name' || key === 'site_logo' || key === 'site_banner') {
              window.dispatchEvent(new Event('site-settings-updated'));
            } else if (key.startsWith('footer_')) {
              window.dispatchEvent(new Event('footer-settings-updated'));
            } else {
              // General trigger for other state variables
              window.dispatchEvent(new Event(`${key}-updated`));
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync database with server:", err);
    }
  }

  static initialize() {
    // First visit on this browser: seed the LOCAL cache only. The real site
    // content is then pulled from the server by syncWithServer(). Writing
    // these empty defaults with set() would push them to /api/db and erase
    // the shared database for every visitor.
    const isCleaned = storeRead('berry_mist_cleaned_v6');
    if (!isCleaned || !storeRead('berry_mist_initialized')) {
      this.setLocal('novels', INITIAL_NOVELS);
      this.setLocal('news', INITIAL_NEWS);
      this.setLocal('teams', INITIAL_TEAMS);
      this.setLocal('suggestions', INITIAL_SUGGESTIONS);
      this.setLocal('comments', INITIAL_COMMENTS);
      this.setLocal('reviews', INITIAL_REVIEWS);
      this.setLocal('reservations', [] as Reservation[]);
      this.setLocal('notifications', [] as Notification[]);
      this.setLocal('reports', [] as Report[]);
      this.setLocal('translator_requests', [] as TranslatorRequest[]);
      this.setLocal('reading_history', [] as any[]);
      this.setLocal('bookmarks', [] as string[]);
      this.setLocal('current_role', 'GUEST'); // Default to GUEST to secure the platform
      this.setLocal('ads', INITIAL_ADS);
      this.setLocal('chapters', [] as Chapter[]);

      storeWrite('berry_mist_initialized', 'true');
      storeWrite('berry_mist_cleaned_v6', 'true');
    }
  }
}
