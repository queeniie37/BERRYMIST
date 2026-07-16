import React, { useState, useEffect, useRef } from 'react';
import { Star, Eye, Layers, Heart, Share2, Plus, Calendar, Clock, ChevronDown, MessageSquare, Edit2, AlertCircle, Trash2, Upload, Image, ArrowUp, ArrowDown, FileText, ChevronLeft, Undo2, Redo2, BookOpen, Info } from 'lucide-react';
import { Novel, Chapter, Comment, Review, User, UserRole, Report, Suggestion } from '../types';
import { BerryDatabase } from '../data';
import { compressImageFile } from '../utils/media';
import { normalizeChapterText } from '../utils/text';
import { isUserTranslatorOfTheMonth } from '../utils/points';
import ConfirmModal from './ConfirmModal';

function sanitizeChapterHtml(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Restore simple formatting tags
  let restored = escaped.replace(/&lt;(\/?)(b|i|u)&gt;/gi, '<$1$2>');
  
  // Restore img tags (backwards compatibility)
  restored = restored.replace(/&lt;img\s+src="([^"]+)"\s*(?:\/)?&gt;/gi, (match, src) => {
    return `<img src="${src}" class="max-h-[750px] w-full max-w-[700px] my-6 mx-auto rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.6)] border border-white/10 block object-contain bg-black/30 p-1.5 transition-all duration-300 hover:border-violet-500/40 hover:scale-[1.01]" />`;
  });
  
  // Restore (PNG, JPG: base64) tags
  restored = restored.replace(/\(PNG,\s*JPG:\s*([^\s)]+)\)/gi, (match, src) => {
    return `<img src="${src}" class="max-h-[750px] w-full max-w-[700px] my-6 mx-auto rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.6)] border border-white/10 block object-contain bg-black/30 p-1.5 transition-all duration-300 hover:border-violet-500/40 hover:scale-[1.01]" />`;
  });
  
  return restored;
}

