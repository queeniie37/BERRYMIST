import React, { useState, useEffect } from 'react';
import { Volume2, Sparkles } from 'lucide-react';
import { Ad } from '../types';
import { BerryDatabase } from '../data';

interface AdsTickerProps {
  onAdClick: (ad: Ad) => void;
  refreshTrigger?: number;
}

export default function AdsTicker({ onAdClick, refreshTrigger }: AdsTickerProps) {
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    const allAds = BerryDatabase.get<Ad[]>('ads', []);
    // Every advertisement published by the owner is fully visible to both visitors and subscribers
    setAds(allAds);
  }, [refreshTrigger]);

  if (ads.length === 0) return null;

  return (
    <div className="relative w-full h-11 bg-gradient-to-r from-violet-950/40 to-fuchsia-950/40 border-b border-violet-500/10 overflow-hidden flex items-center select-none">
      {/* Ticker Moving Container with infinite scrolling marquee */}
      <div className="absolute inset-0 flex items-center pr-36 overflow-hidden">
        <div className="flex gap-16 animate-marquee whitespace-nowrap items-center hover:[animation-play-state:paused] cursor-pointer">
          {/* We repeat the ads list to ensure smooth infinite scrolling */}
          {[...ads, ...ads, ...ads].map((ad, idx) => (
            <div 
              key={`${ad.id}-${idx}`}
              onClick={() => onAdClick(ad)}
              className="flex items-center gap-3 shrink-0 text-xs font-semibold text-fuchsia-200 hover:text-white transition-colors"
            >
              <span className="p-1 bg-fuchsia-500/20 rounded-lg text-fuchsia-300 font-bold border border-fuchsia-500/20 text-[10px]">
                إعلان مميز 🔥
              </span>
              <img src={ad.image} alt="" className="w-6 h-6 rounded object-cover border border-white/10" referrerPolicy="no-referrer" />
              <span className="truncate max-w-[280px] font-bold text-white">{ad.title}</span>
              <span className="text-[10px] text-fuchsia-400 font-extrabold hover:underline">انقر للتفاصيل ⚡</span>
            </div>
          ))}
        </div>
      </div>

      {/* Static Header Label on the Right */}
      <div className="absolute right-0 top-0 bottom-0 z-10 w-36 bg-[#1A1326] border-l border-violet-500/10 flex items-center justify-center gap-2 px-3 shadow-[10px_0_20px_rgba(15,11,20,0.9)]">
        <Volume2 size={13} className="text-fuchsia-400 animate-bounce" />
        <span className="font-extrabold text-[11px] text-fuchsia-200 tracking-wider">شريط الإعلانات</span>
        <Sparkles size={11} className="text-yellow-400 animate-pulse" />
      </div>
    </div>
  );
}
