import React, { useState, useEffect } from 'react';
import { Star, Eye, Layers, BookOpen, Bookmark, Play } from 'lucide-react';
import { Novel } from '../types';

interface HeroSliderProps {
  featuredNovels: Novel[];
  onStartReading: (novelId: string) => void;
  onViewDetails: (novelId: string) => void;
}

export default function HeroSlider({ featuredNovels, onStartReading, onViewDetails }: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (featuredNovels.length === 0) return;

    if (isPaused) {
      setProgress(0);
      return;
    }

    const intervalTime = 100; // update progress every 100ms
    const totalDuration = 7000; // 7 seconds
    const step = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveIndex((prevIndex) => (prevIndex + 1) % featuredNovels.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [featuredNovels, activeIndex, isPaused]);

  if (featuredNovels.length === 0) return null;

  const currentNovel = featuredNovels[activeIndex];

  return (
    <div 
      className="relative w-full h-[430px] md:h-[550px] rounded-3xl overflow-hidden glass-panel group transition-all duration-500"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        setProgress(0);
      }}
    >
      {/* Background Banner with Ken Burns zoom and fade transition */}
      <div className="absolute inset-0 z-0">
        <div 
          key={currentNovel.id}
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-100 group-hover:scale-105 animate-in fade-in duration-500"
          style={{ backgroundImage: `url(${currentNovel.cover})`, filter: 'brightness(0.3) blur(6px)' }}
        />
        {/* Soft color mist glow layers */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0B14] via-[#0F0B14]/60 to-transparent" />
        <div className="absolute top-10 left-10 w-96 h-96 rounded-full mist-glow-violet blur-[100px] opacity-30 animate-float-slow" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full mist-glow-berry blur-[100px] opacity-25 animate-float-slow" style={{ animationDelay: '5s' }} />
      </div>

      {/* Main Content Layout */}
      <div className="absolute inset-0 z-10 flex flex-col md:flex-row items-center justify-between p-5 pb-12 sm:p-6 md:p-12 gap-8 text-right">
        {/* Right side: Novel Art with Glass Framing */}
        <div className="hidden md:block w-[40%] h-full flex justify-center items-center">
          <div className="relative w-64 h-[360px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 group-hover:scale-[1.02] transition-transform duration-500">
            <img 
              src={currentNovel.cover} 
              alt={currentNovel.titleAr} 
              className="w-full h-full object-cover"
            />
            {/* Ambient shadow reflection */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          </div>
        </div>

        {/* Left side: Information (Glassmorphic details card) */}
        <div className="w-full md:w-[55%] flex flex-col justify-center h-full">
          <span className="text-xs bg-violet-500/20 text-violet-300 font-extrabold px-3 py-1.5 rounded-full border border-violet-500/30 w-fit mb-3">
            ✨ الرواية المميزة للأسبوع
          </span>

          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight line-clamp-2">
            {currentNovel.titleAr}
          </h1>
          <p className="text-xs md:text-sm text-purple-300 font-medium mt-1 select-none">
            {currentNovel.titleEn} | المؤلف: <span className="text-purple-200">{currentNovel.author}</span>
          </p>

          {/* Details Row */}
          <div className="flex flex-wrap gap-4 items-center mt-3 text-purple-200/80 text-xs">
            <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <Eye size={12} className="text-violet-400" />
              <span>{currentNovel.views.toLocaleString('ar-EG')} قراءة</span>
            </div>
            <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <Layers size={12} className="text-berry-400" />
              <span>{currentNovel.chaptersCount} فصل</span>
            </div>
          </div>

          {/* Genre Badges */}
          <div className="flex flex-wrap gap-2 mt-4 select-none">
            {currentNovel.genres.map((genre) => (
              <span 
                key={genre} 
                className="text-[11px] font-bold bg-violet-600/10 text-violet-300 border border-violet-500/20 px-2.5 py-0.5 rounded-full"
              >
                {genre}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-sm text-purple-300/90 mt-4 leading-relaxed line-clamp-2 md:line-clamp-3 max-w-xl">
            {currentNovel.description}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-5 md:mt-6">
            <button 
              onClick={() => onStartReading(currentNovel.id)}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-violet-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Play size={16} className="fill-white" />
              <span>ابدأ القراءة</span>
            </button>
            <button 
              onClick={() => onViewDetails(currentNovel.id)}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>عرض التفاصيل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pagination Dot Indicators with Progress bar inside the active dot */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 select-none">
        {featuredNovels.map((novel, index) => (
          <button 
            key={novel.id}
            onClick={() => {
              setActiveIndex(index);
              setProgress(0);
            }}
            className={`h-2.5 rounded-full transition-all duration-300 relative overflow-hidden ${index === activeIndex ? 'w-10 bg-violet-800' : 'w-2.5 bg-white/20'}`}
          >
            {index === activeIndex && (
              <span 
                className="absolute right-0 top-0 bottom-0 bg-gradient-to-r from-violet-500 to-berry-500 transition-all ease-linear"
                style={{ width: `${progress}%` }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
