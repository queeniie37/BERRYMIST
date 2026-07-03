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
  const chapters: Chapter[] = [];
  for (let i = 1; i <= count; i++) {
    chapters.push({
      id: `${novelId}-chap-${i}`,
      novelId,
      number: i,
      title: `الفصل ${i}: بداية التحدي الأكبر لقوى بيري ميست`,
      content: `هذا هو نص الفصل ${i}. بدأ كل شيء عندما تجمعت الغيوم الداكنة فوق قمم الجبال الشاهقة، معلنةً عن وصول عاصفة لم يشهد لها العالم مثيلاً من قبل.\n\nوقف البطل في منتصف الساحة، مستشعرًا طاقة هائلة تتدفق في عروقه. "أخيراً، حانت اللحظة التي طالما انتظرتها،" همس لنفسه والشرر البنفسجي يتطاير من عينيه المتوهجتين.\n\nتجمعت الأرواح من حوله، تهتف باسمه في صمت مهيب، وكل روح تعبر عن استعدادها للقتال من أجل مليكها الجديد. واجه الأعداء بابتسامة ساخرة، ممسكاً بسيفه المشع ببريق التوت البري الضبابي الفاخر.\n\n"إذا كنتم تعتقدون أن الظلام سيبتلعني، فأنتم واهمون. أنا هو الظلام نفسه، وأنا من يحدد النهاية والبداية!" هكذا صرخ واندفع كالبرق الخاطف متجاوزاً خطوط الدفاع بكل ثقة وبسالة.\n\nاستمرت المعركة لساعات طالت فيها التضحيات وسقط فيها الجبابرة، لكن عزيمة البطل ظلت كالجبل الراسخ لا تتزعزع. وفي نهاية المطاف، سجد الجميع طاعة وخضوعاً لقوته الخارقة الجديدة التي ستغير مصير هذا العالم إلى الأبد.`,
      views: Math.floor(Math.random() * 500) + 10,
      createdAt: new Date().toISOString(),
      isDraft: false
    });
  }
  return chapters;
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
    email: 'hanona37hh@gmail.com',
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

// Database class to handle localStorage safely with immediate cleanup migration
export class BerryDatabase {
  static get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(`berry_mist_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`berry_mist_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
  }

  static initialize() {
    const isCleaned = localStorage.getItem('berry_mist_cleaned_v3');
    if (!isCleaned) {
      // Clear all previous fake items to ensure the user sees an absolutely clean platform!
      this.set('novels', []);
      this.set('news', []);
      this.set('teams', []);
      this.set('suggestions', []);
      this.set('comments', []);
      this.set('reviews', []);
      this.set('reservations', []);
      this.set('notifications', []);
      this.set('reports', []);
      this.set('translator_requests', []);
      this.set('reading_history', []);
      this.set('bookmarks', []);
      this.set('current_role', 'GUEST'); // Default to GUEST to secure the platform
      this.set('ads', []);
      this.set('chapters', []);
      
      localStorage.setItem('berry_mist_initialized', 'true');
      localStorage.setItem('berry_mist_cleaned_v3', 'true');
      return;
    }

    if (!localStorage.getItem('berry_mist_initialized')) {
      this.set('novels', INITIAL_NOVELS);
      this.set('news', INITIAL_NEWS);
      this.set('teams', INITIAL_TEAMS);
      this.set('suggestions', INITIAL_SUGGESTIONS);
      this.set('comments', INITIAL_COMMENTS);
      this.set('reviews', INITIAL_REVIEWS);
      this.set('reservations', [] as Reservation[]);
      this.set('notifications', [] as Notification[]);
      this.set('reports', [] as Report[]);
      this.set('translator_requests', [] as TranslatorRequest[]);
      this.set('reading_history', [] as any[]);
      this.set('bookmarks', [] as string[]);
      this.set('current_role', 'GUEST');
      this.set('ads', INITIAL_ADS);
      this.set('chapters', [] as Chapter[]);
      localStorage.setItem('berry_mist_initialized', 'true');
    }
  }
}
