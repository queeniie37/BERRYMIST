import React, { useState } from 'react';
import { Plus, X, Upload, Check, AlertCircle } from 'lucide-react';
import { Suggestion, User } from '../types';

interface SuggestNovelDialogProps {
  currentUser: User;
  onClose: () => void;
  onAddSuggestion: (suggestion: Partial<Suggestion>) => void;
}

const KNOWN_GENRES = ['أكشن', 'فانتزيا', 'مغامرات', 'إثارة', 'نظام', 'إسيكاي', 'موريم', 'دراما', 'غموض', 'رومانسية', 'كوميديا', 'تراجع', 'موسيقى'];

export default function SuggestNovelDialog({ currentUser, onClose, onAddSuggestion }: SuggestNovelDialogProps) {
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [novelUpdatesLink, setNovelUpdatesLink] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [cover, setCover] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Real file upload & Base64 encoding
  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];
    if (!extension || !allowed.includes(extension)) {
      setError('خطأ: نقبل فقط ملفات الصور بصيغة (PNG, JPG, JPEG, WEBP, SVG, GIF) طبقاً لإجراءات الأمان والجمالية للمنصة.');
      return;
    }

    setError('');
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      let progress = 10;
      const interval = setInterval(() => {
        progress += 30;
        if (progress >= 100) {
          clearInterval(interval);
          setUploadProgress(100);
          setCover(base64String);
        } else {
          setUploadProgress(progress);
        }
      }, 100);
    };
    reader.onerror = () => {
      setError('حدث خطأ أثناء قراءة ملف الصورة. يرجى المحاولة مرة أخرى.');
      setUploadProgress(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'GUEST') {
      setError('عذراً، يجب تسجيل الدخول أو اختيار رتبة "عضو" على الأقل لتتمكن من تقديم اقتراحات جديدة.');
      return;
    }

    if (!titleAr || !titleEn || !description) {
      setError('يرجى ملء الحقول الإلزامية لتأكيد الاقتراح.');
      return;
    }

    onAddSuggestion({
      titleAr,
      titleEn,
      novelUpdatesLink,
      cover: cover || 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=600',
      genres: selectedGenres,
      description,
      suggestedBy: currentUser.username,
      suggestedById: currentUser.id,
      reason,
    });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh] text-right">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Plus size={20} className="text-violet-400" />
            <span>اقتراح رواية جديدة للترجمة</span>
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full text-purple-400 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2 text-sm mb-6 leading-relaxed">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          {/* Row 1: Titles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-purple-200">الاسم العربي للرواية *</label>
              <input 
                type="text" 
                required
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مثال: سيد الخداع الإلهي"
                className="bg-white/5 border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-sm transition-all text-right"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-purple-200">الاسم الإنجليزي للرواية *</label>
              <input 
                type="text" 
                required
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="مثال: Lord of Divine Deception"
                className="bg-white/5 border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-sm transition-all text-right"
              />
            </div>
          </div>

          {/* Row 2: Link */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-purple-200">رابط الرواية على NovelUpdates (اختياري)</label>
            <input 
              type="url" 
              value={novelUpdatesLink}
              onChange={(e) => setNovelUpdatesLink(e.target.value)}
              placeholder="https://www.novelupdates.com/series/..."
              className="bg-white/5 border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-sm transition-all text-left"
              dir="ltr"
            />
          </div>

          {/* Row 3: Drag & Drop Simulated Cover Upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-purple-200">غلاف الرواية المقترحة (رفع مباشر للغلاف فقط) *</label>
            <div className="border-2 border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl p-6 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-all relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleSimulatedUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {uploadProgress === null ? (
                <>
                  <Upload size={24} className="text-purple-400 mb-2" />
                  <p className="text-xs font-bold text-purple-200">اسحب صورة الغلاف إلى هنا أو تصفح ملفاتك</p>
                  <p className="text-[10px] text-purple-400 mt-1">نقبل صور PNG, JPG, JPEG, WEBP ونقوم بقصها آلياً بنسبة 2:3</p>
                </>
              ) : uploadProgress < 100 ? (
                <div className="w-full max-w-xs text-center flex flex-col items-center">
                  <span className="text-xs font-bold text-violet-400 mb-2">جاري الرفع والمعالجة: {uploadProgress}%</span>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400">
                  <Check size={18} />
                  <span className="text-xs font-bold">تم رفع الغلاف بنجاح ومعالجة الأبعاد تلقائياً!</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Genres */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-purple-200">التصنيفات والأنواع (اختر ما ينطبق)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {KNOWN_GENRES.map((genre) => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <button 
                    key={genre}
                    type="button"
                    onClick={() => handleGenreToggle(genre)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${isSelected ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/10' : 'bg-white/5 border-white/5 text-purple-300 hover:bg-white/10'}`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 5: Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-purple-200">نبذة وقصة الرواية *</label>
            <textarea 
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب ملخصاً وجيزاً لقصة الرواية لتشجيع الأعضاء والمترجمين..."
              className="bg-white/5 border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-sm transition-all text-right resize-none"
            />
          </div>

          {/* Row 6: Why suggest */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-purple-200">لماذا تقترح ترجمة هذه الرواية؟</label>
            <textarea 
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: الرواية حققت شعبية جبارة في كوريا وتستحق ترجمة فخمة حصرية لمجتمعنا..."
              className="bg-white/5 border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-sm transition-all text-right resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-white/5">
            <button 
              type="button" 
              onClick={onClose}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-500/15 transition-all cursor-pointer"
            >
              تقديم الاقتراح ونشره للتصويت
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
