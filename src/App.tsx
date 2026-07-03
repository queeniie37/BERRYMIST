import React, { useState, useEffect, useMemo } from 'react';
import { 
  Compass, Flame, Clock, Award, Plus, Layers, Search, 
  MessageSquare, Users, Shield, BookOpen, Heart, 
  ArrowUp, Mail, AlertCircle, TrendingUp, CheckCircle, HelpCircle, FileText, Megaphone
} from 'lucide-react';
import { User, UserRole, Novel, Suggestion, Reservation, News, Team } from './types';
import { DEFAULT_USERS, BerryDatabase } from './data';

// Component imports
import Header from './components/Header';
import NewsTicker from './components/NewsTicker';
import HeroSlider from './components/HeroSlider';
import NovelCard from './components/NovelCard';
import ContinueReading from './components/ContinueReading';
import StatsCounter from './components/StatsCounter';
import SuggestNovelDialog from './components/SuggestNovelDialog';
import ExploreLibrary from './components/ExploreLibrary';
import NovelDetails from './components/NovelDetails';
import ReaderView from './components/ReaderView';
import TranslatorPanel from './components/TranslatorPanel';
import AdminPanel from './components/AdminPanel';
import AdsTicker from './components/AdsTicker';
import AdsPage from './components/AdsPage';
import TranslatorRequestForm from './components/TranslatorRequestForm';

