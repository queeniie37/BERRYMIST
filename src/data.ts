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

// Database class to handle localStorage safely with immediate cleanup migration
export class BerryDatabase {
  static get<T>(key: string, defaultValue: T): T {
    try {
      if (key === 'novels') {
        const data = localStorage.getItem(`berry_mist_novels`);
        if (data) {
          const novelsList = JSON.parse(data) as Novel[];
          const chapsData = localStorage.getItem(`berry_mist_chapters`);
          const chapsList = chapsData ? JSON.parse(chapsData) as Chapter[] : [];
          
          const userStr = localStorage.getItem('berry_mist_current_user_data');
          const currentUser = userStr ? JSON.parse(userStr) : null;
          
          const usersDbStr = localStorage.getItem('berry_mist_users_db');
          const parsedUsersDb = usersDbStr ? JSON.parse(usersDbStr) : [];
          
          const ownerUserIds = new Set<string>();
          if (Array.isArray(parsedUsersDb)) {
            parsedUsersDb
              .filter((u: any) => u && u.email?.toLowerCase() === 'berrymist11@gmail.com')
              .forEach((u: any) => ownerUserIds.add(u.id));
          }
          ownerUserIds.add('berrymist-owner');

          const updated = novelsList.map(n => {
            let nChaps = chapsList.filter(c => c.novelId === n.id);
            
            // Check if authorized
            const isPublishedByOwner = ownerUserIds.has(n.translatorId) || n.translatorName === 'BERRYMIST';
            const isAuthorized = currentUser && (
              currentUser.role === 'OWNER' || 
              currentUser.email?.toLowerCase() === 'berrymist11@gmail.com' || 
              n.translatorId === currentUser.id || 
              isPublishedByOwner
            );
            
            if (!isAuthorized) {
              nChaps = nChaps.filter(c => !c.publishAt || new Date(c.publishAt) <= new Date());
            }
            
            const actualCount = nChaps.length;
            return { ...n, chaptersCount: actualCount };
          });
          return updated as unknown as T;
        }
      }

      const data = localStorage.getItem(`berry_mist_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`berry_mist_${key}`, JSON.stringify(value));

      // Private per-user keys stay on this device only (no events, no server sync)
      if (PRIVATE_LOCAL_KEYS.has(key)) return;

      // Dispatch standard custom events so that App.tsx updates reactively and instantly
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

      // Sync shared site content to the backend Express server database asynchronously
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      }).catch(err => console.error("Error syncing to backend database:", err));
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
  }

  // Local-only write: never pushed to the shared server database.
  // Used during first-visit initialization so a fresh visitor's empty
  // defaults do not wipe the site's real content for everyone.
  static setLocal<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`berry_mist_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
  }

  static async syncWithServer(): Promise<void> {
    try {
      const response = await fetch('/api/db');
      if (!response.ok) return;
      
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
        'translator_requests', 'ads', 'role_assignments', 'site_name', 'site_logo', 'site_banner',
        'footer_description', 'footer_email', 'footer_support_text',
        'footer_community_text', 'footer_socials'
      ];
      
      for (const key of keysToSync) {
        if (key in serverDb) {
          const localValStr = localStorage.getItem(`berry_mist_${key}`);
          const serverValStr = JSON.stringify(serverDb[key]);
          
          if (localValStr !== serverValStr) {
            try {
              localStorage.setItem(`berry_mist_${key}`, serverValStr);
            } catch (storageError) {
              console.warn(`Failed to write key ${key} to localStorage (quota exceeded or disabled):`, storageError);
            }
            
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
    const isCleaned = localStorage.getItem('berry_mist_cleaned_v6');
    if (!isCleaned || !localStorage.getItem('berry_mist_initialized')) {
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

      localStorage.setItem('berry_mist_initialized', 'true');
      localStorage.setItem('berry_mist_cleaned_v6', 'true');
    }
  }
}
