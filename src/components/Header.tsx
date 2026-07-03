import React, { useState, useEffect } from 'react';
import { Search, Bell, Moon, Sun, User as UserIcon, LogOut, Settings, Award, Shield, FileText, CheckCircle, Flame, Layers, Plus, Megaphone, Menu, X, LogIn } from 'lucide-react';
import { User, UserRole } from '../types';
import { DEFAULT_USERS, BerryDatabase } from '../data';
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
  
  // Real-time search results
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    const novels = BerryDatabase.get<any[]>('novels', []);
    const filtered = novels.filter(n => 
      n.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.genres.some((g: string) => g.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setSearchResults(filtered);
  }, [searchQuery]);

  const notifications = BerryDatabase.get<any[]>('notifications', [
    { id: '1', title: 'فصل جديد متاح!', message: 'الفصل 165 من "بداية بعد النهاية" متوفر الآن للقراءة.', isRead: false, createdAt: 'منذ ١٠ دقائق' },
    { id: '2', title: 'موافقة على روايتك', message: 'تمت الموافقة على رواية "عودة ملك الظلال" ونشرها بنجاح.', isRead: true, createdAt: 'منذ ساعة' }
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      <header className="sticky top-0 z-50 w-full glass-panel h-20 transition-all duration-300 flex items-center border-b border-white/5 px-6 lg:px-12 justify-between">
        {/* Right Side: Logo & Hamburger */}
        <div className="flex items-center gap-4">
          {/* Hamburger button for mobile/tablet */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2.5 rounded-full bg-white/5 border border-white/5 text-purple-200 hover:text-white transition-all cursor-pointer"
          >
            <Menu size={20} />
          </button>

          <div 
            onClick={() => onNavigate('home')} 
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(139,92,246,0.6)]">🍇</span>
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-berry-400 bg-clip-text text-transparent">
              BerryMist
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
              الفرق
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
        <div className="flex items-center gap-4">
          {currentUser.role === 'GUEST' && (
            <button 
              onClick={() => setLoginModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-violet-600 to-berry-500 text-white shadow-lg hover:brightness-110 transition-all cursor-pointer"
            >
              <LogIn size={13} />
              <span>تسجيل الدخول 🍇</span>
            </button>
          )}

          {/* Quick Role Switcher Trigger (For Demo/Evaluation) */}
          <button 
            onClick={() => setRoleSelectorOpen(!roleSelectorOpen)} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-500/10 border border-violet-500/30 hover:border-violet-500/60 transition-all text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)] cursor-pointer"
            title="تبديل رتب العضوية لتجربة المزايا بالكامل"
          >
            <Layers size={14} className="animate-pulse" />
            <span>رتبة:</span>
            <span className="text-berry-300">
              {currentUser.role === 'OWNER' ? 'المالك 👑' :
               currentUser.role === 'SUPERVISOR' ? 'مشرف 🛡️' :
               currentUser.role === 'TRANSLATOR' ? 'مترجم ✍️' :
               currentUser.role === 'MEMBER' ? 'عضو 👤' : 'زائر 🌐'}
            </span>
          </button>

          {/* Search Button */}
          <button 
            onClick={() => setSearchOpen(true)}
            className="p-2.5 rounded-full bg-white/5 border border-white/5 text-purple-200/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <Search size={18} />
          </button>

          {/* Notifications Trigger */}
          <div className="relative">
            <button 
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setProfileOpen(false);
              }}
              className="p-2.5 rounded-full bg-white/5 border border-white/5 text-purple-200/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-berry-500 rounded-full animate-ping" />
              )}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-berry-500 rounded-full" />
              )}
            </button>

            {/* Notifications Panel */}
            {notificationsOpen && (
              <div className="absolute left-0 mt-3 w-80 glass-panel rounded-2xl p-4 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                  <h4 className="font-bold text-sm text-purple-200">الإشعارات</h4>
                  <button className="text-xs text-violet-400 hover:text-violet-300">تعليم الكل كمقروء</button>
                </div>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {notifications.map((notif) => (
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
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar with Dropdown */}
          <div className="relative">
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
                      {currentUser.role === 'OWNER' && (
                        <button 
                          onClick={() => { onNavigate('admin'); setProfileOpen(false); }}
                          className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl text-sm text-purple-200 hover:text-white transition-all text-right cursor-pointer"
                        >
                          <Shield size={16} className="text-violet-400" />
                          <span>لوحة المالك والإدارة</span>
                        </button>
                      )}

                      {(currentUser.role === 'TRANSLATOR' || currentUser.role === 'OWNER' || currentUser.role === 'WRITER') && (
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
            <button 
              onClick={() => { onRoleChange('OWNER'); setRoleSelectorOpen(false); }}
              className={`p-2.5 col-span-2 rounded-xl border font-semibold transition-all ${currentUser.role === 'OWNER' ? 'bg-violet-600 text-white border-violet-500' : 'bg-white/5 text-purple-300 border-white/5 hover:bg-white/10'}`}
            >
              👑 المالك والمدير (تحكم شامل)
            </button>
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
        <div className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-xl flex flex-col justify-between p-6 animate-in fade-in duration-300 lg:hidden">
          <div>
            <div className="flex items-center justify-between pb-6 border-b border-white/5 mb-8">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🍇</span>
                <span className="font-extrabold text-2xl bg-gradient-to-r from-violet-400 via-purple-400 to-berry-400 bg-clip-text text-transparent">
                  BerryMist
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
                <span>⚔️ الفرق</span>
                <span className="text-xs text-purple-400 font-normal">فريق التحرير والترجمة</span>
              </button>
              <button 
                onClick={() => { onNavigate('ads'); setMobileMenuOpen(false); }} 
                className={`py-3.5 px-5 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${currentPage === 'ads' ? 'bg-gradient-to-r from-violet-600 to-berry-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <span>📢 صفحة الإعلانات العامة</span>
                <span className="text-xs text-purple-400 font-normal">آخر الأخبار والإعلانات</span>
              </button>
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
