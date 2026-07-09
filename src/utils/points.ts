import { BerryDatabase } from '../data';
import { Novel, Chapter, User } from '../types';

export interface TranslatorPointsInfo {
  translatorId: string;
  translatorName: string;
  avatar: string;
  viewsThisMonth: number;
  pointsThisMonth: number;
  viewsHistory: { month: string; views: number; points: number }[];
}

export const getCurrentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const getChapterMonthKey = (chap: Chapter): string => {
  const dateStr = chap.publishAt || chap.createdAt;
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

export const getTranslatorPoints = (userId: string, username: string): TranslatorPointsInfo => {
  const allNovels = BerryDatabase.get<Novel[]>('novels', []);
  const allChapters = BerryDatabase.get<Chapter[]>('chapters', []);
  const usersDb = BerryDatabase.get<User[]>('users_db', []);
  const targetUser = usersDb.find(u => u.id === userId) || usersDb.find(u => u.username === username);
  const avatar = targetUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150';

  // Find all novels translated by this user
  const translatorNovels = allNovels.filter(n => n.translatorId === userId || n.translatorName === username);
  const novelIdsSet = new Set(translatorNovels.map(n => n.id));

  // Find all chapters of these novels
  const translatorChapters = allChapters.filter(c => novelIdsSet.has(c.novelId));

  const viewsByMonth: Record<string, number> = {};

  translatorChapters.forEach(chap => {
    const monthKey = getChapterMonthKey(chap);
    if (!monthKey) return;
    const views = chap.views || 0;
    viewsByMonth[monthKey] = (viewsByMonth[monthKey] || 0) + views;
  });

  const currentMonthKey = getCurrentMonthKey();
  const viewsThisMonth = viewsByMonth[currentMonthKey] || 0;
  const pointsThisMonth = Math.floor(viewsThisMonth / 10);

  // Build history (excluding current month, sorted descending)
  const viewsHistory = Object.keys(viewsByMonth)
    .filter(m => m !== currentMonthKey)
    .sort((a, b) => b.localeCompare(a))
    .map(m => ({
      month: m,
      views: viewsByMonth[m],
      points: Math.floor(viewsByMonth[m] / 10)
    }));

  return {
    translatorId: userId,
    translatorName: username,
    avatar,
    viewsThisMonth,
    pointsThisMonth,
    viewsHistory
  };
};

export const getAllTranslatorsPoints = (): TranslatorPointsInfo[] => {
  const usersDb = BerryDatabase.get<User[]>('users_db', []);
  const allNovels = BerryDatabase.get<Novel[]>('novels', []);

  // Get all users who have the role TRANSLATOR, WRITER, or OWNER, or who translate at least one novel
  const translatorsSet = new Set<string>();
  const translatorsList: { id: string; username: string }[] = [];

  usersDb.forEach(u => {
    if (u.role === 'TRANSLATOR' || u.role === 'WRITER' || u.role === 'OWNER') {
      if (!translatorsSet.has(u.id)) {
        translatorsSet.add(u.id);
        translatorsList.push({ id: u.id, username: u.username });
      }
    }
  });

  allNovels.forEach(n => {
    if (n.translatorId && !translatorsSet.has(n.translatorId)) {
      translatorsSet.add(n.translatorId);
      translatorsList.push({ id: n.translatorId, username: n.translatorName });
    }
  });

  return translatorsList.map(t => getTranslatorPoints(t.id, t.username));
};

export const getCrownedTranslatorId = (): string => {
  return BerryDatabase.get<string>('translator_of_the_month_id', '');
};

export const crownTranslator = (userId: string): void => {
  BerryDatabase.set('translator_of_the_month_id', userId);
};

export const isUserTranslatorOfTheMonth = (username: string): boolean => {
  const usersDb = BerryDatabase.get<any[]>('users_db', []);
  const crownedId = getCrownedTranslatorId();
  if (!crownedId) return false;
  const crownedUser = usersDb.find(u => u.id === crownedId);
  return !!(crownedUser && crownedUser.username === username);
};
