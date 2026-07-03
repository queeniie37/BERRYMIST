import React from 'react';
import { Play, RotateCcw, Clock } from 'lucide-react';
import { Novel } from '../types';

interface ReadingProgressItem {
  novelId: string;
  chapterNumber: number;
  progress: number; // percentage
  updatedAt: string;
}

interface ContinueReadingProps {
  progressItems: ReadingProgressItem[];
  novels: Novel[];
  onChapterClick: (novelId: string, chapterNumber: number) => void;
}

export default function ContinueReading({ progressItems, novels, onChapterClick }: ContinueReadingProps) {
  if (progressItems.length === 0) return null;

  return (
    <div className="w-full text-right my-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <Clock size={18} className="text-berry-400" />
          <span>متابعة القراءة</span>
        </h2>
        <span className="text-xs text-purple-400">عرض الكل</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {progressItems.map((item) => {
          const novel = novels.find(n => n.id === item.novelId);
          if (!novel) return null;

          return (
            <div 
              key={item.novelId}
              onClick={() => onChapterClick(novel.id, item.chapterNumber)}
              className="group relative bg-[#1A1625]/60 hover:bg-[#1A1625] border border-white/5 hover:border-violet-500/20 rounded-2xl p-3 flex gap-3 cursor-pointer transition-all duration-300 hover:-translate-y-1"
            >
              {/* Cover mini */}
              <div className="relative w-12 h-16 rounded-xl overflow-hidden bg-black/20 shrink-0">
                <img src={novel.cover} alt={novel.titleAr} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              </div>

              {/* Text metadata */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white truncate group-hover:text-violet-400 transition-colors">
                    {novel.titleAr}
                  </h4>
                  <p className="text-[10px] text-purple-300 font-medium mt-1">
                    الفصل {item.chapterNumber}
                  </p>
                </div>

                {/* Progress bar info */}
                <div className="w-full mt-2">
                  <div className="flex items-center justify-between text-[9px] text-purple-400 mb-1">
                    <span>{item.progress}% مكتمل</span>
                    <span className="flex items-center gap-0.5">
                      <Clock size={8} />
                      <span>نشط مؤخراً</span>
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-berry-500 rounded-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Hover Resume play overlay button */}
              <div className="absolute left-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-violet-600 p-1.5 rounded-lg text-white">
                <Play size={10} className="fill-white" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
