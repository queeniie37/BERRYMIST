import React from 'react';
import { Star, Eye, BookOpen, Layers, Users, UsersRound } from 'lucide-react';

export default function StatsCounter() {
  const stats = [
    { label: 'مراجعة معتمدة', value: '3,892', icon: <Star size={20} className="text-yellow-400" /> },
    { label: 'مليون قراءة', value: '28.7M', icon: <Eye size={20} className="text-violet-400" /> },
    { label: 'فصل مترجم', value: '256,780', icon: <Layers size={20} className="text-pink-400" /> },
    { label: 'رواية مؤرشفة', value: '12,450', icon: <BookOpen size={20} className="text-purple-400" /> },
    { label: 'فريق ترجمة', value: '128', icon: <UsersRound size={20} className="text-blue-400" /> },
    { label: 'مستخدم نشط', value: '45,290', icon: <Users size={20} className="text-green-400" /> },
  ];

  return (
    <div className="w-full my-12 bg-[#14101D]/50 border border-white/5 rounded-3xl p-6 md:p-8 text-right select-none relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-berry-600/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-4 relative z-10">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="flex flex-col items-center justify-center p-4 bg-[#1A1625]/80 border border-white/5 rounded-2xl text-center group hover:border-violet-500/20 hover:-translate-y-1 transition-all duration-300"
          >
            {/* Outline animated icon */}
            <div className="p-3 bg-white/5 rounded-xl mb-3 border border-white/5 group-hover:scale-110 transition-transform">
              {stat.icon}
            </div>
            
            {/* Animated Large Stat value */}
            <span className="font-extrabold text-lg md:text-2xl text-white tracking-tight bg-gradient-to-r from-white to-purple-200 bg-clip-text">
              {stat.value}
            </span>
            
            {/* Stat Label */}
            <span className="text-[11px] font-bold text-purple-300/80 mt-1 uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
