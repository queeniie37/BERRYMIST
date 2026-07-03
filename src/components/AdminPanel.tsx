import React, { useState, useEffect } from 'react';
import { Shield, Check, X, AlertCircle, MessageSquare, Layers, Clock, Settings, Bell, RefreshCw, UserCheck } from 'lucide-react';
import { Novel, Suggestion, Reservation, User, TranslatorRequest } from '../types';
import { BerryDatabase } from '../data';

interface AdminPanelProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
}

export default function AdminPanel({ currentUser, onNavigate }: AdminPanelProps) {
  const [pendingNovels, setPendingNovels] = useState<Novel[]>([]);
  const [activeReservations, setActiveReservations] = useState<Reservation[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [translatorRequests, setTranslatorRequests] = useState<TranslatorRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'novels' | 'reservations' | 'logs' | 'translator_requests'>('novels');
  const [rejectReason, setRejectReason] = useState<{ [novelId: string]: string }>({});
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);

  useEffect(() => {
    // Load pending novels
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    setPendingNovels(allNovels.filter(n => n.status === 'PENDING'));

    // Load active reservations
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    setActiveReservations(allReservations.filter(r => r.status === 'ACTIVE'));

    // Load suggestions
    const allSuggestions = BerryDatabase.get<Suggestion[]>('suggestions', []);
    setSuggestions(allSuggestions);

    // Load translator requests
    const allReqs = BerryDatabase.get<TranslatorRequest[]>('translator_requests', []);
    setTranslatorRequests(allReqs);
  }, []);

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

    // Update users_db
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
      </div>

    </div>
  );
}
