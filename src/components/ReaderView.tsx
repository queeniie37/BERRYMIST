import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Settings, Type, BookOpen, HelpCircle, Heart, Check, Share2, Clipboard, MessageSquare } from 'lucide-react';
import { Chapter, Novel, User, Comment, CommentReply, Report } from '../types';
import { BerryDatabase } from '../data';

// Chapter text is author-provided. Escape all HTML, then re-allow only the
// simple formatting tags the chapter editor can produce (<b>, <i>, <u>, <img>) so a
// malicious chapter can't inject scripts into readers' browsers.
function sanitizeChapterHtml(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Restore simple formatting tags
  let restored = escaped.replace(/&lt;(\/?)(b|i|u)&gt;/gi, '<$1$2>');
  
  // Restore img tags (backwards compatibility)
  restored = restored.replace(/&lt;img\s+src="([^"]+)"\s*(?:\/)?&gt;/gi, (match, src) => {
    return `<img src="${src}" class="max-h-[300px] sm:max-h-[500px] w-auto max-w-full my-4 mx-auto rounded-xl shadow-lg border border-white/10 block object-contain" />`;
  });
  
  // Restore (PNG, JPG: base64) tags
  restored = restored.replace(/\(PNG,\s*JPG:\s*([^\s)]+)\)/gi, (match, src) => {
    return `<img src="${src}" class="max-h-[300px] sm:max-h-[500px] w-auto max-w-full my-4 mx-auto rounded-xl shadow-lg border border-white/10 block object-contain" />`;
  });
  
  return restored;
}

interface ReaderViewProps {
  novelId: string;
  chapterNumber: number;
  currentUser: User;
  onBack: () => void;
  onNavigateChapter: (direction: 'next' | 'prev') => void;
}