export default function App() {
  // Core states
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USERS.OWNER);
  const [currentPage, setCurrentPage] = useState<string>('home'); // home, explore, suggestions, teams, profile, novel, reader, translator-panel, admin
  const [currentParams, setCurrentParams] = useState<any>(null);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Modals / Overlays
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showProfileFavorites, setShowProfileFavorites] = useState(true);
  const [refreshAdsTrigger, setRefreshAdsTrigger] = useState(0);

  // Initialize data on mount
  useEffect(() => {
    BerryDatabase.initialize();

    const handleAdsUpdate = () => {
      setRefreshAdsTrigger(prev => prev + 1);
    };
    window.addEventListener('ads-updated', handleAdsUpdate);

    const handleUserUpdate = () => {
      const savedUser = BerryDatabase.get<User | null>('current_user_data', null);
      if (savedUser) {
        setCurrentUser(savedUser);
      }
    };
    window.addEventListener('user-updated', handleUserUpdate);
    
    // Load from local database
    const savedUser = BerryDatabase.get<User | null>('current_user_data', null);
    if (savedUser) {
      setCurrentUser(savedUser);
    } else {
      const initialRole = BerryDatabase.get<UserRole>('current_role', 'OWNER');
      setCurrentUser(DEFAULT_USERS[initialRole]);
    }
    const loadedNovels = BerryDatabase.get<Novel[]>('novels', []);
    const loadedSuggestions = BerryDatabase.get<Suggestion[]>('suggestions', []);
    
    setNovels(loadedNovels);
    setNews(BerryDatabase.get<News[]>('news', []));
    setSuggestions(loadedSuggestions);
    setBookmarks(BerryDatabase.get<string[]>('bookmarks', []));
    setReadingHistory(BerryDatabase.get<any[]>('reading_history', []));
    setTeams(BerryDatabase.get<Team[]>('teams', []));

    // Run automatic reservation expiration check
    checkReservationsExpiration(loadedNovels, loadedSuggestions);
    checkScheduledChapters();

    // Setup an interval to check for scheduled Gregorian chapters every 5 seconds
    const schedulerInterval = setInterval(() => {
      checkScheduledChapters();
    }, 5000);

    return () => {
      clearInterval(schedulerInterval);
      window.removeEventListener('ads-updated', handleAdsUpdate);
      window.removeEventListener('user-updated', handleUserUpdate);
    };
  }, []);

  // Auto-check and publish scheduled chapters when their Gregorian date is reached
  const checkScheduledChapters = () => {
    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const allNovels = BerryDatabase.get<any[]>('novels', []);
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    
    let dbChanged = false;
    const now = new Date();

    const updatedChapters = allChapters.map(chap => {
      // If a chapter is scheduled (isDraft is true and publishAt is set)
      if (chap.isDraft && chap.publishAt) {
        const publishTime = new Date(chap.publishAt);
        if (now >= publishTime) {
          chap.isDraft = false;
          dbChanged = true;

          const correspondingNovel = allNovels.find(n => n.id === chap.novelId);
          const novelTitle = correspondingNovel ? correspondingNovel.titleAr : 'الرواية المترجمة';

          // Add a notification toast/alert
          allNotifs.unshift({
            id: `notif-scheduled-publish-${Date.now()}-${chap.id}`,
            userId: correspondingNovel?.translatorId || 'system',
            title: '🎉 نشر تلقائي لفصل مجدول!',
            message: `لقد حان وقت النشر الميلادي المحدد للفصل "${chap.title}" من رواية "${novelTitle}" وتم نشره تلقائياً للقراء الآن!`,
            type: 'CHAPTER',
            isRead: false,
            createdAt: 'الآن',
            novelId: chap.novelId,
            chapterId: chap.id
          });
        }
      }
      return chap;
    });

    if (dbChanged) {
      BerryDatabase.set('chapters', updatedChapters);
      BerryDatabase.set('notifications', allNotifs);
      
      // Force React state update
      const freshNovels = BerryDatabase.get<Novel[]>('novels', []);
      setNovels([...freshNovels]);
    }
  };

  // Auto check and expire inactive reservations past 30 days
  const checkReservationsExpiration = (currentNovelsList?: Novel[], currentSugsList?: Suggestion[]) => {
    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    const allNovels = currentNovelsList || BerryDatabase.get<Novel[]>('novels', []);
    const allSuggestions = currentSugsList || BerryDatabase.get<Suggestion[]>('suggestions', []);
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    
    let dbChanged = false;
    const now = new Date();

    const updatedReservations = allReservations.map(res => {
      if (res.status === 'ACTIVE') {
        const end = new Date(res.endAt);
        if (now > end) {
          // Check if novel has 0 chapters
          const correspondingNovel = allNovels.find(n => n.id === res.novelId);
          if (correspondingNovel && correspondingNovel.chaptersCount === 0) {
            dbChanged = true;
            
            // 1. Expire reservation
            res.status = 'EXPIRED';
            
            // 2. Change suggestion back to PENDING so it appears in the suggestions page again
            const matchingSug = allSuggestions.find(s => s.titleAr === res.novelTitle || s.titleEn === correspondingNovel.titleEn);
            if (matchingSug) {
              matchingSug.status = 'PENDING';
            }
            
            // 3. Set novel status to CANCELLED
            correspondingNovel.status = 'CANCELLED';

            // 4. Notify translator
            allNotifs.push({
              id: `notif-expire-${Date.now()}-${res.id}`,
              userId: res.translatorId,
              title: '⚠️ انتهاء صلاحية حجز الرواية (30 يوماً)',
              message: `لقد تم إلغاء حجزك لرواية "${res.novelTitle}" تلقائياً بسبب عدم نشر أي فصول خلال مهلة الـ 30 يوماً، وقد عادت الرواية لقائمة الاقتراحات العامة لتصويت الأعضاء وحجز المترجمين الآخرين.`,
              type: 'RESERVATION',
              isRead: false,
              createdAt: 'الآن'
            });
          }
        }
      }
      return res;
    });

    if (dbChanged) {
      BerryDatabase.set('reservations', updatedReservations);
      BerryDatabase.set('novels', allNovels);
      BerryDatabase.set('suggestions', allSuggestions);
      BerryDatabase.set('notifications', allNotifs);
      setNovels([...allNovels]);
      setSuggestions([...allSuggestions]);
    }
  };

  // Handle suggestion claim directly
  const handleClaimSuggestion = (sug: Suggestion) => {
    if (currentUser.role !== 'TRANSLATOR' && currentUser.role !== 'OWNER') {
      alert('عذراً، يجب أن تكون مترجماً أو مالكاً لحجز الروايات المقترحة.');
      return;
    }

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

    // 2. Create reservation record
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

    // 3. Update suggestion status (becomes RESERVED so it disappears from suggestions list)
    const updatedSugs = suggestions.map(s => s.id === sug.id ? { ...s, status: 'RESERVED' as const } : s);
    setSuggestions(updatedSugs);
    BerryDatabase.set('suggestions', updatedSugs);

    // Save Novels & Reservations
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const updatedNovels = [newNovel, ...allNovels];
    setNovels(updatedNovels);
    BerryDatabase.set('novels', updatedNovels);

    const allReservations = BerryDatabase.get<Reservation[]>('reservations', []);
    BerryDatabase.set('reservations', [newRes, ...allReservations]);

    // Send notification
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-claimed-${Date.now()}`,
      userId: currentUser.id,
      title: 'تم استلام الاقتراح بنجاح!',
      message: `لقد قمت بحجز الرواية المقترحة "${sug.titleAr}" بنجاح. تظهر الآن في لوحة المترجم وحسابك وجاري بدء عداد الحجز 30 يوماً.`,
      type: 'RESERVATION',
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);
    alert(`تهانينا! لقد قمت باستلام وحجز الرواية المقترحة "${sug.titleAr}" للترجمة بنجاح وجاري بدء عداد الحجز 30 يوماً.`);
  };

  // Update dynamic simulated user role
  const handleRoleChange = (newRole: UserRole) => {
    BerryDatabase.set('current_role', newRole);
    const u = DEFAULT_USERS[newRole];
    setCurrentUser(u);
    BerryDatabase.set('current_user_data', u);
    
    // Relocate to homepage if they lose access to Admin or Translator panels
    if (newRole === 'GUEST' || newRole === 'MEMBER') {
      if (currentPage === 'admin' || currentPage === 'translator-panel') {
        setCurrentPage('home');
      }
    }
  };

  // Safe navigation
  const handleNavigate = (page: string, params: any = null) => {
    setCurrentPage(page);
    setCurrentParams(params);
    window.scrollTo(0, 0);
  };

  // Toggle Novel Bookmarks (Mofaddala)
  const handleBookmarkToggle = (novelId: string) => {
    if (currentUser.role === 'GUEST') {
      alert('الزائر لا يملك صلاحية إضافة الروايات للمفضلة. غير رتبتك من الأعلى لعضو أولاً!');
      return;
    }

    const updated = bookmarks.includes(novelId) 
      ? bookmarks.filter(id => id !== novelId) 
      : [...bookmarks, novelId];
    
    setBookmarks(updated);
    BerryDatabase.set('bookmarks', updated);

    // Update novel bookmarksCount
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const updatedNovels = allNovels.map(n => {
      if (n.id === novelId) {
        return { 
          ...n, 
          bookmarksCount: bookmarks.includes(novelId) ? n.bookmarksCount - 1 : n.bookmarksCount + 1 
        };
      }
      return n;
    });
    setNovels(updatedNovels);
    BerryDatabase.set('novels', updatedNovels);
  };

  // Add custom user proposed suggestion
  const handleAddSuggestion = (suggestionData: Partial<Suggestion>) => {
    const newSug: Suggestion = {
      id: `sug-${Date.now()}`,
      titleAr: suggestionData.titleAr || '',
      titleEn: suggestionData.titleEn || '',
      novelUpdatesLink: suggestionData.novelUpdatesLink,
      cover: suggestionData.cover || 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=600',
      genres: suggestionData.genres || [],
      description: suggestionData.description || '',
      suggestedBy: currentUser.username,
      suggestedById: currentUser.id,
      votes: 1,
      votedUsers: [currentUser.id],
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    const updated = [newSug, ...suggestions];
    setSuggestions(updated);
    BerryDatabase.set('suggestions', updated);
    setShowSuggestDialog(false);
    alert('شكرًا لك! تم تسجيل اقتراحك بنجاح وهو متاح للتصويت الآن من قبل جميع الأعضاء.');
  };

  // Vote on specific suggestion
  const handleVoteSuggestion = (sugId: string) => {
    if (currentUser.role === 'GUEST') {
      alert('الزائر لا يملك حق التصويت. غير رتبتك إلى عضو أو مترجم من شريط التحكم.');
      return;
    }

    const updated = suggestions.map((sug) => {
      if (sug.id === sugId) {
        const hasVoted = sug.votedUsers.includes(currentUser.id);
        const votedUsers = hasVoted 
          ? sug.votedUsers.filter(id => id !== currentUser.id) 
          : [...sug.votedUsers, currentUser.id];
        
        return { 
          ...sug, 
          votes: hasVoted ? sug.votes - 1 : sug.votes + 1, 
          votedUsers 
        };
      }
      return sug;
    });

    setSuggestions(updated);
    BerryDatabase.set('suggestions', updated);
  };

  // Read Chapter helper (Routes to full screen reader)
  const handleReadChapter = (novelId: string, chapterNumber: number) => {
    handleNavigate('reader', { novelId, chapterNumber });
  };

  // Reader viewport navigation helper (Previous / Next chapter)
  const handleReaderNavigateChapter = (direction: 'next' | 'prev') => {
    if (currentPage !== 'reader' || !currentParams) return;
    const { novelId, chapterNumber } = currentParams;
    const allChapters = BerryDatabase.get<any[]>('chapters', []);
    const chaptersOfNovel = allChapters.filter(c => c.novelId === novelId).sort((a, b) => a.number - b.number);
    
    let nextNum = chapterNumber;
    if (direction === 'next') {
      nextNum = Math.min(chapterNumber + 1, chaptersOfNovel.length);
    } else {
      nextNum = Math.max(chapterNumber - 1, 1);
    }

    handleNavigate('reader', { novelId, chapterNumber: nextNum });
  };

  // Filter novels list based on status (Awaiting approved drafts only for main view)
  const activeNovels = useMemo(() => novels.filter(n => n.status !== 'PENDING'), [novels]);

  // Filter trending list (sorted by views / popular)
  const trendingNovels = useMemo(() => [...activeNovels]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8), [activeNovels]);

  // Latest added chapters list (with new tag)
  const latestChaptersList = useMemo(() => [...activeNovels]
    .filter(n => n.chaptersCount > 0)
    .slice(0, 20), [activeNovels]);

  return (
    <div className="relative min-h-screen bg-[#0F0B14] text-purple-100 flex flex-col justify-between selection:bg-violet-600/30">
      
      {/* Ambient background particles and mist glow elements */}
      <div className="absolute top-0 left-0 w-full h-[600px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full mist-glow-violet opacity-30 blur-[120px] animate-float-slow" />
        <div className="absolute top-10 right-[-10%] w-[500px] h-[500px] rounded-full mist-glow-berry opacity-20 blur-[100px] animate-float-slow" style={{ animationDelay: '6s' }} />
      </div>

      {/* Shared Premium Header */}
      <Header 
        currentUser={currentUser} 
        onRoleChange={handleRoleChange} 
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* Breaking News Ticker (Sticks below navbar) */}
      <NewsTicker 
        newsList={news} 
        onNewsClick={(item) => {
          if (item.novelId) {
            handleNavigate('novel', { id: item.novelId });
          } else {
            alert(`إعلان المنصة: ${item.title}`);
          }
        }}
      />

      {/* Moving Advertisements Ticker Bar */}
      <AdsTicker 
        onAdClick={(ad) => {
          handleNavigate('ads', { selectedAdId: ad.id });
        }}
        refreshTrigger={refreshAdsTrigger}
      />

      {/* Main Core Body Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 relative z-10">
        
        {/* ==================== SCREEN 1: HOMEPAGE ==================== */}
        {currentPage === 'home' && (
          <div className="flex flex-col gap-10">
            {activeNovels.length === 0 ? (
              <div className="w-full text-right p-8 md:p-12 rounded-3xl bg-white/5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px]" />
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-berry-600/10 rounded-full blur-[80px]" />
                
                <span className="text-4xl filter drop-shadow-[0_0_15px_rgba(139,92,246,0.5)] mb-4 block">🍇</span>
                <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4">أهلاً بك في منصة بيري ميست (Berry Mist) الفاخرة!</h2>
                <p className="text-purple-300 text-sm md:text-base leading-relaxed mb-6 max-w-3xl">
                  لقد قمنا بحذف جميع البيانات والمسودات التجريبية الوهمية بنجاح بناءً على طلبك لتوفير بيئة عمل نظيفة وجاهزة تماماً للاستخدام الفعلي. يمكنك الآن إنشاء أعمالك الفخمة والترجمات الحقيقية والمحتوى الروائي مباشرة!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-violet-500/20 transition-all">
                    <span className="text-lg font-bold text-violet-300 block mb-2">🛡️ لوحة المالك والإدارة</span>
                    <p className="text-xs text-purple-400 leading-relaxed mb-4">
                      بصفتك المالك، يمكنك إدارة الروايات بالكامل، مراجعة طلبات الترجمة، تخصيص وتعديل الأخبار، تفعيل الإعلانات، وتنسيق الأقسام.
                    </p>
                    <button 
                      onClick={() => handleNavigate('admin')}
                      className="px-4 py-2 bg-violet-600/20 hover:bg-violet-600 text-violet-200 hover:text-white rounded-xl text-xs font-bold border border-violet-500/30 transition-all cursor-pointer"
                    >
                      الدخول للوحة المالك ←
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-berry-500/20 transition-all">
                    <span className="text-lg font-bold text-berry-300 block mb-2">✍️ لوحة المترجمين والكتّاب</span>
                    <p className="text-xs text-purple-400 leading-relaxed mb-4">
                      قم بإنشاء وتأليف الروايات الخاصة بك، إضافة الفصول والمقاطع، وحجز الأعمال المقترحة من قبل الأعضاء لبدء الترجمة والنشر.
                    </p>
                    <button 
                      onClick={() => handleNavigate('translator-panel')}
                      className="px-4 py-2 bg-berry-600/20 hover:bg-berry-600 text-berry-200 hover:text-white rounded-xl text-xs font-bold border border-berry-500/30 transition-all cursor-pointer"
                    >
                      الدخول للوحة العمل ←
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap gap-3 items-center text-xs text-purple-400">
                  <span>💡 يمكنك تبديل دورك الحالي (رتبتك) في أي وقت لتجربة مزايا الأعضاء والقراء والزوار عبر النقر على زر </span>
                  <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold border border-violet-500/20">رتبة: المالك 👑</span>
                  <span>الموجود بالأعلى في شريط التنقل.</span>
                </div>
              </div>
            ) : (
              <>
                {/* Cinematic Slider */}
                <HeroSlider 
                  featuredNovels={activeNovels.slice(0, 3)}
                  onStartReading={(id) => handleReadChapter(id, 1)}
                  onViewDetails={(id) => handleNavigate('novel', { id })}
                />

                {/* Continuing Reading Carousel (History) */}
                <ContinueReading 
                  progressItems={readingHistory}
                  novels={novels}
                  onChapterClick={handleReadChapter}
                />

                {/* Trending Section (الروايات الرائجة اليوم) */}
                <div className="w-full text-right mt-4">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                      <Flame size={20} className="text-berry-400 animate-pulse" />
                      <span>الروايات الرائجة والترند اليوم</span>
                    </h2>
                    <span className="text-xs text-purple-400">تحديث فوري</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-4">
                    {trendingNovels.map((novel, idx) => (
                      <NovelCard 
                        key={novel.id}
                        novel={novel}
                        isBookmarked={bookmarks.includes(novel.id)}
                        onBookmarkToggle={handleBookmarkToggle}
                        onClick={(id) => handleNavigate('novel', { id })}
                        ranking={idx + 1}
                      />
                    ))}
                  </div>
                </div>

                {/* Latest added chapters section (آخر الفصول المضافة) */}
                <div className="w-full text-right my-4">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                      <Layers size={20} className="text-violet-400" />
                      <span>آخر الفصول المضافة بالمنصة</span>
                    </h2>
                    <button 
                      onClick={() => handleNavigate('explore')}
                      className="text-xs text-violet-400 hover:text-white"
                    >
                      عرض فلاتر المكتبة ←
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {latestChaptersList.map((novel) => (
                      <div 
                        key={novel.id}
                        onClick={() => handleReadChapter(novel.id, novel.chaptersCount)}
                        className="p-4 bg-[#14101D] hover:bg-[#1A1625] border border-white/5 hover:border-violet-500/20 rounded-2xl flex gap-4 cursor-pointer transition-all hover:-translate-y-0.5 group relative"
                      >
                        {/* Purple "جديد" (New) ribbon badge as requested in specs */}
                        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-600 text-white shadow-md animate-pulse">
                          جديد
                        </span>

                        <img src={novel.cover} alt={novel.titleAr} className="w-12 h-18 rounded-xl object-cover shrink-0" loading="lazy" referrerPolicy="no-referrer" />
                        
                        <div className="flex-1 flex flex-col justify-between min-w-0 text-right">
                          <div>
                            <h4 className="font-extrabold text-xs text-white group-hover:text-violet-400 transition-colors truncate">
                              {novel.titleAr}
                            </h4>
                            <span className="text-[10px] text-purple-400 truncate mt-0.5 block">{novel.titleEn}</span>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2 text-[10px] text-purple-300 border-t border-white/5 pt-2">
                            <span className="font-bold text-violet-300">قراءة الفصل {novel.chaptersCount} ←</span>
                            <span className="text-purple-400">منذ دقائق</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Platform statistics bottom deck */}
            <StatsCounter />
          </div>
        )}

        {/* ==================== SCREEN 2: DISCOVERY / EXPLORE CATALOG ==================== */}
        {currentPage === 'explore' && (
          <ExploreLibrary 
            novels={activeNovels}
            bookmarks={bookmarks}
            onBookmarkToggle={handleBookmarkToggle}
            onNovelClick={(id) => handleNavigate('novel', { id })}
          />
        )}

        {/* ==================== SCREEN 3: NOVEL PROFILE DETAILS ==================== */}
        {currentPage === 'novel' && currentParams && (
          <NovelDetails 
            novelId={currentParams.id}
            currentUser={currentUser}
            onBack={() => handleNavigate('explore')}
            onReadChapter={handleReadChapter}
            isBookmarked={bookmarks.includes(currentParams.id)}
            onBookmarkToggle={handleBookmarkToggle}
            autoOpenAddChapter={currentParams.autoOpenAddChapter}
          />
        )}

        {/* ==================== SCREEN 4: READ CHAPTERS VIEWPORT ==================== */}
        {currentPage === 'reader' && currentParams && (
          <ReaderView 
            novelId={currentParams.novelId}
            chapterNumber={currentParams.chapterNumber}
            currentUser={currentUser}
            onBack={() => handleNavigate('novel', { id: currentParams.novelId })}
            onNavigateChapter={handleReaderNavigateChapter}
          />
        )}

        {/* ==================== SCREEN 5: TRANSLATORS CLAIMS / SUGGESTIONS LIST ==================== */}
        {currentPage === 'suggestions' && (
          <div className="w-full text-right mt-4 pb-12 animate-in fade-in duration-300">
            <div className="p-6 bg-[#1A1625] rounded-3xl mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <Compass size={24} className="text-berry-400 animate-pulse" />
                  <span>اقتراح ورش روائية جديدة للتصويت</span>
                </h1>
                <p className="text-xs text-purple-300 mt-1">صوت للروايات التي تتمنى رؤيتها مترجمة حياً بالمنصة أو قدم اقتراحاً جديداً!</p>
              </div>
              <button 
                onClick={() => {
                  if (currentUser.role === 'GUEST') {
                    alert('عذراً، يجب عليك تسجيل الدخول أو اختيار رتبة "عضو" على الأقل لتقديم المقترحات.');
                    return;
                  }
                  setShowSuggestDialog(true);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold shadow-lg"
              >
                تقديم اقتراح جديد +
              </button>
            </div>

            {/* List of active suggestions */}
            <div className="flex flex-col gap-4">
              {suggestions.filter(s => s.status === 'PENDING').length > 0 ? (
                suggestions.filter(s => s.status === 'PENDING').map((sug) => (
                  <div key={sug.id} className="p-5 bg-[#1A1625] border border-white/5 rounded-2xl flex flex-col md:flex-row gap-5 items-center md:items-start text-right">
                    <img src={sug.cover} alt={sug.titleAr} className="w-24 h-36 rounded-xl object-cover border border-white/5 shrink-0 shadow-lg" />
                    
                    <div className="flex-1 w-full flex flex-col justify-between">
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 w-full">
                          <h4 className="font-extrabold text-sm text-white">{sug.titleAr}</h4>
                          <button 
                            onClick={() => handleVoteSuggestion(sug.id)}
                            className={`px-4 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${sug.votedUsers.includes(currentUser.id) ? 'bg-berry-500/20 border-berry-500/40 text-berry-300 font-extrabold' : 'bg-white/5 border-white/10 text-purple-300 hover:bg-white/10'}`}
                          >
                            <span>👍 صوت للترجمة ({sug.votes})</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-purple-400 mt-0.5">{sug.titleEn}</p>
                        <p className="text-xs text-purple-300/90 mt-4 leading-relaxed whitespace-pre-wrap">{sug.description}</p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 pt-3 border-t border-white/5 text-[10px] text-purple-400 gap-3 w-full">
                        <span>اقترح بواسطة: <span className="font-bold text-white">{sug.suggestedBy}</span></span>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400">مفتوح للتصويت العام</span>
                          {(currentUser.role === 'TRANSLATOR' || currentUser.role === 'OWNER') && (
                            <button
                              onClick={() => handleClaimSuggestion(sug)}
                              className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-md shadow-violet-500/10 flex items-center gap-1"
                            >
                              <span>حجز واستلام للترجمة 📝</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center glass-panel rounded-2xl border border-white/5 text-purple-400">
                  <p className="text-sm font-semibold">لا توجد اقتراحات روائية مفتوحة للتصويت حالياً.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SCREEN 6: TEAMS DIRECTORY ==================== */}
        {currentPage === 'teams' && (
          <div className="w-full text-right mt-4 pb-12 animate-in fade-in duration-300">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Users size={20} className="text-violet-400 animate-pulse" />
              <span>فهرس ودليل فرق الترجمة المعتمدة</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {teams.map((team) => (
                <div key={team.id} className="p-6 bg-[#1A1625] border border-white/5 rounded-3xl flex flex-col justify-between text-right">
                  <div>
                    <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-4">
                      <span className="text-3xl p-2 bg-white/5 rounded-2xl border border-white/5">{team.logo}</span>
                      <div>
                        <h3 className="font-extrabold text-sm text-white">{team.name}</h3>
                        <span className="text-[10px] text-purple-400">تاريخ التأسيس: {new Date(team.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>

                    <p className="text-xs text-purple-300 leading-relaxed mb-4">{team.bio}</p>

                    <h4 className="font-bold text-[10px] text-violet-400 uppercase tracking-wider mb-2">أعضاء الفريق النشطين:</h4>
                    <div className="flex gap-2 flex-wrap mb-4">
                      {team.members.map((member, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-white/5 border border-white/5 px-2.5 py-1 rounded-xl text-[10px] text-purple-200">
                          <img src={member.avatar} alt={member.username} className="w-5 h-5 rounded-full border border-white/10" />
                          <span>{member.username} ({member.role})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-purple-400 pt-3 border-t border-white/5">
                    <span>يشرف على {team.novelsCount} روايات نشطة</span>
                    <button className="text-violet-400 hover:text-white font-extrabold cursor-pointer">انضم للفريق</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== SCREEN 7: MEMBER PROFILE PAGE ==================== */}
        {currentPage === 'profile' && (
          <div className="w-full text-right mt-4 pb-12 animate-in fade-in duration-300">
            <div className="glass-panel rounded-3xl p-6 border border-white/5 relative overflow-hidden select-none mb-6">
              
              <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
                <img src={currentUser.avatar} alt={currentUser.username} className="w-20 h-20 rounded-full border-2 border-violet-500 shadow-xl" />
                <div className="text-center sm:text-right">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <h2 className="text-xl md:text-2xl font-extrabold text-white">{currentUser.username}</h2>
                    <span className="text-[10px] bg-violet-600/30 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-xs text-purple-400 mt-1">{currentUser.email}</p>
                  <p className="text-xs text-purple-300 mt-3 leading-relaxed max-w-md">{currentUser.bio || 'لا يوجد نبذة شخصية مضافة حالياً.'}</p>
                </div>
              </div>

              {/* Stats column */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8 pt-6 border-t border-white/5 relative z-10 text-center">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-purple-400 block mb-1">المستوى</span>
                  <span className="font-extrabold text-white text-base">Lvl {currentUser.level}</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-purple-400 block mb-1">XP الإجمالي</span>
                  <span className="font-extrabold text-white text-base">{currentUser.xp} XP</span>
                </div>
                <button 
                  onClick={() => setShowProfileFavorites(!showProfileFavorites)}
                  className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col items-center justify-center ${showProfileFavorites ? 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.15)] scale-102' : 'bg-white/5 border-white/5 hover:border-violet-500/20'}`}
                >
                  <span className="text-[10px] text-purple-400 block mb-1">الروايات المفضلة</span>
                  <span className="font-extrabold text-white text-base flex items-center gap-1">
                    {bookmarks.length} <Heart size={14} className="text-berry-400 fill-berry-400 animate-pulse" />
                  </span>
                  <span className="text-[9px] text-violet-400 mt-0.5 font-bold">
                    {showProfileFavorites ? 'انقر لإخفائها ▲' : 'انقر لتصفحها ▼'}
                  </span>
                </button>
              </div>
            </div>

            {/* Bookmarks Display Section */}
            {showProfileFavorites && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-3">
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <Heart size={16} className="text-berry-400 fill-berry-400 animate-pulse" />
                    <span>قائمة الروايات المفضلة الخاصة بك ({bookmarks.length})</span>
                  </h3>
                  <span className="text-[10px] text-purple-400 font-bold">انقر على الرواية للذهاب لصفحة فصولها حياً</span>
                </div>

                {bookmarks.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {novels
                      .filter((n) => bookmarks.includes(n.id))
                      .map((novel) => (
                        <div 
                          key={novel.id}
                          onClick={() => handleNavigate('novel', { id: novel.id })}
                          className="bg-[#14101D] border border-white/5 hover:border-violet-500/30 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-500/15 group flex flex-col justify-between h-full"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden">
                            <img 
                              src={novel.cover} 
                              alt={novel.titleAr} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-95" />
                            
                            {/* Remove button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBookmarkToggle(novel.id);
                              }}
                              className="absolute top-2 left-2 p-1.5 bg-black/60 hover:bg-black/80 text-berry-400 hover:text-white rounded-full transition-all cursor-pointer z-10"
                              title="إزالة من المفضلة"
                            >
                              <Heart size={12} className="fill-current" />
                            </button>
                          </div>
                          <div className="p-2.5 text-right flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-extrabold text-[11px] text-white group-hover:text-violet-400 transition-colors truncate">
                                {novel.titleAr}
                              </h4>
                              <span className="text-[9px] text-purple-400 truncate block mt-0.5">{novel.titleEn}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-purple-300 font-bold text-left">
                              تصفح الرواية ←
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="py-12 px-4 text-center bg-[#14101D]/50 rounded-2xl border border-dashed border-white/5 text-purple-400 animate-in fade-in duration-300">
                    <Heart size={32} className="mx-auto mb-3 text-purple-500/50" />
                    <p className="text-xs font-semibold">مفضلتك فارغة تماماً حالياً!</p>
                    <p className="text-[10px] text-purple-400 mt-1">ابدأ بإضافة رواياتك الفخمة المفضلة من المكتبة لتظهر هنا.</p>
                    <button
                      onClick={() => handleNavigate('explore')}
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold mt-4 transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-md shadow-violet-500/10"
                    >
                      تصفح واستكشف المكتبة الآن 🧭
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Works & Reservations Section for Creative Roles */}
            {['OWNER', 'TRANSLATOR', 'WRITER'].includes(currentUser.role) && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 mb-6 animate-in fade-in duration-300">
                <h3 className="font-extrabold text-sm text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-3">
                  <FileText size={16} className="text-violet-400" />
                  <span>💼 لوحة الأعمال والحجوزات الشخصية</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Column 1: Active Translating/Writing Works */}
                  <div>
                    <h4 className="font-bold text-xs text-purple-300 mb-3 flex items-center gap-1.5">
                      <BookOpen size={14} className="text-violet-400" />
                      <span>الأعمال الحالية ({novels.filter(n => n.translatorId === currentUser.id).length})</span>
                    </h4>

                    {novels.filter(n => n.translatorId === currentUser.id).length > 0 ? (
                      <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {novels
                          .filter(n => n.translatorId === currentUser.id)
                          .map(novel => (
                            <div 
                              key={novel.id}
                              onClick={() => handleNavigate('novel', { id: novel.id })}
                              className="p-3 bg-[#14101D] hover:bg-[#1C1628] border border-white/5 hover:border-violet-500/20 rounded-xl flex items-center gap-3 cursor-pointer transition-all text-right"
                            >
                              <img src={novel.cover} alt={novel.titleAr} className="w-10 h-14 rounded-lg object-cover border border-white/5" />
                              <div className="flex-1 text-right">
                                <h5 className="font-extrabold text-[11px] text-white truncate">{novel.titleAr}</h5>
                                <span className="text-[9px] text-purple-400 block truncate">{novel.titleEn}</span>
                                <span className="text-[8px] mt-1 inline-block bg-violet-600/20 text-violet-300 px-1.5 py-0.5 rounded font-bold">
                                  {novel.chaptersCount} فصلاً • {novel.status}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-[#14101D]/50 border border-dashed border-white/5 rounded-2xl text-[10px] text-purple-400">
                        {currentUser.role === 'WRITER' ? 'لم تقم بتأليف أي رواية حتى الآن.' : 'لم تقم بترجمة أي رواية مسجلة باسمك بعد.'}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Reserved Works */}
                  <div>
                    <h4 className="font-bold text-xs text-purple-300 mb-3 flex items-center gap-1.5">
                      <Clock size={14} className="text-violet-400" />
                      <span>الحجوزات النشطة على الملف ({BerryDatabase.get<any[]>('reservations', []).filter(r => r.translatorId === currentUser.id && r.status === 'ACTIVE').length})</span>
                    </h4>

                    {BerryDatabase.get<any[]>('reservations', []).filter(r => r.translatorId === currentUser.id && r.status === 'ACTIVE').length > 0 ? (
                      <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {BerryDatabase.get<any[]>('reservations', [])
                          .filter(r => r.translatorId === currentUser.id && r.status === 'ACTIVE')
                          .map(res => {
                            const daysLeft = Math.ceil((new Date(res.endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            return (
                              <div 
                                key={res.id}
                                className="p-3 bg-[#14101D] border border-white/5 rounded-xl flex flex-col justify-between"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <h5 className="font-bold text-[11px] text-white truncate text-right">{res.novelTitle}</h5>
                                  <span className="text-[8px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-extrabold shrink-0">
                                    {daysLeft > 0 ? `${daysLeft} يوم متبقي` : 'منتهي'}
                                  </span>
                                </div>
                                <div className="text-[8px] text-purple-400 mt-2 flex justify-between items-center font-mono">
                                  <span>تاريخ الحجز: {new Date(res.startAt).toLocaleDateString('ar-EG')}</span>
                                  <span>الانتهاء: {new Date(res.endAt).toLocaleDateString('ar-EG')}</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-[#14101D]/50 border border-dashed border-white/5 rounded-2xl text-[10px] text-purple-400">
                        لا توجد أي روايات محجوزة باسمك في الوقت الحالي.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Achievements Grid List */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5">
              <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                <Award size={16} className="text-yellow-400" />
                <span>الأوسمة والإنجازات الشخصية</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                  <span className="text-2xl mb-2">⭐</span>
                  <span className="font-bold text-xs text-white">الناقد المعتمد</span>
                  <span className="text-[10px] text-purple-400 mt-1">كتابة أول مراجعة تفصيلية</span>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                  <span className="text-2xl mb-2">🔥</span>
                  <span className="font-bold text-xs text-white">القارئ المتفجر</span>
                  <span className="text-[10px] text-purple-400 mt-1">قراءة أكثر من 100 فصلاً</span>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                  <span className="text-2xl mb-2">💬</span>
                  <span className="font-bold text-xs text-white">الملهم المتحدث</span>
                  <span className="text-[10px] text-purple-400 mt-1">كتابة أكثر من 20 تعليقاً</span>
                </div>
                <div className="p-4 bg-[#14101D] opacity-40 rounded-2xl border border-dashed border-white/10 flex flex-col items-center" title="مغلق حالياً">
                  <span className="text-2xl mb-2">🏆</span>
                  <span className="font-bold text-xs text-purple-400">بطل الموسم</span>
                  <span className="text-[9px] text-purple-500 mt-1">يتطلب XP أكثر</span>
                </div>
              </div>
            </div>

            {/* If Member (Reader), show Translator Request Form */}
            {currentUser.role === 'MEMBER' && (
              <TranslatorRequestForm 
                currentUser={currentUser} 
                onRequestSubmitted={() => {
                  // Re-render or notify user
                  console.log('Translator request submitted!');
                }} 
              />
            )}
          </div>
        )}

        {/* ==================== SCREEN 8: TRANSLATOR CONTROL DESK ==================== */}
        {currentPage === 'translator-panel' && (
          <TranslatorPanel currentUser={currentUser} onNavigate={handleNavigate} />
        )}

        {/* ==================== SCREEN 9: ADMIN PANEL ==================== */}
        {currentPage === 'admin' && (
          <AdminPanel currentUser={currentUser} onNavigate={handleNavigate} />
        )}

        {/* ==================== SCREEN 10: ADS AND ANNOUNCEMENTS PANEL ==================== */}
        {currentPage === 'ads' && (
          <AdsPage 
            currentUser={currentUser} 
            onNavigate={handleNavigate} 
            selectedAdId={currentParams?.selectedAdId}
          />
        )}

      </main>

      {/* Suggest Novel Modal Form Popup Overlay */}
      {showSuggestDialog && (
        <SuggestNovelDialog 
          currentUser={currentUser} 
          onClose={() => setShowSuggestDialog(false)} 
          onAddSuggestion={handleAddSuggestion}
        />
      )}

      {/* Shared Full-Featured Footer */}
      <footer className="w-full bg-[#14101D] border-t border-white/5 py-12 px-6 lg:px-12 text-right relative overflow-hidden select-none">
        
        {/* Main Footer columns */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 relative z-10">
          
          {/* Col 1: Brand Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(139,92,246,0.4)]">🍇</span>
              <span className="font-extrabold text-xl bg-gradient-to-r from-violet-400 to-berry-400 bg-clip-text text-transparent">
                BerryMist
              </span>
            </div>
            <p className="text-xs text-purple-300 leading-relaxed max-w-xs">
              منصة عربية رائدة تعنى بترجمة، اقتراح وقراءة الروايات الخفيفة وروايات الفانتازيا والويب المظلمة بأعلى دقة ومعايير حماية وجمالية بصرية فخمة للغاية.
            </p>
          </div>

          {/* Col 2: Shortcuts */}
          <div>
            <h4 className="font-extrabold text-xs text-white uppercase tracking-wider mb-4 border-r-2 border-violet-500 pr-2">أقسام سريعة</h4>
            <div className="flex flex-col gap-2.5 text-xs text-purple-300">
              <button onClick={() => handleNavigate('home')} className="hover:text-white transition-colors text-right">الرئيسية</button>
              <button onClick={() => handleNavigate('explore')} className="hover:text-white transition-colors text-right">المكتبة والاستكشاف</button>
              <button onClick={() => handleNavigate('suggestions')} className="hover:text-white transition-colors text-right">اقتراحات الأعضاء</button>
              <button onClick={() => handleNavigate('teams')} className="hover:text-white transition-colors text-right">الفرق المعتمدة</button>
            </div>
          </div>

          {/* Col 3: Support & Contact */}
          <div>
            <h4 className="font-extrabold text-xs text-white uppercase tracking-wider mb-4 border-r-2 border-berry-500 pr-2">تواصل معنا والدعم</h4>
            <div className="flex flex-col gap-2.5 text-xs text-purple-300">
              <span className="text-purple-400">البريد المعتمد:</span>
              <span className="text-white font-mono">support@berrymist.com</span>
              <span className="text-purple-400 mt-1">تواصل الدعم السريع:</span>
              <span className="text-white">عبر تذكرة الديسكورد الرسمية بالأسفل</span>
            </div>
          </div>

          {/* Col 4: Community Links */}
          <div>
            <h4 className="font-extrabold text-xs text-white uppercase tracking-wider mb-4 border-r-2 border-violet-500 pr-2">انضم لمجتمعنا الاجتماعي</h4>
            <p className="text-xs text-purple-300 mb-3 max-w-xs">انضم لعائلتنا الروائية الكبرى لتصلك إشعارات الفصول فور صدورها قبل الجميع حياً!</p>
            <div className="flex gap-2 justify-start select-none">
              <a href="https://discord.gg/berrymist" target="_blank" rel="noreferrer" className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-purple-300 hover:text-white hover:bg-violet-600 transition-all text-sm font-bold shadow-md" title="ديسكورد">
                Discord 👾
              </a>
              <a href="https://t.me/berrymist" target="_blank" rel="noreferrer" className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-purple-300 hover:text-white hover:bg-sky-600 transition-all text-sm font-bold shadow-md" title="تيليجرام">
                Telegram 📢
              </a>
            </div>
          </div>

        </div>

        {/* Sub-footer Copyright */}
        <div className="max-w-7xl mx-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-purple-400 gap-4">
          <span>حقوق النشر والترجمة محفوظة بالكامل © 2026 لمنصة Berry Mist وللمترجمين المعتمدين.</span>
          <div className="flex gap-4">
            <span className="hover:text-white cursor-pointer">شروط الخدمة والاستخدام</span>
            <span className="hover:text-white cursor-pointer">سياسة الخصوصية وحماية البيانات</span>
            <span className="hover:text-white cursor-pointer">DMCA وحقوق الملكية</span>
          </div>
        </div>

      </footer>

    </div>
  );
}
