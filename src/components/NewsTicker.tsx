import React, { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import { News } from '../types';

interface NewsTickerProps {
  newsList: News[];
  onNewsClick: (news: News) => void;
}

export default function NewsTicker({ newsList, onNewsClick }: NewsTickerProps) {
  const activeNews = newsList.filter(n => n.isActive);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (activeNews.length === 0 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeNews.length);
    }, 16000); // Transitions to next news item after current completes

    return () => clearInterval(interval);
  }, [activeNews, isPaused]);

  if (activeNews.length === 0) return null;

  // The list can shrink between renders (news deleted / server sync), so the
  // saved index may point past the end — wrap it instead of crashing.
  const currentItem = activeNews[currentIndex % activeNews.length];

  return (
    <div 
      className="relative w-full h-12 bg-[#14101D] border-b border-white/5 overflow-hidden flex items-center select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ticker Moving Container */}
      <div className="absolute inset-0 flex items-center pr-32">
        <div 
          key={currentIndex}
          onClick={() => onNewsClick(currentItem)}
          className="whitespace-nowrap flex items-center gap-3 text-purple-100 hover:text-white cursor-pointer select-none text-sm font-semibold tracking-wide animate-ticker-ltr hover:[animation-play-state:paused]"
          style={{ textShadow: '0 0 10px rgba(139, 92, 246, 0.4)' }}
        >
          <span 
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ backgroundColor: currentItem.color + '22', color: currentItem.color, border: `1px solid ${currentItem.color}44` }}
          >
            {currentItem.icon}
          </span>
          <span>{currentItem.title}</span>
          <span className="text-[10px] text-purple-400">({new Date(currentItem.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })})</span>
          <span className="text-[11px] text-berry-400 font-bold">← انقر للتفاصيل</span>
        </div>
      </div>

      {/* Static Badge on the Right (z-index higher, covers moving text) */}
      <div className="absolute right-0 top-0 bottom-0 z-10 w-32 bg-[#1A1625] border-l border-white/5 flex items-center justify-center gap-2 px-3 shadow-[10px_0_20px_rgba(15,11,20,0.9)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-berry-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-berry-500"></span>
        </span>
        <Megaphone size={14} className="text-berry-400" />
        <span className="font-extrabold text-xs text-white">آخر الأخبار</span>
      </div>
    </div>
  );
}
