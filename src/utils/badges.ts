import { BerryDatabase } from '../data';

// Badges are granted EXCLUSIVELY by the owner from the admin panel and are
// stored in the shared, synced 'user_badges' key (userId -> badges[]), so a
// badge granted on the owner's device appears on the member's profile on
// their own device. Profiles show a badges section only when at least one
// badge has actually been granted — no automatic/fake achievements.
export interface UserBadge {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: 'READER' | 'TRANSLATOR';
  grantedAt: string;
}

export type BadgeSpec = Omit<UserBadge, 'grantedAt'>;

// Catalog the owner picks from: reader-fitting and translator-fitting awards.
export const BADGE_CATALOG: BadgeSpec[] = [
  // Reader achievements
  { id: 'reader-active', name: 'القارئ النشط', icon: '📖', desc: 'مواظبة مميزة على قراءة الروايات والفصول', kind: 'READER' },
  { id: 'reader-blazing', name: 'القارئ المتفجر', icon: '🔥', desc: 'قراءة عدد ضخم من الفصول', kind: 'READER' },
  { id: 'commenter-gold', name: 'المعلّق الذهبي', icon: '💬', desc: 'تفاعل مميز ومستمر بالتعليقات', kind: 'READER' },
  { id: 'critic', name: 'الناقد المعتمد', icon: '⭐', desc: 'مراجعات وتقييمات عالية الجودة', kind: 'READER' },
  { id: 'season-hero', name: 'بطل الموسم', icon: '🏆', desc: 'الأكثر نشاطاً وتفاعلاً هذا الموسم', kind: 'READER' },
  // Translator achievements
  { id: 'translator-month', name: 'مترجم الشهر', icon: '🥇', desc: 'أفضل مترجم للشهر الحالي', kind: 'TRANSLATOR' },
  { id: 'fast-publisher', name: 'الناشر السريع', icon: '⚡', desc: 'وتيرة نشر فصول شهرية غزيرة', kind: 'TRANSLATOR' },
  { id: 'expert-translator', name: 'المترجم الخبير', icon: '🎖️', desc: 'ترجمة عدة روايات بجودة عالية', kind: 'TRANSLATOR' },
  { id: 'platform-pillar', name: 'عمود المنصة', icon: '👑', desc: 'مساهمة استثنائية في إثراء المنصة', kind: 'TRANSLATOR' }
];

type BadgesMap = { [userId: string]: UserBadge[] };

export const getUserBadges = (userId: string): UserBadge[] => {
  if (!userId) return [];
  const map = BerryDatabase.get<BadgesMap>('user_badges', {});
  const list = map && typeof map === 'object' ? map[userId] : undefined;
  return Array.isArray(list) ? list : [];
};

// Owner-only operations (the admin panel is already gated to the owner).
export const grantBadge = (userId: string, badgeId: string): boolean => {
  const spec = BADGE_CATALOG.find((b) => b.id === badgeId);
  if (!spec || !userId) return false;
  const map = BerryDatabase.get<BadgesMap>('user_badges', {});
  const existing = Array.isArray(map[userId]) ? map[userId] : [];
  if (existing.some((b) => b.id === badgeId)) return false; // already granted
  const updated: BadgesMap = {
    ...map,
    [userId]: [...existing, { ...spec, grantedAt: new Date().toISOString() }]
  };
  return BerryDatabase.set('user_badges', updated);
};

export const revokeBadge = (userId: string, badgeId: string): boolean => {
  const map = BerryDatabase.get<BadgesMap>('user_badges', {});
  const existing = Array.isArray(map[userId]) ? map[userId] : [];
  const filtered = existing.filter((b) => b.id !== badgeId);
  if (filtered.length === existing.length) return false;
  const updated: BadgesMap = { ...map, [userId]: filtered };
  return BerryDatabase.set('user_badges', updated);
};
