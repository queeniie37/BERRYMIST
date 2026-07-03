import React, { useState, useEffect } from 'react';
import { FileText, Plus, CheckCircle, Flame, Clock, Award, Check, Layers, AlertCircle, Edit, Trash2, Calendar, BookOpen, Eye, RefreshCw } from 'lucide-react';
import { Novel, Suggestion, Reservation, User } from '../types';
import { BerryDatabase, COVER_IMAGES } from '../data';

interface TranslatorPanelProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
}

export default function TranslatorPanel({ currentUser, onNavigate }: TranslatorPanelProps) {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeTab, setActiveTab] = useState<'novels' | 'claims' | 'reservations' | 'add-novel' | 'activity' | 'deleted-chapters'>('novels');
  
  // Create novel form
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [author, setAuthor] = useState('');
  const [lang, setLang] = useState('الكورية');
  const [desc, setDesc] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [success, setSuccess] = useState('');

  // Enhanced activity & archive states
  const [chapters, setChapters] = useState<any[]>([]);
  const [deletedChapters, setDeletedChapters] = useState<any[]>([]);

  // Editing chapter states
  const [editingChapter, setEditingChapter] = useState<any | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterContent, setEditChapterContent] = useState('');
  const [editChapterPublishAt, setEditChapterPublishAt] = useState('');
  const [editChapterImages, setEditChapterImages] = useState('');

  const genresOptions = ['أكشن', 'فانتزيا', 'مغامرات', 'إثارة', 'نظام', 'إسيكاي', 'موريم', 'دراما', 'غموض', 'رومانسية', 'كوميديا', 'تراجع'];

  const loadChaptersAndDeleted = () => {
    // 1. Load active chapters
    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const allNovels = BerryDatabase.get<any[]>('novels', []);
    
    // We only want chapters of novels translated/written by this user (or all if OWNER)
    const userNovelIds = allNovels
      .filter(n => n.translatorId === currentUser.id || currentUser.role === 'OWNER')
      .map(n => n.id);
      
    const userChapters = allChapters.filter(c => userNovelIds.includes(c.novelId));
    
    // Add novelTitle to each chapter for display
    const chaptersWithNovelInfo = userChapters.map(c => {
      const n = allNovels.find(novel => novel.id === c.novelId);
      return {
        ...c,
        novelTitle: n ? n.titleAr : 'رواية غير معروفة'
      };
    });
    setChapters(chaptersWithNovelInfo.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    // 2. Load deleted chapters
    const allDeleted = BerryDatabase.get<any[]>('deleted_chapters', []);
    // For regular translators/writers, show chapters deleted by them (or from their novels)
    // For OWNER, show ALL deleted chapters by all translators/writers!
    if (currentUser.role === 'OWNER') {
      setDeletedChapters(allDeleted);
    } else {
      setDeletedChapters(allDeleted.filter(d => d.deletedById === currentUser.id || userNovelIds.includes(d.novelId)));
    }
  };

  const canModifyChapter = (chapter: any) => {
    if (currentUser.role === 'OWNER') {
      return { allowed: true, reason: 'مالك الموقع لديه صلاحية كاملة دائماً', daysLeft: 15 };
    }
    const createdDate = new Date(chapter.createdAt);
    const now = new Date();
    const diffTime = now.getTime() - createdDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays > 15) {
      return { allowed: false, reason: 'مغلق (مضى أكثر من 15 يوماً على النشر)', daysLeft: 0 };
    }
    
    const daysLeft = Math.max(0, 15 - Math.floor(diffDays));
    return { allowed: true, reason: `متبقي ${daysLeft} يوم للتعديل/الحذف`, daysLeft };
  };

  const downloadNovelAndChapters = (novel: Novel) => {
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

  useEffect(() => {
    // Load novels matching current translator or Owner
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    setNovels(allNovels.filter(n => n.translatorId === currentUser.id || currentUser.role === 'OWNER'));

    // Load available suggestions
    const allSuggestions = BerryDatabase.get<Suggestion[]>('suggestions', []);
    setSuggestions(allSuggestions.filter(s => s.status === 'PENDING'));

    // Load active reservations
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    setReservations(allReservations.filter(r => r.translatorId === currentUser.id));

    loadChaptersAndDeleted();
  }, [currentUser, activeTab]);

  // Handle deleting a chapter (with confirmation & archives it)
  const handleDeleteChapter = (chapterId: string) => {
    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const chapterToDelete = allChapters.find(c => c.id === chapterId);
    if (!chapterToDelete) return;

    // Enforce 15-day restriction
    const permission = canModifyChapter(chapterToDelete);
    if (!permission.allowed) {
      alert(`عذراً، لا يمكنك حذف هذا الفصل! السبب: ${permission.reason}. يرجى التواصل مع الإدارة لأي تعديلات.`);
      return;
    }

    const isConfirmed = window.confirm('هل أنت متأكد تماماً من حذف هذا الفصل؟ سيتم نقله إلى أرشيف الفصول المحذوفة ويمكنك استعادته أو حذفه نهائياً من هناك.');
    if (!isConfirmed) return;

    // Remove from active chapters
    const remainingChapters = allChapters.filter(c => c.id !== chapterId);
    BerryDatabase.set('chapters', remainingChapters);

    // Get original novel title
    const allNovels = BerryDatabase.get<any[]>('novels', []);
    const n = allNovels.find(novel => novel.id === chapterToDelete.novelId);

    // Add to deleted_chapters archive
    const allDeleted = BerryDatabase.get<any[]>('deleted_chapters', []);
    const deletedEntry = {
      ...chapterToDelete,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser.username,
      deletedById: currentUser.id,
      novelTitle: n ? n.titleAr : 'رواية غير معروفة'
    };
    BerryDatabase.set('deleted_chapters', [...allDeleted, deletedEntry]);

    // Recalculate chapters count for novel
    if (n) {
      const updatedNovels = allNovels.map(novel => {
        if (novel.id === n.id) {
          return {
            ...novel,
            chaptersCount: Math.max(0, novel.chaptersCount - 1)
          };
        }
        return novel;
      });
      BerryDatabase.set('novels', updatedNovels);
    }

    loadChaptersAndDeleted();
    alert('تم حذف الفصل ونقله إلى الأرشيف بنجاح! 🗑️');
  };

  // Handle restoring a chapter
  const handleRestoreChapter = (deletedId: string) => {
    const allDeleted = BerryDatabase.get<any[]>('deleted_chapters', []);
    const chapToRestore = allDeleted.find(d => d.id === deletedId);
    if (!chapToRestore) return;

    // Remove from deleted list
    const remainingDeleted = allDeleted.filter(d => d.id !== deletedId);
    BerryDatabase.set('deleted_chapters', remainingDeleted);

    // Add back to active chapters
    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    
    // Clean deleted meta
    const { deletedAt, deletedBy, deletedById, ...originalChapter } = chapToRestore;
    BerryDatabase.set('chapters', [...allChapters, originalChapter]);

    // Recalculate chapters count for novel
    const allNovels = BerryDatabase.get<any[]>('novels', []);
    const updatedNovels = allNovels.map(novel => {
      if (novel.id === originalChapter.novelId) {
        return {
          ...novel,
          chaptersCount: novel.chaptersCount + 1
        };
      }
      return novel;
    });
    BerryDatabase.set('novels', updatedNovels);

    loadChaptersAndDeleted();
    alert('تم استعادة الفصل ونشره مجدداً بنجاح! ↩️');
  };

  // Handle permanently deleting a chapter
  const handlePermanentlyDelete = (deletedId: string) => {
    const isConfirmed = window.confirm('تحذير: هل أنت متأكد من حذف هذا الفصل نهائياً؟ هذا الإجراء لا يمكن التراجع عنه وسيمحو الفصل تماماً من قواعد البيانات!');
    if (!isConfirmed) return;

    const allDeleted = BerryDatabase.get<any[]>('deleted_chapters', []);
    const remainingDeleted = allDeleted.filter(d => d.id !== deletedId);
    BerryDatabase.set('deleted_chapters', remainingDeleted);

    loadChaptersAndDeleted();
    alert('تم حذف الفصل نهائياً وبشكل دائم. ❌');
  };

  // Handle opening edit modal
  const handleOpenEditModal = (chapter: any) => {
    // Enforce 15-day restriction
    const permission = canModifyChapter(chapter);
    if (!permission.allowed) {
      alert(`عذراً، لا يمكنك تعديل هذا الفصل! السبب: ${permission.reason}. يرجى التواصل مع الإدارة لأي تعديلات.`);
      return;
    }

    setEditingChapter(chapter);
    setEditChapterTitle(chapter.title.split(':').slice(1).join(':').trim() || chapter.title);
    setEditChapterContent(chapter.content);
    setEditChapterPublishAt(chapter.publishAt || '');
    setEditChapterImages(chapter.images ? chapter.images.join(', ') : '');
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملفات صور فقط (PNG, JPG, JPEG, GIF)');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setEditChapterImages(prev => prev ? `${prev}, ${base64String}` : base64String);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeEditAttachedImage = (indexToRemove: number) => {
    const list = editChapterImages.split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    const updated = list.filter((_, idx) => idx !== indexToRemove);
    setEditChapterImages(updated.join(', '));
  };

  // Handle saving edited chapter
  const handleSaveEditChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChapter) return;

    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    
    const imgUrls = editChapterImages.split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    const isScheduled = editChapterPublishAt ? new Date(editChapterPublishAt) > new Date() : false;

    const updatedChapters = allChapters.map(c => {
      if (c.id === editingChapter.id) {
        return {
          ...c,
          title: `الفصل ${editingChapter.number}: ${editChapterTitle}`,
          content: editChapterContent,
          isDraft: isScheduled,
          publishAt: editChapterPublishAt || undefined,
          images: imgUrls.length > 0 ? imgUrls : undefined
        };
      }
      return c;
    });

    BerryDatabase.set('chapters', updatedChapters);
    setEditingChapter(null);
    loadChaptersAndDeleted();
    alert('تم تعديل وحفظ بيانات الفصل بنجاح! 💾');
  };

  // Request reservation extension
  const handleRequestExtension = (resId: string) => {
    const reason = prompt('أدخل سبب تمديد مهلة الحجز (مثال: نحتاج وقت لتدقيق الفصول الأولى):');
    if (!reason || reason.trim() === '') {
      alert('السبب مطلوب لتقديم طلب التمديد.');
      return;
    }

    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    const updated = allReservations.map(r => {
      if (r.id === resId) {
        return {
          ...r,
          extensionRequested: true,
          extensionReason: reason
        };
      }
      return r;
    });

    BerryDatabase.set('reservations', updated);
    setReservations(updated.filter(r => r.translatorId === currentUser.id));

    // Send admin notification
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-ext-${Date.now()}`,
      userId: 'berrymist-owner', // Notify Owner
      title: 'طلب تمديد حجز رواية',
      message: `قام المترجم "${currentUser.username}" بطلب تمديد حجز رواية للسبب التالي: ${reason}`,
      type: 'RESERVATION',
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
    alert('تم إرسال طلب تمديد مهلة الحجز بنجاح للإدارة العليا للمراجعة.');
  };

  // Simulate 30 days passing for testing purposes
  const handleSimulateTime = (resId: string) => {
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    const updated = allReservations.map(r => {
      if (r.id === resId) {
        // Set startAt and endAt to 31 days ago, making it expired
        const thirtyOneDaysAgo = new Date();
        thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
        const expiredEndAt = new Date();
        expiredEndAt.setDate(expiredEndAt.getDate() - 1);
        
        return {
          ...r,
          startAt: thirtyOneDaysAgo.toISOString(),
          endAt: expiredEndAt.toISOString()
        };
      }
      return r;
    });

    BerryDatabase.set('reservations', updated);
    setReservations(updated.filter(r => r.translatorId === currentUser.id));
    alert('تمت محاكاة مرور 30 يوماً بنجاح على هذا الحجز! يرجى الانتقال إلى الشاشات الأخرى أو إعادة تحميل الموقع لتفعيل الفحص التلقائي لانتهاء الصلاحية.');
  };

  // Cancel reservation by the translator who booked it
  const handleCancelMyReservation = (resId: string, novelId: string, novelTitle: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إلغاء حجز رواية "${novelTitle}"؟ ستعود الرواية فوراً إلى قائمة الاقتراحات العامة للأعضاء.`)) {
      return;
    }

    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    const updatedRes = allReservations.map(r => r.id === resId ? { ...r, status: 'CANCELLED' as const } : r);
    BerryDatabase.set('reservations', updatedRes);
    setReservations(updatedRes.filter(r => r.translatorId === currentUser.id));

    // Set novel back to CANCELLED
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const updatedNovels = allNovels.map(n => n.id === novelId ? { ...n, status: 'CANCELLED' as const, translatorId: '', translatorName: '' } : n);
    BerryDatabase.set('novels', updatedNovels);

    // Return Suggestion to PENDING so it appears back in suggestion panel with votes kept intact
    const allSuggestions = BerryDatabase.get<Suggestion[]>('suggestions', []);
    const updatedSugs = allSuggestions.map(s => {
      if (s.titleAr === novelTitle) {
        return { ...s, status: 'PENDING' as const };
      }
      return s;
    });
    BerryDatabase.set('suggestions', updatedSugs);

    alert('تم إلغاء حجز الرواية بنجاح وعودتها للاقتراحات العامة مباشرة مع بقاء أصواتها.');
  };

  // Handle suggestion claim directly from translator panel
  const handleClaimSuggestion = (sug: Suggestion) => {
    const startAt = new Date();
    const endAt = new Date();
    endAt.setDate(startAt.getDate() + 30); // 30 Days reservation timer

    // 1. Create a novel placeholder from suggestion
    const newNovel: Novel = {
      id: `novel-claimed-${Date.now()}`,
      titleAr: sug.titleAr,
      titleEn: sug.titleEn,
      author: 'الكاتب الأصلي',
      translatorId: currentUser.id,
      translatorName: currentUser.username,
      cover: sug.cover,
      chaptersCount: 0,
      views: 0,
      likes: 0,
      bookmarksCount: 0,
      rating: 5.0,
      ratingCount: 1,
      status: 'RESERVED',
      language: 'الكورية',
      genres: sug.genres,
      description: sug.description,
      createdAt: new Date().toISOString(),
      downloadAllowed: true
    };

    // 2. Create reservation
    const newRes: Reservation = {
      id: `res-claimed-${Date.now()}`,
      novelId: newNovel.id,
      novelTitle: newNovel.titleAr,
      translatorId: currentUser.id,
      translatorName: currentUser.username,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: 'ACTIVE',
      extensionRequested: false
    };

    // 3. Update suggestion status (Disappears from list because status becomes RESERVED)
    const allSuggestions = BerryDatabase.get<Suggestion[]>('suggestions', []);
    const updatedSugs = allSuggestions.map(s => s.id === sug.id ? { ...s, status: 'RESERVED' as const } : s);
    BerryDatabase.set('suggestions', updatedSugs);

    // Save
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    BerryDatabase.set('novels', [newNovel, ...allNovels]);
    BerryDatabase.set('reservations', [newRes, ...allReservations]);

    // Refresh state
    setNovels([newNovel, ...novels]);
    setSuggestions(updatedSugs.filter(s => s.status === 'PENDING'));
    setReservations([newRes, ...reservations]);

    // Send notification
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-claimed-${Date.now()}`,
      userId: currentUser.id,
      title: 'تم استلام الاقتراح بنجاح!',
      message: `لقد قمت بحجز الرواية المقترحة "${sug.titleAr}" بنجاح. تظهر الآن في لوحة المترجم وحسابك.`,
      type: 'RESERVATION',
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
    alert(`تهانينا! لقد قمت باستلام الرواية المقترحة "${sug.titleAr}" بنجاح وجاري بدء عداد الحجز 30 يوماً.`);
  };

  // Submit new novel draft for Admin Review / Publish immediately for Owner
  const handleCreateNovel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr || !titleEn || !author || !desc) {
      alert('يرجى ملء الحقول الإلزامية.');
      return;
    }

    const isOwner = currentUser.role === 'OWNER';
    const status = isOwner ? 'AVAILABLE' : 'PENDING';

    const newNovel: Novel = {
      id: `novel-draft-${Date.now()}`,
      titleAr,
      titleEn,
      author,
      translatorId: currentUser.id,
      translatorName: currentUser.username,
      cover: COVER_IMAGES.unconquered_one, // fallback
      chaptersCount: 0,
      views: 0,
      likes: 0,
      bookmarksCount: 0,
      rating: 5.0,
      ratingCount: 0,
      status: status, // Published immediately if Owner, else needs approval!
      language: lang,
      genres: selectedGenres,
      description: desc,
      createdAt: new Date().toISOString(),
      downloadAllowed: true
    };

    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    BerryDatabase.set('novels', [newNovel, ...allNovels]);

    if (!isOwner) {
      // Notify administrators if created by Translator/Writer
      const allNotifs = BerryDatabase.get<any[]>('notifications', []);
      const newNotif = {
        id: `notif-review-${Date.now()}`,
        userId: 'berrymist-owner', // Notify Super Admin
        title: 'رواية جديدة قيد المراجعة',
        message: `قام ${currentUser.role === 'WRITER' ? 'الكاتب' : 'المترجم'} "${currentUser.username}" بإنشاء رواية جديدة "${titleAr}" وبانتظار موافقتك الرسمية.`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: 'الآن'
      };
      BerryDatabase.set('notifications', [...allNotifs, newNotif]);
      setSuccess('تم تقديم طلب إنشاء الرواية بنجاح وهي قيد مراجعة المالك للموافقة عليها قبل النشر بالمنصة.');
    } else {
      setSuccess('تمت إضافة ونشر الرواية الجديدة مباشرة بنجاح بصفك مالك المنصة! 🎉');
    }

    setTitleAr('');
    setTitleEn('');
    setAuthor('');
    setDesc('');
    setSelectedGenres([]);

    setTimeout(() => {
      setSuccess('');
      setActiveTab('novels');
      setNovels([newNovel, ...novels]);
    }, 2000);
  };

  return (
    <div className="w-full text-right mt-4 pb-12 animate-in fade-in duration-300">
      
      {/* Banner */}
      <div className="p-6 bg-gradient-to-r from-violet-900/40 via-purple-900/20 to-[#14101D] border border-violet-500/15 rounded-3xl mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-violet-400" size={24} />
            <span>لوحة تحكم ومطوري الترجمة الفخمة</span>
          </h1>
          <p className="text-xs text-purple-300 mt-1">أنشئ رواياتك الخاصة، انشر فصولاً، واستلم الاقتراحات من مجتمع القراء.</p>
        </div>
        <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]">✍️</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 mb-6 text-sm font-semibold text-purple-300/80 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('novels')}
          className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'novels' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>{currentUser.role === 'WRITER' ? 'رواياتي المؤلفة' : 'رواياتي المترجمة'} ({novels.length})</span>
          {activeTab === 'novels' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        {currentUser.role !== 'WRITER' && (
          <button 
            onClick={() => setActiveTab('claims')}
            className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'claims' ? 'text-white' : 'hover:text-white'}`}
          >
            <span>طلبات استلام الاقتراحات ({suggestions.length})</span>
            {activeTab === 'claims' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
          </button>
        )}
        {currentUser.role !== 'WRITER' && (
          <button 
            onClick={() => setActiveTab('reservations')}
            className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'reservations' ? 'text-white' : 'hover:text-white'}`}
          >
            <span>حجوزاتي النشطة ({reservations.filter(r => r.status === 'ACTIVE').length})</span>
            {activeTab === 'reservations' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
          </button>
        )}
        <button 
          onClick={() => setActiveTab('add-novel')}
          className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'add-novel' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>{currentUser.role === 'WRITER' ? 'تأليف رواية جديدة +' : 'تسجيل رواية جديدة للترجمة +'}</span>
          {activeTab === 'add-novel' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('activity')}
          className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'activity' ? 'text-white' : 'hover:text-white'}`}
        >
          <span className="flex items-center gap-1">📋 صفحة الأنشطة والجدولة ({chapters.length})</span>
          {activeTab === 'activity' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('deleted-chapters')}
          className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'deleted-chapters' ? 'text-white' : 'hover:text-white'}`}
        >
          <span className="flex items-center gap-1">🗑️ الفصول المحذوفة ({deletedChapters.length})</span>
          {activeTab === 'deleted-chapters' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="w-full">
        {/* TAB 1: Novels list */}
        {activeTab === 'novels' && (
          <div className="flex flex-col gap-4">
            {novels.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {novels.map((novel) => (
                  <div 
                    key={novel.id}
                    className="p-4 bg-[#1A1625] border border-white/5 hover:border-violet-500/20 rounded-2xl flex gap-4 transition-all"
                  >
                    <img src={novel.cover} alt={novel.titleAr} className="w-16 h-24 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-extrabold text-sm text-white truncate">{novel.titleAr}</h4>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${novel.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                            {novel.status === 'PENDING' ? 'بانتظار موافقة الإدارة' : 'نشطة بالموقع'}
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-400 truncate mt-0.5">{novel.titleEn}</p>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-white/5 text-[10px] text-purple-300">
                        <span>{novel.chaptersCount} فصل منشور</span>
                        <div className="flex gap-2.5 items-center">
                          {novel.status !== 'PENDING' && (
                            <>
                              <button 
                                onClick={() => downloadNovelAndChapters(novel)}
                                className="px-2.5 py-1.5 bg-[#1F172B] hover:bg-[#2A203C] text-violet-300 hover:text-white border border-violet-500/20 hover:border-violet-500/40 rounded-xl text-[9px] font-bold cursor-pointer transition-all flex items-center gap-1"
                                title="تنزيل الرواية وفصولها بالكامل كملف نصي"
                              >
                                <span>تنزيل 📥</span>
                              </button>
                              <button 
                                onClick={() => onNavigate('novel', { id: novel.id, autoOpenAddChapter: true })}
                                className="px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-xl text-[9px] font-bold cursor-pointer transition-all flex items-center gap-1"
                              >
                                <span>إضافة فصل جديد +</span>
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => onNavigate('novel', { id: novel.id })}
                            className="text-violet-400 font-extrabold hover:text-violet-300"
                          >
                            عرض وتعديل ←
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                <AlertCircle size={32} className="mx-auto mb-2 text-violet-400 animate-pulse" />
                <p className="text-sm">لم تقم بتسجيل أو حجز أي رواية خاصة بك حتى الآن.</p>
                <button 
                  onClick={() => setActiveTab('add-novel')}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold mt-4"
                >
                  سجل أول رواية لك الآن
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Active Reservations */}
        {activeTab === 'reservations' && (
          <div className="flex flex-col gap-4 text-right animate-in fade-in duration-300">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-purple-300 flex items-start gap-2 leading-relaxed">
              <AlertCircle size={14} className="shrink-0 text-violet-400 mt-0.5" />
              <span>
                إدارة المهلة الزمنية: لكل حجز رواية مدة صلاحية قدرها **30 يوماً**. إذا انتهت الـ 30 يوماً دون نشر أي فصول للرواية، يتم إلغاء الحجز تلقائياً لتتاح الرواية لمترجمين آخرين ومكافحة الاحتكار. يمكنك طلب تمديد الحجز بمهلة إضافية عند الحاجة.
              </span>
            </div>

            {reservations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reservations.map((res) => {
                  const daysLeft = Math.ceil((new Date(res.endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysLeft <= 0 || res.status === 'EXPIRED';
                  
                  return (
                    <div 
                      key={res.id} 
                      className="p-5 bg-[#1A1625] border border-white/5 hover:border-violet-500/10 rounded-2xl flex flex-col justify-between transition-all"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="font-extrabold text-xs text-white">{res.novelTitle}</h4>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            res.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400' :
                            isExpired ? 'bg-zinc-500/10 text-zinc-400' :
                            'bg-green-500/10 text-green-400'
                          }`}>
                            {res.status === 'CANCELLED' ? 'ملغي' :
                             isExpired ? 'منتهي الصلاحية' :
                             'نشط ومحمي ⏱️'}
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-purple-400 flex flex-col gap-1 mt-2.5">
                          <div>تاريخ البدء: <span className="text-white font-mono">{new Date(res.startAt).toLocaleDateString('ar-EG')}</span></div>
                          <div>تاريخ الانتهاء: <span className="text-white font-mono">{new Date(res.endAt).toLocaleDateString('ar-EG')}</span></div>
                        </div>

                        <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                          <span className="text-purple-300">المهلة المتبقية:</span>
                          <span className={`font-extrabold ${isExpired ? 'text-red-400' : daysLeft <= 5 ? 'text-amber-400 animate-pulse' : 'text-violet-400'}`}>
                            {isExpired ? 'انتهى الحجز (0 يوم)' : `${daysLeft} يوماً متبقياً`}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end mt-5 pt-3 border-t border-white/5">
                        {/* Simulation button for easy demo */}
                        {!isExpired && res.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleSimulateTime(res.id)}
                            className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-black rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                            title="لمحاكاة مرور 30 يوماً فوراً للتأكد من زوال الحجز وعودة الرواية للاقتراحات"
                          >
                            ⌛ محاكاة 30 يوماً
                          </button>
                        )}

                        {!isExpired && res.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleCancelMyReservation(res.id, res.novelId, res.novelTitle)}
                            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            إلغاء الحجز ❌
                          </button>
                        )}

                        {res.extensionRequested ? (
                          <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                            ⏳ تم إرسال طلب التمديد وبانتظار الإدارة
                          </span>
                        ) : (
                          !isExpired && res.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleRequestExtension(res.id)}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            >
                              طلب تمديد الحجز ⏱️
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                <p className="text-xs">لا تملك أي حجوزات نشطة حالياً.</p>
                <button
                  onClick={() => setActiveTab('claims')}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold mt-4 cursor-pointer"
                >
                  استكشف الروايات المقترحة لحجزها
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Suggestions available for claiming/reservation */}
        {activeTab === 'claims' && (
          <div className="flex flex-col gap-4 text-right">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-purple-300 flex items-start gap-2 leading-relaxed">
              <AlertCircle size={14} className="shrink-0 text-violet-400 mt-0.5" />
              <span>
                طبقاً لمستند المواصفات الفنية: عندما تختار "قبول ترجمة واستلام" رواية من الاقتراحات المرفوعة من الأعضاء، فإنها **تزول وتختفي من خانة الاقتراحات العامة** وتتحول تلقائياً إلى حالة **محجوزة لترجمتك** وتظهر فوراً في حسابك لبدء ترجمتها!
              </span>
            </div>

            {suggestions.length > 0 ? (
              <div className="flex flex-col gap-3">
                {suggestions.map((sug) => (
                  <div key={sug.id} className="p-5 bg-[#1A1625] border border-white/5 hover:border-violet-500/20 rounded-2xl flex flex-col md:flex-row gap-5 transition-all text-right">
                    <img src={sug.cover} alt={sug.titleAr} className="w-24 h-36 rounded-xl object-cover border border-white/5 mx-auto md:mx-0" />
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-sm text-white">{sug.titleAr}</h4>
                          <span className="text-[10px] bg-purple-500/10 text-purple-300 px-2.5 py-0.5 rounded-full font-extrabold">👍 {sug.votes} صوت للتأييد</span>
                        </div>
                        <p className="text-[10px] text-purple-400 mt-0.5">{sug.titleEn}</p>
                        <p className="text-xs text-purple-300 mt-3 leading-relaxed">{sug.description}</p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-3 border-t border-white/5 gap-3">
                        <span className="text-[10px] text-purple-400">اقترح بواسطة: <span className="font-bold text-white">{sug.suggestedBy}</span></span>
                        
                        <div className="flex gap-2">
                          {sug.novelUpdatesLink && (
                            <a 
                              href={sug.novelUpdatesLink} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-purple-300 rounded-lg text-xs font-bold transition-all"
                            >
                              NovelUpdates 🔗
                            </a>
                          )}
                          <button 
                            onClick={() => handleClaimSuggestion(sug)}
                            className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-violet-500/10"
                          >
                            طلب استلام الرواية وحجزها للترجمة 📝
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                <p className="text-sm font-semibold">لا توجد اقتراحات روائية بانتظار الترجمة حالياً.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Create Novel */}
        {activeTab === 'add-novel' && (
          <div className="glass-panel p-6 rounded-2xl border border-white/5 text-right">
            
            {success && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-2 text-xs mb-6">
                <CheckCircle size={16} />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleCreateNovel} className="flex flex-col gap-5 text-xs font-medium">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">الاسم العربي للرواية *</label>
                  <input 
                    type="text" 
                    required
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    placeholder="مثال: بداية ما بعد السد الأكبر"
                    className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">الاسم الإنجليزي للرواية *</label>
                  <input 
                    type="text" 
                    required
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder="مثال: The Beginning of the Great Gate"
                    className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">المؤلف الأصلي للرواية *</label>
                  <input 
                    type="text" 
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="مثال: TurtleMe"
                    className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">اللغة الأصلية للرواية *</label>
                  <select 
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-purple-200 text-xs transition-all text-right cursor-pointer"
                  >
                    <option value="الكورية">الكورية 🇰🇷</option>
                    <option value="الصينية">الصينية 🇨🇳</option>
                    <option value="اليابانية">اليابانية 🇯🇵</option>
                    <option value="الإنجليزية">الإنجليزية 🇺🇸</option>
                  </select>
                </div>
              </div>

              {/* Genres checkbox list */}
              <div className="flex flex-col gap-1.5">
                <label className="text-purple-200">اختر التصنيفات المناسبة للرواية</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {genresOptions.map((g) => {
                    const isSelected = selectedGenres.includes(g);
                    return (
                      <button 
                        key={g}
                        type="button"
                        onClick={() => {
                          setSelectedGenres(prev => 
                            isSelected ? prev.filter(item => item !== g) : [...prev, g]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${isSelected ? 'bg-violet-600 border-violet-500 text-white' : 'bg-[#1A1625] border-white/5 text-purple-300'}`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Synopsis description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-purple-200">نبذة وقصة الرواية الأصلي بالتفصيل *</label>
                <textarea 
                  required
                  rows={4}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="اكتب فصول النبذة الأولى بشكل فخم لجذب واهتمام مجتمع القراء..."
                  className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-white/5">
                <button 
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-violet-500/10"
                >
                  تقديم طلب مراجعة الرواية ونشرها بالمنصة
                </button>
              </div>

            </form>

          </div>
        )}

        {/* TAB 4: Activity Desk & Scheduling */}
        {activeTab === 'activity' && (
          <div className="flex flex-col gap-4 text-right animate-in fade-in duration-300">
            <div className="p-5 bg-gradient-to-r from-violet-950/20 to-purple-950/20 border border-violet-500/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Calendar size={16} className="text-violet-400" />
                  <span>لوحة الأنشطة وجدولة الفصول تلقائياً</span>
                </h3>
                <p className="text-[10px] text-purple-400 mt-1">تتبع كل فصولك المترجمة، عدل عليها بدون قيود زمنية، وجدول مواعيد نشرها في ثوانٍ معدودة.</p>
              </div>
              <span className="text-[10px] bg-violet-600/20 text-violet-300 px-3 py-1 rounded-xl font-bold border border-violet-500/20">
                إجمالي فصولك: {chapters.length} فصلاً
              </span>
            </div>

            {chapters.length > 0 ? (
              <div className="flex flex-col gap-3">
                {chapters.map((chap) => {
                  const isScheduled = chap.publishAt && new Date(chap.publishAt) > new Date();
                  return (
                    <div 
                      key={chap.id}
                      className="p-4 bg-[#1A1625] border border-white/5 hover:border-violet-500/10 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-xs text-white truncate">{chap.title}</h4>
                          <span className="text-[9px] bg-violet-950 text-violet-300 px-2 py-0.5 rounded border border-white/5 font-bold">
                            {chap.novelTitle}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[9px] text-purple-400">
                          <span>المشاهدات: {chap.views || 0} 👀</span>
                          <span>تاريخ الإنشاء: {new Date(chap.createdAt).toLocaleDateString('ar-EG')} ⏱️</span>
                          {chap.images && <span>مرفق به {chap.images.length} صورة 🖼️</span>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {isScheduled ? (
                          <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-xl font-bold font-mono">
                            📅 مجدول للنشر: {new Date(chap.publishAt).toLocaleString('ar-EG')}
                          </span>
                        ) : (
                          <span className="text-[9px] bg-green-500/15 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-xl font-bold">
                            ✅ منشور علناً للقراء
                          </span>
                        )}

                        {/* 15 Days Rule Badge */}
                        {(() => {
                          const perm = canModifyChapter(chap);
                          if (currentUser.role === 'OWNER') {
                            return (
                              <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-xl font-bold">
                                🛡️ صلاحية المالك كاملة
                              </span>
                            );
                          }
                          return perm.allowed ? (
                            <span className="text-[9px] bg-blue-500/15 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-xl font-bold">
                              ⏳ متبقي {perm.daysLeft} يوم للتعديل/الحذف
                            </span>
                          ) : (
                            <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-xl font-bold">
                              🔒 مغلق (مرت 15 يوماً)
                            </span>
                          );
                        })()}

                        <div className="flex gap-2">
                          <button 
                            disabled={!canModifyChapter(chap).allowed}
                            onClick={() => handleOpenEditModal(chap)}
                            className={`p-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all border flex items-center gap-1 ${
                              canModifyChapter(chap).allowed 
                                ? 'bg-violet-600/10 hover:bg-violet-600/20 text-violet-300 border-violet-500/10' 
                                : 'bg-gray-800/30 text-gray-500 border-gray-800/20 cursor-not-allowed opacity-50'
                            }`}
                            title={canModifyChapter(chap).reason}
                          >
                            <Edit size={12} />
                            <span>تعديل الفصل ✍️</span>
                          </button>
                          <button 
                            disabled={!canModifyChapter(chap).allowed}
                            onClick={() => handleDeleteChapter(chap.id)}
                            className={`p-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all border flex items-center gap-1 ${
                              canModifyChapter(chap).allowed 
                                ? 'bg-red-600/10 hover:bg-red-600/20 text-red-400 border-red-500/10' 
                                : 'bg-gray-800/30 text-gray-500 border-gray-800/20 cursor-not-allowed opacity-50'
                            }`}
                            title={canModifyChapter(chap).reason}
                          >
                            <Trash2 size={12} />
                            <span>حذف 🗑️</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center bg-[#1A1625] border border-dashed border-white/5 rounded-3xl text-xs text-purple-400">
                لم تقم بنشر أو جدولة أي فصول بعد. اختر رواية من لوحة التحكم وابدأ بإضافة فصولك!
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Deleted Chapters Archive */}
        {activeTab === 'deleted-chapters' && (
          <div className="flex flex-col gap-4 text-right animate-in fade-in duration-300">
            <div className="p-5 bg-gradient-to-r from-red-950/20 to-purple-950/20 border border-red-500/10 rounded-2xl">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Trash2 size={16} className="text-red-400 animate-pulse" />
                <span>سلة المحذوفات وأرشيف الفصول المحذوفة</span>
              </h3>
              <p className="text-[10px] text-purple-400 mt-1">
                {currentUser.role === 'OWNER' 
                  ? 'بصفتك مالك الموقع، تظهر هنا كل الفصول المحذوفة من جميع المترجمين والكتّاب، حيث يمكنك استعادتها أو مسحها نهائياً لضمان سلامة المحتوى.'
                  : 'الفصول التي قمت بحذفها تظل محفوظة هنا بأمان. يمكنك مراجعتها، استعادتها إلى فصول الرواية، أو حذفها نهائياً.'}
              </p>
            </div>

            {deletedChapters.length > 0 ? (
              <div className="flex flex-col gap-3">
                {deletedChapters.map((chap) => (
                  <div 
                    key={chap.id}
                    className="p-4 bg-[#1A1625] border border-white/5 hover:border-red-500/10 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-xs text-white truncate">{chap.title}</h4>
                        <span className="text-[9px] bg-red-950/40 text-red-300 px-2 py-0.5 rounded border border-red-500/10 font-bold">
                          {chap.novelTitle}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[9px] text-purple-400">
                        <span>حذفها: {chap.deletedBy} 👤</span>
                        <span>تاريخ الحذف: {new Date(chap.deletedAt).toLocaleString('ar-EG')} 📅</span>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => handleRestoreChapter(chap.id)}
                        className="p-2 px-3 bg-green-600/10 hover:bg-green-600/20 text-green-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all border border-green-500/10 flex items-center gap-1"
                      >
                        <span>استعادة الفصل ↩️</span>
                      </button>
                      <button 
                        onClick={() => handlePermanentlyDelete(chap.id)}
                        className="p-2 px-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all border border-red-500/10 flex items-center gap-1"
                      >
                        <span>حذف نهائي ❌</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center bg-[#1A1625] border border-dashed border-white/5 rounded-3xl text-xs text-purple-400">
                سلة المحذوفات فارغة تماماً ولا توجد فصول مؤرشفة حالياً.
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT CHAPTER MODAL OVERLAY */}
      {editingChapter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#14101D] border border-violet-500/20 rounded-3xl p-6 max-w-2xl w-full text-right shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <h3 className="font-extrabold text-sm md:text-base text-white border-b border-white/5 pb-3 mb-4 flex items-center gap-2">
              <Edit size={18} className="text-violet-400" />
              <span>تعديل الفصل: {editingChapter.title}</span>
            </h3>

            <form onSubmit={handleSaveEditChapter} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-purple-200 font-bold">عنوان الفصل</label>
                <input 
                  type="text" 
                  required
                  value={editChapterTitle}
                  onChange={(e) => setEditChapterTitle(e.target.value)}
                  className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-purple-200 font-bold">متن الفصل</label>
                  
                  {/* Rich Text Format Helpers */}
                  <div className="flex gap-1">
                    <button 
                      type="button" 
                      onClick={() => {
                        const textarea = document.getElementById('edit-content-textarea') as HTMLTextAreaElement;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selected = text.substring(start, end);
                        const replacement = `<b>${selected || 'نص غامق'}</b>`;
                        setEditChapterContent(text.substring(0, start) + replacement + text.substring(end));
                      }} 
                      className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white border border-white/5 rounded-lg text-[9px] font-bold cursor-pointer"
                    >
                      B
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const textarea = document.getElementById('edit-content-textarea') as HTMLTextAreaElement;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selected = text.substring(start, end);
                        const replacement = `<i>${selected || 'نص مائل'}</i>`;
                        setEditChapterContent(text.substring(0, start) + replacement + text.substring(end));
                      }} 
                      className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white border border-white/5 rounded-lg text-[9px] italic font-bold cursor-pointer"
                    >
                      I
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const textarea = document.getElementById('edit-content-textarea') as HTMLTextAreaElement;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selected = text.substring(start, end);
                        const replacement = `<u>${selected || 'نص مسطر'}</u>`;
                        setEditChapterContent(text.substring(0, start) + replacement + text.substring(end));
                      }} 
                      className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white border border-white/5 rounded-lg text-[9px] underline font-bold cursor-pointer"
                    >
                      U
                    </button>
                  </div>
                </div>
                <textarea 
                  id="edit-content-textarea"
                  required
                  rows={8}
                  value={editChapterContent}
                  onChange={(e) => setEditChapterContent(e.target.value)}
                  className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white font-sans"
                />
              </div>

              {/* Chapter Images Attachment with easy PNG Upload */}
              <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl border border-white/5 text-right">
                <label className="text-xs font-extrabold text-purple-200 flex items-center gap-1">
                  <Eye size={14} className="text-violet-400" />
                  <span>إرفاق أو تعديل صور ورسومات الفصل (PNG, JPG)</span>
                </label>
                <p className="text-[10px] text-purple-300/70">ارفع صور PNG جديدة مباشرة من جهازك، أو عدل الروابط الموجودة مسبقاً.</p>

                {/* File picker */}
                <div className="flex flex-col items-center justify-center border border-dashed border-violet-500/20 hover:border-violet-500/50 bg-[#1A1625]/80 p-4 rounded-xl text-center transition-colors">
                  <input 
                    type="file" 
                    id="edit-png-uploader"
                    accept="image/*"
                    multiple
                    onChange={handleEditImageUpload}
                    className="hidden"
                  />
                  <label 
                    htmlFor="edit-png-uploader"
                    className="cursor-pointer flex flex-col items-center gap-1 w-full py-2"
                  >
                    <RefreshCw size={24} className="text-violet-400 animate-spin-slow" />
                    <span className="text-xs font-bold text-white">اضغط هنا لرفع صور PNG إضافية من جهازك 📂</span>
                    <span className="text-[9px] text-purple-400">يدعم صيغ PNG, JPG, WebP وGIF</span>
                  </label>
                </div>

                {/* Thumbnails preview */}
                {editChapterImages.split(',').map(url => url.trim()).filter(url => url.length > 0).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 p-2 bg-black/20 rounded-xl border border-white/5">
                    {editChapterImages.split(',').map(url => url.trim()).filter(url => url.length > 0).map((url, idx) => (
                      <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-md">
                        <img src={url} alt="Attached" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeEditAttachedImage(idx)}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer text-[10px] font-bold"
                        >
                          حذف ❌
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional manual URL input */}
                <div className="flex flex-col gap-1 mt-2">
                  <span className="text-[10px] font-bold text-purple-300">الروابط النصية للصور (مفصولة بفاصلة):</span>
                  <input 
                    type="text" 
                    value={editChapterImages}
                    onChange={(e) => setEditChapterImages(e.target.value)}
                    placeholder="رابط الصورة 1, رابط الصورة 2..."
                    className="bg-[#1A1625] border border-white/5 focus:border-violet-500 outline-none rounded-xl px-4 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-purple-200 font-bold">📅 جدولة وقت النشر التلقائي بالتاريخ الميلادي</label>
                <input 
                  type="datetime-local" 
                  value={editChapterPublishAt}
                  onChange={(e) => setEditChapterPublishAt(e.target.value)}
                  className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white font-mono"
                />
                <span className="text-[9px] text-purple-400">اختر التاريخ والوقت الميلادي الذي ترغب في إعادة جدولة الفصل فيه تلقائياً. اتركه فارغاً للنشر الفوري.</span>
              </div>

              <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => setEditingChapter(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-xl font-bold cursor-pointer shadow-lg shadow-violet-500/10"
                >
                  حفظ تعديلات الفصل 💾
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
