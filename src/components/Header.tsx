import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon, Sun, User as UserIcon, LogOut, Settings, Award, Shield, FileText, CheckCircle, Flame, Layers, Plus, Megaphone, Menu, X, LogIn } from 'lucide-react';
import { User, UserRole } from '../types';
import { DEFAULT_USERS, BerryDatabase } from '../data';
import { isImageSource, safeEmojiOrFallback } from '../utils/media';
import LoginModal from './LoginModal';

interface HeaderProps {
  currentUser: User;
  onRoleChange: (newRole: UserRole) => void;
  onNavigate: (page: string, params?: any) => void;
  currentPage: string;
  onLoginSuccess: (user: User) => void;
}

export default function Header({ currentUser, onRoleChange, onNavigate, currentPage, onLoginSuccess }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Close the profile/notifications dropdowns when clicking anywhere
  // outside them (e.g. on a novel card) instead of leaving them open.
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);
  
  useEffect(() => {
    const handleOpenLoginModal = () => {
      setLoginModalOpen(true);
    };
    window.addEventListener('open-login-modal', handleOpenLoginModal);
    return () => {
      window.removeEventListener('open-login-modal', handleOpenLoginModal);
    };
  }, []);
  
  const [siteName, setSiteName] = useState(() => BerryDatabase.get<string>('site_name', 'BerryMist'));
  const [siteLogo, setSiteLogo] = useState(() => {
    const logo = BerryDatabase.get<string>('site_logo', '/site_logo_v2.png');
    return logo === '🍇' ? '/site_logo_v2.png' : logo;
  });

  const safeSiteLogo = (typeof siteLogo === 'string' && siteLogo.trim() && siteLogo.trim() !== '🍇') ? siteLogo.trim() : '/site_logo_v2.png';
  const safeSiteName = (typeof siteName === 'string' && siteName.trim()) ? siteName.trim() : 'BerryMist';

  useEffect(() => {
    const handleSiteUpdate = () => {
      setSiteName(BerryDatabase.get<string>('site_name', 'BerryMist'));
      const logo = BerryDatabase.get<string>('site_logo', '/site_logo_v2.png');
      setSiteLogo(logo === '🍇' ? '/site_logo_v2.png' : logo);
    };
    window.addEventListener('site-settings-updated', handleSiteUpdate);
    return () => window.removeEventListener('site-settings-updated', handleSiteUpdate);
  }, []);

  // Real-time search results
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    // All uploaded novels are searchable by every visitor (guests included), except cancelled ones
    const novels = BerryDatabase.get<any[]>('novels', []);
    const filtered = novels.filter(n => {
      if (n.status === 'CANCELLED') return false;
      return (
        n.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.genres.some((g: string) => g.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
    setSearchResults(filtered);
  }, [searchQuery]);

  const [localNotifications, setLocalNotifications] = useState<any[]>([]);

  const loadNotifications = () => {
    const rawNotifications = BerryDatabase.get<any[]>('notifications', [
      { id: '1', title: 'فصل جديد متاح!', message: 'الفصل 165 من "بداية بعد النهاية" متوفر الآن للقراءة.', isRead: false, createdAt: 'منذ ١٠ دقائق' },
      { id: '2', title: 'موافقة على روايتك', message: 'تمت الموافقة على رواية "عودة ملك الظلال" ونشرها بنجاح.', isRead: true, createdAt: 'منذ ساعة' }
    ]);

    const filtered = rawNotifications.filter(n => {
      if (currentUser.role === 'GUEST') {
        return !n.userId && !n.email;
      }
      return !n.userId && !n.email || n.userId === currentUser.id || n.email?.toLowerCase() === currentUser.email?.toLowerCase();
    });
    // Newest notifications always on top. New ones are appended to the end
    // of the stored array, so entries without parseable dates fall back to
    // reversed insertion order instead of keeping oldest-first.
    const indexed = filtered.map((n, idx) => ({ n, idx, t: Date.parse(n?.createdAt || '') || 0 }));
    indexed.sort((a, b) => (b.t - a.t) || (b.idx - a.idx));
    setLocalNotifications(indexed.map(x => x.n));
  };

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };
    window.addEventListener('user-updated', handleUpdate);
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      window.removeEventListener('user-updated', handleUpdate);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [currentUser]);

  const handleMarkAllRead = () => {
    const rawNotifications = BerryDatabase.get<any[]>('notifications', [
      { id: '1', title: 'فصل جديد متاح!', message: 'الفصل 165 من "بداية بعد النهاية" متوفر الآن للقراءة.', isRead: false, createdAt: 'منذ ١٠ دقائق' },
      { id: '2', title: 'موافقة على روايتك', message: 'تمت الموافقة على رواية "عودة ملك الظلال" ونشرها بنجاح.', isRead: true, createdAt: 'منذ ساعة' }
    ]);
    const updated = rawNotifications.map(n => {
      const isTarget = currentUser.role !== 'GUEST' && (n.userId === currentUser.id || n.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (isTarget || (!n.userId && !n.email)) {
        return { ...n, isRead: true };
      }
      return n;
    });
    BerryDatabase.set('notifications', updated);
    loadNotifications();
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const unreadCount = localNotifications.filter(n => !n.isRead).length;

  return (
    <>
      <header className="sticky top-0 z-50 w-full glass-panel h-20 transition-all duration-300 flex items-center border-b border-white/5 px-4 sm:px-6 lg:px-12 justify-between">
        {/* Right Side: Logo & Hamburger */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Hamburger button for mobile/tablet */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600/10 border border-violet-500/25 text-violet-300 hover:text-white hover:bg-violet-600/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(139,92,246,0.12)] whitespace-nowrap"
            title="الأقسام والصفحات"
          >
            <Menu size={16} />
            <span className="text-xs font-bold font-sans hidden min-[400px]:inline">القائمة</span>
          </button>

          <div 
            onClick={() => onNavigate('home')} 
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none"
          >
            {isImageSource(safeSiteLogo) ? (
              <img src={safeSiteLogo} alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover filter drop-shadow-[0_0_10px_rgba(139,92,246,0.6)] animate-pulse" referrerPolicy="no-referrer" />
            ) : (
              <img src="/site_logo_v2.png" alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover filter drop-shadow-[0_0_10px_rgba(139,92,246,0.6)] animate-pulse" referrerPolicy="no-referrer" />
            )}
            <span className="font-extrabold text-lg sm:text-2xl tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-berry-400 bg-clip-text text-transparent">
              {safeSiteName}
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-purple-200/80 mr-8">
            <button 
              onClick={() => onNavigate('home')} 
              className={`hover:text-white transition-colors py-2 relative ${currentPage === 'home' ? 'text-white font-semibold' : ''}`}
            >
              الرئيسية
              {currentPage === 'home' && (
                <span className="absolute bottom-0 right-0 left-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />
              )}
            </button>
            <button 
              onClick={() => onNavigate('explore')} 
              className={`hover:text-white transition-colors py-2 relative ${currentPage === 'explore' ? 'text-white font-semibold' : ''}`}
            >
              المكتبة والاستكشاف
              {currentPage === 'explore' && (
                <span className="absolute bottom-0 right-0 left-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />
              )}
            </button>
            <button 
              onClick={() => onNavigate('suggestions')} 
              className={`hover:text-white transition-colors py-2 relative ${currentPage === 'suggestions' ? 'text-white font-semibold' : ''}`}
            >
              اقتراح رواية
              {currentPage === 'suggestions' && (
                <span className="absolute bottom-0 right-0 left-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />
              )}
            </button>
            <button 
              onClick={() => onNavigate('teams')} 
              className={`hover:text-white transition-colors py-2 relative ${currentPage === 'teams' ? 'text-white font-semibold' : ''}`}
            >
              المترجمين
              {currentPage === 'teams' && (
                <span className="absolute bottom-0 right-0 left-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />
              )}
            </button>
            <button 
              onClick={() => onNavigate('ads')} 
              className={`hover:text-white transition-colors py-2 relative ${currentPage === 'ads' ? 'text-white font-semibold' : ''}`}
            >
              الإعلانات 📢
              {currentPage === 'ads' && (
                <span className="absolute bottom-0 right-0 left-0 h-[2px] bg-gradient-to-r from-violet-500 to-berry-500 rounded-full" />
              )}
            </button>
          </nav>
        </div>

        {/* Left Side: Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {currentUser.role === 'GUEST' && (
            <button 
              onClick={() => setLoginModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold bg-gradient-to-r from-violet-600 to-berry-500 text-white shadow-lg hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
            >
              <LogIn size={12} />
              <span className="hidden sm:inline">تسجيل الدخول 🍇</span>
              <span className="sm:hidden">دخول</span>
            </button>
          )}

          {/* Quick Role Switcher removed for privacy, keeping only the one in profile next to user's name */}

          {/* Search Button */}
          <button 
            onClick={() => setSearchOpen(true)}
            className="p-2 sm:p-2.5 rounded-full bg-white/5 border border-white/5 text-purple-200/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <Search size={16} />
          </button>

          {/* Notifications Trigger */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setProfileOpen(false);
              }}
              className="p-2 sm:p-2.5 rounded-full bg-white/5 border border-white/5 text-purple-200/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-berry-500 rounded-full animate-ping" />
              )}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-berry-500 rounded-full" />
              )}
            </button>

            {/* Notifications Panel */}
            {notificationsOpen && (
              <div className="absolute left-0 mt-3 w-80 max-w-[calc(100vw-2rem)] glass-panel rounded-2xl p-4 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                  <h4 className="font-bold text-sm text-purple-200">الإشعارات</h4>
                  <button 
                    onClick={handleMarkAllRead} 
                    className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer"
                  >
                    تعليم الكل كمقروء
                  </button>
                </div>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {localNotifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-2.5 rounded-xl text-right transition-colors ${notif.isRead ? 'bg-transparent' : 'bg-violet-500/10'}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-white">{notif.title}</span>
                        <span className="text-[10px] text-purple-400">{notif.createdAt}</span>
                      </div>
                      <p className="text-xs text-purple-300/90 mt-1">{notif.message}</p>
                    </div>
                  ))}

                  {localNotifications.length === 0 && (
                    <p className="text-xs text-purple-400 py-6 text-center">لا توجد إشعارات حالياً.</p>
                  )}
                </div>

                {localNotifications.length > 0 && (
                  <button 
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigate('notifications');
                    }}
                    className="w-full mt-3 py-2 bg-gradient-to-r from-berry-600/20 to-violet-600/20 hover:from-berry-600/40 hover:to-violet-600/40 border border-violet-500/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center block"
                  >
                    عرض الكل 👁️
                  </button>
                )}
              </div>
            )}
          </div>

          {/* User Profile Avatar with Dropdown */}
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 cursor-pointer focus:outline-none"
            >
              <img 
                src={currentUser.avatar} 
                alt={currentUser.username} 
                className="w-10 h-10 rounded-full border border-violet-500/30 object-cover"
              />
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute left-0 mt-3 w-64 glass-panel rounded-2xl p-4 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-3 pb-3 border-b border-white/5 mb-3 text-right">
                  <img src={currentUser.avatar} alt={currentUser.username} className="w-12 h-12 rounded-full border border-violet-500/20" />
                  <div>
                    <h4 className="font-bold text-sm text-white">{currentUser.username}</h4>
                    <span className="text-xs text-violet-400">{currentUser.email}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-right">
                  {currentUser.role !== 'GUEST' && (
                    <div className="px-2 py-1.5 bg-white/5 rounded-xl flex justify-between text-xs text-purple-300 mb-2">
                      <span>المستوى {currentUser.level}</span>
                      <span>XP {currentUser.xp}</span>
                    </div>
                  )}

                  {currentUser.role === 'GUEST' ? (
                    <button 
                      onClick={() => { setLoginModalOpen(true); setProfileOpen(false); }}
                      className="flex items-center justify-between w-full p-2.5 bg-gradient-to-r from-violet-600 to-berry-500 rounded-xl text-xs font-bold text-white hover:brightness-110 transition-all text-right cursor-pointer shadow-md"
                    >
                      <LogIn size={14} />
                      <span>تسجيل دخول / إنشاء حساب</span>
                    </button>
                  ) : (
                    <>
                      {(currentUser.role === 'OWNER' || currentUser.email?.toLowerCase() === 'berrymist11@gmail.com') && (
                        <button 
                          onClick={() => { onNavigate('admin'); setProfileOpen(false); }}
                          className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl text-sm text-purple-200 hover:text-white transition-all text-right cursor-pointer"
                        >
                          <Shield size={16} className="text-violet-400" />
                          <span>لوحة المالك والإدارة</span>
                        </button>
                      )}

                      {(currentUser.role === 'TRANSLATOR' || currentUser.role === 'OWNER' || currentUser.role === 'WRITER' || currentUser.email?.toLowerCase() === 'berrymist11@gmail.com') && (
                        <button 
                          onClick={() => { onNavigate('translator-panel'); setProfileOpen(false); }}
                          className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl text-sm text-purple-200 hover:text-white transition-all text-right cursor-pointer"
                        >
                          <FileText size={16} className="text-berry-400" />
                          <span>لوحة العمل (مترجم/كاتب)</span>
                        </button>
                      )}

                      <button 
                        onClick={() => { onNavigate('profile'); setProfileOpen(false); }}
                        className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl text-sm text-purple-200 hover:text-white transition-all text-right cursor-pointer"
                      >
                        <UserIcon size={16} className="text-purple-400" />
                        <span>ملفي الشخصي</span>
                      </button>

                      <button 
                        onClick={() => { onNavigate('ads'); setProfileOpen(false); }}
                        className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl text-sm text-purple-200 hover:text-white transition-all text-right cursor-pointer"
                      >
                        <Megaphone size={16} className="text-fuchsia-400" />
                        <span>صفحة الإعلانات العامة</span>
                      </button>

                      <button 
                        onClick={() => { onNavigate('explore'); setProfileOpen(false); }}
                        className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl text-sm text-purple-200 hover:text-white transition-all text-right cursor-pointer"
                      >
                        <Layers size={16} className="text-purple-400" />
                        <span>مكتبتي الروائية</span>
                      </button>

                      <button 
                        onClick={() => { onRoleChange('GUEST'); setProfileOpen(false); }}
                        className="flex items-center justify-between w-full p-2 hover:bg-red-500/10 rounded-xl text-sm text-red-400 transition-all text-right cursor-pointer"
                      >
                        <LogOut size={16} className="text-red-400" />
                        <span>تسجيل الخروج</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Interactive Role Control Center Widget */}
      {roleSelectorOpen && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm glass-panel p-4 rounded-2xl shadow-2xl border border-violet-500/40 animate-bounce-short">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-bold">ميزة محاكاة رتب الموقع</span>
            <button onClick={() => setRoleSelectorOpen(false)} className="text-purple-400 hover:text-white text-xs font-bold">إغلاق ×</button>
          </div>
          <h3 className="font-bold text-sm text-purple-100 text-right mb-1">مركز التحكم بصلاحيات العضوية</h3>
          <p className="text-xs text-purple-300/95 text-right mb-4">اختر رتبتك لمحاكاة تجربة الموقع بالكامل كقارئ، أو مترجم يحجز ويكتب روايات، أو مالك ومسؤول الإدارة:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button 
              onClick={() => { onRoleChange('GUEST'); setRoleSelectorOpen(false); }}
              className={`p-2.5 rounded-xl border font-semibold transition-all ${currentUser.role === 'GUEST' ? 'bg-violet-600 text-white border-violet-500' : 'bg-white/5 text-purple-300 border-white/5 hover:bg-white/10'}`}
            >
              🌐 زائر (تصفح فقط)
            </button>
            <button 
              onClick={() => { onRoleChange('MEMBER'); setRoleSelectorOpen(false); }}
              className={`p-2.5 rounded-xl border font-semibold transition-all ${currentUser.role === 'MEMBER' ? 'bg-violet-600 text-white border-violet-500' : 'bg-white/5 text-purple-300 border-white/5 hover:bg-white/10'}`}
            >
              👤 عضو قارئ (تفاعل)
            </button>
            <button 
              onClick={() => { onRoleChange('TRANSLATOR'); setRoleSelectorOpen(false); }}
              className={`p-2.5 rounded-xl border font-semibold transition-all ${currentUser.role === 'TRANSLATOR' ? 'bg-violet-600 text-white border-violet-500' : 'bg-white/5 text-purple-300 border-white/5 hover:bg-white/10'}`}
            >
              ✍️ مترجم (تأليف وحجز)
            </button>
            <button 
              onClick={() => { onRoleChange('WRITER'); setRoleSelectorOpen(false); }}
              className={`p-2.5 rounded-xl border font-semibold transition-all ${currentUser.role === 'WRITER' ? 'bg-violet-600 text-white border-violet-500' : 'bg-white/5 text-purple-300 border-white/5 hover:bg-white/10'}`}
            >
              ✒️ كاتب ومؤلف
            </button>
            {currentUser.email?.toLowerCase() === 'berrymist11@gmail.com' ? (
              <button 
                onClick={() => { onRoleChange('OWNER'); setRoleSelectorOpen(false); }}
                className={`p-2.5 col-span-2 rounded-xl border font-semibold transition-all ${currentUser.role === 'OWNER' ? 'bg-violet-600 text-white border-violet-500' : 'bg-white/5 text-purple-300 border-white/5 hover:bg-white/10'}`}
              >
                👑 المالك والمدير (تحكم شامل)
              </button>
            ) : (
              <button 
                onClick={() => alert('خطأ أمني: هذه الرتبة مخصصة لمالك الموقع فقط! يرجى تسجيل الدخول كمالك بحسابك أولاً للوصول.')}
                className="p-2.5 col-span-2 rounded-xl border border-white/5 bg-white/5 text-purple-400/50 cursor-not-allowed font-semibold text-center"
              >
                🔒 رتبة المالك مغلقة (يتطلب تسجيل دخول المالك)
              </button>
            )}
          </div>
          <p className="text-[10px] text-purple-400 text-center mt-3">بيانات محاكاة Berry Mist محفوظة تلقائياً في LocalStorage</p>
        </div>
      )}

      {/* Advanced Command Palette Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex justify-center pt-24 px-4">
          <div className="w-full max-w-2xl glass-panel p-6 rounded-3xl shadow-2xl border border-white/10 h-fit max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <span className="text-purple-300 font-bold text-lg text-right">بحث متقدم وسريع</span>
              <button 
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="p-1.5 hover:bg-white/5 rounded-full text-purple-400 hover:text-white transition-all font-bold text-sm"
              >
                إغلاق (Esc)
              </button>
            </div>

            <div className="relative mb-4">
              <input 
                type="text" 
                placeholder="ابحث باسم الرواية، الكاتب، المترجم أو التصنيفات (مثال: الظلال، أكشن)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-white/5 border border-white/10 focus:border-violet-500 rounded-2xl py-4.5 pr-12 pl-4 text-white text-right placeholder-purple-300/40 text-sm outline-none transition-all"
              />
              <Search className="absolute right-4 top-4 text-purple-400" size={20} />
            </div>

            <div className="flex-1 overflow-y-auto max-h-96 pr-1">
              {searchResults.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {searchResults.map((novel) => (
                    <div 
                      key={novel.id} 
                      onClick={() => {
                        onNavigate('novel', { id: novel.id });
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-4 p-3 bg-white/5 hover:bg-violet-500/10 border border-white/5 hover:border-violet-500/20 rounded-2xl cursor-pointer transition-all text-right"
                    >
                      <img src={novel.cover} alt={novel.titleAr} className="w-12 h-16 rounded-xl object-cover border border-white/5" />
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-white">{novel.titleAr}</h4>
                        <span className="text-xs text-purple-300">{novel.titleEn}</span>
                        <div className="flex gap-2 flex-wrap mt-1">
                          {novel.genres.slice(0, 3).map((g: string) => (
                            <span key={g} className="text-[10px] bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full">{g}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-left text-xs text-purple-400">
                        <span>{novel.chaptersCount} فصل</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim() !== '' ? (
                <div className="text-center py-12 text-purple-300">
                  <p className="text-sm">لم يتم العثور على نتائج للبحث عن "{searchQuery}"</p>
                  <p className="text-xs text-purple-400 mt-1">تأكد من كتابة أحرف صحيحة أو تصنيف سليم.</p>
                </div>
              ) : (
                <div className="text-right py-6">
                  <h4 className="font-bold text-xs text-purple-400 uppercase tracking-wider mb-3">روايات مقترحة وبحث سريع</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['أكشن', 'فانتزيا', 'إسيكاي', 'نظام', 'مغامرات', 'موريم'].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        className="p-2.5 bg-white/5 hover:bg-white/10 text-right rounded-xl text-purple-300 hover:text-white transition-all text-xs"
                      >
                        🔍 تصنيف: {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-xl flex flex-col justify-between gap-6 p-6 overflow-y-auto animate-in fade-in duration-300 lg:hidden">
          <div>
            <div className="flex items-center justify-between pb-6 border-b border-white/5 mb-8">
              <div className="flex items-center gap-2">
                {isImageSource(safeSiteLogo) ? (
                  <img src={safeSiteLogo} alt="Logo" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <img src="/site_logo_v2.png" alt="Logo" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                )}
                <span className="font-extrabold text-2xl bg-gradient-to-r from-violet-400 via-purple-400 to-berry-400 bg-clip-text text-transparent">
                  {safeSiteName}
                </span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-full bg-white/5 border border-white/5 text-purple-200 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-col gap-4 text-right text-lg font-bold text-purple-100">
              <button 
                onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }} 
                className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'home' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <span>🏠 الرئيسية</span>
                <span className="text-xs text-purple-400 font-normal">عرض كل الأقسام</span>
              </button>
              <button 
                onClick={() => { onNavigate('explore'); setMobileMenuOpen(false); }} 
                className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'explore' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <span>📚 المكتبة والاستكشاف</span>
                <span className="text-xs text-purple-400 font-normal">تصفح وتصنيف الروايات</span>
              </button>
              <button 
                onClick={() => { onNavigate('suggestions'); setMobileMenuOpen(false); }} 
                className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'suggestions' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <span>💡 اقتراح رواية</span>
                <span className="text-xs text-purple-400 font-normal">شاركنا باقتراحاتك الفخمة</span>
              </button>
              <button 
                onClick={() => { onNavigate('teams'); setMobileMenuOpen(false); }} 
                className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'teams' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <span>⚔️ المترجمين</span>
                <span className="text-xs text-purple-400 font-normal">فريق التحرير والترجمة والمترجمين</span>
              </button>
              <button
                onClick={() => { onNavigate('ads'); setMobileMenuOpen(false); }}
                className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'ads' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <span>📢 صفحة الإعلانات العامة</span>
                <span className="text-xs text-purple-400 font-normal">آخر الأخبار والإعلانات</span>
              </button>

              {/* Control panels — shown per role so the owner sees all panels */}
              {(currentUser.role === 'TRANSLATOR' || currentUser.role === 'WRITER' || currentUser.role === 'OWNER') && (
                <button
                  onClick={() => { onNavigate('translator-panel'); setMobileMenuOpen(false); }}
                  className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'translator-panel' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <span>✍️ لوحة العمل (مترجم/كاتب)</span>
                  <span className="text-xs text-purple-400 font-normal">إنشاء ونشر رواياتك</span>
                </button>
              )}
              {currentUser.role === 'OWNER' && (
                <button
                  onClick={() => { onNavigate('admin'); setMobileMenuOpen(false); }}
                  className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'admin' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <span>🛡️ لوحة المالك والإدارة</span>
                  <span className="text-xs text-purple-400 font-normal">إدارة المنصة بالكامل</span>
                </button>
              )}
            </nav>
          </div>

          {/* Mobile role switch shortcut & profile link in menu bottom */}
          <div className="border-t border-white/5 pt-6 flex flex-col gap-4">
            <button 
              onClick={() => { onNavigate('profile'); setMobileMenuOpen(false); }}
              className="py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-between text-sm font-semibold transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <img src={currentUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-violet-500/30" />
                <span>ملفي الشخصي ({currentUser.username})</span>
              </span>
              <span className="text-xs text-violet-400">تعديل ملفي</span>
            </button>
            <div className="text-center text-[9px] text-purple-500">
              © 2026 بيري ميست 🍇 - جميع الحقوق محفوظة
            </div>
          </div>
        </div>
      )}

      <LoginModal 
        isOpen={loginModalOpen} 
        onClose={() => setLoginModalOpen(false)} 
        onLoginSuccess={onLoginSuccess} 
      />
    </>
  );
}
