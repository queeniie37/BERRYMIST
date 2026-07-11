import React, { useState, useEffect } from 'react';
import { Shield, Check, X, AlertCircle, MessageSquare, Layers, Clock, Settings, Bell, RefreshCw, UserCheck, Upload, Trash2 } from 'lucide-react';
import { Novel, Suggestion, Reservation, User, TranslatorRequest, Report } from '../types';
import { BerryDatabase } from '../data';
import { isImageSource, safeEmojiOrFallback, compressImageFile } from '../utils/media';
import { getAllTranslatorsPoints, crownTranslator, getCrownedTranslatorId, getCurrentMonthKey } from '../utils/points';
import ConfirmModal from './ConfirmModal';

interface AdminPanelProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
}

export default function AdminPanel({ currentUser, onNavigate }: AdminPanelProps) {
  const [allNovels, setAllNovels] = useState<Novel[]>([]);
  const [pendingNovels, setPendingNovels] = useState<Novel[]>([]);
  const [activeReservations, setActiveReservations] = useState<Reservation[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [translatorRequests, setTranslatorRequests] = useState<TranslatorRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'novels' | 'reservations' | 'logs' | 'translator_requests' | 'settings' | 'users' | 'reports' | 'edit-requests' | 'points' | 'trash'>('novels');
  const [rejectReason, setRejectReason] = useState<{ [novelId: string]: string }>({});
  const [deletedNovels, setDeletedNovels] = useState<any[]>([]);
  const [deletedChapters, setDeletedChapters] = useState<any[]>([]);
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
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  // Users management states
  const [users, setUsers] = useState<any[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newRoleVal, setNewRoleVal] = useState<string>('MEMBER');
  const [roleChangeReason, setRoleChangeReason] = useState<string>('');

  const [siteNameInput, setSiteNameInput] = useState(() => {
    const val = BerryDatabase.get<any>('site_name', 'BerryMist');
    return (typeof val === 'string' && val.trim()) ? val.trim() : 'BerryMist';
  });
  const [siteLogoInput, setSiteLogoInput] = useState(() => {
    const val = BerryDatabase.get<any>('site_logo', '🍇');
    return (typeof val === 'string' && val.trim()) ? val.trim() : '🍇';
  });
  const [siteBannerInput, setSiteBannerInput] = useState(() => {
    const val = BerryDatabase.get<any>('site_banner', '/site_banner.png');
    return (typeof val === 'string' && val.trim()) ? val.trim() : '/site_banner.png';
  });

  // Footer dynamic inputs
  const [footerDescInput, setFooterDescInput] = useState(() => BerryDatabase.get<string>('footer_description', 'منصة عربية رائدة تعنى بترجمة، اقتراح وقراءة الروايات الخفيفة وروايات الفانتازيا والويب المظلمة بأعلى دقة ومعايير حماية وجمالية بصرية فخمة للغاية.'));
  const [footerEmailInput, setFooterEmailInput] = useState(() => BerryDatabase.get<string>('footer_email', 'support@berrymist.com'));
  const [footerSupportInput, setFooterSupportInput] = useState(() => BerryDatabase.get<string>('footer_support_text', 'عبر تذكرة الديسكورد الرسمية بالأسفل'));
  const [footerCommunityTextInput, setFooterCommunityTextInput] = useState(() => BerryDatabase.get<string>('footer_community_text', 'انضم لعائلتنا الروائية الكبرى لتصلك إشعارات الفصول فور صدورها قبل الجميع حياً!'));

  const defaultSocialLinks = [
    { id: "discord", name: "Discord", icon: "👾", url: "https://discord.gg/berrymist", active: true },
    { id: "telegram", name: "Telegram", icon: "📢", url: "https://t.me/berrymist", active: true },
    { id: "facebook", name: "Facebook", icon: "👥", url: "", active: false },
    { id: "twitter", name: "Twitter / X", icon: "🐦", url: "", active: false },
    { id: "instagram", name: "Instagram", icon: "📸", url: "", active: false },
    { id: "tiktok", name: "TikTok", icon: "🎵", url: "", active: false },
    { id: "youtube", name: "YouTube", icon: "📺", url: "", active: false },
    { id: "whatsapp", name: "WhatsApp", icon: "💬", url: "", active: false }
  ];
  const [footerSocialsInput, setFooterSocialsInput] = useState<any[]>(() => BerryDatabase.get<any[]>('footer_socials', defaultSocialLinks));

  const handleSocialUrlChange = (id: string, url: string) => {
    setFooterSocialsInput(prev => prev.map(item => item.id === id ? { ...item, url } : item));
  };

  const handleSocialActiveToggle = (id: string) => {
    setFooterSocialsInput(prev => prev.map(item => item.id === id ? { ...item, active: !item.active } : item));
  };

  const handleSaveFooterSettings = (e: React.FormEvent) => {
    e.preventDefault();
    BerryDatabase.set('footer_description', footerDescInput.trim());
    BerryDatabase.set('footer_email', footerEmailInput.trim());
    BerryDatabase.set('footer_support_text', footerSupportInput.trim());
    BerryDatabase.set('footer_community_text', footerCommunityTextInput.trim());
    BerryDatabase.set('footer_socials', footerSocialsInput);
    
    // Dispatch event to update App.tsx footer state in real-time
    window.dispatchEvent(new Event('footer-settings-updated'));
    alert('تم حفظ إعدادات الفوتر وقنوات المجتمع بنجاح ونشرها حياً في الفوتر! 🎉');
  };

  const handleSaveSiteSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteNameInput.trim()) {
      alert('الرجاء إدخال اسم موقع صالح.');
      return;
    }
    
    // Support all common image formats (PNG, JPG, JPEG, WEBP, SVG, GIF) and base64/local paths
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
    const isImageFormat = (url: string) => {
      const lower = url.trim().toLowerCase();
      return (
        lower.startsWith('/') || 
        lower.startsWith('data:image/') || 
        allowedExtensions.some(ext => lower.includes(ext)) ||
        lower.includes('unsplash.com') ||
        lower.includes('api.dicebear.com')
      );
    };

    if (siteLogoInput.trim().startsWith('http') || siteLogoInput.trim().startsWith('/')) {
      if (!isImageFormat(siteLogoInput)) {
        alert('تنبيه: نوصي برابط صورة بصيغة مدعومة (PNG, JPG, JPEG, WEBP, SVG) لشعار المنصة لضمان جودة العرض!');
      }
    }
    if (siteBannerInput.trim().startsWith('http') || siteBannerInput.trim().startsWith('/')) {
      if (!isImageFormat(siteBannerInput)) {
        alert('تنبيه: نوصي برابط صورة بصيغة مدعومة (PNG, JPG, JPEG, WEBP, SVG) لغلاف المنصة لضمان جودة العرض!');
      }
    }

    // Hard guard: never store values big enough to break the ~5MB
    // localStorage quota or bloat the shared berry_db.json for visitors.
    const MAX_STORED_LENGTH = 1.5 * 1024 * 1024;
    if (siteLogoInput.length > MAX_STORED_LENGTH || siteBannerInput.length > MAX_STORED_LENGTH) {
      alert('حجم الصورة كبير جداً للتخزين! الرجاء رفع الصورة من زر الرفع ليتم ضغطها تلقائياً، أو استخدام رابط صورة خارجي.');
      return;
    }

    BerryDatabase.set('site_name', siteNameInput.trim());
    BerryDatabase.set('site_logo', siteLogoInput.trim() || '🍇');
    BerryDatabase.set('site_banner', siteBannerInput.trim() || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&fm=png');
    
    // Dispatch event to update other components in real-time
    window.dispatchEvent(new Event('site-settings-updated'));
    alert('تم حفظ إعدادات هوية المنصة بنجاح وتحديثها في شريط التنقل والواجهة الرئيسية! 🎉');
  };

  useEffect(() => {
    // Load pending novels
    const loadedNovels = BerryDatabase.get<Novel[]>('novels', []);
    setAllNovels(loadedNovels);
    setPendingNovels(loadedNovels.filter(n => n.status === 'PENDING'));

    // Load active reservations
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    setActiveReservations(allReservations.filter(r => r.status === 'ACTIVE'));

    // Load suggestions
    const allSuggestions = BerryDatabase.get<Suggestion[]>('suggestions', []);
    setSuggestions(allSuggestions);

    // Load translator requests
    const allReqs = BerryDatabase.get<TranslatorRequest[]>('translator_requests', []);
    setTranslatorRequests(allReqs);

    // Load registered users from database or set defaults
    const usersDb = BerryDatabase.get<any[]>('users_db', []);
    // Clear out fake/mock users completely
    const filteredUsers = usersDb.filter((u: any) =>
      u.id !== 'member-1' &&
      u.id !== 'translator-1' &&
      u.id !== 'writer-1' &&
      u.id !== 'supervisor-1' &&
      u.id !== 'guest-user' &&
      !(u.email || '').endsWith('@berrymist.com')
    );
    BerryDatabase.set('users_db', filteredUsers);
    setUsers(filteredUsers);

    // Load reports
    const allReports = BerryDatabase.get<Report[]>('reports', []);
    setReports(allReports);

    // Load edit requests
    const allEditReqs = BerryDatabase.get<any[]>('edit_requests', []);
    setEditRequests(allEditReqs);

    const allDeletedNovels = BerryDatabase.get<any[]>('deleted_novels', []);
    setDeletedNovels(allDeletedNovels);

    const allDeletedChapters = BerryDatabase.get<any[]>('deleted_chapters', []);
    setDeletedChapters(allDeletedChapters);
  }, []);

  const [editRequests, setEditRequests] = useState<any[]>([]);

  const handleResolveEditRequest = (requestId: string) => {
    const allEditReqs = BerryDatabase.get<any[]>('edit_requests', []);
    const updated = allEditReqs.map(r => r.id === requestId ? { ...r, status: 'RESOLVED' } : r);
    BerryDatabase.set('edit_requests', updated);
    setEditRequests(updated);

    // Send a notification to the translator
    const targetReq = allEditReqs.find(r => r.id === requestId);
    if (targetReq) {
      const allNotifs = BerryDatabase.get<any[]>('notifications', []);
      const newNotif = {
        id: `notif-resolved-${Date.now()}`,
        userId: targetReq.translatorId,
        title: 'تم تعديل الفصل بنجاح!',
        message: `لقد قام المالك بتلبية طلب التعديل الخاص بك للرواية "${targetReq.novelName}"، فصل: "${targetReq.chapterName}".`,
        type: 'SYSTEM' as const,
        isRead: false,
        createdAt: 'الآن'
      };
      BerryDatabase.set('notifications', [newNotif, ...allNotifs]);
    }
    alert('تم وضع علامة "تم التعديل" على الطلب وإشعار المترجم بنجاح!');
  };

  const handleResolveReport = (reportId: string, action: 'DELETE' | 'DISMISS') => {
    const allReports = BerryDatabase.get<Report[]>('reports', []);
    const targetReport = allReports.find(r => r.id === reportId);
    if (!targetReport) return;

    if (action === 'DELETE') {
      showConfirm(
        'حذف التعليق وتلبية البلاغ',
        'هل أنت متأكد من رغبتك في حذف هذا التعليق وتلبية البلاغ؟ سيتم إزالة التعليق بشكل دائم من ساحة النقاش.',
        () => {
          // Delete the actual comment from comments database
          const allComments = BerryDatabase.get<any[]>('comments', []);
          const updatedComments = allComments.filter(c => c.id !== targetReport.targetId);
          BerryDatabase.set('comments', updatedComments);

          // Also mark report as resolved
          const updatedReports = allReports.map(r => r.id === reportId ? { ...r, status: 'RESOLVED' as const } : r);
          BerryDatabase.set('reports', updatedReports);
          setReports(updatedReports);
          alert('تم حذف التعليق بنجاح وتحديث حالة البلاغ كمحلول. 🎉');
        }
      );
    } else {
      showConfirm(
        'تجاهل وأرشفة البلاغ',
        'هل أنت متأكد من رغبتك في تجاهل هذا البلاغ وأرشفته دون اتخاذ أي إجراء لحذف التعليق؟',
        () => {
          const updatedReports = allReports.map(r => r.id === reportId ? { ...r, status: 'RESOLVED' as const } : r);
          BerryDatabase.set('reports', updatedReports);
          setReports(updatedReports);
          alert('تم تجاهل البلاغ بنجاح وأرشفته كمكتمل.');
        },
        false
      );
    }
  };

  const handleDeleteNovelFromAdmin = (novelId: string) => {
    const target = allNovels.find(n => n.id === novelId);
    if (!target) return;

    showConfirm(
      'نقل الرواية لسلة المحذوفات (تأكيد 1/2)',
      `هل أنت متأكد من رغبتك في نقل رواية "${target.titleAr}" إلى سلة المحذوفات؟ سيتم إخفاء الرواية وجميع فصولها وتعليقاتها عن الزوار.`,
      () => {
        setTimeout(() => {
          showConfirm(
            'نقل الرواية لسلة المحذوفات (تأكيد نهائي 2/2) ⚠️',
            `تأكيد أخير ومؤكد: هل أنت متأكد تماماً من رغبتك في إخفاء رواية "${target.titleAr}" ونقلها لسلة المحذوفات؟ يمكنك التراجع عنها لاحقاً.`,
            () => {
              const loadedNovels = BerryDatabase.get<Novel[]>('novels', []);
              const updated = loadedNovels.filter(n => n.id !== novelId);
              BerryDatabase.set('novels', updated);
              setAllNovels(updated);
              setPendingNovels(updated.filter(n => n.status === 'PENDING'));

              // Archive chapters inside the deleted novel object
              const allChapters = BerryDatabase.get<any[]>('chapters', []);
              const novelChapters = allChapters.filter(c => c.novelId === novelId);
              const remainingChapters = allChapters.filter(c => c.novelId !== novelId);
              BerryDatabase.set('chapters', remainingChapters);

              // Move novel to deleted_novels in DB
              const allDeletedNovels = BerryDatabase.get<any[]>('deleted_novels', []);
              const deletedNovelEntry = {
                ...target,
                deletedAt: new Date().toISOString(),
                deletedBy: currentUser.username,
                chapters: novelChapters
              };
              const updatedDeletedNovels = [deletedNovelEntry, ...allDeletedNovels];
              BerryDatabase.set('deleted_novels', updatedDeletedNovels);
              setDeletedNovels(updatedDeletedNovels);

              window.dispatchEvent(new Event('novels-updated'));
              alert(`تم نقل الرواية "${target.titleAr}" إلى سلة المحذوفات بنجاح! 🗑️`);
            },
            true
          );
        }, 100);
      },
      true
    );
  };

  const handleRestoreNovel = (novelId: string) => {
    const allDeleted = BerryDatabase.get<any[]>('deleted_novels', []);
    const target = allDeleted.find(n => n.id === novelId);
    if (!target) return;

    const remainingDeleted = allDeleted.filter(n => n.id !== novelId);
    BerryDatabase.set('deleted_novels', remainingDeleted);
    setDeletedNovels(remainingDeleted);

    const { deletedAt, deletedBy, chapters: savedChapters, ...originalNovel } = target;
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    BerryDatabase.set('novels', [...allNovels, originalNovel]);
    setAllNovels([...allNovels, originalNovel]);

    if (savedChapters && savedChapters.length > 0) {
      const allChapters = BerryDatabase.get<any[]>('chapters', []);
      BerryDatabase.set('chapters', [...allChapters, ...savedChapters]);
    }

    window.dispatchEvent(new Event('novels-updated'));
    alert(`تم استعادة الرواية "${originalNovel.titleAr}" وجميع فصولها بنجاح إلى الموقع! ↩️`);
  };

  const handlePermanentlyDeleteNovel = (novelId: string) => {
    const allDeleted = BerryDatabase.get<any[]>('deleted_novels', []);
    const target = allDeleted.find(n => n.id === novelId);
    if (!target) return;

    showConfirm(
      'حذف الرواية نهائياً ⚠️ (تأكيد 1/2)',
      `تحذير هام للغاية: هل أنت متأكد من حذف رواية "${target.titleAr}" نهائياً وبشكل قاطع؟ هذا الإجراء سيمحو الرواية وكافة فصولها وتعليقاتها من خوادم وقواعد بيانات الموقع بالكامل ولا يمكن التراجع عنه أبداً!`,
      () => {
        setTimeout(() => {
          showConfirm(
            'حذف الرواية نهائياً ⚠️ (تأكيد نهائي 2/2)',
            `تنبيه أخير ومطلق: هل أنت متأكد تماماً وقاطعاً من رغبتك في محو رواية "${target.titleAr}" وكافة فصولها وبياناتها للأبد؟ هذا الإجراء لا رجعة فيه إطلاقاً!`,
            () => {
              const remainingDeleted = allDeleted.filter(n => n.id !== novelId);
              BerryDatabase.set('deleted_novels', remainingDeleted);
              setDeletedNovels(remainingDeleted);

              const deletedChapterIds = (target.chapters || []).map((c: any) => c.id);

              const allReservations = BerryDatabase.get<any[]>('reservations', []);
              BerryDatabase.set('reservations', allReservations.filter(r => r.novelId !== novelId));

              const allComments = BerryDatabase.get<any[]>('comments', []);
              BerryDatabase.set('comments', allComments.filter(c => c.refId !== novelId && !deletedChapterIds.includes(c.refId)));

              const allReviews = BerryDatabase.get<any[]>('reviews', []);
              BerryDatabase.set('reviews', allReviews.filter(r => r.novelId !== novelId));

              const allBookmarks = BerryDatabase.get<string[]>('bookmarks', []);
              BerryDatabase.set('bookmarks', allBookmarks.filter(id => id !== novelId));

              const allHistory = BerryDatabase.get<any[]>('reading_history', []);
              BerryDatabase.set('reading_history', allHistory.filter(h => h.novelId !== novelId));

              alert(`تم حذف الرواية "${target.titleAr}" نهائياً من قواعد البيانات بنجاح.`);
            },
            true
          );
        }, 100);
      },
      true
    );
  };

  const handleRestoreChapter = (chapterId: string) => {
    const allDeleted = BerryDatabase.get<any[]>('deleted_chapters', []);
    const chapToRestore = allDeleted.find(d => d.id === chapterId);
    if (!chapToRestore) return;

    const remainingDeleted = allDeleted.filter(d => d.id !== chapterId);
    BerryDatabase.set('deleted_chapters', remainingDeleted);
    setDeletedChapters(remainingDeleted);

    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const { deletedAt, deletedBy, deletedById, ...originalChapter } = chapToRestore;
    BerryDatabase.set('chapters', [...allChapters, originalChapter]);

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
    setAllNovels(updatedNovels);

    window.dispatchEvent(new Event('novels-updated'));
    alert('تم استعادة الفصل ونشره مجدداً بنجاح! ↩️');
  };

  const handlePermanentlyDeleteChapter = (chapterId: string) => {
    const allDeleted = BerryDatabase.get<any[]>('deleted_chapters', []);
    const target = allDeleted.find(d => d.id === chapterId);
    if (!target) return;

    showConfirm(
      'حذف الفصل نهائياً ⚠️ (تأكيد 1/2)',
      `هل أنت متأكد تماماً وبشكل قاطع من حذف الفصل "${target.title}" للرواية "${target.novelTitle}" نهائياً؟`,
      () => {
        setTimeout(() => {
          showConfirm(
            'حذف الفصل نهائياً ⚠️ (تأكيد نهائي 2/2)',
            `تنبيه أخير وقاطع: هل أنت متأكد تماماً من رغبتك في مسح هذا الفصل نهائياً وبشكل دائم ومحوه للأبد؟ لا يمكن استعادة الفصل بعد هذا الإجراء!`,
            () => {
              const remainingDeleted = allDeleted.filter(d => d.id !== chapterId);
              BerryDatabase.set('deleted_chapters', remainingDeleted);
              setDeletedChapters(remainingDeleted);

              const allComments = BerryDatabase.get<any[]>('comments', []);
              BerryDatabase.set('comments', allComments.filter(c => c.refId !== chapterId));

              alert('تم حذف الفصل نهائياً وبشكل دائم. ❌');
            },
            true
          );
        }, 100);
      },
      true
    );
  };

  // Approve pending novel
  const handleApproveNovel = (novelId: string) => {
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const targetNovel = allNovels.find(n => n.id === novelId);
    if (!targetNovel) return;

    const updated = allNovels.map(n => n.id === novelId ? { ...n, status: 'TRANSLATING' as const } : n);
    BerryDatabase.set('novels', updated);
    setPendingNovels(updated.filter(n => n.status === 'PENDING'));

    // Notify creator
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-${Date.now()}`,
      userId: targetNovel.translatorId,
      title: '🎉 تمت الموافقة على روايتك!',
      message: `تم قبول طلب نشر الرواية "${targetNovel.titleAr}" وهي الآن حية ومعتمدة في المنصة بالكامل.`,
      type: 'ROLE' as const,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
    alert(`تمت الموافقة بنجاح على نشر رواية "${targetNovel.titleAr}" وإشعار المترجم.`);
  };

  // Reject pending novel with mandatory reason
  const handleRejectNovel = (novelId: string) => {
    const reason = rejectReason[novelId];
    if (!reason || reason.trim() === '') {
      alert('الرجاء إدخال سبب الرفض لإخطار المترجم.');
      return;
    }

    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const targetNovel = allNovels.find(n => n.id === novelId);
    if (!targetNovel) return;

    // Remove or set as CANCELLED
    const updated = allNovels.filter(n => n.id !== novelId);
    BerryDatabase.set('novels', updated);
    setPendingNovels(updated.filter(n => n.status === 'PENDING'));

    // Notify creator with reject reason
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-${Date.now()}`,
      userId: targetNovel.translatorId,
      title: '❌ تم رفض طلب الرواية',
      message: `عذراً، تم رفض طلب نشر روايتك "${targetNovel.titleAr}" للسبب التالي: ${reason}`,
      type: 'ROLE' as const,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);

    setActiveRejectId(null);
    alert('تم رفض طلب نشر الرواية بنجاح وإرسال سبب الرفض للمترجم.');
  };

  // Cancel reservation if translator is inactive
  const handleCancelReservation = (resId: string, novelId: string, translatorId: string, novelTitle: string) => {
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    const updatedRes = allReservations.map(r => r.id === resId ? { ...r, status: 'CANCELLED' as const } : r);
    BerryDatabase.set('reservations', updatedRes);
    setActiveReservations(updatedRes.filter(r => r.status === 'ACTIVE'));

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

    // Notify translator of cancellation
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-${Date.now()}`,
      userId: translatorId,
      title: '⚠️ إلغاء حجز رواية',
      message: `لقد قامت إدارة المنصة بإلغاء حجزك لرواية "${novelTitle}" لإعطاء فرصة لمترجمين آخرين ومكافحة الاحتكار.`,
      type: 'RESERVATION' as const,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
    alert('تم إلغاء الحجز بنجاح وإرجاع الرواية للائحة الاقتراحات العامة مباشرة مع الاحتفاظ بنسبة الأصوات.');
  };

  // Approve reservation extension request
  const handleApproveExtension = (resId: string) => {
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    const targetRes = allReservations.find(r => r.id === resId);
    if (!targetRes) return;

    const currentEnd = new Date(targetRes.endAt);
    currentEnd.setDate(currentEnd.getDate() + 30); // Add 30 more days

    const updated = allReservations.map(r => {
      if (r.id === resId) {
        return {
          ...r,
          endAt: currentEnd.toISOString(),
          extensionRequested: false
        };
      }
      return r;
    });

    BerryDatabase.set('reservations', updated);
    setActiveReservations(updated.filter(r => r.status === 'ACTIVE'));

    // Notify translator
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-appext-${Date.now()}`,
      userId: targetRes.translatorId,
      title: '✅ تمت الموافقة على تمديد حجز الرواية',
      message: `تم قبول طلب تمديد حجز رواية "${targetRes.novelTitle}" بنجاح، وتمت إضافة 30 يوماً إضافية لمهلة الحجز الخاصة بك.`,
      type: 'RESERVATION' as const,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
    alert(`تمت الموافقة بنجاح على تمديد مهلة حجز رواية "${targetRes.novelTitle}" لمدة 30 يوماً إضافية.`);
  };

  // Reject reservation extension request
  const handleRejectExtension = (resId: string) => {
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    const targetRes = allReservations.find(r => r.id === resId);
    if (!targetRes) return;

    const updated = allReservations.map(r => {
      if (r.id === resId) {
        return {
          ...r,
          extensionRequested: false
        };
      }
      return r;
    });

    BerryDatabase.set('reservations', updated);
    setActiveReservations(updated.filter(r => r.status === 'ACTIVE'));

    // Notify translator
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-rejext-${Date.now()}`,
      userId: targetRes.translatorId,
      title: '❌ تم رفض تمديد حجز الرواية',
      message: `عذراً، تم رفض طلب تمديد حجز رواية "${targetRes.novelTitle}". يرجى نشر الفصل الأول قبل انتهاء المهلة المتبقية لتفادي الإلغاء.`,
      type: 'RESERVATION' as const,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
    alert(`تم رفض تمديد حجز رواية "${targetRes.novelTitle}" بنجاح وإشعار المترجم.`);
  };

  // Approve translator request
  const handleApproveTranslator = (reqId: string) => {
    const allReqs = BerryDatabase.get<TranslatorRequest[]>('translator_requests', []);
    const reqIndex = allReqs.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;

    allReqs[reqIndex].status = 'ACCEPTED';
    BerryDatabase.set('translator_requests', allReqs);
    setTranslatorRequests(allReqs);

    const targetEmail = allReqs[reqIndex].email.toLowerCase();

    // Publish the role assignment to the shared DB so the translator's own
    // device picks it up on next sync and gains the work panel.
    const assignments = BerryDatabase.get<Record<string, string>>('role_assignments', {});
    assignments[targetEmail] = 'TRANSLATOR';
    BerryDatabase.set('role_assignments', assignments);

    // Update users_db (local to this device)
    const usersDb = BerryDatabase.get<any[]>('users_db', []);
    const userIndex = usersDb.findIndex(u => u.email.toLowerCase() === targetEmail);
    if (userIndex !== -1) {
      usersDb[userIndex].role = 'TRANSLATOR';
      BerryDatabase.set('users_db', usersDb);
    }

    // Update current_user_data if same user
    const currentUserData = BerryDatabase.get<any>('current_user_data', null);
    if (currentUserData && currentUserData.email.toLowerCase() === targetEmail) {
      currentUserData.role = 'TRANSLATOR';
      BerryDatabase.set('current_user_data', currentUserData);
      window.dispatchEvent(new Event('user-updated'));
    }

    // Create notification
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-approved-${Date.now()}`,
      email: targetEmail,
      title: '🎉 تهانينا! تم قبول طلبك كمترجم',
      message: 'لقد وافق مالك المنصة على طلب انضمامك لفريق المترجمين بيري ميست. يمكنك الآن حجز روايات وتنزيلها وترجمتها!',
      type: 'ROLE' as any,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [newNotif, ...allNotifs]);
    alert('تم قبول طلب المترجم بنجاح وترقية رتبته إلى مترجم رسمي!');
  };

  // Reject translator request
  const handleRejectTranslator = (reqId: string) => {
    const allReqs = BerryDatabase.get<TranslatorRequest[]>('translator_requests', []);
    const reqIndex = allReqs.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;

    allReqs[reqIndex].status = 'REJECTED';
    BerryDatabase.set('translator_requests', allReqs);
    setTranslatorRequests(allReqs);

    const targetEmail = allReqs[reqIndex].email.toLowerCase();

    // Create notification
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-rejected-${Date.now()}`,
      email: targetEmail,
      title: '❌ بخصوص طلب الانضمام كمترجم',
      message: 'نأسف لإبلاغك بأنه قد تم رفض طلب انضمامك كـ مترجم حالياً من قبل الإدارة.',
      type: 'ROLE' as any,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [newNotif, ...allNotifs]);
    alert('تم رفض طلب الانضمام كمترجم وإرسال الإشعار له.');
  };

  // Change user role from Admin Panel
  const handleUpdateUserRole = (userId: string) => {
    if (!roleChangeReason.trim()) {
      alert('الرجاء كتابة سبب تغيير الرتبة.');
      return;
    }

    const usersDb = BerryDatabase.get<any[]>('users_db', []);
    const userIndex = usersDb.findIndex(u => u.id === userId);
    if (userIndex === -1) return;

    const oldRole = usersDb[userIndex].role;
    const targetEmail = usersDb[userIndex].email;
    const targetUsername = usersDb[userIndex].username;

    usersDb[userIndex].role = newRoleVal;
    BerryDatabase.set('users_db', usersDb);
    setUsers(usersDb);

    // Propagate the role change to the user's own device via the shared DB
    const assignments = BerryDatabase.get<Record<string, string>>('role_assignments', {});
    assignments[targetEmail.toLowerCase()] = newRoleVal;
    BerryDatabase.set('role_assignments', assignments);

    // If that user is logged in, update current_user_data
    const currentUserData = BerryDatabase.get<any>('current_user_data', null);
    if (currentUserData && currentUserData.id === userId) {
      currentUserData.role = newRoleVal;
      BerryDatabase.set('current_user_data', currentUserData);
      BerryDatabase.set('current_role', newRoleVal);
      window.dispatchEvent(new Event('user-updated'));
    }

    // Add notification with reason
    const roleLabels: any = {
      GUEST: 'زائر',
      MEMBER: 'قارئ',
      TRANSLATOR: 'مترجم وكاتب',
      WRITER: 'كاتب ومؤلف',
      SUPERVISOR: 'مشرف',
      OWNER: 'مالك'
    };

    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-role-${Date.now()}`,
      userId: userId,
      email: targetEmail,
      title: '👑 تم تعديل رتبتك من قبل الإدارة',
      message: `تم تغيير رتبتك من (${roleLabels[oldRole] || oldRole}) إلى (${roleLabels[newRoleVal] || newRoleVal}). السبب: ${roleChangeReason.trim()}`,
      type: 'ROLE' as const,
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [newNotif, ...allNotifs]);

    alert(`تم بنجاح تغيير رتبة المستخدم "${targetUsername}" إلى "${roleLabels[newRoleVal]}" وإرسال إشعار فوري له بالسبب.`);
    setEditingUserId(null);
    setRoleChangeReason('');
  };

  return (
    <div className="w-full text-right mt-4 pb-12 animate-in fade-in duration-300">
      
      {/* Header banner */}
      <div className="p-6 bg-[#1A1625] border border-white/5 rounded-3xl mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-berry-400" size={24} />
            <span>لوحة تحكم المالك والإدارة العليا 👑</span>
          </h1>
          <p className="text-xs text-purple-300 mt-1">تتبع إحصائيات المنصة بالكامل، راجع الروايات المعلقة، وتحكم بالحجوزات.</p>
        </div>
        <span className="text-3xl">⚙️</span>
      </div>

      {/* Stats counter strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white/5 rounded-2xl text-center border border-white/5">
          <span className="text-xs text-purple-400 block mb-1">الروايات المعلقة للموافقة</span>
          <span className="font-extrabold text-white text-lg">{pendingNovels.length}</span>
        </div>
        <div className="p-4 bg-white/5 rounded-2xl text-center border border-white/5">
          <span className="text-xs text-purple-400 block mb-1">الحجوزات النشطة للمترجمين</span>
          <span className="font-extrabold text-white text-lg">{activeReservations.length}</span>
        </div>
        <div className="p-4 bg-white/5 rounded-2xl text-center border border-white/5">
          <span className="text-xs text-purple-400 block mb-1">إجمالي الاقتراحات المفتوحة</span>
          <span className="font-extrabold text-white text-lg">{suggestions.length}</span>
        </div>
        <div className="p-4 bg-white/5 rounded-2xl text-center border border-white/5">
          <span className="text-xs text-purple-400 block mb-1">حالة لوحة التحكم</span>
          <span className="text-xs font-extrabold text-green-400 block mt-1 animate-pulse">● متصل وآمن</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 mb-6 text-sm font-semibold text-purple-300/80">
        <button 
          onClick={() => setActiveTab('novels')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'novels' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>طلبات الموافقة على الروايات ({pendingNovels.length})</span>
          {activeTab === 'novels' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('translator_requests')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'translator_requests' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>طلبات الانضمام كمترجم ({translatorRequests.filter(r => r.status === 'PENDING').length})</span>
          {activeTab === 'translator_requests' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('reservations')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'reservations' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>مراقبة وإدارة الحجوزات النشطة ({activeReservations.length})</span>
          {activeTab === 'reservations' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'logs' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>سجل نشاط الخادم والمنصة 🖥️</span>
          {activeTab === 'logs' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'settings' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>إعدادات هوية المنصة ⚙️</span>
          {activeTab === 'settings' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'users' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>إدارة رتب الأعضاء 👤</span>
          {activeTab === 'users' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'reports' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>بلاغات التعليقات المسيئة ({reports.filter(r => r.status === 'PENDING').length}) 🚨</span>
          {activeTab === 'reports' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('edit-requests')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'edit-requests' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>طلبات تعديل الفصول ({editRequests.filter(r => r.status === 'PENDING').length}) 🛠️</span>
          {activeTab === 'edit-requests' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('points')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'points' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>نقاط المترجمين وتتويج مترجم الشهر 🏆</span>
          {activeTab === 'points' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('trash')}
          className={`pb-3 px-6 relative transition-colors ${activeTab === 'trash' ? 'text-white' : 'hover:text-white'}`}
        >
          <span>سلة المحذوفات (Trash Bin) 🗑️</span>
          {activeTab === 'trash' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />}
        </button>
      </div>

      {/* Panel Tab Content */}
      <div className="w-full">
        {/* TAB: Translator Requests for Owner approval */}
        {activeTab === 'translator_requests' && (
          <div className="flex flex-col gap-4 text-right">
            {translatorRequests.length > 0 ? (
              <div className="flex flex-col gap-4">
                {translatorRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className={`p-5 rounded-2xl border flex flex-col gap-4 transition-all duration-300 ${
                      req.status === 'PENDING'
                        ? 'bg-[#1D172B] border-violet-500/30'
                        : req.status === 'ACCEPTED'
                          ? 'bg-green-950/10 border-green-500/20'
                          : 'bg-red-950/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-white">{req.username}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            req.status === 'PENDING' 
                              ? 'bg-yellow-500/20 text-yellow-300' 
                              : req.status === 'ACCEPTED'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-red-500/20 text-red-300'
                          }`}>
                            {req.status === 'PENDING' && '⏳ قيد الانتظار'}
                            {req.status === 'ACCEPTED' && '✅ مقبول'}
                            {req.status === 'REJECTED' && '❌ مرفوض'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${req.joinType === 'TEAM' ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                            {req.joinType === 'TEAM' ? '👥 انضمام كـ فريق' : '✍️ انضمام كـ فرد'}
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-400 mt-0.5">{req.email}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                        {req.discord && (
                          <span className="px-2 py-1 bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/20 rounded-lg">
                            ديسكورد: {req.discord}
                          </span>
                        )}
                        {req.telegram && (
                          <span className="px-2 py-1 bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20 rounded-lg">
                            تليجرام: {req.telegram}
                          </span>
                        )}
                        <span className="px-2 py-1 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-lg">
                          التاريخ: {new Date(req.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="font-bold text-violet-400 block mb-1">الخبرة السابقة والأعمال:</span>
                        <p className="text-purple-200">{req.experience}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="font-bold text-violet-400 block mb-1">سبب طلب الانضمام:</span>
                        <p className="text-purple-200">{req.reason}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-purple-300">
                        <span>اللغات المترجم منها:</span>
                        <span className="font-bold text-white">{req.languages.join('، ')}</span>
                      </div>

                      {req.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRejectTranslator(req.id)}
                            className="flex items-center gap-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <X size={14} />
                            <span>رفض الطلب</span>
                          </button>
                          <button
                            onClick={() => handleApproveTranslator(req.id)}
                            className="flex items-center gap-1 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 border border-green-500/20 hover:border-green-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-green-500/5"
                          >
                            <Check size={14} />
                            <span>قبول كمترجم رسمي</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center bg-[#1A1625] rounded-2xl border border-dashed border-white/5">
                <p className="text-sm text-purple-400">لا توجد أي طلبات انضمام كمترجمين حالياً.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Pending novels for Owner approval */}
        {activeTab === 'novels' && (
          <div className="flex flex-col gap-4 text-right">
            {pendingNovels.length > 0 ? (
              pendingNovels.map((novel) => (
                <div key={novel.id} className="p-5 bg-[#1A1625] border border-white/5 rounded-2xl flex flex-col md:flex-row gap-5">
                  <img src={novel.cover} alt={novel.titleAr} className="w-20 h-28 rounded-xl object-cover border border-white/5 mx-auto md:mx-0" />
                  
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{novel.titleAr}</h4>
                      <p className="text-[10px] text-purple-400 mt-0.5">{novel.titleEn} | لغة الرواية: {novel.language}</p>
                      <p className="text-xs text-purple-300 mt-2 line-clamp-2">{novel.description}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-3 border-t border-white/5 gap-3">
                      <span className="text-[10px] text-purple-400">مقدم بواسطة المترجم: <span className="font-bold text-white">{novel.translatorName}</span></span>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleApproveNovel(novel.id)}
                          className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          الموافقة على النشر ونشرها حياً ✓
                        </button>
                        <button 
                          onClick={() => setActiveRejectId(activeRejectId === novel.id ? null : novel.id)}
                          className="px-4 py-1.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          رفض الطلب ×
                        </button>
                      </div>
                    </div>

                    {/* Reject reason textbox (Mandatory as requested) */}
                    {activeRejectId === novel.id && (
                      <div className="mt-4 p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex flex-col gap-2 animate-in slide-in-from-top-1">
                        <label className="text-[10px] font-bold text-red-300">أدخل سبب الرفض لإخطار المترجم (إلزامي):</label>
                        <textarea 
                          rows={2}
                          value={rejectReason[novel.id] || ''}
                          onChange={(e) => setRejectReason({ ...rejectReason, [novel.id]: e.target.value })}
                          placeholder="النبذة مكررة أو غير واضحة، الكاتب محمي، يرجى إعادة صياغتها..."
                          className="w-full bg-[#14101D] border border-white/5 rounded-xl p-2 text-xs text-white"
                        />
                        <button 
                          onClick={() => handleRejectNovel(novel.id)}
                          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold mr-auto cursor-pointer"
                        >
                          تأكيد الرفض والإخطار آلياً
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              ))
            ) : (
                <div className="p-12 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                  <p className="text-sm">لا توجد طلبات موافقة روائية متبقية. كل الروايات نشطة وموافق عليها!</p>
                </div>
              )}

            {/* Manage Published Novels Section */}
            <div className="mt-12 pt-8 border-t border-white/5">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span>📚 إدارة وحذف الروايات المنشورة في الموقع</span>
                <span className="text-xs bg-violet-600/20 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-normal">
                  إجمالي الروايات: {allNovels.filter(n => n.status !== 'PENDING').length}
                </span>
              </h3>
              <p className="text-xs text-purple-400 mb-6 leading-relaxed">
                بصفتك مالك الموقع، يمكنك هنا استعراض جميع الروايات المنشورة والموافَق عليها بالمنصة، وحذف أي رواية غير مرغوب فيها نهائياً بضغطة زر واحدة.
              </p>

              {allNovels.filter(n => n.status !== 'PENDING').length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allNovels.filter(n => n.status !== 'PENDING').map((novel) => (
                    <div key={novel.id} className="p-4 bg-[#14101D] border border-white/5 rounded-2xl flex gap-4 items-center justify-between">
                      <div className="flex gap-3 items-center min-w-0">
                        <img src={novel.cover} alt={novel.titleAr} className="w-12 h-16 rounded-lg object-cover border border-white/5" />
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-white truncate">{novel.titleAr}</h4>
                          <p className="text-[9px] text-purple-400 mt-0.5 truncate">{novel.titleEn}</p>
                          <p className="text-[9px] text-violet-300 mt-1">بواسطة المترجم: <span className="font-bold text-white">{novel.translatorName}</span></p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteNovelFromAdmin(novel.id)}
                        className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                        title="حذف الرواية نهائياً من الموقع"
                      >
                        حذف 🗑️
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                  <p className="text-xs">لا توجد روايات منشورة حالياً في المنصة.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Reservations monitor */}
        {activeTab === 'reservations' && (
          <div className="flex flex-col gap-4 text-right">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-purple-300 flex items-start gap-2 leading-relaxed mb-2">
              <AlertCircle size={14} className="shrink-0 text-violet-400 mt-0.5" />
              <span>
                مكافحة الاحتكار: يستطيع المالك إلغاء أي حجز نشط تجاوز مهلته ولم ينشر المترجم الفصل الأول له، لإرجاع الرواية للائحة الاقتراحات ليتسنى لمترجم آخر نشيط حجزها وترجمتها فوراً.
              </span>
            </div>

            {activeReservations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReservations.map((res) => (
                  <div key={res.id} className="p-4 bg-[#1A1625] border border-white/5 rounded-2xl flex flex-col justify-between text-right animate-in fade-in">
                    <div>
                      <h4 className="font-extrabold text-xs text-white truncate">{res.novelTitle}</h4>
                      <p className="text-[10px] text-purple-400 mt-0.5">المترجم الحاجز: <span className="font-bold text-white">{res.translatorName}</span></p>
                      
                      <div className="flex flex-col gap-1 mt-3 text-[10px] text-purple-300">
                        <span>تاريخ بدء الحجز: {new Date(res.startAt).toLocaleDateString('en-US')}</span>
                        <span>تاريخ انتهاء الصلاحية: {new Date(res.endAt).toLocaleDateString('en-US')}</span>
                      </div>

                      {res.extensionRequested && (
                        <div className="mt-3 p-3 bg-violet-600/10 border border-violet-500/20 rounded-xl text-[10px]">
                          <span className="font-bold text-amber-300 block mb-1">⚠️ طلب تمديد مهلة الحجز:</span>
                          <p className="text-purple-200 mb-2 italic">"{res.extensionReason || 'لا يوجد سبب محدد'}"</p>
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleApproveExtension(res.id)}
                              className="px-2.5 py-1 bg-green-600 text-white rounded font-bold text-[9px] hover:bg-green-500 transition-all cursor-pointer"
                            >
                              قبول التمديد ✓
                            </button>
                            <button
                              onClick={() => handleRejectExtension(res.id)}
                              className="px-2.5 py-1 bg-red-600 text-white rounded font-bold text-[9px] hover:bg-red-500 transition-all cursor-pointer"
                            >
                              رفض ×
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                      <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-2.5 py-0.5 rounded-full font-bold">الحجز نشط 🟡</span>
                      
                      <button 
                        onClick={() => handleCancelReservation(res.id, res.novelId, res.translatorId, res.novelTitle)}
                        className="px-3 py-1 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        إلغاء حجز الرواية وسحبها ⚠️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                <p className="text-sm">لا توجد حجوزات ترجمة نشطة حالياً.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: System logs */}
        {activeTab === 'logs' && (
          <div className="p-5 bg-black rounded-2xl border border-white/5 font-mono text-[11px] text-green-400 text-right h-80 overflow-y-auto leading-relaxed">
            <p className="text-white mb-2">=== سجلات خادم منصة BERRY MIST لترجمة وقراءة الروايات الفاخرة ===</p>
            <p>[2026-06-28 11:28:01] INFO: Database initialized with localStorage successfully.</p>
            <p>[2026-06-28 11:28:02] INFO: Server listening on internal Port 3000 securely.</p>
            <p>[2026-06-28 11:28:05] SUCCESS: JWT Authentication active for role simulations.</p>
            <p>[2026-06-28 11:28:10] INFO: User GUEST changed role to MEMBER successfully.</p>
            <p>[2026-06-28 11:29:15] INFO: Novel "عودة ملك الظلال" fetched chapter 250 with CLS=0.</p>
            <p>[2026-06-28 11:30:20] SUCCESS: Watermark signed using current active user credentials.</p>
            <p>[2026-06-28 11:32:00] INFO: News Ticker Linear translation left-to-right initialized.</p>
            <p className="text-white mt-4">=== نهاية السجل الحالي. المنصة خضراء وآمنة بالكامل ===</p>
          </div>
        )}

        {/* TAB 4: Identity Settings */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6 text-right animate-in fade-in duration-300">
            <div className="p-6 bg-[#1A1625] rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-violet-600/5 rounded-full blur-[60px]" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-berry-600/5 rounded-full blur-[60px]" />

              <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                <Settings className="text-violet-400" size={20} />
                <div>
                  <h3 className="font-extrabold text-sm text-white">تخصيص هوية المنصة الفاخرة</h3>
                  <p className="text-[10px] text-purple-400 mt-0.5">يمكنك بصفتك مالك المنصة تعديل الاسم، الشعار، وبانر الموقع الرئيسي فورا.</p>
                </div>
              </div>

              <form onSubmit={handleSaveSiteSettings} className="flex flex-col gap-5 text-right">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-purple-200">اسم الموقع الجديد</label>
                    <input 
                      type="text"
                      value={siteNameInput}
                      onChange={(e) => setSiteNameInput(e.target.value)}
                      placeholder="مثال: BerryMist"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                      required
                    />
                  </div>

                  {/* Logo File / Emoji Upload */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-purple-200">شعار الموقع (ملف صورة أو إيموجي)</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text"
                        value={siteLogoInput}
                        onChange={(e) => setSiteLogoInput(e.target.value)}
                        placeholder="اكتب إيموجي (مثال: 🍇) أو ارفع ملف يساراً"
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                      />
                      <div className="relative overflow-hidden shrink-0">
                        <button 
                          type="button"
                          className="px-4 py-3 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Upload size={14} />
                          <span>رفع صورة</span>
                        </button>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];
                            const extension = file.name.split('.').pop()?.toLowerCase() || '';
                            if (!allowed.includes(extension)) {
                              alert('خطأ: يجب اختيار صورة بصيغة مدعومة (PNG, JPG, JPEG, WEBP, SVG)!');
                              return;
                            }
                            compressImageFile(file, 256)
                              .then((dataUrl) => setSiteLogoInput(dataUrl))
                              .catch(() => alert('تعذر معالجة صورة الشعار. جرب صورة أصغر حجماً (يفضل أقل من 2MB).'));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner File Upload */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-purple-200">تحميل بانر الموقع الرئيسي (ملف صورة) *</label>
                  <div className="relative border border-dashed border-white/10 hover:border-violet-500/40 rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[90px]">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];
                        const extension = file.name.split('.').pop()?.toLowerCase() || '';
                        if (!allowed.includes(extension)) {
                          alert('خطأ: يجب اختيار صورة بصيغة مدعومة (PNG, JPG, JPEG, WEBP, SVG)!');
                          return;
                        }
                        compressImageFile(file, 1600)
                          .then((dataUrl) => setSiteBannerInput(dataUrl))
                          .catch(() => alert('تعذر معالجة صورة البانر. جرب صورة أصغر حجماً (يفضل أقل من 4MB).'));
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {siteBannerInput ? (
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-10 rounded border border-violet-500 overflow-hidden">
                          <img src={siteBannerInput} alt="Banner Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <span className="text-[10px] text-green-400 font-bold">تم تحميل البانر بنجاح ✓</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={18} className="text-purple-400" />
                        <span className="text-[10px] text-purple-300 font-bold">انقر لاختيار ملف صورة لبانر الموقع الرئيسي</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mt-2 flex items-center gap-4">
                  <span className="text-lg">👁️</span>
                  <div>
                    <span className="text-xs font-bold text-violet-300 block mb-1">معاينة الهوية المقترحة:</span>
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 w-fit">
                      {isImageSource(siteLogoInput) ? (
                        <img src={siteLogoInput} alt="Preview Logo" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-lg">{safeEmojiOrFallback(siteLogoInput)}</span>
                      )}
                      <span className="text-xs font-extrabold text-white">{siteNameInput}</span>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3.5 mt-4 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-xl text-xs font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  <span>حفظ وتطبيق إعدادات الهوية الجديدة</span>
                </button>
              </form>
            </div>

            {/* Footer and Social Links customization */}
            <div className="p-6 bg-[#1A1625] rounded-3xl border border-white/5 shadow-xl relative overflow-hidden mt-6">
              <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/5 rounded-full blur-[60px]" />
              <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                <Settings className="text-[#FF2255]" size={20} />
                <div>
                  <h3 className="font-extrabold text-sm text-white">تعديل بيانات الفوتر وقنوات المجتمع الاجتماعي (أسفل الموقع)</h3>
                  <p className="text-[10px] text-purple-400 mt-0.5">يمكنك التحكم بجميع النصوص في الفوتر وتحديد روابط شبكات التواصل الاجتماعي المعروضة للزوار.</p>
                </div>
              </div>

              <form onSubmit={handleSaveFooterSettings} className="flex flex-col gap-5 text-right">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-purple-200">نبذة الموقع في أسفل الصفحة (من نحن)</label>
                    <textarea 
                      rows={3}
                      value={footerDescInput}
                      onChange={(e) => setFooterDescInput(e.target.value)}
                      placeholder="منصة عربية رائدة لترجمة وقراءة الروايات الخفيفة..."
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors resize-none"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-purple-200">نص دعوة انضم لعائلتنا (انضم لمجتمعنا)</label>
                    <textarea 
                      rows={3}
                      value={footerCommunityTextInput}
                      onChange={(e) => setFooterCommunityTextInput(e.target.value)}
                      placeholder="انضم لعائلتنا الروائية الكبرى لتصلك إشعارات الفصول فور صدورها..."
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors resize-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-purple-200">البريد الإلكتروني المعتمد للدعم الفني</label>
                    <input 
                      type="email"
                      value={footerEmailInput}
                      onChange={(e) => setFooterEmailInput(e.target.value)}
                      placeholder="support@berrymist.com"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors font-mono"
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-purple-200">طريقة تواصل الدعم السريع</label>
                    <input 
                      type="text"
                      value={footerSupportInput}
                      onChange={(e) => setFooterSupportInput(e.target.value)}
                      placeholder="مثال: عبر تذكرة الديسكورد الرسمية بالأسفل"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Social media URLs and toggles */}
                <div className="border-t border-white/5 pt-5 mt-2">
                  <h4 className="text-xs font-bold text-violet-300 mb-3 flex items-center gap-1.5">
                    <span>🔗 تخصيص شبكات التواصل الاجتماعي (انضم لمجتمعنا):</span>
                  </h4>
                  <p className="text-[9px] text-purple-400 mb-4">قم بتفعيل الشبكات التي تريدها وإضافة الرابط الخاص بها، وإلغاء تفعيل الشبكات التي لا ترغب بعرضها.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {footerSocialsInput.map((social) => (
                      <div key={social.id} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg">{social.icon}</span>
                            <span className="text-xs font-bold text-white">{social.name}</span>
                          </div>
                          
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-[10px] text-purple-400">{social.active ? 'نشط ومفعل ✓' : 'معطل ومخفي ✗'}</span>
                            <input 
                              type="checkbox"
                              checked={social.active}
                              onChange={() => handleSocialActiveToggle(social.id)}
                              className="w-3.5 h-3.5 accent-violet-600 rounded cursor-pointer"
                            />
                          </label>
                        </div>

                        <input 
                          type="text"
                          value={social.url || ''}
                          onChange={(e) => handleSocialUrlChange(social.id, e.target.value)}
                          placeholder={`أدخل رابط حساب ${social.name} هنا...`}
                          className="w-full px-3 py-1.5 bg-black/30 border border-white/5 rounded-xl text-[10px] text-purple-200 focus:outline-none focus:border-violet-500 transition-colors"
                          disabled={!social.active}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3.5 mt-4 bg-gradient-to-r from-berry-600 to-violet-600 hover:from-berry-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg shadow-berry-500/20 flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  <span>حفظ ونشر جميع إعدادات الفوتر والشبكات الاجتماعية</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB: Member Ranks Management */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-6 text-right animate-in fade-in duration-300">
            <div className="p-6 bg-[#1A1625] rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-violet-600/5 rounded-full blur-[60px]" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-berry-600/5 rounded-full blur-[60px]" />

              <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                <UserCheck className="text-violet-400" size={20} />
                <div>
                  <h3 className="font-extrabold text-sm text-white font-sans">إدارة رتب وأعضاء المنصة 👑</h3>
                  <p className="text-[10px] text-purple-400 mt-0.5">بصفتك المالك، يمكنك ترقية أو تعديل رتب أي مستخدم مع تقديم سبب يصله في إشعاراته.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {users.filter(u => (u.email || '').toLowerCase() !== 'hanona37hh@gmail.com').map((user) => {
                  const novelsCount = BerryDatabase.get<Novel[]>('novels', [])
                    .filter(n => n.translatorId === user.id && n.status !== 'PENDING').length;

                  // Define dynamic rank display
                  const getRankLabel = (u: any) => {
                    if (u.role === 'SUPERVISOR') return 'مشرف 🛡️';
                    if (u.role === 'MEMBER') return 'قارئ 👤';
                    if (u.role === 'TRANSLATOR' || u.role === 'WRITER') {
                      if (novelsCount > 10) return 'مترجم وكاتب محترف 🏆';
                      if (novelsCount > 6) return 'مترجم وكاتب خبير 🎖️';
                      return 'مترجم وكاتب ✍️';
                    }
                    return u.role;
                  };

                  return (
                    <div 
                      key={user.id} 
                      className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-violet-500/20 transition-all duration-300 flex flex-col gap-4"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={user.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} 
                            alt={user.username} 
                            className="w-12 h-12 rounded-xl object-cover border border-white/10 bg-black/20"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-sm">{user.username}</h4>
                              <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2.5 py-0.5 rounded-full font-bold">
                                {getRankLabel(user)}
                              </span>
                            </div>
                            <p className="text-[10px] text-purple-400 font-mono mt-0.5">{user.email}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 text-[11px] text-purple-300">
                          <div>عدد الروايات المترجمة/المؤلفة: <span className="font-extrabold text-white">{novelsCount}</span></div>
                          {user.bio && <div className="text-[10px] text-purple-400 mt-1 max-w-xs truncate text-left sm:text-right">{user.bio}</div>}
                        </div>
                      </div>

                      {/* Editing Actions */}
                      {editingUserId === user.id ? (
                        <div className="mt-2 p-4 bg-black/30 border border-violet-500/20 rounded-xl flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-bold text-purple-200">الرتبة الجديدة</label>
                              <select 
                                value={newRoleVal}
                                onChange={(e) => setNewRoleVal(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#151120] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                              >
                                <option value="MEMBER">قارئ 👤</option>
                                <option value="TRANSLATOR">مترجم وكاتب ✍️</option>
                                <option value="SUPERVISOR">مشرف 🛡️</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-bold text-purple-200">سبب تغيير الرتبة (إجباري)</label>
                              <input 
                                type="text"
                                value={roleChangeReason}
                                onChange={(e) => setRoleChangeReason(e.target.value)}
                                placeholder="اكتب السبب بوضوح هنا (مثال: تقديم روايات متميزة)..."
                                className="w-full px-3 py-2 rounded-lg bg-[#151120] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                                required
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-2">
                            <button 
                              onClick={() => handleUpdateUserRole(user.id)}
                              className="px-4 py-2 bg-gradient-to-r from-berry-600 to-violet-600 hover:from-berry-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              حفظ التغيير وإرسال الإشعار
                            </button>
                            <button 
                              onClick={() => {
                                setEditingUserId(null);
                                setRoleChangeReason('');
                              }}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end border-t border-white/5 pt-3">
                          <button 
                            onClick={() => {
                              setEditingUserId(user.id);
                              setNewRoleVal(user.role);
                              setRoleChangeReason('');
                            }}
                            className="px-4 py-1.5 bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white border border-violet-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            تعديل الرتبة 👤
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {users.filter(u => (u.email || '').toLowerCase() !== 'hanona37hh@gmail.com').length === 0 && (
                  <div className="p-12 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                    <p className="text-sm">لا يوجد أعضاء آخرون مسجلون في المنصة حالياً لتعديل رتبهم.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Offensive Comment Reports */}
        {activeTab === 'reports' && (
          <div className="flex flex-col gap-6 text-right animate-in fade-in duration-300">
            <div className="p-6 bg-[#1A1625] rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-red-600/5 rounded-full blur-[60px]" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-violet-600/5 rounded-full blur-[60px]" />

              <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                <AlertCircle className="text-red-400" size={20} />
                <div>
                  <h3 className="font-extrabold text-sm text-white font-sans">بلاغات التعليقات المسيئة والمخالفة 🚨</h3>
                  <p className="text-[10px] text-purple-400 mt-0.5">بصفتك المالك، يمكنك هنا مراجعة بلاغات الزوار والأعضاء بخصوص التعليقات، وحذف التعليق المخالف مباشرة أو تجاهل البلاغ.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {reports.slice().reverse().map((report) => (
                  <div 
                    key={report.id} 
                    className={`p-5 rounded-2xl bg-white/[0.02] border transition-all duration-300 flex flex-col gap-3 ${report.status === 'PENDING' ? 'border-red-500/20 shadow-lg shadow-red-500/2' : 'border-white/5 opacity-60'}`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold ${report.status === 'PENDING' ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-green-500/20 text-green-300'}`}>
                          {report.status === 'PENDING' ? 'قيد المراجعة ⏳' : 'محلول / مؤرشف ✔️'}
                        </span>
                        <span className="text-[10px] text-purple-400">
                          بواسطة: <span className="text-white font-bold">{report.reportedBy}</span>
                        </span>
                        <span className="text-[10px] text-purple-400 font-mono">
                          {new Date(report.createdAt).toLocaleString('ar-EG', { numberingSystem: 'latn' })}
                        </span>
                      </div>
                    </div>

                    <div className="bg-black/30 p-3.5 rounded-xl border border-white/5">
                      <div className="text-[10px] text-purple-400 font-bold mb-1">التعليق المبلَّغ عنه:</div>
                      <p className="text-xs text-purple-100 font-sans leading-relaxed italic">"{report.targetName}"</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-purple-300">
                      <div>
                        <span className="font-bold text-purple-200">السبب المحدد: </span>
                        <span className="text-red-300 font-bold">{report.reason}</span>
                      </div>
                      <div>
                        <span className="font-bold text-purple-200">المكان والسياق: </span>
                        <span className="text-violet-300 font-bold">{report.details || 'غير محدد'}</span>
                      </div>
                    </div>

                    {report.status === 'PENDING' && (
                      <div className="flex justify-end gap-2 border-t border-white/5 pt-3 mt-1">
                        <button
                          onClick={() => handleResolveReport(report.id, 'DELETE')}
                          className="px-4 py-2 bg-gradient-to-r from-red-600 to-violet-600 hover:from-red-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>🗑️ حذف التعليق وتلبية البلاغ</span>
                        </button>
                        <button
                          onClick={() => handleResolveReport(report.id, 'DISMISS')}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          تجاهل البلاغ وأرشفته
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {reports.length === 0 && (
                  <div className="p-12 text-center bg-white/5 rounded-2xl border border-white/5 text-purple-400">
                    <p className="text-sm">لا توجد بلاغات مسجلة بخصوص أي تعليق في المنصة حالياً. 🎉</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Edit Requests */}
        {activeTab === 'edit-requests' && (
          <div className="flex flex-col gap-4 text-right">
            <div className="p-5 bg-gradient-to-r from-violet-950/20 to-purple-950/20 border border-violet-500/10 rounded-2xl mb-2">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <AlertCircle size={16} className="text-violet-400 animate-pulse" />
                <span>طلبات تعديل الفصول المقدمة من المترجمين</span>
              </h3>
              <p className="text-[10px] text-purple-400 mt-1">
                تظهر هنا طلبات المترجمين لتعديل أخطاء بالفصول المنشورة أو بعد فوات مهلة الـ 15 يوماً. يمكنك مراجعتها ومعالجتها مباشرة.
              </p>
            </div>

            {editRequests.length > 0 ? (
              <div className="flex flex-col gap-3">
                {editRequests.map((req) => (
                  <div 
                    key={req.id}
                    className="p-5 bg-[#1A1625] border border-white/5 rounded-2xl flex flex-col gap-3 hover:border-violet-500/10 transition-all text-xs"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{req.translatorName} 👤</span>
                        <span className="text-[9px] text-purple-400">({req.translatorName === 'berrymist-owner' ? 'المالك' : 'مترجم'})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${req.status === 'RESOLVED' ? 'bg-green-500/15 text-green-400 border border-green-500/15' : 'bg-amber-500/15 text-amber-400 border border-amber-500/15'}`}>
                        {req.status === 'RESOLVED' ? 'تم حل الطلب ✓' : '⏳ قيد الانتظار'}
                      </span>
                    </div>

                    <div className="text-purple-200">
                      اسم الرواية: <span className="text-white font-extrabold">{req.novelName}</span>
                    </div>
                    <div className="text-purple-200">
                      الفصل المطلوب: <span className="text-white font-bold">{req.chapterName}</span>
                    </div>
                    <div className="p-3 bg-black/20 rounded-xl border border-white/5 text-purple-300 mt-1 leading-relaxed">
                      {req.details}
                    </div>

                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[9px] text-purple-500">
                      <span>تاريخ الطلب: {new Date(req.createdAt).toLocaleString('en-US')}</span>
                      {req.status === 'PENDING' && (
                        <button
                          onClick={() => handleResolveEditRequest(req.id)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                        >
                          تحديد كـ "تم التعديل" ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center bg-[#1A1625] border border-dashed border-white/5 rounded-3xl text-xs text-purple-400">
                لا توجد أي طلبات تعديل مقدمة حالياً.
              </div>
            )}
          </div>
        )}

        {/* TAB: Points and Crown translator */}
        {activeTab === 'points' && (() => {
          const transPoints = getAllTranslatorsPoints().sort((a, b) => b.pointsThisMonth - a.pointsThisMonth);
          const crownedId = getCrownedTranslatorId();
          const currentMonth = new Date().toLocaleString('ar-EG', { month: 'long', year: 'numeric' });

          const handleCrownTranslator = (uid: string, name: string) => {
            crownTranslator(uid);
            // Refresh state trigger
            setAllNovels([...BerryDatabase.get<Novel[]>('novels', [])]); 
            alert(`تم تتويج المترجم "${name}" كـ "مترجم الشهر" بنجاح! 👑`);
          };

          return (
            <div className="flex flex-col gap-5 text-right animate-in fade-in duration-300">
              <div className="p-5 bg-gradient-to-r from-violet-950/20 to-purple-950/20 border border-violet-500/10 rounded-2xl mb-2">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <span>لوحة نقاط المترجمين وتتويج بطل الشهر 🏆</span>
                </h3>
                <p className="text-[10px] text-purple-400 mt-1">
                  توضح هذه اللوحة إجمالي المشاهدات المعتمدة (التي تجاوزت 30 ثانية لكل زيارة قارئ) والنقاط المكتسبة لكل مترجم لشهر <strong>{currentMonth}</strong>. يمكنك تتويج المترجم الأفضل ليحصل على اللقب والرتبة الفخمة تلقائياً.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-white/5">
                {transPoints.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-purple-200 text-right">
                        <thead>
                          <tr className="border-b border-white/5 text-purple-400 font-sans">
                            <th className="pb-3 pt-1 pr-2">المترجم</th>
                            <th className="pb-3 pt-1">رتبة الموقع</th>
                            <th className="pb-3 pt-1">المشاهدات المعتمدة ({currentMonth})</th>
                            <th className="pb-3 pt-1">النقاط المكتسبة ({currentMonth})</th>
                            <th className="pb-3 pt-1">الحالة واللقب</th>
                            <th className="pb-3 pt-1 text-left pl-2">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {transPoints.map((t, index) => {
                            const isThisCrowned = crownedId === t.translatorId;
                            // Find user role
                            const usersDb = BerryDatabase.get<User[]>('users_db', []);
                            const matchedUser = usersDb.find(u => u.id === t.translatorId);
                            const roleLabel = matchedUser?.role === 'OWNER' ? 'المالك 👑' : matchedUser?.role === 'TRANSLATOR' ? 'مترجم ✍️' : matchedUser?.role === 'WRITER' ? 'مؤلف 📝' : 'عضو 👤';

                            return (
                              <tr key={t.translatorId} className={`hover:bg-white/5 transition-all ${isThisCrowned ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : ''}`}>
                                <td className="py-3 pr-2 flex items-center gap-2 flex-row-reverse text-right">
                                  <img 
                                    src={t.avatar} 
                                    alt={t.translatorName} 
                                    className={`w-8 h-8 rounded-full border ${isThisCrowned ? 'border-yellow-400' : 'border-white/10'}`} 
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-white flex items-center gap-1">
                                      {t.translatorName}
                                      {index === 0 && t.pointsThisMonth > 0 && <span className="text-[9px] text-yellow-400 bg-yellow-500/10 px-1 rounded-sm">الأعلى 🥇</span>}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 text-purple-300 font-sans">{roleLabel}</td>
                                <td className="py-3 font-mono font-bold text-white">{t.viewsThisMonth.toLocaleString('ar-EG', { numberingSystem: 'latn' })} مشاهدة</td>
                                <td className="py-3 font-mono font-extrabold text-violet-400">{t.pointsThisMonth} نقطة</td>
                                <td className="py-3">
                                  {isThisCrowned ? (
                                    <span className="inline-flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                      🏆 مترجم الشهر الحالي
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-purple-400">عضو مشارك</span>
                                  )}
                                </td>
                                <td className="py-3 text-left pl-2">
                                  {isThisCrowned ? (
                                    <button
                                      disabled
                                      className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg text-[10px] font-bold cursor-not-allowed"
                                    >
                                      بطل متوج 👑
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleCrownTranslator(t.translatorId, t.translatorName)}
                                      className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-md shadow-violet-500/5"
                                    >
                                      تتويج باللقب 👑
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-purple-400 text-center py-4">لا يوجد أي مترجمين مسجلين في النظام حالياً.</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB: Trash Bin (سلة المحذوفات) */}
        {activeTab === 'trash' && (
          <div className="flex flex-col gap-6 text-right animate-in fade-in duration-300">
            <div className="p-5 bg-gradient-to-r from-red-950/20 to-violet-950/20 border border-red-500/10 rounded-2xl mb-2 flex items-start gap-3">
              <div className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white font-sans flex items-center gap-2">
                  <span>سلة المحذوفات المركزية للمنصة 🗑️</span>
                  <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full font-bold">خاص بمالك الموقع</span>
                </h3>
                <p className="text-[10px] text-purple-400 mt-1">
                  مرحباً يا مالك الموقع. تظهر هنا كافة الروايات والفصول التي تم حذفها من قبل المترجمين أو المشرفين. تبقى المواد هنا بشكل آمن، ويمكنك استعادتها بكامل فصولها وبياناتها بضغطة زر واحدة أو حذفها بشكل نهائي وقاطع من قواعد البيانات.
                </p>
              </div>
            </div>

            {/* Grid layout for Deleted Novels & Chapters */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Column 1: Deleted Novels (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <h4 className="text-xs font-extrabold text-purple-200 flex items-center gap-1.5 justify-end">
                  <span>الروايات المحذوفة مؤقتاً ({deletedNovels.length})</span>
                </h4>
                
                {deletedNovels.length === 0 ? (
                  <div className="p-12 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-2xl">
                    <p className="text-xs text-purple-400">لا توجد أي روايات محذوفة مؤقتاً في السلة حالياً. 🌱</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {deletedNovels.map((novel) => (
                      <div key={novel.id} className="p-4 bg-[#1A1625] border border-white/5 rounded-2xl flex gap-4 items-start relative group">
                        <img src={novel.cover} alt={novel.titleAr} className="w-16 h-24 rounded-xl object-cover border border-white/5 shrink-0" />
                        
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-xs text-white truncate">{novel.titleAr}</h5>
                          <p className="text-[9px] text-purple-400 mt-0.5 truncate">{novel.titleEn} | {novel.language}</p>
                          <p className="text-[10px] text-violet-300 mt-2">المترجم: <span className="font-bold text-white">{novel.translatorName}</span></p>
                          
                          <div className="flex flex-wrap gap-2 mt-3 text-[9px] text-purple-400 border-t border-white/5 pt-2">
                            <span>تاريخ الحذف: {novel.deletedAt ? new Date(novel.deletedAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' }) : 'غير محدد'}</span>
                            <span>بواسطة: {novel.deletedBy || 'غير معروف'}</span>
                            <span>الفصول المؤرشفة: <span className="font-bold text-white">{(novel.chapters || []).length}</span></span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRestoreNovel(novel.id)}
                            className="px-3 py-1.5 bg-green-500/10 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/20 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                          >
                            استعادة ↩️
                          </button>
                          <button
                            onClick={() => handlePermanentlyDeleteNovel(novel.id)}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                          >
                            حذف نهائي ❌
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 2: Deleted Chapters (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <h4 className="text-xs font-extrabold text-purple-200 flex items-center gap-1.5 justify-end">
                  <span>الفصول الفردية المحذوفة ({deletedChapters.length})</span>
                </h4>

                {deletedChapters.length === 0 ? (
                  <div className="p-12 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-2xl">
                    <p className="text-xs text-purple-400">لا توجد أي فصول محذوفة مؤقتاً في السلة حالياً. 🌱</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {deletedChapters.map((chap) => (
                      <div key={chap.id} className="p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl flex flex-col gap-2 transition-all text-right">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2.5 py-0.5 rounded-full font-bold max-w-[150px] truncate" title={chap.novelTitle}>
                              {chap.novelTitle}
                            </span>
                            <span className="text-xs font-bold text-white truncate">{chap.title}</span>
                          </div>
                          <span className="text-[9px] text-purple-400 block">رقم الفصل: {chap.number}</span>
                        </div>

                        <div className="flex flex-wrap justify-between items-center text-[9px] text-purple-400 border-t border-white/5 pt-2 gap-1">
                          <div className="flex items-center gap-1">
                            <span>بواسطة:</span>
                            <span className="text-purple-300 font-bold">{chap.deletedBy || 'المترجم'}</span>
                          </div>
                          
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleRestoreChapter(chap.id)}
                              className="px-2 py-1 bg-green-500/10 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/20 rounded-xl text-[9px] font-bold transition-all cursor-pointer"
                            >
                              استعادة ↩️
                            </button>
                            <button
                              onClick={() => handlePermanentlyDeleteChapter(chap.id)}
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-xl text-[9px] font-bold transition-all cursor-pointer"
                            >
                              حذف نهائي ❌
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

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
