export type UserRole = 'GUEST' | 'MEMBER' | 'TRANSLATOR' | 'SUPERVISOR' | 'OWNER' | 'WRITER';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  xp: number;
  level: number;
  avatar: string;
  discord?: string;
  telegram?: string;
  paypalEmail?: string;
  bio?: string;
  customStatus?: string;
}

export type NovelStatus = 'AVAILABLE' | 'RESERVED' | 'TRANSLATING' | 'HIATUS' | 'COMPLETED' | 'ONGOING' | 'PENDING' | 'CANCELLED' | 'PENDING_APPROVAL';

export interface Novel {
  id: string;
  titleAr: string;
  titleEn: string;
  titleOriginal?: string;
  author: string;
  translatorId: string;
  translatorName: string;
  teamId?: string;
  teamName?: string;
  cover: string; // 2:3 Cover Image (Local mock asset or WEBP link)
  banner?: string;
  chaptersCount: number;
  views: number;
  likes: number;
  bookmarksCount: number;
  rating: number;
  ratingCount: number;
  status: NovelStatus;
  language: string; // الكورية، الصينية، اليابانية، إلخ
  genres: string[];
  description: string;
  updatesLink?: string;
  createdAt: string;
  downloadAllowed?: boolean; // Managed by Owner
}

export interface Chapter {
  id: string;
  novelId: string;
  number: number;
  title: string;
  content: string; // Text containing multiple paragraphs
  views: number;
  createdAt: string;
  isDraft: boolean;
  publishAt?: string; // Scheduled datetime ISO string
}

export interface ChapterRevision {
  id: string;
  chapterId: string;
  novelId: string;
  number: number;
  title: string;
  content: string;
  modifiedAt: string;
  wordsCount: number;
}

export interface Suggestion {
  id: string;
  titleAr: string;
  titleEn: string;
  originalLink?: string;
  novelUpdatesLink?: string;
  cover: string;
  genres: string[];
  description: string;
  suggestedBy: string; // username
  suggestedById: string;
  votes: number;
  votedUsers: string[]; // User IDs
  status: 'PENDING' | 'ACCEPTED' | 'TRANSLATING' | 'RESERVED' | 'REJECTED';
  createdAt: string;
  reason?: string; // In case of rejection or approval note
}

export interface Reservation {
  id: string;
  novelId: string;
  novelTitle: string;
  translatorId: string;
  translatorName: string;
  startAt: string; // ISO string
  endAt: string; // ISO string (e.g., 30 days from start)
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  extensionRequested: boolean;
  extensionReason?: string;
  cancelledReason?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'SYSTEM' | 'CHAPTER' | 'COMMENT' | 'SUPPORT' | 'RESERVATION' | 'ROLE';
  isRead: boolean;
  createdAt: string;
  novelId?: string;
  chapterId?: string;
}

export interface CommentReply {
  id: string;
  authorName: string;
  authorAvatar?: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  refId: string; // novelId or chapterId
  refType: 'NOVEL' | 'CHAPTER';
  authorName: string;
  authorAvatar?: string;
  authorRole: UserRole;
  content: string;
  likes: number;
  likedBy: string[]; // User IDs
  replies: CommentReply[];
  createdAt: string;
}

export interface Review {
  id: string;
  novelId: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  pros: string;
  cons: string;
  verdict: string;
  recommend: boolean;
  likes: number;
  likedBy: string[]; // User IDs
  createdAt: string;
}

export interface Report {
  id: string;
  type: 'NOVEL' | 'CHAPTER' | 'COMMENT';
  targetId: string;
  targetName: string; // e.g. Name of Novel, Title of Chapter or excerpt of comment
  reason: string;
  details?: string;
  reportedBy: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
}

export interface TranslatorRequest {
  id: string;
  username: string;
  email: string;
  discord?: string;
  telegram?: string;
  experience: string;
  languages: string[];
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface News {
  id: string;
  title: string;
  content?: string;
  icon: string; // lucide icon name or emoji
  color: string; // hex or tailwind text class
  link?: string;
  novelId?: string;
  chapterId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  banner?: string;
  bio: string;
  members: { username: string; role: string; avatar: string }[];
  novelsCount: number;
  createdAt: string;
}

export interface Ad {
  id: string;
  title: string;
  image: string; // URL or Base64 data
  content: string; // Details/Information about the ad
  showInTicker: boolean; // Option to show in moving ticker bar
  createdAt: string;
}

