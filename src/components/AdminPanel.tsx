import React, { useState, useEffect } from 'react';
import { Shield, Check, X, AlertCircle, MessageSquare, Layers, Clock, Settings, Bell, RefreshCw, UserCheck, Upload } from 'lucide-react';
import { Novel, Suggestion, Reservation, User, TranslatorRequest } from '../types';
import { BerryDatabase } from '../data';

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
  const [activeTab, setActiveTab] = useState<'novels' | 'reservations' | 'logs' | 'translator_requests' | 'settings' | 'users'>('novels');
  const [rejectReason, setRejectReason] = useState<{ [novelId: string]: string }>({});
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);

  // Users management states
  const [users, setUsers] = useState<any[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newRoleVal, setNewRoleVal] = useState<string>('MEMBER');
  const [roleChangeReason, setRoleChangeReason] = useState<string>('');

  const [siteNameInput, setSiteNameInput] = useState(() => BerryDatabase.get<string>('site_name', 'BerryMist'));
  const [siteLogoInput, setSiteLogoInput] = useState(() => BerryDatabase.get<string>('site_logo', '🍇'));
  const [siteBannerInput, setSiteBannerInput] = useState(() => BerryDatabase.get<string>('site_banner', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200'));

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
    
    // PNG validations for image attachments
    if (siteLogoInput.trim().startsWith('http')) {
      const cleanLogo = siteLogoInput.trim().split('?')[0].split('#')[0].toLowerCase();
      if (!cleanLogo.endsWith('.png') && !siteLogoInput.toLowerCase().includes('.png')) {
        alert('عذراً، يجب أن يكون رابط الشعار بصيغة PNG فقط (ينتهي بـ .png) لضمان جودة العرض والشفافية!');
        return;
      }
    }
    if (siteBannerInput.trim().startsWith('http')) {
      const cleanBanner = siteBannerInput.trim().split('?')[0].split('#')[0].toLowerCase();
      if (!cleanBanner.endsWith('.png') && !siteBannerInput.toLowerCase().includes('.png')) {
        alert('عذراً، يجب أن يكون رابط بانر الموقع بصيغة PNG فقط (ينتهي بـ .png) لضمان جودة العرض والشفافية!');
        return;
      }
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
  }, []);

  const handleDeleteNovelFromAdmin = (novelId: string) => {
    const target = allNovels.find(n => n.id === novelId);
    if (!target) return;
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف رواية "${target.titleAr}" نهائياً من الموقع بالكامل مع جميع الفصول والتعليقات الخاصة بها؟ هذا الإجراء لا يمكن التراجع عنه!`)) {
      return;
    }

    const loadedNovels = BerryDatabase.get<Novel[]>('novels', []);
    const updated = loadedNovels.filter(n => n.id !== novelId);
    BerryDatabase.set('novels', updated);
    setAllNovels(updated);
    setPendingNovels(updated.filter(n => n.status === 'PENDING'));

    // Also delete chapters & reservations
    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const deletedChaptersList = allChapters.filter(c => c.novelId === novelId);
    const deletedChapterIds = deletedChaptersList.map(c => c.id);
    const updatedChapters = allChapters.filter(c => c.novelId !== novelId);
    BerryDatabase.set('chapters', updatedChapters);

    const allReservations = BerryDatabase.get<any[]>('reservations', []);
    const updatedReservations = allReservations.filter(r => r.novelId !== novelId);
    BerryDatabase.set('reservations', updatedReservations);

    // Delete comments associated with novel or its chapters
    const allComments = BerryDatabase.get<any[]>('comments', []);
    const updatedComments = allComments.filter(c => c.refId !== novelId && !deletedChapterIds.includes(c.refId));
    BerryDatabase.set('comments', updatedComments);

    // Delete reviews
    const allReviews = BerryDatabase.get<any[]>('reviews', []);
    const updatedReviews = allReviews.filter(r => r.novelId !== novelId);
    BerryDatabase.set('reviews', updatedReviews);

    // Delete bookmarks
    const allBookmarks = BerryDatabase.get<string[]>('bookmarks', []);
    const updatedBookmarks = allBookmarks.filter(id => id !== novelId);
    BerryDatabase.set('bookmarks', updatedBookmarks);

    // Delete reading history
    const allHistory = BerryDatabase.get<any[]>('reading_history', []);
    const updatedHistory = allHistory.filter(h => h.novelId !== novelId);
    BerryDatabase.set('reading_history', updatedHistory);

    // Delete from deleted_chapters
    const allDeletedChapters = BerryDatabase.get<any[]>('deleted_chapters', []);
    const updatedDeletedChapters = allDeletedChapters.filter(c => c.novelId !== novelId);
    BerryDatabase.set('deleted_chapters', updatedDeletedChapters);

    window.dispatchEvent(new Event('novels-updated'));
    alert(`تم حذف الرواية "${target.titleAr}" بنجاح مع كافة فصولها وبياناتها!`);
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
                          التاريخ: {new Date(req.createdAt).toLocaleDateString('ar-EG')}
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
                        <span>تاريخ بدء الحجز: {new Date(res.startAt).toLocaleDateString('ar-EG')}</span>
                        <span>تاريخ انتهاء الصلاحية: {new Date(res.endAt).toLocaleDateString('ar-EG')}</span>
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
                    <label className="text-xs font-bold text-purple-200">شعار الموقع (ملف PNG أو إيموجي)</label>
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
                          <span>رفع PNG</span>
                        </button>
                        <input 
                          type="file" 
                          accept=".png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const extension = file.name.split('.').pop()?.toLowerCase();
                            if (extension !== 'png') {
                              alert('خطأ: يجب اختيار صورة بصيغة PNG لشعار الموقع!');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setSiteLogoInput(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner File Upload (Strictly PNG) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-purple-200">تحميل بانر الموقع الرئيسي (ملف PNG حصراً) *</label>
                  <div className="relative border border-dashed border-white/10 hover:border-violet-500/40 rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[90px]">
                    <input 
                      type="file" 
                      accept=".png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const extension = file.name.split('.').pop()?.toLowerCase();
                        if (extension !== 'png') {
                          alert('خطأ: يجب اختيار صورة غلاف بصيغة PNG لبانر الموقع!');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setSiteBannerInput(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {siteBannerInput ? (
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-10 rounded border border-violet-500 overflow-hidden">
                          <img src={siteBannerInput} alt="Banner Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <span className="text-[10px] text-green-400 font-bold">تم تحميل البانر بنجاح ✓ (بصيغة PNG)</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={18} className="text-purple-400" />
                        <span className="text-[10px] text-purple-300 font-bold">انقر لاختيار ملف PNG لبانر الموقع الرئيسي</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mt-2 flex items-center gap-4">
                  <span className="text-lg">👁️</span>
                  <div>
                    <span className="text-xs font-bold text-violet-300 block mb-1">معاينة الهوية المقترحة:</span>
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 w-fit">
                      {siteLogoInput.startsWith('http') ? (
                        <img src={siteLogoInput} alt="Preview Logo" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-lg">{siteLogoInput}</span>
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
      </div>

    </div>
  );
}
