import React, { useState, useEffect } from 'react';
import { Star, Eye, Layers, Heart, Download, Share2, Plus, Calendar, Clock, ChevronDown, MessageSquare, Edit2, AlertCircle, Trash2, Upload, Image } from 'lucide-react';
import { Novel, Chapter, Comment, Review, User, UserRole } from '../types';
import { BerryDatabase } from '../data';

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
  
  // Claim state variables
  const [timeRemaining, setTimeRemaining] = useState('');
  const [reservation, setReservation] = useState<any | null>(null);

  // New commenting state
  const [commentText, setCommentText] = useState('');
  const [replyTexts, setReplyTexts] = useState<{ [commentId: string]: string }>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  // Add chapter simulator state
  const [showAddChapterForm, setShowAddChapterForm] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [newChapterImages, setNewChapterImages] = useState('');
  const [newChapterPublishAt, setNewChapterPublishAt] = useState('');

  const downloadFullNovelAndChapters = () => {
    if (!novel) return;
    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const novelChapters = allChapters
      .filter(c => c.novelId === novel.id)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    let fileContent = `==================================================\r\n`;
    fileContent += `رواية: ${novel.titleAr}\r\n`;
    fileContent += `العنوان الأصلي: ${novel.titleEn}\r\n`;
    fileContent += `المؤلف: ${novel.author}\r\n`;
    fileContent += `المترجم: ${novel.translatorName}\r\n`;
    fileContent += `التصنيفات: ${novel.genres.join('، ')}\r\n`;
    fileContent += `الوصف:\r\n${novel.description}\r\n`;
    fileContent += `==================================================\r\n\r\n`;

    if (novelChapters.length === 0) {
      fileContent += `(لا توجد فصول منشورة لهذه الرواية بعد)\r\n`;
    } else {
      novelChapters.forEach((ch) => {
        fileContent += `--------------------------------------------------\r\n`;
        fileContent += `الفصل ${ch.chapterNumber}: ${ch.title}\r\n`;
        fileContent += `تاريخ النشر: ${ch.publishAt || 'فوري'}\r\n`;
        fileContent += `--------------------------------------------------\r\n\r\n`;
        fileContent += `${ch.content}\r\n\r\n`;
      });
    }

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${novel.titleAr}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    
    // Filter out scheduled chapters for non-author / non-owner users
    const isAuthorized = currentUser.role === 'OWNER' || (foundNovel && foundNovel.translatorId === currentUser.id);
    if (!isAuthorized) {
      foundChapters = foundChapters.filter(c => !c.publishAt || new Date(c.publishAt) <= new Date());
    }
    setChapters(foundChapters);

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const foundComments = allComments.filter(c => c.refId === novelId || foundChapters.some(ch => ch.id === c.refId));
    setComments(foundComments);

    const allReservations = BerryDatabase.get<any[]>('reservations', []);
    const activeRes = allReservations.find(r => r.novelId === novelId && r.status === 'ACTIVE');
    setReservation(activeRes || null);
  }, [novelId]);

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

  // Claim/Reservation action handler
  const handleClaimNovel = () => {
    if (currentUser.role === 'GUEST') {
      alert('عذراً، يجب عليك اختيار رتبة "مترجم" أو "عضو" لتتمكن من حجز الرواية للترجمة.');
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
    if (commentText.trim() === '') return;
    if (currentUser.role === 'GUEST') {
      alert('الزائر لا يملك صلاحية كتابة التعليقات. قم بالتبديل لرتبة "عضو" من الأعلى!');
      return;
    }

    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      refId: novel.id,
      refType: 'NOVEL',
      authorName: currentUser.username,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      content: commentText,
      likes: 0,
      likedBy: [],
      replies: [],
      createdAt: new Date().toISOString()
    };

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = [newComment, ...allComments];
    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === novel.id || chapters.some(ch => ch.id === c.refId)));
    setCommentText('');
  };

  // Like comment handler
  const handleLikeComment = (commentId: string) => {
    if (currentUser.role === 'GUEST') return;
    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = allComments.map(c => {
      if (c.id === commentId) {
        const isLiked = c.likedBy.includes(currentUser.id);
        const likedBy = isLiked ? c.likedBy.filter(id => id !== currentUser.id) : [...c.likedBy, currentUser.id];
        return { ...c, likes: isLiked ? c.likes - 1 : c.likes + 1, likedBy };
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
      id: `reply-${Date.now()}`,
      authorName: currentUser.username,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      content: text,
      createdAt: new Date().toISOString()
    };

    const allComments = BerryDatabase.get<Comment[]>('comments', []);
    const updated = allComments.map(c => {
      if (c.id === commentId) {
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      return c;
    });

    BerryDatabase.set('comments', updated);
    setComments(updated.filter(c => c.refId === novel.id || chapters.some(ch => ch.id === c.refId)));
    setReplyTexts({ ...replyTexts, [commentId]: '' });
    setActiveReplyId(null);
  };

  // Helper to apply HTML tags for rich text
  const applyFormat = (tag: string) => {
    const textarea = document.getElementById('chapter-content-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const replacement = `<${tag}>${selected || 'نص التنسيق'}</${tag}>`;
    setNewChapterContent(text.substring(0, start) + replacement + text.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length + 2, start + tag.length + 2 + (selected || 'نص التنسيق').length);
    }, 0);
  };

  // Convert uploaded PNG/images to Base64 data urls
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      // Validate file size or type if needed, but standard images are perfect
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملفات صور فقط (PNG, JPG, JPEG, GIF)');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setNewChapterImages(prev => prev ? `${prev}, ${base64String}` : base64String);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachedImage = (indexToRemove: number) => {
    const list = newChapterImages.split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    const updated = list.filter((_, idx) => idx !== indexToRemove);
    setNewChapterImages(updated.join(', '));
  };

  // Translator: Create Chapter handler
  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle || !newChapterContent) return;

    const newChapterNum = chapters.length + 1;
    const imgUrls = newChapterImages.split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    const isScheduled = newChapterPublishAt ? new Date(newChapterPublishAt) > new Date() : false;

    const newChap: Chapter = {
      id: `${novel.id}-chap-${newChapterNum}-${Date.now()}`,
      novelId: novel.id,
      number: newChapterNum,
      title: `الفصل ${newChapterNum}: ${newChapterTitle}`,
      content: newChapterContent,
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
    setChapters(updatedChaps.filter(c => c.novelId === novel.id).sort((a, b) => a.number - b.number));

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

    // Notify all bookmark users
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
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

    setShowAddChapterForm(false);
    setNewChapterTitle('');
    setNewChapterContent('');
    setNewChapterImages('');
    setNewChapterPublishAt('');
  };

  const isTranslatorOrOwner = currentUser.role === 'OWNER' || (novel && novel.translatorId === currentUser.id);

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
            <img src={novel.cover} alt={novel.titleAr} className="w-full h-full object-cover" />
          </div>
          {isTranslatorOrOwner && (
            <button 
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.png';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  
                  const extension = file.name.split('.').pop()?.toLowerCase();
                  if (extension !== 'png') {
                    alert('عذراً، يجب أن يكون الملف بصيغة PNG فقط لضمان جودة العرض الفاخرة بالمنصة!');
                    return;
                  }
                  
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64String = reader.result as string;
                    // Update in database
                    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
                    const updatedNovels = allNovels.map(n => n.id === novel.id ? { ...n, cover: base64String } : n);
                    BerryDatabase.set('novels', updatedNovels);
                    
                    // Update local state
                    setNovel({ ...novel, cover: base64String });
                    alert('تم تحديث غلاف الرواية بنجاح بصورة PNG المرفقة! 🎉');
                    // Trigger event so any other components update if listening
                    window.dispatchEvent(new Event('novels-updated'));
                  };
                  reader.readAsDataURL(file);
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
        <div className="flex-1 flex flex-col justify-between h-full">
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

            <p className="text-xs text-purple-400 mt-2">
              الكاتب الأصلي: <span className="text-purple-200 font-bold">{novel.author}</span> | المترجم الحالي: <span className="text-berry-300 font-bold">{novel.translatorName || 'لا يوجد'}</span>
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
              <span className="font-bold text-white text-base">{(novel.views).toLocaleString('ar-EG')}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
              <span className="text-xs text-purple-400 block mb-1">الفصول</span>
              <span className="font-bold text-white text-base">{novel.chaptersCount}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
              <span className="text-xs text-purple-400 block mb-1">المفضلة</span>
              <span className="font-bold text-white text-base">{(novel.bookmarksCount).toLocaleString('ar-EG')}</span>
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

            <button 
              onClick={() => onBookmarkToggle(novel.id)}
              className={`px-5 py-3 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${isBookmarked ? 'bg-berry-600/20 border-berry-500/40 text-berry-300' : 'bg-white/5 border-white/10 text-purple-300 hover:bg-white/10'}`}
            >
              <Heart size={14} className={isBookmarked ? 'fill-berry-500 text-berry-500 animate-pulse' : ''} />
              <span>{isBookmarked ? 'في المفضلة' : 'أضف للمفضلة'}</span>
            </button>

            {currentUser.role === 'OWNER' || (currentUser.role === 'TRANSLATOR' && novel.translatorId === currentUser.id) ? (
              <button 
                onClick={downloadFullNovelAndChapters}
                className="px-5 py-3 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 border border-violet-500/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-500/10 transition-all duration-300"
                title="تنزيل الرواية وفصولها بالكامل كملف نصي"
              >
                <Download size={14} />
                <span>تحميل الرواية وفصولها 📥</span>
              </button>
            ) : (
              <button disabled className="px-5 py-3 bg-white/5 border border-white/5 text-purple-500 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-2" title="التحميل متاح فقط للمترجم المعين والمالك للحماية">
                <Download size={14} className="opacity-50" />
                <span>التحميل محمي 🔒</span>
              </button>
            )}

            {/* Special Request Claim/Reservation trigger */}
            {novel.status === 'AVAILABLE' && (currentUser.role === 'TRANSLATOR' || currentUser.role === 'OWNER') && (
              <button 
                onClick={handleClaimNovel}
                className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-yellow-500/15 cursor-pointer"
              >
                <span>طلب حجز واستلام الرواية 📝</span>
              </button>
            )}
          </div>
        </div>
      </div>

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
        <div className="flex border-b border-white/5 mb-6 text-sm font-semibold text-purple-300/80">
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
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                <span className="text-xs text-purple-300 font-semibold">إجمالي الفصول المنشورة: {chapters.length} فصلاً</span>
                
                {/* Show Add Chapter trigger for OWNER, TRANSLATOR, or WRITER */}
                {(currentUser.role === 'OWNER' || currentUser.role === 'TRANSLATOR' || currentUser.role === 'WRITER') && (
                  <button 
                    onClick={() => setShowAddChapterForm(!showAddChapterForm)}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-500/10"
                  >
                    <Plus size={14} />
                    <span>إضافة فصل جديد للرواية</span>
                  </button>
                )}
              </div>

              {/* Add Chapter Simulator Form inside Tab */}
              {showAddChapterForm && (
                <form onSubmit={handleCreateChapter} className="p-5 rounded-2xl bg-violet-950/10 border border-violet-500/20 text-right flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="font-bold text-xs text-violet-300">محرر ترجمة الفصول السريع لـ {novel.titleAr}</h4>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-purple-200">عنوان الفصل الجديد</label>
                    <input 
                      type="text" 
                      required
                      placeholder="عنوان الفصل (مثال: بداية الملحمة واللقاء الأول)"
                      value={newChapterTitle}
                      onChange={(e) => setNewChapterTitle(e.target.value)}
                      className="bg-[#1A1625] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-violet-500 text-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-purple-200">متن وترجمة الفصل (كامل النص)</label>
                      
                      {/* Rich Text controls */}
                      <div className="flex gap-1">
                        <button 
                          type="button" 
                          onClick={() => applyFormat('b')} 
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-white border border-white/5 rounded-lg text-[10px] font-bold cursor-pointer"
                          title="نص كثيف (Bold)"
                        >
                          <b>B</b>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => applyFormat('i')} 
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-white border border-white/5 rounded-lg text-[10px] italic font-bold cursor-pointer"
                          title="نص مائل (Italic)"
                        >
                          <i>I</i>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => applyFormat('u')} 
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-white border border-white/5 rounded-lg text-[10px] underline font-bold cursor-pointer"
                          title="خط تحت النص (Underline)"
                        >
                          <u>U</u>
                        </button>
                      </div>
                    </div>
                    
                    <textarea 
                      id="chapter-content-textarea"
                      required
                      rows={6}
                      placeholder="اكتب أو الصق نص الفصل المترجم هنا بالكامل... يمكنك تحديد نص والنقر على أزرار التنسيق في الأعلى لجعله كثيفاً، مائلاً، أو تحته خط."
                      value={newChapterContent}
                      onChange={(e) => setNewChapterContent(e.target.value)}
                      className="bg-[#1A1625] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-violet-500 text-white font-sans min-h-[160px]"
                    />
                  </div>

                  {/* Chapter Images Attachment with easy PNG Upload */}
                  <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl border border-white/5 text-right">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-extrabold text-purple-200 flex items-center gap-1">
                        <Image size={14} className="text-violet-400" />
                        <span>إرفاق صور ورسومات الفصل (مثال: PNG, JPG)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const demoUrls = [
                            'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600', // anime character
                            'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600', // fantasy sword
                            'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600'  // magic gateway
                          ];
                          const randomUrl = demoUrls[Math.floor(Math.random() * demoUrls.length)];
                          setNewChapterImages(prev => prev ? `${prev}, ${randomUrl}` : randomUrl);
                        }}
                        className="text-[9px] bg-violet-600/10 hover:bg-violet-600/30 text-violet-300 border border-violet-500/10 px-2.5 py-1 rounded-xl cursor-pointer transition-all"
                      >
                        ⚡ توليد صورة عشوائية للمحاكاة
                      </button>
                    </div>

                    <p className="text-[10px] text-purple-300/70">تستطيع الآن رفع صور PNG مباشرة من جهازك لتضمينها بلمسة واحدة، أو إدخال روابط الصور يدوياً أدناه.</p>

                    {/* Drag and Drop / Choose File button */}
                    <div className="flex flex-col items-center justify-center border border-dashed border-violet-500/20 hover:border-violet-500/50 bg-[#1A1625]/80 p-4 rounded-xl text-center transition-colors">
                      <input 
                        type="file" 
                        id="png-uploader"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label 
                        htmlFor="png-uploader"
                        className="cursor-pointer flex flex-col items-center gap-1 w-full py-2"
                      >
                        <Upload size={24} className="text-violet-400 animate-bounce" />
                        <span className="text-xs font-bold text-white">اضغط هنا لرفع صور PNG أو سحبها وإفلاتها مباشرة 📂</span>
                        <span className="text-[9px] text-purple-400">يدعم صيغ PNG, JPG, WebP وGIF</span>
                      </label>
                    </div>

                    {/* Live Image Thumbnails Preview */}
                    {newChapterImages.split(',').map(url => url.trim()).filter(url => url.length > 0).length > 0 && (
                      <div className="flex flex-wrap gap-2.5 mt-2 p-2 bg-black/20 rounded-xl border border-white/5">
                        {newChapterImages.split(',').map(url => url.trim()).filter(url => url.length > 0).map((url, idx) => (
                          <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-md">
                            <img src={url} alt="Chapter attach" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeAttachedImage(idx)}
                              className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer text-[10px] font-bold"
                              title="حذف الصورة"
                            >
                              حذف ❌
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text field backup */}
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="text-[10px] font-bold text-purple-300">روابط الصور المرفقة يدوياً (مفصولة بفاصلة):</span>
                      <input 
                        type="text" 
                        placeholder="رابط الصورة 1, رابط الصورة 2..."
                        value={newChapterImages}
                        onChange={(e) => setNewChapterImages(e.target.value)}
                        className="bg-[#1A1625] border border-white/5 rounded-xl px-4 py-2 text-xs outline-none focus:border-violet-500 text-white"
                      />
                    </div>
                  </div>

                  {/* Chapter Publishing Scheduler */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-purple-200">📅 جدولة وقت النشر التلقائي بالتاريخ الميلادي</label>
                    <input 
                      type="datetime-local" 
                      value={newChapterPublishAt}
                      onChange={(e) => setNewChapterPublishAt(e.target.value)}
                      className="bg-[#1A1625] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-violet-500 text-white font-mono"
                    />
                    <span className="text-[9px] text-purple-400">اختر التاريخ والوقت الميلادي الذي ترغب في نشر الفصل فيه تلقائياً. سيظل الفصل مخفياً عن القراء حتى يحين ذلك الموعد بالضبط.</span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button 
                      type="button" 
                      onClick={() => setShowAddChapterForm(false)}
                      className="px-4 py-2 bg-white/5 rounded-xl text-purple-300 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      نشر الفصل فوراً للقراء
                    </button>
                  </div>
                </form>
              )}

              {/* Grid of Chapters */}
              {chapters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {chapters.map((chapter) => (
                    <div 
                      key={chapter.id}
                      onClick={() => onReadChapter(novel.id, chapter.number)}
                      className="group p-4 bg-[#1A1625] border border-white/5 hover:border-violet-500/20 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:bg-violet-950/5 text-right"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-purple-100 group-hover:text-violet-400 transition-colors">
                          الفصل {chapter.number}: {chapter.title.split(':').slice(1).join(':').trim() || 'فصل مترجم'}
                        </h4>
                        <span className="text-[10px] text-purple-400 mt-1 block">
                          تاريخ النشر: {new Date(chapter.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                      <span className="px-3 py-1.5 bg-white/5 text-purple-300 rounded-xl text-[11px] font-bold group-hover:bg-violet-600 group-hover:text-white transition-all">
                        قراءة الفصل ←
                      </span>
                    </div>
                  ))}
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
              <form onSubmit={handleAddComment} className="flex gap-3">
                <input 
                  type="text" 
                  placeholder={currentUser.role === 'GUEST' ? 'سجل الدخول أو غير رتبتك من الأعلى لكتابة تعليق...' : 'اكتب تعليقك هنا حول الرواية...'}
                  disabled={currentUser.role === 'GUEST'}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-[#1A1625] border border-white/5 focus:border-violet-500 outline-none rounded-2xl px-4 py-3.5 text-white placeholder-purple-300/40 text-xs text-right transition-all"
                />
                <button 
                  type="submit"
                  disabled={currentUser.role === 'GUEST'}
                  className="px-6 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  إرسال
                </button>
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
                          </div>
                          <span className="text-[10px] text-purple-400 mt-0.5 block">{new Date(comment.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      </div>

                      {/* Comment Content */}
                      <p className="text-xs text-purple-200 leading-relaxed pr-12">{comment.content}</p>

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
                            if (currentUser.role === 'GUEST') return;
                            setActiveReplyId(activeReplyId === comment.id ? null : comment.id);
                          }}
                          className="hover:text-white transition-colors cursor-pointer"
                        >
                          <span>رد</span>
                        </button>
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

    </div>
  );
}
