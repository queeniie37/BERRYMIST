import { BerryDatabase } from '../data';
import { User } from '../types';

// Public member directory synced through the shared database so the owner's
// admin panel can list every subscriber with their reading stats. Accounts
// themselves (users_db) stay private per-device — this directory carries only
// displayable info: no email, no credentials.
export interface DirectoryEntry {
  id: string;
  username: string;
  avatar: string;
  role: string;
  joinedAt: string;
  novelsRead: number;
  chaptersRead: number;
  lastSeen: string;
}

export type UserDirectory = { [userId: string]: DirectoryEntry };

// Each member's own device publishes/refreshes their entry (on login and as
// their reading history grows). Writes only happen when something meaningful
// changed, so the 4-second sync poll doesn't cause write loops.
export const upsertSelfInDirectory = (user: User): void => {
  if (!user || !user.id || user.role === 'GUEST') return;

  const dir = BerryDatabase.get<UserDirectory>('user_directory', {});
  // read_chapters logs every chapter each user finished (one row per
  // chapter), unlike reading_history which keeps only the latest position
  // per novel — so it gives the owner accurate reading totals.
  const readLog = BerryDatabase.get<any[]>('read_chapters', []).filter(
    (rc) => rc && rc.userId === user.id
  );
  const novelsRead = new Set(readLog.map((rc) => rc.novelId).filter(Boolean)).size;
  const chaptersRead = readLog.length;

  const prev = dir && typeof dir === 'object' ? dir[user.id] : undefined;
  const changed =
    !prev ||
    prev.username !== user.username ||
    prev.avatar !== user.avatar ||
    prev.role !== user.role ||
    prev.novelsRead !== novelsRead ||
    prev.chaptersRead !== chaptersRead;
  if (!changed) return;

  const entry: DirectoryEntry = {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    joinedAt: prev?.joinedAt || new Date().toISOString(),
    novelsRead,
    chaptersRead,
    lastSeen: new Date().toISOString()
  };
  BerryDatabase.set('user_directory', { ...dir, [user.id]: entry });
};
