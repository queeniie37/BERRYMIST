import React, { useState, useEffect } from 'react';
import { FileText, Plus, CheckCircle, Flame, Clock, Award, Check, Layers, AlertCircle, Edit, Trash2, Calendar, BookOpen, Eye, RefreshCw, Upload, Image } from 'lucide-react';
import { Novel, Suggestion, Reservation, User } from '../types';
import { BerryDatabase, COVER_IMAGES } from '../data';
import { getTranslatorPoints, getAllTranslatorsPoints, isUserTranslatorOfTheMonth, getCurrentMonthKey } from '../utils/points';
import ConfirmModal from './ConfirmModal';

interface TranslatorPanelProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
}

export default function TranslatorPanel({ currentUser, onNavigate }: TranslatorPanelProps) {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeTab, setActiveTab] = useState<'novels' | 'claims' | 'reservations' | 'add-novel' | 'activity' | 'deleted-chapters' | 'edit-requests' | 'points'>('novels');
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
  
  // Create novel form
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [author, setAuthor] = useState('');
  const [lang, setLang] = useState('الكورية');
  const [desc, setDesc] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState('');
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

  const genresOptions = ['أكشن', 'فانتزيا', 'مغامرات', 'إثارة', 'نظام', 'إسيكاي', 'موريم', 'دراما', 'غموض', 'رومانسية', 'كوميديا', 'تراجع', 'موسيقى'];

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
    const isScheduled = chapter.publishAt && new Date(chapter.publishAt) > new Date();
    if (isScheduled) {
      return { allowed: true, reason: 'الفصول المجدولة قابلة للتعديل دائماً', daysLeft: 15 };
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

  // Edit Request Form States
  const [reqNovelName, setReqNovelName] = useState('');
  const [reqChapterName, setReqChapterName] = useState('');
  const [reqDetails, setReqDetails] = useState('');
  const [myEditRequests, setMyEditRequests] = useState<any[]>([]);

  const handleCreateEditRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqNovelName || !reqChapterName || !reqDetails) return;

    const newRequest = {
      id: `edit-req-${Date.now()}`,
      novelName: reqNovelName,
      chapterName: reqChapterName,
      details: reqDetails,
      translatorId: currentUser.id,
      translatorName: currentUser.username,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString()
    };

    const allEditReqs = BerryDatabase.get<any[]>('edit_requests', []);
    const updated = [newRequest, ...allEditReqs];
    BerryDatabase.set('edit_requests', updated);

    // Send a system notification to the Owner
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-editreq-${Date.now()}`,
      userId: 'berrymist-owner',
      title: `طلب تعديل فصل جديد من المترجم: ${currentUser.username}`,
      message: `طلب المترجم "${currentUser.username}" تعديلاً على رواية "${reqNovelName}"، فصل: "${reqChapterName}". التفاصيل: ${reqDetails}`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: new Date().toISOString()
    };
    BerryDatabase.set('notifications', [newNotif, ...allNotifs]);

    setMyEditRequests(updated.filter(r => r.translatorId === currentUser.id));
    setReqNovelName('');
    setReqChapterName('');
    setReqDetails('');
    alert('تم إرسال طلب التعديل لمالك الموقع بنجاح! سيتم مراجعته وتعديل الفصل قريباً.');
  };

  const handleStatusChange = (novelId: string, newStatus: any) => {
    let reason = '';
    const statusNames: Record<string, string> = {
      ONGOING: 'مستمرة',
      HIATUS: 'متوقفة مؤقتاً',
      CANCELLED: 'متوقفة نهائياً',
      COMPLETED: 'مكتملة'
    };

    if (newStatus === 'HIATUS' || newStatus === 'CANCELLED') {
      const promptMsg = newStatus === 'HIATUS' 
        ? 'يرجى إدخال سبب التوقف المؤقت (سيصل السبب لمالك الموقع):' 
        : 'يرجى إدخال سبب التوقف النهائي (سيصل السبب لمالك الموقع):';
      reason = prompt(promptMsg) || '';
      if (!reason.trim()) {
        alert('يجب ذكر السبب لتغيير الحالة إلى متوقفة!');
        return;
      }
    }

    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const updated = allNovels.map(n => {
      if (n.id === novelId) {
        return {
          ...n,
          status: newStatus,
          statusChangeReason: reason || undefined
        };
      }
      return n;
    });

    BerryDatabase.set('novels', updated);
    setNovels(updated.filter(n => n.translatorId === currentUser.id || currentUser.role === 'OWNER'));

    // Send Admin Notification to owner
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-status-${Date.now()}`,
      userId: 'berrymist-owner',
      title: `تغيير حالة رواية: ${updated.find(n => n.id === novelId)?.titleAr || ''}`,
      message: `قام المترجم "${currentUser.username}" بتغيير حالة رواية "${updated.find(n => n.id === novelId)?.titleAr || ''}" إلى (${statusNames[newStatus]}). ${reason ? `السبب: ${reason}` : ''}`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: new Date().toISOString()
    };
    BerryDatabase.set('notifications', [newNotif, ...allNotifs]);

    alert(`تم تغيير حالة الرواية إلى (${statusNames[newStatus]}) بنجاح وتنبيه المالك.`);
    window.dispatchEvent(new Event('novels-updated'));
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

    // Load my edit requests
    const allEditReqs = BerryDatabase.get<any[]>('edit_requests', []);
    setMyEditRequests(allEditReqs.filter(r => r.translatorId === currentUser.id));

    loadChaptersAndDeleted();
  }, [currentUser, activeTab]);

  // Handle deleting a chapter (with confirmation & archives it)
  const handleDeleteChapter = (chapterId: string) => {
    if (currentUser.role !== 'OWNER') {
      alert('عذراً، المترجمون لا يملكون صلاحية حذف الفصول التي تم نشرها. فقط مالك الموقع يملك هذه الصلاحية.');
      return;
    }

    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const chapterToDelete = allChapters.find(c => c.id === chapterId);
    if (!chapterToDelete) return;

    // Enforce 15-day restriction
    const permission = canModifyChapter(chapterToDelete);
    if (!permission.allowed) {
      alert(`عذراً، لا يمكنك حذف هذا الفصل! السبب: ${permission.reason}. يرجى التواصل مع الإدارة لأي تعديلات.`);
      return;
    }

    showConfirm(
      'حذف الفصل ونقله للأرشيف (تأكيد 1/2)',
      `هل أنت متأكد تماماً من حذف هذا الفصل؟ سيتم نقله إلى أرشيف الفصول المحذوفة ويمكنك استعادته أو حذفه نهائياً من هناك.`,
      () => {
        setTimeout(() => {
          showConfirm(
            'حذف الفصل ونقله للأرشيف (تأكيد نهائي 2/2) ⚠️',
            `تنبيه أخير ومؤكد: هل أنت متأكد تماماً وبشكل قاطع من إزالة هذا الفصل ونقله لسلة المحذوفات؟`,
            () => {
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
                const actualCount = remainingChapters.filter(c => c.novelId === n.id).length;
                const updatedNovels = allNovels.map(novel => {
                  if (novel.id === n.id) {
                    return {
                      ...novel,
                      chaptersCount: actualCount
                    };
                  }
                  return novel;
                });
                BerryDatabase.set('novels', updatedNovels);
              }

              loadChaptersAndDeleted();
              window.dispatchEvent(new Event('novels-updated'));
              alert('تم حذف الفصل ونقله إلى الأرشيف بنجاح! 🗑️');
            },
            true
          );
        }, 100);
      },
      true
    );
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
    const actualCount = [...allChapters, originalChapter].filter(c => c.novelId === originalChapter.novelId).length;
    const updatedNovels = allNovels.map(novel => {
      if (novel.id === originalChapter.novelId) {
        return {
          ...novel,
          chaptersCount: actualCount
        };
      }
      return novel;
    });
    BerryDatabase.set('novels', updatedNovels);

    loadChaptersAndDeleted();
    window.dispatchEvent(new Event('novels-updated'));
    alert('تم استعادة الفصل ونشره مجدداً بنجاح! ↩️');
  };

  // Handle permanently deleting a chapter
  const handlePermanentlyDelete = (deletedId: string) => {
    showConfirm(
      'حذف الفصل نهائياً ⚠️ (تأكيد 1/2)',
      'تحذير: هل أنت متأكد من حذف هذا الفصل نهائياً؟ هذا الإجراء لا يمكن التراجع عنه وسيمحو الفصل تماماً من قواعد البيانات!',
      () => {
        setTimeout(() => {
          showConfirm(
            'حذف الفصل نهائياً ⚠️ (تأكيد نهائي 2/2)',
            'تنبيه أخير وقاطع: هل أنت متأكد تماماً من رغبتك في مسح هذا الفصل نهائياً وبشكل دائم ومحوه للأبد؟ لا يمكن استعادة الفصل بعد هذا الإجراء!',
            () => {
              const allDeleted = BerryDatabase.get<any[]>('deleted_chapters', []);
              const remainingDeleted = allDeleted.filter(d => d.id !== deletedId);
              BerryDatabase.set('deleted_chapters', remainingDeleted);

              loadChaptersAndDeleted();
              alert('تم حذف الفصل نهائياً وبشكل دائم. ❌');
            },
            true
          );
        }, 100);
      },
      true
    );
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
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'png' && file.type !== 'image/png') {
        alert('يرجى اختيار صور بصيغة PNG فقط لضمان جمالية وتوافق العرض بالمنصة!');
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

    if (editChapterPublishAt) {
      const publishDate = new Date(editChapterPublishAt);
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
    if (!coverImage) {
      alert('خطأ: يرجى إرفاق وتحميل ملف غلاف الرواية بصيغة PNG أولاً.');
      return;
    }

    const isOwner = currentUser.role === 'OWNER' || currentUser.email?.toLowerCase() === 'berrymist11@gmail.com';
    const status = 'AVAILABLE'; // Make all novels active and AVAILABLE instantly so they appear on the homepage for visitors right away!

    const newNovel: Novel = {
      id: `novel-draft-${Date.now()}`,
      titleAr,
      titleEn,
      author,
      translatorId: currentUser.id,
      translatorName: currentUser.username,
      cover: coverImage,
      chaptersCount: 0,
      views: 0,
      likes: 0,
      bookmarksCount: 0,
      rating: 5.0,
      ratingCount: 0,
      status: status, // Published immediately!
      language: lang,
      genres: selectedGenres,
      description: desc,
      createdAt: new Date().toISOString(),
      downloadAllowed: true
    };

    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    BerryDatabase.set('novels', [newNovel, ...allNovels]);

    if (!isOwner) {
      // Notify administrators
      const allNotifs = BerryDatabase.get<any[]>('notifications', []);
      const newNotif = {
        id: `notif-review-${Date.now()}`,
        userId: 'berrymist-owner', // Notify Super Admin
        title: 'تم نشر رواية جديدة تلقائياً',
        message: `قام ${currentUser.role === 'WRITER' ? 'الكاتب' : 'المترجم'} "${currentUser.username}" بنشر رواية جديدة "${titleAr}" بنجاح على الموقع.`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: 'الآن'
      };
      BerryDatabase.set('notifications', [...allNotifs, newNotif]);
      setSuccess('تهانينا! تم إنشاء ونشر روايتك بنجاح وأصبحت نشطة فوراً لجميع الزوار على الصفحة الرئيسية! 🎉');
    } else {
      setSuccess('تمت إضافة ونشر الرواية الجديدة مباشرة بنجاح بصفك مالك المنصة! 🎉');
    }

    setTitleAr('');
    setTitleEn('');
    setAuthor('');
    setDesc('');
    setSelectedGenres([]);
    setCoverImage('');

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
        <button 
          onClick={() => setActiveTab('edit-requests')}
          className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'edit-requests' ? 'text-white' : 'hover:text-white'}`}
        >
          <span className="flex items-center gap-1">🛠️ طلب تعديل فصل</span>
          {activeTab === 'edit-requests' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('points')}
          className={`pb-3 px-6 relative transition-colors shrink-0 ${activeTab === 'points' ? 'text-white' : 'hover:text-white'}`}
        >
          <span className="flex items-center gap-1">🌟 نظام النقاط ({getTranslatorPoints(currentUser.id, currentUser.username).pointsThisMonth} ن)</span>
          {activeTab === 'points' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
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

                      <div className="flex flex-col gap-2 mt-3 pt-2.5 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] text-purple-300">
                          <span>{novel.chaptersCount} فصل منشور</span>
                          <div className="flex gap-2.5 items-center">
                            {novel.status !== 'PENDING' && (
                              <button
                                onClick={() => onNavigate('novel', { id: novel.id, autoOpenAddChapter: true })}
                                className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white rounded-xl text-[9px] font-bold cursor-pointer transition-all flex items-center gap-1"
                              >
                                <span>إضافة فصل جديد +</span>
                              </button>
                            )}
                            <button 
                              onClick={() => onNavigate('novel', { id: novel.id })}
                              className="text-violet-400 font-extrabold hover:text-violet-300 text-[10px]"
                            >
                              عرض وتعديل ←
                            </button>
                          </div>
                        </div>

                        {novel.status !== 'PENDING' && (
                          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] bg-white/5 p-2 rounded-xl border border-white/5">
                            <span className="text-purple-300 font-medium">الحالة: <span className="text-violet-300 font-bold">
                              {novel.status === 'ONGOING' || novel.status === 'TRANSLATING' || novel.status === 'AVAILABLE' ? 'مستمرة' :
                               novel.status === 'HIATUS' ? 'متوقفة مؤقتاً' :
                               novel.status === 'CANCELLED' ? 'متوقفة نهائياً' :
                               novel.status === 'COMPLETED' ? 'مكتملة' : novel.status}
                            </span></span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-purple-400">تغيير الحالة:</span>
                              <select
                                value={novel.status === 'TRANSLATING' || novel.status === 'AVAILABLE' ? 'ONGOING' : novel.status}
                                onChange={(e) => handleStatusChange(novel.id, e.target.value as any)}
                                className="bg-[#13101E] text-purple-200 border border-white/10 rounded-lg px-2 py-1 cursor-pointer text-[10px] outline-none focus:border-violet-500"
                              >
                                <option value="ONGOING">مستمرة</option>
                                <option value="HIATUS">متوقفة مؤقتاً</option>
                                <option value="CANCELLED">متوقفة نهائياً</option>
                                <option value="COMPLETED">مكتملة</option>
                              </select>
                            </div>
                          </div>
                        )}
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
                          <div>تاريخ البدء: <span className="text-white font-mono">{new Date(res.startAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</span></div>
                          <div>تاريخ الانتهاء: <span className="text-white font-mono">{new Date(res.endAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</span></div>
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

              {/* Cover Image Upload (Strictly PNG) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-purple-200">تحميل غلاف الرواية الفاخر (ملف PNG حصراً) *</label>
                <div className="relative border-2 border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl p-6 flex flex-col items-center justify-center bg-[#1A1625] hover:bg-white/5 transition-all text-center cursor-pointer min-h-[120px]">
                  <input 
                    type="file" 
                    accept=".png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const extension = file.name.split('.').pop()?.toLowerCase();
                      if (extension !== 'png') {
                        alert('خطأ: نقبل ملفات صور غلاف بصيغة PNG فقط لضمان الجودة الفاخرة لغلاف الرواية!');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setCoverImage(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {coverImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={coverImage} alt="Cover Preview" className="w-20 h-28 object-cover rounded-xl border border-violet-500" referrerPolicy="no-referrer" />
                      <span className="text-xs text-green-400 font-bold">تم تحميل الغلاف بنجاح ✓ (بصيغة PNG المعتمدة)</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="text-purple-400 mb-2" />
                      <p className="text-xs font-bold text-purple-200">اسحب ملف صورة الغلاف إلى هنا أو تصفح ملفاتك</p>
                      <p className="text-[10px] text-purple-400 mt-1">نقبل فقط ملفات PNG ويجب أن تكون الأبعاد عمودية بنسبة 2:3</p>
                    </>
                  )}
                </div>
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
                          <span>تاريخ الإنشاء: {new Date(chap.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })} ⏱️</span>
                          {chap.images && <span>مرفق به {chap.images.length} صورة 🖼️</span>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {isScheduled ? (
                          <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-xl font-bold font-mono">
                            📅 مجدول للنشر: {new Date(chap.publishAt).toLocaleString('en-US', { hour12: true })}
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
                        <span>تاريخ الحذف: {new Date(chap.deletedAt).toLocaleString('ar-EG', { numberingSystem: 'latn' })} 📅</span>
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

        {/* TAB 6: Edit Requests */}
        {activeTab === 'edit-requests' && (
          <div className="glass-panel p-6 rounded-2xl border border-white/5 text-right animate-in fade-in duration-300">
            <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2 justify-end">
              <span>طلب تعديل خطأ في فصل 🛠️</span>
              <AlertCircle className="text-violet-400" size={18} />
            </h3>
            <p className="text-xs text-purple-300 mb-6 leading-relaxed">
              إذا واجهت أي خطأ في فصل ما أو انتهت مهلة الـ 15 يوماً المتاحة للتعديل، يمكنك تقديم طلب تعديل مباشر لمالك الموقع لتعديله نيابة عنك.
            </p>

            {/* Submission Form */}
            <form onSubmit={handleCreateEditRequest} className="flex flex-col gap-5 text-xs font-medium">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">اسم الرواية *</label>
                  <input 
                    type="text" 
                    required
                    value={reqNovelName}
                    onChange={(e) => setReqNovelName(e.target.value)}
                    placeholder="مثال: بداية ما بعد السد الأكبر"
                    className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">الفصل المطلوب تعديله (الرقم أو الاسم) *</label>
                  <input 
                    type="text" 
                    required
                    value={reqChapterName}
                    onChange={(e) => setReqChapterName(e.target.value)}
                    placeholder="مثال: الفصل 25"
                    className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-purple-200">التغيير المطلوب والتعديلات المقترحة بالتفصيل *</label>
                <textarea 
                  required
                  rows={4}
                  value={reqDetails}
                  onChange={(e) => setReqDetails(e.target.value)}
                  placeholder="يرجى كتابة التعديل أو التغيير المطلوب بدقة..."
                  className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md"
                >
                  إرسال طلب التعديل للمالك 🚀
                </button>
              </div>
            </form>

            {/* List of submitted edit requests */}
            <div className="mt-8 border-t border-white/5 pt-6">
              <h4 className="text-xs font-bold text-purple-200 mb-4">طلبات التعديل المرسلة الخاصة بك:</h4>
              {myEditRequests.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {myEditRequests.map((r: any) => (
                    <div key={r.id} className="p-4 bg-[#1A1625] border border-white/5 rounded-xl flex justify-between items-center text-right text-xs">
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${r.status === 'RESOLVED' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {r.status === 'RESOLVED' ? 'تم التعديل ✓' : 'قيد المراجعة ⏱️'}
                        </span>
                        <div className="text-purple-300 mt-2">
                          رواية: <span className="text-white font-bold">{r.novelName}</span> | {r.chapterName}
                        </div>
                        <p className="text-purple-400 mt-1">{r.details}</p>
                      </div>
                      <span className="text-[10px] text-purple-500 font-mono">
                        {new Date(r.createdAt).toLocaleDateString('en-US')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-purple-400">لم تقم بإرسال أي طلبات تعديل بعد.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: Points System */}
        {activeTab === 'points' && (() => {
          const pointsInfo = getTranslatorPoints(currentUser.id, currentUser.username);
          const isCrowned = isUserTranslatorOfTheMonth(currentUser.username);
          const currentMonth = new Date().toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
          const nextPointViewsLeft = 10 - (pointsInfo.viewsThisMonth % 10);
          const progressPercent = ((pointsInfo.viewsThisMonth % 10) / 10) * 100;

          return (
            <div className="flex flex-col gap-6 text-right animate-in fade-in duration-300">
              
              {/* Crowned Greeting */}
              {isCrowned && (
                <div className="relative p-6 rounded-3xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-yellow-500/30 text-center flex flex-col items-center justify-center gap-2 overflow-hidden shadow-xl shadow-yellow-500/5">
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
                  <div className="text-4xl">🏆</div>
                  <h3 className="text-lg font-extrabold text-yellow-400">تهانينا الحارة! أنت مترجم الشهر!</h3>
                  <p className="text-xs text-yellow-100 max-w-md">
                    لقد تم تتويجك من قِبل الإدارة كـ <strong>مترجم الشهر</strong> نظراً لجهودك الاستثنائية وتفاعلك الرائع. تظهر رتبتك الخاصة الآن بجانب اسمك في جميع الفصول والتعليقات!
                  </p>
                </div>
              )}

              {/* Main Points Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Views & Points Box */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 md:col-span-2 flex flex-col gap-5 justify-between">
                  <div className="flex justify-between items-center flex-row-reverse">
                    <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2.5 py-1 rounded-full font-bold">
                      {currentMonth}
                    </span>
                    <h4 className="text-sm font-extrabold text-white">إحصائيات النقاط والمشاهدات المعتمدة 📈</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-[#13101E] p-4 rounded-xl border border-white/5">
                      <span className="text-[10px] text-purple-400 block mb-1">المشاهدات المعتمدة هذا الشهر</span>
                      <strong className="text-2xl font-extrabold text-white font-mono">{pointsInfo.viewsThisMonth}</strong>
                      <span className="text-[9px] text-purple-500 block mt-1">مشاهدة</span>
                    </div>
                    <div className="bg-gradient-to-br from-[#1C1430] to-[#120B20] p-4 rounded-xl border border-violet-500/10 shadow-inner">
                      <span className="text-[10px] text-violet-400 block mb-1">نقاطك الحالية المكتسبة</span>
                      <strong className="text-2xl font-extrabold text-violet-400 font-mono">{pointsInfo.pointsThisMonth}</strong>
                      <span className="text-[9px] text-violet-500 block mt-1">نقطة</span>
                    </div>
                  </div>

                  {/* Progress to Next Point */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[11px] text-purple-300">
                      <span>{pointsInfo.viewsThisMonth % 10} / 10 مشاهدات للقطة التالية</span>
                      <span>متبقي {nextPointViewsLeft} مشاهدات لنقطة جديدة</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5 p-[2px]">
                      <div 
                        className="bg-gradient-to-r from-violet-600 to-berry-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Rules & Info */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col gap-4 text-xs">
                  <h4 className="font-extrabold text-white flex items-center gap-1.5 justify-end">
                    <span>دليل نظام النقاط</span>
                    <Award className="text-violet-400" size={16} />
                  </h4>
                  <ul className="flex flex-col gap-3 text-purple-300 list-disc list-inside">
                    <li>كل <strong>10 مشاهدات معتمدة</strong> تمنحك <strong>نقطة واحدة</strong>.</li>
                    <li><strong>حماية المشاهدات:</strong> لا تُحتسب المشاهدة إلا إذا أمضى القارئ <strong>30 ثانية على الأقل</strong> داخل الفصل.</li>
                    <li>تتجدد النقاط وتصفر تلقائياً مع بداية كل شهر ميلادي لفتح باب المنافسة من جديد.</li>
                    <li>مترجم الشهر يحصل على رتبة مؤقتة فخمة بجانب اسمه حتى إعلان فائز الشهر التالي.</li>
                  </ul>
                </div>

              </div>

              {/* Points History */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <h4 className="text-sm font-extrabold text-white mb-4">سجل النقاط للأشهر السابقة 📜</h4>
                {pointsInfo.viewsHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-purple-300 text-right">
                      <thead>
                        <tr className="border-b border-white/5 text-purple-400">
                          <th className="pb-3 pt-1">الشهر الميلادي</th>
                          <th className="pb-3 pt-1">المشاهدات المنجزة</th>
                          <th className="pb-3 pt-1 text-left">النقاط المكتسبة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {pointsInfo.viewsHistory.map((h, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 font-sans">{h.month}</td>
                            <td className="py-3">{h.views} مشاهدة</td>
                            <td className="py-3 text-left text-violet-400 font-bold">{h.points} نقطة</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-purple-400 text-center py-4">لا توجد بيانات تاريخية للأشهر السابقة حتى الآن.</p>
                )}
              </div>

            </div>
          );
        })()}
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
                  rows={16}
                  value={editChapterContent}
                  onChange={(e) => setEditChapterContent(e.target.value)}
                  className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white font-sans min-h-[45vh] resize-y"
                />
              </div>

              {/* Image attachment fields removed per request to avoid cluttered inputs */}

              <div className="flex flex-col gap-1.5">
                <label className="text-purple-200 font-bold">📅 جدولة وقت النشر التلقائي بالتاريخ الميلادي</label>
                <input 
                  type="datetime-local" 
                  lang="en"
                  value={editChapterPublishAt}
                  onChange={(e) => setEditChapterPublishAt(e.target.value)}
                  min={getMinScheduleDate()}
                  max={getMaxScheduleDate()}
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