export default function ReaderView({ novelId, chapterNumber, currentUser, onBack, onNavigateChapter }: ReaderViewProps) {
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [themeMode, setThemeMode] = useState<'dark' | 'sepia' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<number>(18);
  const [fontFamily, setFontFamily] = useState<'naskh' | 'sans'>('naskh');
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [hasPrevChapter, setHasPrevChapter] = useState(false);
  const [hasNextChapter, setHasNextChapter] = useState(false);
  
  // Chapter Comments System state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTexts, setReplyTexts] = useState<{ [commentId: string]: string }>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<Comment | null>(null);
  const [reportReason, setReportReason] = useState('محتوى مسيء / غير لائق');
  const [reportDetails, setReportDetails] = useState('');
  const [isSpoilerComment, setIsSpoilerComment] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<string[]>([]);
  
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load novel and specific chapter
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const foundNovel = allNovels.find(n => n.id === novelId);
    if (foundNovel) setNovel(foundNovel);

    const allChapters = BerryDatabase.get<Chapter[]>('chapters', []);
    let novelChapters = allChapters.filter(c => c.novelId === novelId);

    // Filter out scheduled chapters for non-author / non-owner users
    if (currentUser.role !== 'OWNER' && foundNovel?.translatorId !== currentUser.id) {
      novelChapters = novelChapters.filter(c => !c.publishAt || new Date(c.publishAt) <= new Date());
    }

    // Sort chapters by number ascending
    novelChapters.sort((a, b) => a.number - b.number);

    const currentIndex = novelChapters.findIndex(c => c.number === chapterNumber);
    setHasPrevChapter(currentIndex > 0);
    setHasNextChapter(currentIndex !== -1 && currentIndex < novelChapters.length - 1);

    const foundChapter = novelChapters.find(c => c.number === chapterNumber);
    if (foundChapter) {
      setChapter(foundChapter);
      
      // Load comments for this chapter
      const allComments = BerryDatabase.get<Comment[]>('comments', []);
      const chapterComments = allComments.filter(c => c.refId === foundChapter.id);
      setComments(chapterComments);

      // Update reader history
      const history = BerryDatabase.get<any[]>('reading_history', []);
      const updatedHistory = history.filter(h => h.novelId !== novelId);
      updatedHistory.unshift({
        novelId,
        chapterNumber,
        progress: Math.floor(Math.random() * 30) + 70, // Simulated scroll progress
        updatedAt: new Date().toISOString()
      });
      BerryDatabase.set('reading_history', updatedHistory);

      // Save to read chapters log
      const readChapters = BerryDatabase.get<any[]>('read_chapters', []);
      const alreadySaved = readChapters.some(rc => rc.novelId === novelId && rc.chapterNumber === chapterNumber && (rc.userId === (currentUser?.id || 'guest')));
      if (!alreadySaved) {
        readChapters.push({
          userId: currentUser?.id || 'guest',
          novelId,
          chapterNumber,
          readAt: new Date().toISOString()
        });
        BerryDatabase.set('read_chapters', readChapters);
      }

      // Increment view count of novel
      const updatedNovels = allNovels.map(n => n.id === novelId ? { ...n, views: n.views + 1 } : n);
      BerryDatabase.set('novels', updatedNovels);
    }
  }, [novelId, chapterNumber, currentUser]);

  // Track scrolling progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Copy protection & select listeners as specified in master specs §19.7
  useEffect(() => {
    // If the user is an OWNER, they can copy all chapters freely!
    if (currentUser.role === 'OWNER') {
      return;
    }

    const preventAction = (e: Event) => {
      e.preventDefault();
      alert('محتوى الفصول محمي بموجب حقوق النشر لمنصة Berry Mist ©');
    };

    const blockCopy = (e: ClipboardEvent) => preventAction(e);
    const blockCut = (e: ClipboardEvent) => preventAction(e);
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    const blockDrag = (e: DragEvent) => e.preventDefault();
    
    const blockShortcuts = (e: KeyboardEvent) => {
      // Block Ctrl+P (Print), Ctrl+S (Save), Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        alert('محتوى الفصول محمي ضد السرقة والنسخ والتحميل بموجب حقوق النشر لمنصة Berry Mist ©');
      }
    };

    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCut);
    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('dragstart', blockDrag);
    document.addEventListener('keydown', blockShortcuts);

    return () => {
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCut);
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('dragstart', blockDrag);
      document.removeEventListener('keydown', blockShortcuts);
    };
  }, [currentUser]);

  // Add Comment Handler
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'GUEST') {
      alert('يجب تسجيل الدخول أولاً لتتمكن من كتابة التعليقات. 🍇');
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }
    if (!commentText.trim() || !chapter) return;

    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      refId: chapter.id,
      refType: 'CHAPTER',
      authorName: currentUser.username,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      content: commentText,
      likes: 0,
      likedBy: [],
      replies: [],
      createdAt: new Date().toISOString(),
      isSpoiler: isSpoilerComment
    };

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = [newComment, ...allComments];
    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === chapter.id));
    setCommentText('');
    setIsSpoilerComment(false);
  };

  // Like Comment Handler
  const handleLikeComment = (commentId: string) => {
    if (currentUser.role === 'GUEST') {
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }
    if (!chapter) return;
    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = allComments.map(c => {
      if (c.id === commentId) {
        const alreadyLiked = c.likedBy.includes(currentUser.id);
        const likedBy = alreadyLiked 
          ? c.likedBy.filter(id => id !== currentUser.id)
          : [...c.likedBy, currentUser.id];
        const likes = alreadyLiked ? c.likes - 1 : c.likes + 1;
        return { ...c, likes, likedBy };
      }
      return c;
    });
    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === chapter.id));
  };

  // Add Reply Handler
  const handleAddReply = (commentId: string) => {
    if (currentUser.role === 'GUEST') {
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }
    const replyText = replyTexts[commentId];
    if (!replyText || !replyText.trim() || !chapter) return;

    const newReply = {
      id: `rep-${Date.now()}`,
      authorName: currentUser.username,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role === 'OWNER' ? 'المالك 👑' : currentUser.role === 'TRANSLATOR' ? 'مترجم ✍️' : 'عضو قارئ 👤',
      content: replyText,
      createdAt: new Date().toISOString()
    };

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = allComments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          replies: [...(c.replies || []), newReply]
        };
      }
      return c;
    });
    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === chapter.id));
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
    if (!reportingComment || !chapter || !novel) return;

    const newReport: Report = {
      id: 'report-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'COMMENT',
      targetId: reportingComment.id,
      targetName: `${reportingComment.authorName}: ${reportingComment.content}`,
      reason: reportReason,
      details: `رواية: ${novel.titleAr} • الفصل ${chapter.number}${reportDetails ? ` - التفاصيل: ${reportDetails}` : ''}`,
      reportedBy: currentUser.role === 'GUEST' ? 'زائر' : currentUser.username,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    const reports = BerryDatabase.get<Report[]>('reports', []);
    BerryDatabase.set('reports', [...reports, newReport]);

    // Send a system notification immediately to the Owner
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const usersDb = BerryDatabase.get<any[]>('users_db', []);
    const owners = usersDb.filter(u => u && (u.role === 'OWNER' || u.email?.toLowerCase() === 'hanona37hh@gmail.com'));
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
    if (currentUser.role !== 'OWNER' && currentUser.email?.toLowerCase() !== 'hanona37hh@gmail.com') {
      alert('عذراً، هذه الصلاحية مخصصة لمالك الموقع فقط!');
      return;
    }

    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التعليق نهائياً؟')) {
      return;
    }

    if (!chapter) return;
    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = allComments.filter(c => c.id !== commentId);
    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === chapter.id));
    alert('تم حذف التعليق بنجاح.');
  };

  if (!novel || !chapter) {
    return (
      <div className="w-full text-center py-20 text-purple-400">
        <p className="text-sm font-semibold">جاري تحميل قارئ الفصول والترجمة الفاخرة...</p>
      </div>
    );
  }

  const getThemeClasses = () => {
    if (themeMode === 'sepia') return 'bg-[#F4ECD8] text-[#5B4636]';
    if (themeMode === 'light') return 'bg-white text-[#1A1A1A]';
    return 'bg-[#0F0B14] text-[#F5F1FF]';
  };

  return (
    <div className={`w-full min-h-screen text-right transition-colors duration-300 pb-16 ${getThemeClasses()}`}>
      
      {/* 3px Reading Progress bar fixed on top of the screen */}
      <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] bg-white/5">
        <div 
          className="h-full bg-gradient-to-r from-violet-500 to-berry-500 transition-all duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Reader Bar (Title, Navigation actions) */}
      <div className="sticky top-0 z-40 w-full glass-panel h-16 flex items-center justify-between gap-2 px-3 sm:px-6 border-b border-white/5">
        <button 
          onClick={onBack}
          className="text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer"
        >
          <span>← عودة للرواية</span>
        </button>

        <div className="text-center min-w-0">
          <h4 className="font-extrabold text-xs text-white truncate max-w-[140px] sm:max-w-md mx-auto">{novel.titleAr}</h4>
          <span className="text-[10px] text-purple-400 mt-0.5 block font-bold truncate max-w-[140px] sm:max-w-md mx-auto">الفصل {chapter.number}: {chapter.title.split(':').slice(1).join(':').trim()}</span>
        </div>

        {/* Customizer triggers */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-white/5 hover:bg-white/10 text-purple-200 hover:text-white rounded-xl border border-white/5 transition-all cursor-pointer"
            title="تخصيص الخط والسمات"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Settings Menu Drawer */}
      {showSettings && (
        <div className="fixed top-18 left-3 sm:left-6 z-50 w-72 max-w-[calc(100vw-1.5rem)] glass-panel p-4 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-4 text-right">
          <h4 className="font-extrabold text-xs text-white border-b border-white/5 pb-2 mb-3">تخصيص قارئ الرواية</h4>
          
          {/* Themes switcher */}
          <div className="flex flex-col gap-1.5 mb-4">
            <span className="text-[10px] text-purple-300 font-semibold">سمة الخلفية</span>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setThemeMode('dark')}
                className={`py-2 px-2 rounded-xl text-center text-xs font-bold transition-all border ${themeMode === 'dark' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-[#14101D] border-white/5 text-purple-300'}`}
              >
                داكن 🌌
              </button>
              <button 
                onClick={() => setThemeMode('sepia')}
                className={`py-2 px-2 rounded-xl text-center text-xs font-bold transition-all border ${themeMode === 'sepia' ? 'bg-[#5B4636] border-[#5B4636] text-[#F4ECD8]' : 'bg-[#F4ECD8] border-[#5B4636]/10 text-[#5B4636]'}`}
              >
                ورقي 📜
              </button>
              <button 
                onClick={() => setThemeMode('light')}
                className={`py-2 px-2 rounded-xl text-center text-xs font-bold transition-all border ${themeMode === 'light' ? 'bg-white border-white text-black' : 'bg-white/5 border-white/5 text-purple-300'}`}
              >
                فاتح ☀️
              </button>
            </div>
          </div>

          {/* FontSize */}
          <div className="flex flex-col gap-1.5 mb-4">
            <div className="flex justify-between items-center text-[10px] text-purple-300">
              <span>أقصى: 28px</span>
              <span className="font-bold">حجم خط القراءة: {fontSize}px</span>
              <span>أدنى: 16px</span>
            </div>
            <input 
              type="range" 
              min={16} 
              max={28} 
              step={2}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-violet-600"
            />
          </div>

          {/* Font Family */}
          <div className="flex flex-col gap-1.5 mb-4">
            <span className="text-[10px] text-purple-300 font-semibold">عائلة الخطوط العربية</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button 
                onClick={() => setFontFamily('naskh')}
                className={`py-2 rounded-xl border font-bold transition-all ${fontFamily === 'naskh' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/5 text-purple-300'}`}
              >
                خط النسخ الفاخر
              </button>
              <button 
                onClick={() => setFontFamily('sans')}
                className={`py-2 rounded-xl border font-bold transition-all ${fontFamily === 'sans' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/5 text-purple-300'}`}
              >
                خط واجهة مستخدم
              </button>
            </div>
          </div>

          {/* Line Spacing */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-purple-300 font-semibold">تباعد الأسطر والفقرات</span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[1.6, 1.8, 2.1].map((lh) => (
                <button 
                  key={lh}
                  onClick={() => setLineHeight(lh)}
                  className={`py-1.5 rounded-xl border font-bold transition-all ${lineHeight === lh ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/5 text-purple-300'}`}
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Print-only copyright notice replaces the protected content for non-owners */}
      {currentUser.role !== 'OWNER' && (
        <div className="print-only-notice hidden">
          محتوى هذا الفصل محمي بموجب حقوق النشر والترجمة لمنصة Berry Mist © ولا يسمح بطباعته أو حفظه.
        </div>
      )}

      {/* Main Chapter Content Frame */}
      <div
        ref={readerRef}
        className={`w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16 text-right leading-relaxed relative watermarked-text ${currentUser.role !== 'OWNER' ? 'select-none print-protected' : ''}`}
        data-watermark={`BERRY MIST - ${currentUser.username}`}
        style={{ 
          fontSize: `${fontSize}px`, 
          fontFamily: fontFamily === 'naskh' ? '"Noto Naskh Arabic", "Amiri", serif' : '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
          lineHeight: lineHeight,
          userSelect: currentUser.role !== 'OWNER' ? 'none' : 'auto',
          WebkitUserSelect: currentUser.role !== 'OWNER' ? 'none' : 'auto'
        }}
      >
        <div className={`mb-8 text-center ${currentUser.role !== 'OWNER' ? 'select-none' : ''}`}>
          <h2 className="text-xl md:text-3xl font-extrabold tracking-tight border-b border-white/5 pb-4">
            الفصل {chapter.number}: {chapter.title.split(':').slice(1).join(':').trim() || 'فصل مترجم'}
          </h2>
          <span className="text-xs text-purple-400 mt-2 block">حقوق الترجمة والنشر محفوظة لمنصة Berry Mist وللمترجم: {novel.translatorName}</span>
        </div>

        {/* Text paragraph splitter */}
        <div className="space-y-6">
          {chapter.content.split('\n\n').map((para, idx) => (
            <p 
              key={idx} 
              className={`whitespace-pre-wrap ${currentUser.role !== 'OWNER' ? 'select-none' : ''}`}
              dangerouslySetInnerHTML={{ __html: sanitizeChapterHtml(para) }}
            />
          ))}
        </div>

        {/* Chapter Images Display */}
        {(chapter as any).images && (chapter as any).images.length > 0 && (
          <div className={`mt-12 mb-8 ${currentUser.role !== 'OWNER' ? 'select-none' : ''}`}>
            <h4 className="text-center text-xs text-purple-400 font-bold mb-4 flex items-center justify-center gap-1.5 border-t border-b border-white/5 py-3">
              🖼️ رسومات وتوضيحات الفصل المرفقة
            </h4>
            <div className="flex flex-col gap-6 items-center">
              {(chapter as any).images.map((imgUrl: string, index: number) => (
                <div key={index} className="relative rounded-2xl overflow-hidden border border-white/10 max-w-full shadow-2xl">
                  <img 
                    src={imgUrl} 
                    alt={`Illustration ${index + 1}`} 
                    referrerPolicy="no-referrer"
                    className="max-h-[600px] w-auto object-contain select-none"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-[8px] text-white px-2 py-0.5 rounded font-mono select-none">
                    صورة {index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation bottom buttons (with correctly inverted arrow icons) */}
        <div className="flex flex-wrap justify-between items-center gap-2 border-t border-white/5 pt-8 mt-12 select-none">
          <button
            onClick={() => hasPrevChapter && onNavigateChapter('prev')}
            disabled={!hasPrevChapter}
            className="px-3 sm:px-5 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer transition-all border border-white/5 hover:border-white/10"
          >
            <ChevronRight size={14} className="text-purple-400" />
            <span>الفصل السابق</span>
          </button>

          <button
            onClick={onBack}
            className="px-3 sm:px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-purple-300 cursor-pointer"
          >
            فهرس الفصول
          </button>

          <button
            onClick={() => hasNextChapter && onNavigateChapter('next')}
            disabled={!hasNextChapter}
            className="px-3 sm:px-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-[#1A1625] disabled:to-[#1A1625] disabled:border-white/5 disabled:text-purple-300/30 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-violet-500/10"
          >
            <span>الفصل التالي</span>
            <ChevronLeft size={14} className="text-white" />
          </button>
        </div>

        {/* Comments section below chapter navigation */}
        <div className="mt-16 border-t border-white/5 pt-12 text-right">
          <h3 className="text-lg font-extrabold text-white mb-6 flex items-center justify-between gap-2 border-b border-white/5 pb-3">
            <span>التعليقات والمناقشات حول الفصل ({comments.length})</span>
            <MessageSquare size={18} className="text-violet-400" />
          </h3>

          {/* Form to submit comment */}
          <form onSubmit={handleAddComment} className="flex flex-col gap-2 mb-8">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={currentUser.role === 'GUEST' ? 'سجل الدخول لكتابة تعليق حول الفصل... 🍇' : 'اكتب تعليقك هنا حول أحداث الفصل...'}
                readOnly={currentUser.role === 'GUEST'}
                onClick={() => {
                  if (currentUser.role === 'GUEST') window.dispatchEvent(new Event('open-login-modal'));
                }}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 min-w-0 bg-[#14101D] border border-white/5 focus:border-violet-500 outline-none rounded-2xl px-4 py-3 text-white placeholder-purple-300/40 text-xs text-right transition-all"
              />
              <button
                type="submit"
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold shadow-lg transition-all cursor-pointer shrink-0"
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
                <div key={comment.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl text-right flex flex-col gap-3">
                  
                  {/* Comment Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={comment.authorAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=user'} alt={comment.authorName} className="w-8 h-8 rounded-full border border-violet-500/20" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">{comment.authorName}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold">
                            {comment.authorRole === 'OWNER' ? 'المالك 👑' : comment.authorRole === 'TRANSLATOR' ? 'مترجم ✍️' : 'عضو قارئ 👤'}
                          </span>
                        </div>
                        <span className="text-[9px] text-purple-400 mt-0.5 block">{new Date(comment.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Comment Content */}
                  {comment.isSpoiler && !revealedSpoilers.includes(comment.id) ? (
                    <div className="pr-11">
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
                    <div className="pr-11">
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
                  <div className="flex items-center gap-4 pr-11 text-[9px] text-purple-400">
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
                    {(currentUser.role === 'OWNER' || currentUser.email?.toLowerCase() === 'hanona37hh@gmail.com') && (
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
                    <div className="mr-11 mt-2 flex flex-col gap-3 border-r border-white/5 pr-4">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="p-3 bg-white/5 rounded-xl flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <img src={reply.authorAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=reply'} alt={reply.authorName} className="w-5 h-5 rounded-full border border-white/10" />
                            <span className="font-bold text-[10px] text-white">{reply.authorName}</span>
                            <span className="text-[7px] px-1 bg-violet-500/20 text-violet-300 rounded-full">{reply.authorRole}</span>
                          </div>
                          <p className="text-xs text-purple-300 leading-relaxed">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply field active */}
                  {activeReplyId === comment.id && (
                    <div className="mr-11 mt-2 flex gap-2">
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
              <div className="p-8 text-center rounded-2xl border border-white/5 bg-white/5 text-purple-400">
                <p className="text-xs">لا توجد تعليقات على هذا الفصل بعد. شارك رأيك حول الترجمة والأحداث الملحمية!</p>
              </div>
            )}
          </div>
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

    </div>
  );
}
