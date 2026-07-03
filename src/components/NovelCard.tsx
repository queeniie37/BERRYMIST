import React, { useState } from 'react';
import { Star, Heart, Layers, Eye } from 'lucide-react';
import { Novel } from '../types';

interface NovelCardProps {
  key?: any;
  novel: Novel;
  isBookmarked: boolean;
  onBookmarkToggle: (novelId: string) => void;
  onClick: (novelId: string) => void;
  ranking?: number;
}

export default function NovelCard({ novel, isBookmarked, onBookmarkToggle, onClick, ranking }: NovelCardProps) {
  const [heartScale, setHeartScale] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-green-500/10 text-green-400 border border-green-500/20">🟢 متاحة</span>;
      case 'RESERVED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">🟡 محجوزة</span>;
      case 'TRANSLATING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-500/10 text-violet-400 border border-violet-500/20">🔵 قيد الترجمة</span>;
      case 'HIATUS':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/20">🟣 متوقفة</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/10 text-sky-400 border border-sky-500/20">⚪ مكتملة</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">🟠 للمراجعة</span>;
      case 'ONGOING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-500/10 text-pink-400 border border-pink-500/20">🔴 مستمرة</span>;
      default:
        return null;
    }
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHeartScale(true);
    onBookmarkToggle(novel.id);
    setTimeout(() => setHeartScale(false), 400);
  };

  return (
    <div 
      onClick={() => onClick(novel.id)}
      className="group relative bg-[#1A1625] rounded-2xl border border-white/5 hover:border-violet-500/30 overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.15)] cursor-pointer glass-card-shine"
    >
      {/* Ranking Badge if present */}
      {ranking !== undefined && (
        <div className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-berry-500 border border-white/10 flex items-center justify-center font-extrabold text-white text-xs shadow-md">
          {ranking}
        </div>
      )}

      {/* Cover Image Wrapper with 2:3 constraint */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-black/40">
        <img 
          src={novel.cover} 
          alt={novel.titleAr} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Soft Shadow Veil */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1625] via-[#1A1625]/20 to-transparent" />
        
        {/* Absolute Badges on Cover */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
          {getStatusBadge(novel.status)}
        </div>

        {/* Favorite Heart Button */}
        <button 
          onClick={handleHeartClick}
          className={`absolute bottom-3 left-3 z-10 p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 hover:border-berry-500/40 text-purple-200 transition-all cursor-pointer ${heartScale ? 'scale-130' : 'hover:scale-110'}`}
        >
          <Heart 
            size={14} 
            className={`${isBookmarked ? 'text-berry-500 fill-berry-500' : 'text-purple-200'}`} 
          />
        </button>
      </div>

      {/* Info Content Area */}
      <div className="p-3.5 flex flex-col justify-between flex-1 text-right">
        <div>
          <h3 className="font-bold text-xs text-white group-hover:text-violet-400 transition-colors line-clamp-2 h-9">
            {novel.titleAr}
          </h3>
          <span className="text-[10px] text-purple-400 block truncate mt-0.5">
            {novel.titleEn}
          </span>
        </div>

        {/* Bottom Metadata */}
        <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-white/5 text-[10px] text-purple-300">
          <div className="flex items-center gap-1">
            <Layers size={10} className="text-violet-400" />
            <span>{novel.chaptersCount} فصل</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye size={10} className="text-berry-400" />
            <span>{novel.views >= 1000 ? `${(novel.views / 1000).toFixed(1)}k` : novel.views} قراءة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