function extractImagesFromContent(text: string): string[] {
  const urls: string[] = [];
  
  // Extract from <img> (backwards compatibility)
  const imgRegex = /<img\s+src="([^"]+)"\s*(?:\/)?\s*>/gi;
  let match;
  while ((match = imgRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  
  // Extract from (PNG, JPG: ...)
  const customRegex = /\(PNG,\s*JPG:\s*([^\s)]+)\)/gi;
  while ((match = customRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  
  return urls;
}

interface NovelDetailsProps {
  novelId: string;
  currentUser: User;
  onBack: () => void;
  onReadChapter: (novelId: string, chapterNumber: number) => void;
  isBookmarked: boolean;
  onBookmarkToggle: (novelId: string) => void;
  autoOpenAddChapter?: boolean;
}

export default function NovelDetails({ novelId, currentUser, onBack, onReadChapter, isBookmarked, onBookmarkToggle, autoOpenAddChapter }: NovelDetailsProps) {
  const [activeTab, setActiveTab] = useState<'chapters' | 'comments'>('chapters');
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [readChapters, setReadChapters] = useState<any[]>([]);
  // Chapter list ordering: true = ascending (1 → N), false = descending (N → 1)
  // Chapter list order: newest chapter first by default whenever a novel is
  // opened; the toolbar toggle can flip it to oldest-first per visit.
  const [chaptersAscending, setChaptersAscending] = useState(false);
  
  // Claim state variables
  const [timeRemaining, setTimeRemaining] = useState('');
  const [reservation, setReservation] = useState<any | null>(null);

  // New commenting state
  const [commentText, setCommentText] = useState('');
  const [replyTexts, setReplyTexts] = useState<{ [commentId: string]: string }>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<Comment | null>(null);
  const [reportReason, setReportReason] = useState('محتوى مسيء / غير لائق');
  const [reportDetails, setReportDetails] = useState('');
  const [isSpoilerComment, setIsSpoilerComment] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<string[]>([]);

  // Deletion double confirmation modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: true
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void, danger = true) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm,
      danger
    });
  };

  // Add chapter simulator state
  const [showAddChapterForm, setShowAddChapterForm] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [newChapterImages, setNewChapterImages] = useState('');
  const [newChapterPublishAt, setNewChapterPublishAt] = useState('');
  const [newChapterNumber, setNewChapterNumber] = useState<string | number>('');
  const [publishTimeType, setPublishTimeType] = useState<'now' | 'schedule'>('now');
  const [contentHistory, setContentHistory] = useState<string[]>(['']);
  const [historyIdx, setHistoryIdx] = useState(0);

  const getMaxScheduleDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2); // 2 months from now
    const year = maxDate.getFullYear();
    const month = String(maxDate.getMonth() + 1).padStart(2, '0');
    const day = String(maxDate.getDate()).padStart(2, '0');
    const hours = String(maxDate.getHours()).padStart(2, '0');
    const minutes = String(maxDate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getMinScheduleDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef('');

  // Opening the add-chapter page always starts from the top (the trigger
  // button sits far down the novel page, so without this the form opened
  // at the previous scroll position).
  useEffect(() => {
    if (showAddChapterForm) {
      window.scrollTo(0, 0);
    }
  }, [showAddChapterForm]);

  useEffect(() => {
    if (showAddChapterForm) {
      if (editorRef.current && newChapterContent !== lastHtmlRef.current) {
        editorRef.current.innerHTML = newChapterContent;
        lastHtmlRef.current = newChapterContent;
      }
    }
  }, [showAddChapterForm, newChapterContent]);

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    lastHtmlRef.current = html;
    handleContentChange(html);
  };

  // Load everything on mount/id change
  useEffect(() => {
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const foundNovel = allNovels.find(n => n.id === novelId);
    if (foundNovel) {
      setNovel(foundNovel);
    }

    const allChapters = BerryDatabase.get<Chapter[]>('chapters', []);
    let foundChapters = allChapters.filter(c => c.novelId === novelId).sort((a, b) => a.number - b.number);

    // Scheduled (future publishAt) chapters never show in the novel's
    // chapter list — not even for the owner/translator. Until their publish
    // time arrives they live exclusively in the Activity & Scheduling page
    // of the translator panel.
    foundChapters = foundChapters.filter(c => !c.publishAt || new Date(c.publishAt) <= new Date());
    setChapters(foundChapters);
    setNewChapterNumber('');
    // Entering a novel always starts with the newest chapters on top
    setChaptersAscending(false);

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const foundComments = allComments.filter(c => c.refId === novelId || foundChapters.some(ch => ch.id === c.refId));
    setComments(foundComments);

    const allRead = BerryDatabase.get<any[]>('read_chapters', []);
    const myRead = allRead.filter(rc => rc.userId === (currentUser?.id || 'guest'));
    setReadChapters(myRead);

    const allReservations = BerryDatabase.get<any[]>('reservations', []);
    const activeRes = allReservations.find(r => r.novelId === novelId && r.status === 'ACTIVE');
    setReservation(activeRes || null);

  }, [novelId]);

  // Live-refresh the chapter list: picks up chapters synced from the server
  // AND makes a scheduled chapter appear for readers the moment its publish
  // time arrives (checked every 15s), without re-opening the page.
  useEffect(() => {
    const refreshChapters = () => {
      // If the novel itself wasn't in the local cache when the page opened
      // (direct link / first visit before the first server sync), pick it up
      // now instead of leaving the page blank.
      const allNovels = BerryDatabase.get<Novel[]>('novels', []);
      const foundNovel = allNovels.find(n => n.id === novelId);
      if (foundNovel) {
        setNovel(prev => prev ?? foundNovel);
      }

      const allChapters = BerryDatabase.get<Chapter[]>('chapters', []);
      let list = allChapters.filter(c => c.novelId === novelId).sort((a, b) => a.number - b.number);
      // Scheduled chapters are hidden from the chapter list for everyone
      // (owner and translator included) until their publish time arrives.
      list = list.filter(c => !c.publishAt || new Date(c.publishAt) <= new Date());
      setChapters(prev => {
        // Avoid re-render churn when nothing actually changed
        if (prev.length === list.length && prev.every((p, i) => p.id === list[i].id && p.title === list[i].title)) return prev;
        return list;
      });
    };
    window.addEventListener('chapters-updated', refreshChapters);
    window.addEventListener('novels-updated', refreshChapters);
    const timer = setInterval(refreshChapters, 15000);
    return () => {
      window.removeEventListener('chapters-updated', refreshChapters);
      window.removeEventListener('novels-updated', refreshChapters);
      clearInterval(timer);
    };
  }, [novelId, currentUser]);

  // Live-refresh comments pulled by the background server sync so every
  // visitor (guest, reader, translator, owner) sees all comments without
  // needing to re-open the page.
  useEffect(() => {
    const refresh = () => {
      const allComments = BerryDatabase.get<Comment[]>('comments', []);
      setComments(allComments.filter(c => c.refId === novelId || chapters.some(ch => ch.id === c.refId)));
    };
    window.addEventListener('comments-updated', refresh);
    return () => window.removeEventListener('comments-updated', refresh);
  }, [novelId, chapters]);

  useEffect(() => {
    if (autoOpenAddChapter) {
      setActiveTab('chapters');
      setShowAddChapterForm(true);
    }
  }, [autoOpenAddChapter]);

  // Reservation Live Countdown Timer (Updates every second!)
  useEffect(() => {
    if (!reservation) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(reservation.endAt).getTime();
      const distance = end - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeRemaining('انتهت مدة الحجز لعدم النشر');
        
        // Handle auto release in database
        const allReservations = BerryDatabase.get<any[]>('reservations', []);
        const updatedRes = allReservations.map(r => r.id === reservation.id ? { ...r, status: 'EXPIRED' } : r);
        BerryDatabase.set('reservations', updatedRes);

        const allNovels = BerryDatabase.get<Novel[]>('novels', []);
        const updatedNovels = allNovels.map(n => n.id === novelId ? { ...n, status: 'AVAILABLE' as const, translatorId: '', translatorName: '' } : n);
        BerryDatabase.set('novels', updatedNovels);

        setReservation(null);
        if (novel) setNovel({ ...novel, status: 'AVAILABLE', translatorId: '', translatorName: '' });
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setTimeRemaining(`يتبقّى: ${days} يوماً · ${hours} ساعة · ${minutes} دقيقة · ${seconds} ثانية`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation, novel]);

  if (!novel) return null;

  const checkCanReserve = () => {
    if (currentUser.role === 'OWNER') return { allowed: true };

    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const novelChapters = allChapters.filter(c => c.novelId === novel.id);

    // If it has chapters, it means it has been uploaded/published
    if (novelChapters.length > 0) {
      // It can only be reserved if it has been stopped for 6 months!
      const sortedChapters = [...novelChapters].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastChapter = sortedChapters[0];
      const lastChapterDate = new Date(lastChapter.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastChapterDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 180) { // 6 months is approx 180 days
        return { allowed: true, reason: 'رواية متوقفة لأكثر من 6 أشهر' };
      } else {
        return { 
          allowed: false, 
          reason: `هذه الرواية نشطة وتم تنزيل فصول لها مؤخراً (منذ ${diffDays} يوم). لا يمكن حجز الروايات التي تم تنزيلها أبداً إلا إذا توقفت تماماً لمدة 6 أشهر.` 
        };
      }
    }

    // If it has 0 chapters, it can be reserved ONLY if it is in the suggestions ("اقتراح رواية") list!
    const allSuggestions = BerryDatabase.get<Suggestion[]>('suggestions', []);
    const hasSuggestion = allSuggestions.some(s => s.titleAr === novel.titleAr || s.titleEn === novel.titleEn);
    
    if (hasSuggestion) {
      return { allowed: true, reason: 'رواية مقترحة' };
    } else {
      return { 
        allowed: false, 
        reason: 'لا يمكن حجز هذه الرواية؛ فقط الروايات في "اقتراح رواية" أو الروايات التي توقفت فصولها لمدة 6 أشهر يمكن حجزها.' 
      };
    }
  };

  // Claim/Reservation action handler
  const handleClaimNovel = () => {
    if (currentUser.role === 'GUEST') {
      alert('يجب تسجيل الدخول أولاً لتتمكن من حجز الرواية للترجمة. 🍇');
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }

    const check = checkCanReserve();
    if (!check.allowed) {
      alert(check.reason);
      return;
    }

    const startAt = new Date();
    const endAt = new Date();
    endAt.setDate(startAt.getDate() + 30); // 30 Days reservation limit

    const newRes = {
      id: `res-${Date.now()}`,
      novelId: novel.id,
      novelTitle: novel.titleAr,
      translatorId: currentUser.id,
      translatorName: currentUser.username,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: 'ACTIVE' as const,
      extensionRequested: false
    };

    // Update database
    const allReservations = BerryDatabase.get<any[]>('reservations', []);
    BerryDatabase.set('reservations', [...allReservations, newRes]);

    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const updatedNovels = allNovels.map(n => n.id === novel.id ? { 
      ...n, 
      status: 'RESERVED' as const, 
      translatorId: currentUser.id, 
      translatorName: currentUser.username 
    } : n);
    BerryDatabase.set('novels', updatedNovels);

    setReservation(newRes);
    setNovel({ 
      ...novel, 
      status: 'RESERVED', 
      translatorId: currentUser.id, 
      translatorName: currentUser.username 
    });

    // Notify translator
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-${Date.now()}`,
      userId: currentUser.id,
      title: 'تم حجز الرواية بنجاح!',
      message: `لقد قمت بحجز الرواية "${novel.titleAr}" بنجاح. يرجى نشر الفصل الأول خلال 30 يوماً لتأكيد ملكية الترجمة.`,
      type: 'RESERVATION',
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
  };

  // Add Comment Handler
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'GUEST') {
      alert('يجب تسجيل الدخول أولاً لتتمكن من كتابة التعليقات. 🍇');
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }
    if (commentText.trim() === '') return;

    // Random suffix: Date.now() alone collides when the same member posts
    // several comments quickly, making later comments seem to never appear.
    const createdAt = new Date().toISOString();
    const newComment: Comment = {
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      refId: novel.id,
      refType: 'NOVEL',
      authorName: currentUser.username,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      content: commentText,
      likes: 0,
      likedBy: [],
      replies: [],
      createdAt,
      updatedAt: createdAt,
      isSpoiler: isSpoilerComment
    };

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = [newComment, ...allComments];
    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === novel.id || chapters.some(ch => ch.id === c.refId)));
    setCommentText('');
    setIsSpoilerComment(false);
  };

  // Like comment handler
  const handleLikeComment = (commentId: string) => {
    if (currentUser.role === 'GUEST') {
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }
    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = allComments.map(c => {
      if (c.id === commentId) {
        const isLiked = c.likedBy.includes(currentUser.id);
        const likedBy = isLiked ? c.likedBy.filter(id => id !== currentUser.id) : [...c.likedBy, currentUser.id];
        return { ...c, likes: isLiked ? c.likes - 1 : c.likes + 1, likedBy, updatedAt: new Date().toISOString() };
      }
      return c;
    });
    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === novel.id || chapters.some(ch => ch.id === c.refId)));
  };

  // Reply to comment handler
  const handleAddReply = (commentId: string) => {
    const text = replyTexts[commentId];
    if (!text || text.trim() === '') return;
    if (currentUser.role === 'GUEST') return;

    const newReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorName: currentUser.username,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      content: text,
      createdAt: new Date().toISOString()
    };

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = allComments.map(c => {
      if (c.id === commentId) {
        return { ...c, replies: [...(c.replies || []), newReply], updatedAt: new Date().toISOString() };
      }
      return c;
    });

    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === novel.id || chapters.some(ch => ch.id === c.refId)));
    setReplyTexts({ ...replyTexts, [commentId]: '' });
    setActiveReplyId(null);
  };

  // Report offensive comment handler
  const handleReportComment = (comment: Comment) => {
    setReportingComment(comment);
    setReportReason('محتوى مسيء / غير لائق');
    setReportDetails('');
  };

  const submitReport = () => {
    if (!reportingComment) return;

    // Resolve Novel & Chapter names
    let novelTitle = novel?.titleAr || '';
    let chapterNumStr = '';

    const allChapters = BerryDatabase.get<Chapter[]>('chapters', []);
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);

    if (reportingComment.refType === 'CHAPTER') {
      const ch = allChapters.find(c => c.id === reportingComment.refId);
      if (ch) {
        chapterNumStr = `الفصل ${ch.number}`;
        const n = allNovels.find(nv => nv.id === ch.novelId);
        if (n) {
          novelTitle = n.titleAr;
        }
      }
    } else {
      const n = allNovels.find(nv => nv.id === reportingComment.refId);
      if (n) {
        novelTitle = n.titleAr;
      }
    }

    const newReport: Report = {
      id: 'report-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'COMMENT',
      targetId: reportingComment.id,
      targetName: `${reportingComment.authorName}: ${reportingComment.content}`,
      reason: reportReason,
      details: `رواية: ${novelTitle}${chapterNumStr ? ` • ${chapterNumStr}` : ''}${reportDetails ? ` - التفاصيل: ${reportDetails}` : ''}`,
      reportedBy: currentUser.role === 'GUEST' ? 'زائر' : currentUser.username,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    const reports = BerryDatabase.get<Report[]>('reports', []);
    BerryDatabase.set('reports', [...reports, newReport]);

    // Send a system notification immediately to the Owner
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const usersDb = BerryDatabase.get<any[]>('users_db', []);
    // Find all owner users
    const owners = usersDb.filter(u => u && (u.role === 'OWNER' || u.email?.toLowerCase() === 'berrymist11@gmail.com'));
    const ownerIds = owners.map(u => u.id);
    if (ownerIds.length === 0) ownerIds.push('berrymist-owner'); // Fallback

    const newOwnerNotifs = ownerIds.map(oId => ({
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: oId,
      title: '🚨 بلاغ جديد عن تعليق مسيء!',
      message: `قام ${newReport.reportedBy} بالإبلاغ عن تعليق مسيء في ${newReport.details}. محتوى التعليق: "${reportingComment.content}"`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: 'الآن'
    }));

    BerryDatabase.set('notifications', [...allNotifs, ...newOwnerNotifs]);

    alert('تم إرسال البلاغ لمالك المنصة بنجاح وسيتم اتخاذ الإجراء المناسب فوراً.');
    setReportingComment(null);
    setReportDetails('');
  };

  // Delete comment handler for Owner
  const handleDeleteComment = (commentId: string) => {
    if (currentUser.role !== 'OWNER' && currentUser.email?.toLowerCase() !== 'berrymist11@gmail.com') {
      alert('عذراً، هذه الصلاحية مخصصة لمالك الموقع فقط!');
      return;
    }

    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التعليق نهائياً؟')) {
      return;
    }

    // Tombstone-delete so the removal propagates to every device instead of
    // being resurrected by the server-side comments merge.
    BerryDatabase.deleteComment(commentId);
    const remaining = BerryDatabase.get<Comment[]>('comments', []);
    if (novel) {
      setComments(remaining.filter(c => c.refId === novel.id || chapters.some(ch => ch.id === c.refId)));
    }
    alert('تم حذف التعليق بنجاح.');
  };

  // Helper to apply HTML tags for rich text
  const applyFormat = (tag: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const command = tag === 'b' ? 'bold' : tag === 'i' ? 'italic' : tag === 'u' ? 'underline' : tag;
      document.execCommand(command, false);
      const html = editorRef.current.innerHTML;
      lastHtmlRef.current = html;
      handleContentChange(html);
    }
  };

  const handleContentChange = (val: string) => {
    setNewChapterContent(val);
    if (val !== contentHistory[historyIdx]) {
      const nextHistory = contentHistory.slice(0, historyIdx + 1);
      nextHistory.push(val);
      setContentHistory(nextHistory);
      setHistoryIdx(nextHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      const prevIdx = historyIdx - 1;
      setHistoryIdx(prevIdx);
      setNewChapterContent(contentHistory[prevIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIdx < contentHistory.length - 1) {
      const nextIdx = historyIdx + 1;
      setHistoryIdx(nextIdx);
      setNewChapterContent(contentHistory[nextIdx]);
    }
  };

  const insertTextAtCursor = (textToInsert: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, textToInsert);
      const html = editorRef.current.innerHTML;
      lastHtmlRef.current = html;
      handleContentChange(html);
    }
  };

  // Convert uploaded PNG/images to Base64 data urls and insert them immediately in the text content at cursor
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملفات صور فقط (PNG, JPG, JPEG, GIF)');
        return;
      }
      
      compressImageFile(file, 1000)
        .then((base64String) => {
          // Insert clean standard <img> tag at cursor
          const imgTag = `<img src="${base64String}" />`;
          insertTextAtCursor(imgTag);
        })
        .catch(() => alert('تعذر معالجة الصورة. جرب صورة أصغر حجماً.'));
    });
  };

  // Translator: Create Chapter handler
  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!novel) {
      alert('عذراً، يجب اختيار الرواية أولاً!');
      return;
    }
    if (newChapterNumber === '') {
      alert('عذراً، يجب تعبئة رقم الفصل!');
      return;
    }
    const parsedChNum = Number(newChapterNumber);
    if (isNaN(parsedChNum) || parsedChNum <= 0) {
      alert('عذراً، يجب أن يكون رقم الفصل عدداً صحيحاً أكبر من 0!');
      return;
    }
    if (!newChapterTitle.trim()) {
      alert('عذراً، يجب تعبئة عنوان الفصل!');
      return;
    }
    if (!newChapterContent.trim() || newChapterContent.trim() === '<p><br></p>' || newChapterContent.trim() === '<br>') {
      alert('عذراً، يجب تعبئة محتوى الفصل!');
      return;
    }

    if (newChapterPublishAt) {
      const publishDate = new Date(newChapterPublishAt);
      const now = new Date();
      if (publishDate < now) {
        alert('عذراً، لا يمكنك جدولة الفصل في وقت سابق للوقت الحالي!');
        return;
      }
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 2); // 2 months from now
      if (publishDate > maxDate) {
        alert('عذراً، لا يمكنك جدولة الفصل لأكثر من شهرين (60 يوماً) مستقبلاً!');
        return;
      }
    }

    const newChapterNum = Number(newChapterNumber);
    const imgUrls = extractImagesFromContent(newChapterContent);

    const isScheduled = newChapterPublishAt ? new Date(newChapterPublishAt) > new Date() : false;

    const newChap: Chapter = {
      id: `${novel.id}-chap-${newChapterNum}-${Date.now()}`,
      novelId: novel.id,
      number: newChapterNum,
      chapterNumber: newChapterNum,
      title: `الفصل ${newChapterNum}: ${newChapterTitle}`,
      content: normalizeChapterText(newChapterContent),
      views: 0,
      createdAt: new Date().toISOString(),
      isDraft: isScheduled,
      publishAt: newChapterPublishAt || undefined,
      images: imgUrls.length > 0 ? imgUrls : undefined
    } as any;

    // Update database
    const allChapters = BerryDatabase.get<Chapter[]>('chapters', []);
    const updatedChaps = [...allChapters, newChap];
    BerryDatabase.set('chapters', updatedChaps);
    const novelChaps = updatedChaps.filter(c => c.novelId === novel.id).sort((a, b) => a.number - b.number);
    setChapters(novelChaps);
    setNewChapterNumber('');

    // If this novel was in a reserved state and this is Chapter 1, promote status to TRANSLATING
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    let newStatus = novel.status;
    let updatedReservations = BerryDatabase.get<any[]>('reservations', []);
    
    if (novel.status === 'RESERVED' && novel.translatorId === currentUser.id) {
      newStatus = 'TRANSLATING';
      // Mark reservation as completed
      updatedReservations = updatedReservations.map(r => 
        (r.novelId === novel.id && r.status === 'ACTIVE') ? { ...r, status: 'COMPLETED' } : r
      );
      BerryDatabase.set('reservations', updatedReservations);
      setReservation(null);
    }

    const updatedNovels = allNovels.map(n => n.id === novel.id ? { 
      ...n, 
      chaptersCount: n.chaptersCount + 1,
      status: newStatus 
    } : n);
    BerryDatabase.set('novels', updatedNovels);
    setNovel({ ...novel, chaptersCount: novel.chaptersCount + 1, status: newStatus });

    // Scheduled chapters stay private until their publish time: no public
    // "new chapter" announcement now — checkScheduledChapters() sends it when
    // the scheduled date/time actually arrives. The creator only gets a
    // private confirmation that the chapter is scheduled.
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = isScheduled
      ? {
          id: `notif-${Date.now()}`,
          userId: currentUser.id,
          title: '📅 تمت جدولة الفصل بنجاح',
          message: `تمت جدولة الفصل ${newChapterNum} من رواية "${novel.titleAr}" وسيُنشر تلقائياً للقراء في ${new Date(newChapterPublishAt).toLocaleString('ar-EG', { numberingSystem: 'latn' })}. يظهر الآن في صفحة الأنشطة والجدولة كمجدول للنشر.`,
          type: 'CHAPTER' as const,
          isRead: false,
          createdAt: 'الآن',
          novelId: novel.id,
          chapterId: newChap.id
        }
      : {
          id: `notif-${Date.now()}`,
          userId: currentUser.id,
          title: 'فصل جديد صدر!',
          message: `تم نشر الفصل ${newChapterNum} من رواية "${novel.titleAr}" بنجاح.`,
          type: 'CHAPTER' as const,
          isRead: false,
          createdAt: 'الآن',
          novelId: novel.id,
          chapterId: newChap.id
        };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);

    if (isScheduled) {
      alert(`📅 تمت جدولة الفصل ${newChapterNum} بنجاح! لن يظهر للقراء إلا في ${new Date(newChapterPublishAt).toLocaleString('ar-EG', { numberingSystem: 'latn' })}، ويمكنك متابعته من صفحة الأنشطة والجدولة.`);
    } else {
      alert(`تم نشر الفصل ${newChapterNum} بنجاح وهو متاح الآن لجميع القراء! 🎉`);
    }

    setShowAddChapterForm(false);
    setNewChapterTitle('');
    setNewChapterContent('');
    setNewChapterImages('');
    setNewChapterPublishAt('');
    setNewChapterNumber('');
  };

  const isOwner = currentUser.role === 'OWNER' || currentUser.email?.toLowerCase() === 'berrymist11@gmail.com';
  const isTranslatorOrOwner = isOwner || (novel && novel.translatorId === currentUser.id);

  const handleDeleteNovel = () => {
    if (!novel) return;

    showConfirm(
      'حذف الرواية نهائياً ⚠️ (تأكيد 1/2)',
      `هل أنت متأكد تماماً وبشكل قاطع من رغبتك في حذف رواية "${novel.titleAr}" نهائياً من الموقع بالكامل مع جميع الفصول والتعليقات الخاصة بها؟`,
      () => {
        setTimeout(() => {
          showConfirm(
            'حذف الرواية نهائياً ⚠️ (تأكيد نهائي 2/2)',
            `تأكيد أخير ومؤكد: هل أنت متأكد تماماً من حذف رواية "${novel.titleAr}" وكافة فصولها وتعليقاتها وبياناتها للأبد؟ لا يمكن التراجع عن هذا الإجراء تحت أي ظرف!`,
            () => {
              const allNovels = BerryDatabase.get<Novel[]>('novels', []);
              const updatedNovels = allNovels.filter(n => n.id !== novel.id);
              BerryDatabase.set('novels', updatedNovels);

              const allChapters = BerryDatabase.get<any[]>('chapters', []);
              const deletedChaptersList = allChapters.filter(c => c.novelId === novel.id);
              const deletedChapterIds = deletedChaptersList.map(c => c.id);
              const updatedChapters = allChapters.filter(c => c.novelId !== novel.id);
              BerryDatabase.set('chapters', updatedChapters);

              const allReservations = BerryDatabase.get<any[]>('reservations', []);
              const updatedReservations = allReservations.filter(r => r.novelId !== novel.id);
              BerryDatabase.set('reservations', updatedReservations);

              // Delete comments associated with novel or its chapters
              const allComments = BerryDatabase.get<any[]>('comments', []);
              const updatedComments = allComments.filter(c => c.refId !== novel.id && !deletedChapterIds.includes(c.refId));
              BerryDatabase.set('comments', updatedComments);

              // Delete reviews
              const allReviews = BerryDatabase.get<any[]>('reviews', []);
              const updatedReviews = allReviews.filter(r => r.novelId !== novel.id);
              BerryDatabase.set('reviews', updatedReviews);

              // Delete bookmarks
              const allBookmarks = BerryDatabase.get<string[]>('bookmarks', []);
              const updatedBookmarks = allBookmarks.filter(id => id !== novel.id);
              BerryDatabase.set('bookmarks', updatedBookmarks);

              // Delete reading history
              const allHistory = BerryDatabase.get<any[]>('reading_history', []);
              const updatedHistory = allHistory.filter(h => h.novelId !== novel.id);
              BerryDatabase.set('reading_history', updatedHistory);

              // Delete from deleted_chapters
              const allDeletedChapters = BerryDatabase.get<any[]>('deleted_chapters', []);
              const updatedDeletedChapters = allDeletedChapters.filter(c => c.novelId !== novel.id);
              BerryDatabase.set('deleted_chapters', updatedDeletedChapters);

              window.dispatchEvent(new Event('novels-updated'));
              alert(`تم حذف الرواية "${novel.titleAr}" بنجاح مع كافة فصولها وبياناتها!`);
              onBack();
            },
            true
          );
        }, 100);
      },
      true
    );
  };

  const handleDeleteChapterByOwner = (chapterId: string, chapterNumber: number) => {
    if (currentUser.role !== 'OWNER' && currentUser.email?.toLowerCase() !== 'berrymist11@gmail.com') {
      alert('عذراً، هذه الصلاحية مخصصة لمالك الموقع فقط!');
      return;
    }

    showConfirm(
      'حذف الفصل نهائياً ⚠️ (تأكيد 1/2)',
      `هل أنت متأكد من رغبتك في حذف الفصل رقم ${chapterNumber}؟ سيتم حذفه بالكامل مع كافة تعليقاته.`,
      () => {
        setTimeout(() => {
          showConfirm(
            'حذف الفصل نهائياً ⚠️ (تأكيد نهائي 2/2)',
            `تأكيد أخير ومؤكد: هل أنت متأكد تماماً وبشكل قاطع من حذف الفصل رقم ${chapterNumber} وكافة تعليقاته نهائياً؟ هذا الإجراء لا يمكن التراجع عنه مطلقاً!`,
            () => {
              // Delete from active chapters
              const allChapters = BerryDatabase.get<any[]>('chapters', []);
              const remainingChapters = allChapters.filter(c => c.id !== chapterId);
              BerryDatabase.set('chapters', remainingChapters);

              // Filter local state
              setChapters(prev => prev.filter(c => c.id !== chapterId));

              // Delete comments associated with this chapter
              const allComments = BerryDatabase.get<any[]>('comments', []);
              const remainingComments = allComments.filter(c => c.refId !== chapterId);
              BerryDatabase.set('comments', remainingComments);

              // Reduce chaptersCount of the novel
              if (novel) {
                const allNovels = BerryDatabase.get<Novel[]>('novels', []);
                const actualCount = remainingChapters.filter(c => c.novelId === novel.id).length;
                const updatedNovels = allNovels.map(n => {
                  if (n.id === novel.id) {
                    return { ...n, chaptersCount: actualCount };
                  }
                  return n;
                });
                BerryDatabase.set('novels', updatedNovels);
                setNovel(prev => prev ? { ...prev, chaptersCount: actualCount } : null);
              }

              alert(`تم حذف الفصل رقم ${chapterNumber} بنجاح مع كافة تعليقاته نهائياً! 🗑️`);
              window.dispatchEvent(new Event('novels-updated'));
            },
            true
          );
        }, 100);
      },
      true
    );
  };

  if (showAddChapterForm && novel) {
    return (
      <form onSubmit={handleCreateChapter} className="w-full text-right pb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Section Title with File Icon and Cancel Button */}
        <div className="flex items-center justify-between mb-8">
          <button 
            type="button"
            onClick={() => setShowAddChapterForm(false)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>✕ إلغاء والعودة للرواية</span>
          </button>
          <div className="flex items-center gap-3 justify-end">
            <h2 className="text-xl font-extrabold text-white text-right">إضافة فصل جديد</h2>
            <div className="p-2.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl">
              <FileText size={20} />
            </div>
          </div>
        </div>

        {/* 1. Novel selector/display */}
        <div className="flex flex-col gap-1.5 text-right w-full mb-4">
          <div className="relative w-full">
            <div className="w-full bg-[#13101E] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 text-xs text-purple-300 text-right flex justify-between items-center select-none cursor-default">
              <ChevronDown size={14} className="text-purple-400" />
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{novel.titleAr}</span>
                <span className="text-purple-400">الرواية</span>
                <BookOpen size={14} className="text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Chapter Number */}
        <div className="flex flex-col gap-1 w-full mb-4 text-right">
          <div className="flex justify-end items-center mb-1 text-[11px] text-purple-400">
            <span>رقم الفصل</span>
          </div>
          <input 
            type="number"
            required
            min="1"
            placeholder="مثال: 5"
            value={newChapterNumber}
            onChange={(e) => setNewChapterNumber(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-[#13101E] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 text-xs text-white text-right outline-none focus:border-violet-500 font-sans placeholder-purple-300/40 font-mono"
          />
        </div>

        {/* 3. Chapter Title */}
        <div className="flex flex-col gap-1 w-full mb-4 relative text-right">
          <div className="flex justify-between items-center mb-1 text-[11px] text-purple-400">
            <span>100 / {newChapterTitle.length}</span>
            <span>عنوان الفصل</span>
          </div>
          <input 
            type="text"
            required
            maxLength={100}
            placeholder="عنوان الفصل"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            className="w-full bg-[#13101E] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 text-xs text-white text-right outline-none focus:border-violet-500 font-sans placeholder-purple-300/40"
          />
        </div>

        {/* 4. Rich Chapter Content Editor */}
        <div className="flex flex-col border border-white/5 hover:border-white/10 bg-[#13101E] rounded-xl overflow-hidden mb-3">
          {/* Editor Toolbar */}
          <div className="flex justify-between items-center px-4 py-3 bg-[#171324] border-b border-white/5 select-none">
            {/* Left toolbar options: Undo/Redo */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUndo}
                className="p-1.5 hover:bg-white/5 rounded-lg text-purple-400 hover:text-white transition-all cursor-pointer"
                title="تراجع"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                className="p-1.5 hover:bg-white/5 rounded-lg text-purple-400 hover:text-white transition-all cursor-pointer"
                title="إعادة"
              >
                <Redo2 size={16} />
              </button>
            </div>

            {/* Right toolbar options: Bold, Italic, Underline, Image */}
            <div className="flex gap-3 items-center font-bold">
              <button
                type="button"
                onClick={() => {
                  document.getElementById('png-uploader')?.click();
                }}
                className="p-1.5 hover:bg-white/5 rounded-lg text-purple-400 hover:text-white transition-all cursor-pointer"
                title="إدراج صور ورسومات"
              >
                <Image size={16} />
              </button>
              <button
                type="button"
                onClick={() => applyFormat('u')}
                className="p-1.5 hover:bg-white/5 rounded-lg text-purple-400 hover:text-white font-bold transition-all cursor-pointer"
                title="خط تحت النص (Underline)"
              >
                <u>U</u>
              </button>
              <button
                type="button"
                onClick={() => applyFormat('i')}
                className="p-1.5 hover:bg-white/5 rounded-lg text-purple-400 hover:text-white italic font-bold transition-all cursor-pointer"
                title="نص مائل (Italic)"
              >
                <i>I</i>
              </button>
              <button
                type="button"
                onClick={() => applyFormat('b')}
                className="p-1.5 hover:bg-white/5 rounded-lg text-purple-400 hover:text-white font-bold transition-all cursor-pointer"
                title="نص عريض (Bold)"
              >
                <b>B</b>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div 
            ref={editorRef}
            id="chapter-content-textarea"
            contentEditable
            onInput={handleEditorInput}
            placeholder="محتوى الفصل"
            className="w-full bg-[#13101E] px-4 py-4 text-base leading-8 text-white text-right outline-none font-sans min-h-[50vh] overflow-y-auto placeholder-purple-300/40 border border-white/5 rounded-xl empty:before:content-[attr(placeholder)] empty:before:text-purple-300/40 empty:before:pointer-events-none focus:border-violet-500 transition-all [&_img]:max-h-[750px] [&_img]:w-full [&_img]:max-w-[700px] [&_img]:my-6 [&_img]:mx-auto [&_img]:rounded-2xl [&_img]:shadow-[0_10px_35px_rgba(0,0,0,0.6)] [&_img]:border [&_img]:border-white/10 [&_img]:block [&_img]:object-contain [&_img]:bg-black/30 [&_img]:p-1.5 hover:[&_img]:border-violet-500/40 hover:[&_img]:scale-[1.01] [&_img]:transition-all [&_img]:duration-300"
          />
        </div>

        <input 
          type="file" 
          id="png-uploader"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* 7. Publishing Date selectors */}
        <div className="flex flex-col gap-2.5 text-right mb-8">
          <label className="text-xs font-bold text-purple-200">تاريخ النشر</label>
          <div className="flex gap-6 justify-end items-center">
            {/* Option 2: Schedule */}
            <label className="flex items-center gap-2 cursor-pointer group select-none">
              <span className="text-xs text-purple-300 group-hover:text-white transition-colors">تحديد موعد</span>
              <input 
                type="radio"
                name="publishing-time"
                checked={publishTimeType === 'schedule'}
                onChange={() => setPublishTimeType('schedule')}
                className="w-4 h-4 accent-violet-500 cursor-pointer"
              />
            </label>

            {/* Option 1: Now */}
            <label className="flex items-center gap-2 cursor-pointer group select-none">
              <span className="text-xs text-purple-300 group-hover:text-white transition-colors">الآن</span>
              <input 
                type="radio"
                name="publishing-time"
                checked={publishTimeType === 'now'}
                onChange={() => {
                  setPublishTimeType('now');
                  setNewChapterPublishAt('');
                }}
                className="w-4 h-4 accent-violet-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Conditional Date-time Input with smooth collapse/fade */}
          {publishTimeType === 'schedule' && (
            <div className="mt-2.5 p-4 rounded-xl bg-[#13101E] border border-white/5 animate-in slide-in-from-top-2 duration-200 text-right">
              <input 
                type="datetime-local"
                lang="en"
                value={newChapterPublishAt}
                onChange={(e) => setNewChapterPublishAt(e.target.value)}
                min={getMinScheduleDate()}
                max={getMaxScheduleDate()}
                className="w-full bg-[#1A1625] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-violet-500 text-white font-mono text-right"
              />
              <span className="text-[10px] text-purple-400/80 mt-1.5 block">اختر التاريخ والوقت لتسجيل وقت النشر التلقائي للفصل. سيظل الفصل مجدولاً وغير متاح للقراءة قبل هذا الوقت.</span>
            </div>
          )}
        </div>

        {/* 8. Large blue Add/Submit Button */}
        <div className="w-full">
          <button 
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-violet-500/10 flex items-center justify-center gap-2"
          >
            <span>إضافة</span>
          </button>
        </div>

      </form>
    );
  }

  return (
    <div className="w-full text-right mt-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Back button */}
      <button 
        onClick={onBack}
        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-purple-300 hover:text-white transition-all text-xs font-bold mb-6 flex items-center gap-2 mr-auto cursor-pointer"
      >
        <span>← العودة للمكتبة</span>
      </button>

      {/* Novel Profile Banner Area */}
      <div className="relative w-full rounded-3xl overflow-hidden glass-panel border border-white/5 p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start select-none">
        <div 
          className="absolute inset-0 bg-cover bg-center -z-10 opacity-10 filter blur-2xl scale-110"
          style={{ backgroundImage: `url(${novel.cover})` }}
        />

        {/* Cover image wrapper */}
        <div className="flex flex-col gap-3 shrink-0">
          <div className="relative w-48 h-72 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <img src={novel.cover} alt={novel.titleAr} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          {isTranslatorOrOwner && (
            <button 
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  
                  const extension = file.name.split('.').pop()?.toLowerCase();
                  const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];
                  if (!extension || !allowed.includes(extension)) {
                    alert('عذراً، يجب أن يكون الملف بصيغة (PNG, JPG, JPEG, WEBP) لضمان جودة العرض الفاخرة بالمنصة!');
                    return;
                  }
                  
                  compressImageFile(file, 600).then((base64String) => {
                    // Update in database
                    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
                    const updatedNovels = allNovels.map(n => n.id === novel.id ? { ...n, cover: base64String } : n);
                    const savedOk = BerryDatabase.set('novels', updatedNovels);
                    if (!savedOk) {
                      alert('تعذر حفظ الغلاف: مساحة التخزين ممتلئة. جرب صورة أصغر.');
                      return;
                    }
                    // Update local state
                    setNovel({ ...novel, cover: base64String });
                    alert('تم تحديث غلاف الرواية بنجاح بالصورة المرفقة! 🎉');
                    // Trigger event so any other components update if listening
                    window.dispatchEvent(new Event('novels-updated'));
                  }).catch(() => alert('تعذر معالجة صورة الغلاف. جرب صورة أصغر حجماً.'));
                };
                input.click();
              }}
              className="w-full py-2 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-violet-500/5"
            >
              <Image size={12} />
              <span>تغيير غلاف الرواية 🎨</span>
            </button>
          )}
        </div>

        {/* Right Info pane */}
        <div className="flex-1 w-full min-w-0 flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-violet-600/10 border border-violet-600/30 text-violet-300">
                {novel.language}
              </span>
              {novel.teamName && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 border border-sky-500/30 text-sky-300">
                  فريق: {novel.teamName}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight">
              {novel.titleAr}
            </h1>
            <h3 className="text-sm text-purple-300 font-semibold mt-1">
              {novel.titleEn} {novel.titleOriginal ? `| ${novel.titleOriginal}` : ''}
            </h3>

            <p className="text-xs text-purple-400 mt-2 flex items-center gap-1.5 flex-wrap justify-end md:justify-start">
              <span>الكاتب الأصلي: <strong className="text-purple-200 font-bold">{novel.author}</strong></span>
              <span>|</span>
              <span className="flex items-center gap-1.5">
                المترجم الحالي: <strong className="text-berry-300 font-bold">{novel.translatorName || 'لا يوجد'}</strong>
                {novel.translatorName && isUserTranslatorOfTheMonth(novel.translatorName) && (
                  <span className="inline-flex items-center gap-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold">
                    🏆 مترجم الشهر
                  </span>
                )}
              </span>
            </p>

            {/* Genres list */}
            <div className="flex flex-wrap gap-2 mt-4">
              {novel.genres.map(genre => (
                <span key={genre} className="text-xs bg-white/5 border border-white/5 text-purple-300 px-3 py-1 rounded-xl font-bold">
                  {genre}
                </span>
              ))}
            </div>

            {/* Synopsis directly under genres */}
            <div className="mt-4 text-xs text-purple-200 leading-relaxed text-right bg-white/5 p-4 rounded-2xl border border-white/5">
              <span className="font-bold text-violet-300 block mb-1.5">القصة والنبذة:</span>
              <p className="whitespace-pre-wrap">{novel.description}</p>
            </div>
          </div>

          {/* Core novel statistics */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
              <span className="text-xs text-purple-400 block mb-1">المشاهدات</span>
              <span className="font-bold text-white text-base">{(novel.views).toLocaleString('ar-EG', { numberingSystem: 'latn' })}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
              <span className="text-xs text-purple-400 block mb-1">الفصول</span>
              <span className="font-bold text-white text-base">{chapters.length}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
              <span className="text-xs text-purple-400 block mb-1">المفضلة</span>
              <span className="font-bold text-white text-base">{(novel.bookmarksCount).toLocaleString('ar-EG', { numberingSystem: 'latn' })}</span>
            </div>
          </div>

          {/* Interactive Actions Pane */}
          <div className="flex flex-wrap gap-3 mt-6">
            {chapters.length > 0 ? (
              <button 
                onClick={() => onReadChapter(novel.id, 1)}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-violet-500/10 cursor-pointer"
              >
                <span>ابدأ القراءة الأولى</span>
              </button>
            ) : (
              <button 
                disabled
                className="px-6 py-3 bg-white/10 text-purple-400 font-bold rounded-xl text-xs cursor-not-allowed"
              >
                <span>قريباً جداً (بلا فصول)</span>
              </button>
            )}

            {/* Bookmark button */}
            <button
              onClick={() => onBookmarkToggle(novel.id)}
              className={`px-5 py-3 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${isBookmarked ? 'bg-berry-600/20 border-berry-500/40 text-berry-300' : 'bg-white/5 border-white/10 text-purple-300 hover:bg-white/10'}`}
            >
              <Heart size={14} className={isBookmarked ? 'fill-berry-500 text-berry-500 animate-pulse' : ''} />
              <span>{isBookmarked ? 'في المفضلة' : 'أضف للمفضلة'}</span>
            </button>

            {/* Special Request Claim/Reservation trigger */}
            {novel.status === 'AVAILABLE' && (currentUser.role === 'TRANSLATOR' || currentUser.role === 'OWNER') && (
              (() => {
                const check = checkCanReserve();
                if (check.allowed) {
                  return (
                    <button 
                      onClick={handleClaimNovel}
                      className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/15 cursor-pointer"
                    >
                      <span>طلب حجز واستلام الرواية 📝</span>
                    </button>
                  );
                } else {
                  return (
                    <button 
                      disabled
                      title={check.reason}
                      onClick={() => alert(check.reason)}
                      className="px-6 py-3 bg-white/5 border border-white/5 text-purple-500 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                    >
                      <span>🔒 حجز الرواية مغلق</span>
                    </button>
                  );
                }
              })()
            )}

            {/* Owner Delete button */}
            {isOwner && (
              <button 
                onClick={handleDeleteNovel}
                className="px-5 py-3 bg-red-600/25 hover:bg-red-600 hover:text-white text-red-200 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-red-500/10 transition-all duration-300"
                title="حذف الرواية نهائياً من الموقع"
              >
                <Trash2 size={14} />
                <span>حذف الرواية 🗑️</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Translator & Owner: Edit Novel Status Panel */}
      {(currentUser.id === novel.translatorId || isOwner) && novel.status !== 'PENDING' && (
        <div className="w-full mt-4 p-4 rounded-2xl bg-[#1A1625] border border-violet-500/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-right">
            <Edit2 size={16} className="text-violet-400" />
            <span className="text-purple-200">صلاحيات الإدارة: تحديث حالة الرواية الحالية:</span>
            <span className="font-extrabold text-violet-300">
              {novel.status === 'ONGOING' || novel.status === 'TRANSLATING' || novel.status === 'AVAILABLE' ? 'مستمرة' :
               novel.status === 'HIATUS' ? 'متوقفة مؤقتاً' :
               novel.status === 'CANCELLED' ? 'متوقفة نهائياً' :
               novel.status === 'COMPLETED' ? 'مكتملة' : novel.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-400">تغيير إلى:</span>
            <select
              value={novel.status === 'TRANSLATING' || novel.status === 'AVAILABLE' ? 'ONGOING' : novel.status}
              onChange={(e) => {
                const newStatus = e.target.value;
                let reason = '';
                const statusNames: Record<string, string> = {
                  ONGOING: 'مستمرة',
                  HIATUS: 'متوقفة مؤقتاً',
                  CANCELLED: 'متوقفة نهائياً',
                  COMPLETED: 'مكتملة'
                };

                if (newStatus === 'HIATUS' || newStatus === 'CANCELLED') {
                  const promptMsg = newStatus === 'HIATUS' 
                    ? 'يرجى إدخال سبب التوقف المؤقت (سيصل لمالك الموقع):' 
                    : 'يرجى إدخال سبب التوقف النهائي (سيصل لمالك الموقع):';
                  reason = prompt(promptMsg) || '';
                  if (!reason.trim()) {
                    alert('يجب ذكر السبب لتغيير الحالة إلى متوقفة!');
                    return;
                  }
                }

                const allNovels = BerryDatabase.get<Novel[]>('novels', []);
                const updated = allNovels.map(n => {
                  if (n.id === novel.id) {
                    return { ...n, status: newStatus as any, statusChangeReason: reason || undefined };
                  }
                  return n;
                });
                BerryDatabase.set('novels', updated);
                setNovel({ ...novel, status: newStatus as any });

                // Send Admin Notification to owner
                const allNotifs = BerryDatabase.get<any[]>('notifications', []);
                const newNotif = {
                  id: `notif-status-${Date.now()}`,
                  userId: 'berrymist-owner',
                  title: `تغيير حالة رواية: ${novel.titleAr}`,
                  message: `قام المترجم "${currentUser.username}" بتغيير حالة رواية "${novel.titleAr}" إلى (${statusNames[newStatus]}). ${reason ? `السبب: ${reason}` : ''}`,
                  type: 'SYSTEM',
                  isRead: false,
                  createdAt: new Date().toISOString()
                };
                BerryDatabase.set('notifications', [newNotif, ...allNotifs]);

                alert(`تم تغيير حالة الرواية إلى (${statusNames[newStatus]}) بنجاح.`);
                window.dispatchEvent(new Event('novels-updated'));
              }}
              className="bg-[#13101E] text-purple-200 border border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs focus:border-violet-500"
            >
              <option value="ONGOING">مستمرة</option>
              <option value="HIATUS">متوقفة مؤقتاً</option>
              <option value="CANCELLED">متوقفة نهائياً</option>
              <option value="COMPLETED">مكتملة</option>
            </select>
          </div>
        </div>
      )}

      {/* Live Reservation Countdown Banner if reserved */}
      {reservation && (
        <div className="w-full mt-4 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} className="animate-spin-slow text-yellow-400" />
            <span>رواية محجوزة للترجمة بواسطة المترجم: <span className="font-extrabold text-white">{reservation.translatorName}</span></span>
          </div>
          <span className="font-bold tracking-wide bg-yellow-500/10 px-3 py-1 rounded-full text-xs">
            {timeRemaining || 'جاري تحميل العداد...'}
          </span>
        </div>
      )}

      {/* Main Tab Area */}
      <div className="w-full mt-8">
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-white/5 mb-6 text-sm font-semibold text-purple-300/80 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('chapters')}
            className={`pb-3 px-6 relative transition-colors ${activeTab === 'chapters' ? 'text-white' : 'hover:text-white'}`}
          >
            <span>فصول الرواية ({chapters.length})</span>
            {activeTab === 'chapters' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('comments')}
            className={`pb-3 px-6 relative transition-colors ${activeTab === 'comments' ? 'text-white' : 'hover:text-white'}`}
          >
            <span>التعليقات ({comments.length})</span>
            {activeTab === 'comments' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
          </button>
        </div>

        {/* Tab Panel contents */}
        <div className="w-full">

          {/* TAB 2: Chapters List */}
          {activeTab === 'chapters' && (
            <div className="flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex flex-wrap justify-between items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                <span className="text-xs text-purple-300 font-semibold">إجمالي الفصول المنشورة: {chapters.length} فصلاً</span>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Ascending / descending chapter order toggle */}
                  {chapters.length > 0 && (
                    <button
                      onClick={() => setChaptersAscending(prev => !prev)}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-purple-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                      title="تبديل ترتيب عرض الفصول"
                    >
                      {chaptersAscending
                        ? <><ArrowUp size={14} className="text-violet-300" /><span>تصاعدي (الأقدم أولاً)</span></>
                        : <><ArrowDown size={14} className="text-violet-300" /><span>تنازلي (الأحدث أولاً)</span></>}
                    </button>
                  )}

                  {/* Show Add Chapter trigger for OWNER, TRANSLATOR, or WRITER */}
                  {(currentUser.role === 'OWNER' || currentUser.role === 'TRANSLATOR' || currentUser.role === 'WRITER') && (
                    <button
                      onClick={() => {
                        setShowAddChapterForm(!showAddChapterForm);
                        setNewChapterNumber('');
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-500/10"
                    >
                      <Plus size={14} />
                      <span>إضافة فصل جديد للرواية</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Chapters (ordered by the ascending/descending toggle) */}
              {chapters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...chapters].sort((a, b) => chaptersAscending ? a.number - b.number : b.number - a.number).map((chapter) => {
                    const isRead = readChapters.some(rc => rc.novelId === novel.id && rc.chapterNumber === chapter.number);
                    return (
                      <div
                        key={chapter.id}
                        onClick={() => onReadChapter(novel.id, chapter.number)}
                        className={`group p-4 rounded-2xl flex items-center justify-between gap-2 cursor-pointer transition-all text-right border ${
                          isRead
                            ? 'bg-violet-900/15 border-violet-500/40 hover:bg-violet-900/25 hover:border-violet-400'
                            : 'bg-[#1A1625] border-white/5 hover:border-violet-500/20 hover:bg-violet-950/5'
                        }`}
                      >
                        <div className="min-w-0">
                          <h4 className={`font-bold text-xs transition-colors truncate ${isRead ? 'text-violet-300 group-hover:text-violet-200' : 'text-purple-100 group-hover:text-violet-400'}`}>
                            الفصل {chapter.number}: {chapter.title.split(':').slice(1).join(':').trim() || 'فصل مترجم'}
                            {isRead && (
                              <span className="mr-2 text-[9px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-normal">
                                تمت القراءة ✔️
                              </span>
                            )}
                          </h4>
                          <span className={`text-[10px] mt-1 block ${isRead ? 'text-violet-400/80' : 'text-purple-400'}`}>
                            {/* Scheduled chapters carry their scheduled publish time in
                                publishAt; show that as the publish date so a chapter that
                                went live on schedule reads as published on its scheduled
                                day, not the day it was drafted. */}
                            تاريخ النشر: {new Date(chapter.publishAt || chapter.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {currentUser.role === 'OWNER' && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleDeleteChapterByOwner(chapter.id, chapter.number); 
                              }}
                              className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                              title={`حذف الفصل ${chapter.number} نهائياً`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            isRead
                              ? 'bg-violet-500/20 text-violet-300 group-hover:bg-violet-600 group-hover:text-white'
                              : 'bg-white/5 text-purple-300 group-hover:bg-violet-600 group-hover:text-white'
                          }`}>
                            {isRead ? 'قراءة مجدداً ←' : 'قراءة الفصل ←'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-panel p-12 text-center rounded-2xl border border-white/5 text-purple-400">
                  <p className="text-sm font-semibold">لا توجد فصول منشورة لهذه الرواية حالياً.</p>
                  <p className="text-xs text-purple-400 mt-1">إذا كنت المترجم، انقر على "إضافة فصل جديد" للبدء بالترجمة.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Comments System */}
          {activeTab === 'comments' && (
            <div className="flex flex-col gap-6">
              {/* Policy alert enforcement */}
              <div className="p-3 bg-violet-600/5 border border-violet-500/20 rounded-2xl text-right flex items-start gap-2.5">
                <span className="text-sm">⚠️</span>
                <div>
                  <span className="text-[10px] font-extrabold text-violet-400 block mb-0.5 font-sans">سياسة وقوانين التفاعل بالمنصة</span>
                  <p className="text-[10px] text-purple-300 leading-relaxed">
                    يرجى احترام كافة القراء والمترجمين الآخرين. يمنع منعاً باتاً التلفظ بعبارات مخلة أو مسيئة، كما يمنع سرقة جهود المترجمين ونسبها لجهات أخرى. الحسابات المخالفة تتعرض للحظر الفوري المباشر.
                  </p>
                </div>
              </div>

              {/* Form to submit comment */}
              <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder={currentUser.role === 'GUEST' ? 'سجل الدخول لكتابة تعليق حول الرواية... 🍇' : 'اكتب تعليقك هنا حول الرواية...'}
                    readOnly={currentUser.role === 'GUEST'}
                    onClick={() => {
                      if (currentUser.role === 'GUEST') window.dispatchEvent(new Event('open-login-modal'));
                    }}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 min-w-0 bg-[#1A1625] border border-white/5 focus:border-violet-500 outline-none rounded-2xl px-4 py-3.5 text-white placeholder-purple-300/40 text-xs text-right transition-all"
                  />
                  <button
                    type="submit"
                    className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold shadow-lg transition-all cursor-pointer shrink-0"
                  >
                    إرسال
                  </button>
                </div>
                {currentUser.role !== 'GUEST' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsSpoilerComment(!isSpoilerComment)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSpoilerComment
                          ? 'bg-red-500/15 text-red-400 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)] font-extrabold'
                          : 'bg-white/5 text-purple-300 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <span>🔥 يحتوي على حرق للأحداث</span>
                    </button>
                  </div>
                )}
              </form>

              {/* List of comments */}
              <div className="flex flex-col gap-4">
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="p-4 bg-[#1A1625]/60 border border-white/5 rounded-2xl text-right flex flex-col gap-3">
                      
                      {/* Comment Header */}
                      <div className="flex items-center gap-3">
                        <img src={comment.authorAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=user'} alt={comment.authorName} className="w-9 h-9 rounded-full border border-violet-500/20" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{comment.authorName}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold">
                              {comment.authorRole === 'OWNER' ? 'المالك 👑' : comment.authorRole === 'TRANSLATOR' ? 'مترجم ✍️' : 'عضو قارئ 👤'}
                            </span>
                            {isUserTranslatorOfTheMonth(comment.authorName) && (
                              <span className="text-[8.5px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 font-bold flex items-center gap-0.5">
                                🏆 مترجم الشهر
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-purple-400 mt-0.5 block">{new Date(comment.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</span>
                        </div>
                      </div>

                      {/* Comment Content */}
                      {comment.isSpoiler && !revealedSpoilers.includes(comment.id) ? (
                        <div className="pr-12">
                          <div
                            onClick={() => setRevealedSpoilers(prev => [...prev, comment.id])}
                            className="p-3.5 bg-red-950/35 hover:bg-red-950/50 border border-red-500/30 hover:border-red-500/50 rounded-xl cursor-pointer flex items-center justify-between transition-all duration-300 group select-none"
                          >
                            <span className="text-xs font-bold text-red-400 flex items-center gap-2">
                              🚨 يوجد حرق! (اضغط لقراءة التعليق على مسؤوليتك)
                            </span>
                            <span className="text-[10px] bg-red-500/20 text-red-300 hover:bg-red-500/30 px-3 py-1.5 rounded-lg font-extrabold transition-colors">
                              إظهار 👁️
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="pr-12">
                          {comment.isSpoiler && (
                            <span className="text-[10px] text-red-400 font-extrabold bg-red-500/10 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 mb-2 select-none">
                              🔥 تعليق حرق (تم كشفه):
                            </span>
                          )}
                          <p className={`text-xs text-purple-200 leading-relaxed ${comment.isSpoiler ? 'border-r-2 border-red-500/40 pr-3 font-sans' : ''}`}>
                            {comment.content}
                          </p>
                        </div>
                      )}

                      {/* Comment Actions (Like / Reply triggers) */}
                      <div className="flex items-center gap-4 pr-12 text-[10px] text-purple-400">
                        <button 
                          onClick={() => handleLikeComment(comment.id)}
                          className={`flex items-center gap-1 hover:text-berry-400 transition-colors cursor-pointer ${comment.likedBy.includes(currentUser.id) ? 'text-berry-400 font-bold' : ''}`}
                        >
                          <span>إعجاب ({comment.likes})</span>
                        </button>
                        <button
                          onClick={() => {
                            if (currentUser.role === 'GUEST') {
                              window.dispatchEvent(new Event('open-login-modal'));
                              return;
                            }
                            setActiveReplyId(activeReplyId === comment.id ? null : comment.id);
                          }}
                          className="hover:text-white transition-colors cursor-pointer"
                        >
                          <span>رد</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportComment(comment)}
                          className="hover:text-red-400 transition-colors cursor-pointer flex items-center gap-0.5 text-purple-400/80"
                          title="الإبلاغ عن تعليق مسيء"
                        >
                          <span>🚩 إبلاغ</span>
                        </button>
                        {(currentUser.role === 'OWNER' || currentUser.email?.toLowerCase() === 'berrymist11@gmail.com') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="hover:text-red-500 transition-colors cursor-pointer flex items-center gap-0.5 text-red-400"
                            title="حذف التعليق"
                          >
                            <span>🗑️ حذف التعليق</span>
                          </button>
                        )}
                      </div>

                      {/* Comment replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mr-12 mt-2 flex flex-col gap-3 border-r border-white/5 pr-4">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="p-3 bg-white/5 rounded-xl flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <img src={reply.authorAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=reply'} alt={reply.authorName} className="w-6 h-6 rounded-full border border-white/10" />
                                <span className="font-bold text-[11px] text-white">{reply.authorName}</span>
                                <span className="text-[8px] px-1 bg-violet-500/20 text-violet-300 rounded-full">{reply.authorRole}</span>
                              </div>
                              <p className="text-xs text-purple-300 leading-relaxed">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply field active */}
                      {activeReplyId === comment.id && (
                        <div className="mr-12 mt-2 flex gap-2">
                          <input 
                            type="text" 
                            placeholder="اكتب ردك اللطيف..."
                            value={replyTexts[comment.id] || ''}
                            onChange={(e) => setReplyTexts({ ...replyTexts, [comment.id]: e.target.value })}
                            className="flex-1 bg-white/5 border border-white/5 focus:border-violet-500 outline-none rounded-xl px-3 py-2 text-white text-xs"
                          />
                          <button 
                            onClick={() => handleAddReply(comment.id)}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold"
                          >
                            رد
                          </button>
                        </div>
                      )}

                    </div>
                  ))
                ) : (
                  <div className="glass-panel p-12 text-center rounded-2xl border border-white/5 text-purple-400">
                    <p className="text-sm">لا توجد تعليقات بعد. كن أول من يكتب تعليقاً حماسياً!</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {reportingComment && (
        <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex justify-center items-center p-4">
          <div className="w-full max-w-md bg-[#161221] border border-white/10 rounded-3xl p-6 text-right shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">🚨 الإبلاغ عن تعليق مسيء</h3>
            <p className="text-xs text-purple-300 mb-4">
              أنت بصدد الإبلاغ عن تعليق بواسطة <span className="text-violet-400 font-bold">{reportingComment.authorName}</span>:
            </p>
            
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-purple-200 mb-4 max-h-24 overflow-y-auto italic">
              "{reportingComment.content}"
            </div>

            <label className="block text-xs font-bold text-purple-300 mb-1.5">سبب الإبلاغ:</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-[#1e192c] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white mb-4 outline-none focus:border-violet-500"
            >
              <option value="محتوى مسيء / غير لائق">محتوى مسيء / غير لائق / شتائم</option>
              <option value="حرق للأحداث دون تحذير">حرق للأحداث دون تحذير</option>
              <option value="سرقة مجهود / سبام">سرقة مجهود / سبام / إعلانات</option>
              <option value="أخرى">أخرى (يرجى توضيحها أدناه)</option>
            </select>

            <label className="block text-xs font-bold text-purple-300 mb-1.5">تفاصيل إضافية (اختياري):</label>
            <textarea
              placeholder="اكتب أي ملاحظات إضافية تساعد المالك في مراجعة البلاغ..."
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              className="w-full h-20 bg-[#1e192c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white mb-5 outline-none focus:border-violet-500 resize-none"
            />

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={submitReport}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-violet-600 hover:from-red-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                إرسال البلاغ
              </button>
              <button
                type="button"
                onClick={() => setReportingComment(null)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-purple-300 hover:text-white border border-white/10 rounded-xl text-xs cursor-pointer transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        danger={confirmConfig.danger}
      />

    </div>
  );
}
