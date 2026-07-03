import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Calendar, FileText, Image as ImageIcon, CheckCircle, Sparkles, AlertCircle, X, ExternalLink, ArrowRight, Upload } from 'lucide-react';
import { Ad, User } from '../types';
import { BerryDatabase } from '../data';

interface AdsPageProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
  selectedAdId?: string; // Optional if we navigated directly to an ad from the ticker
}

export default function AdsPage({ currentUser, onNavigate, selectedAdId }: AdsPageProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [image, setImage] = useState('');
  const [content, setContent] = useState('');
  const [showInTicker, setShowInTicker] = useState(true);
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Reload ads on mount and when changes occur
  const loadAds = () => {
    const allAds = BerryDatabase.get<Ad[]>('ads', []);
    setAds(allAds.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    
    // If we have a selectedAdId passed via params, find and open it!
    if (selectedAdId) {
      const foundAd = allAds.find(a => a.id === selectedAdId);
      if (foundAd) {
        setSelectedAd(foundAd);
      }
    }
  };

  useEffect(() => {
    loadAds();
  }, [selectedAdId]);

  // Handle PNG/Image file conversion to Base64
  const processImageFile = (file: File) => {
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      setError('يرجى اختيار ملف صورة صالح بصيغة PNG فقط لضمان توافق جودة التصاميم الفاخرة.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImage(e.target.result as string);
        setSuccess('تم تحميل الصورة وتحويلها بنجاح! 🎉');
        setError('');
      }
    };
    reader.onerror = () => {
      setError('فشل قراءة الملف. حاول مرة أخرى.');
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  // Add ad to local storage
  const handleCreateAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !image.trim() || !content.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة بالكامل.');
      return;
    }



    const newAd: Ad = {
      id: `ad-${Date.now()}`,
      title: title.trim(),
      image: image.trim(),
      content: content.trim(),
      showInTicker,
      createdAt: new Date().toISOString()
    };

    const allAds = BerryDatabase.get<Ad[]>('ads', []);
    allAds.unshift(newAd);
    BerryDatabase.set('ads', allAds);

    // Refresh states
    setTitle('');
    setImage('');
    setContent('');
    setShowInTicker(true);
    setSuccess('تمت إضافة الإعلان بنجاح ونشره في المنصة! 🚀');
    setError('');
    setShowAddForm(false);
    loadAds();

    // Trigger global refresh if needed
    window.dispatchEvent(new CustomEvent('ads-updated'));
  };

  // Delete ad
  const handleDeleteAd = (adId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering details modal
    const isConfirmed = window.confirm('هل أنت متأكد تماماً من حذف هذا الإعلان نهائياً؟');
    if (!isConfirmed) return;

    const allAds = BerryDatabase.get<Ad[]>('ads', []);
    const filteredAds = allAds.filter(a => a.id !== adId);
    BerryDatabase.set('ads', filteredAds);

    setSuccess('تم حذف الإعلان بنجاح. ❌');
    loadAds();

    if (selectedAd?.id === adId) {
      setSelectedAd(null);
    }

    window.dispatchEvent(new CustomEvent('ads-updated'));
  };

  return (
    <div className="w-full text-right mt-4 pb-12 animate-in fade-in duration-300">
      
      {/* Header Panel */}
      <div className="p-6 bg-[#1A1625] rounded-3xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone size={24} className="text-fuchsia-400 animate-pulse shrink-0" />
            <span>مركز الإعلانات والبيانات العامة الفاخرة</span>
          </h1>
          <p className="text-xs text-purple-300 mt-1">تصفح آخر الإعلانات المميزة، الفعاليات المجدولة، والتحديثات الرسمية لمنصة بيري ميست.</p>
        </div>
        
        {currentUser.role === 'OWNER' && (
          <button 
            onClick={() => {
              setShowAddForm(!showAddForm);
              setSelectedAd(null);
              setError('');
              setSuccess('');
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            <span>إضافة إعلان جديد 📢</span>
          </button>
        )}
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-2 text-xs mb-6 animate-in slide-in-from-top-2">
          <CheckCircle size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 text-xs mb-6 animate-in slide-in-from-top-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* RIGHT/MAIN COLUMN: Ads List / Form */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Owner New Ad Creation Form */}
          {currentUser.role === 'OWNER' && showAddForm && (
            <div className="p-6 bg-[#1A1625] border border-violet-500/15 rounded-3xl animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-3">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-fuchsia-400" />
                  <span>لوحة إنشاء إعلان جديد بالمنصة 🎨</span>
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-1 bg-white/5 hover:bg-white/10 rounded-lg text-purple-300 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleCreateAd} className="flex flex-col gap-4 text-xs font-medium">
                
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">عنوان الإعلان الرسمي *</label>
                  <input 
                    type="text" 
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: تم فتح باب الانضمام لفرق الترجمة الفخمة..."
                    className="bg-[#14101D] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-2.5 text-white transition-all text-right"
                  />
                </div>

                {/* Drag & Drop PNG File Uploader */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">صورة الإعلان الرئيسية *</label>
                  
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      isDragging 
                        ? 'border-violet-500 bg-violet-500/10' 
                        : image 
                          ? 'border-green-500/40 bg-[#14101D]' 
                          : 'border-white/15 hover:border-violet-500/30 bg-[#14101D]'
                    }`}
                  >
                    <input 
                      type="file" 
                      id="ad-image-uploader"
                      accept="image/png"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <label htmlFor="ad-image-uploader" className="cursor-pointer w-full h-full flex flex-col items-center">
                      <Upload size={24} className="text-violet-400 animate-bounce mb-1" />
                      <span className="font-bold text-white text-xs">اسحب صورة الإعلان (PNG) وأفلتها هنا أو انقر للتصفح 📂</span>
                      <span className="text-[10px] text-purple-400 mt-1">يدعم فقط ملفات الصور بصيغة PNG لضمان جودة التصاميم الفاخرة</span>
                    </label>
                  </div>

                  {image && (
                    <div className="mt-3 p-3 bg-[#14101D] rounded-xl border border-white/5 flex items-center gap-4 justify-between">
                      <div className="flex items-center gap-3">
                        <img src={image} alt="Ad Cover" className="w-16 h-12 rounded object-cover border border-white/10 shadow-md" referrerPolicy="no-referrer" />
                        <span className="text-[10px] text-green-400 font-bold">تم إرفاق الصورة بنجاح وتجهيزها!</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setImage('')}
                        className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-[10px]"
                      >
                        إزالة الصورة ❌
                      </button>
                    </div>
                  )}


                </div>

                {/* Details Content */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-purple-200">تفاصيل ومعلومات الإعلان بالتفصيل *</label>
                  <textarea 
                    required
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="اكتب تفاصيل الإعلان وشروطه وروابط التواصل إن وُجدت بوضوح تام..."
                    className="bg-[#14101D] border border-white/10 focus:border-violet-500 outline-none rounded-xl px-4 py-3 text-white text-xs transition-all text-right resize-none"
                  />
                </div>

                {/* Toggle show in ticker */}
                <div className="flex items-center gap-2 bg-[#14101D] p-3.5 rounded-xl border border-white/5">
                  <input 
                    type="checkbox" 
                    id="showInTicker"
                    checked={showInTicker}
                    onChange={(e) => setShowInTicker(e.target.checked)}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                  <label htmlFor="showInTicker" className="text-purple-200 cursor-pointer font-bold select-none text-[11px]">
                    عرض وتضمين هذا الإعلان في شريط الإعلانات المتحرك العلوي للمنصة 
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-purple-300 font-bold"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit" 
                    className="px-6 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white rounded-xl font-bold shadow-md shadow-violet-500/10"
                  >
                    نشر الإعلان الآن 📢
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* List of active advertisements */}
          <div className="flex flex-col gap-4">
            {ads.length > 0 ? (
              ads.map((ad) => (
                <div 
                  key={ad.id}
                  onClick={() => setSelectedAd(ad)}
                  className={`p-5 bg-[#1A1625] border rounded-2xl flex flex-col md:flex-row gap-5 items-center md:items-start text-right transition-all cursor-pointer group hover:-translate-y-0.5 ${selectedAd?.id === ad.id ? 'border-violet-500/50 bg-violet-950/5' : 'border-white/5 hover:border-violet-500/15'}`}
                >
                  <img src={ad.image} alt={ad.title} className="w-24 h-24 rounded-xl object-cover border border-white/10 shrink-0 shadow-md" referrerPolicy="no-referrer" />
                  
                  <div className="flex-1 w-full flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap justify-between items-start gap-2 w-full">
                        <h4 className="font-extrabold text-sm text-white group-hover:text-fuchsia-400 transition-colors">{ad.title}</h4>
                        
                        {currentUser.role === 'OWNER' && (
                          <button 
                            onClick={(e) => handleDeleteAd(ad.id, e)}
                            className="p-1.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="حذف الإعلان"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-purple-400 mt-1 flex items-center gap-1.5">
                        <Calendar size={11} />
                        <span>نُشر في: {new Date(ad.createdAt).toLocaleDateString('ar-EG')}</span>
                        {ad.showInTicker && (
                          <span className="text-[8px] bg-fuchsia-500/10 text-fuchsia-300 px-1.5 py-0.5 rounded border border-fuchsia-500/10 font-bold">
                            يظهر في الشريط ⚡
                          </span>
                        )}
                      </p>

                      <p className="text-xs text-purple-300 mt-3.5 leading-relaxed line-clamp-2">
                        {ad.content}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-fuchsia-400 font-bold text-left group-hover:underline">
                      انقر للتفاصيل الكاملة للإعلان ←
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center bg-[#1A1625] border border-dashed border-white/5 rounded-3xl text-purple-400">
                <Megaphone size={32} className="mx-auto mb-3 text-purple-500/40" />
                <p className="text-sm font-semibold">لا توجد إعلانات نشطة في المنصة حالياً.</p>
              </div>
            )}
          </div>

        </div>

        {/* LEFT COLUMN: Selected Advertisement Detail View */}
        <div className="lg:col-span-1">
          {selectedAd ? (
            <div className="p-6 bg-[#1A1625] border border-fuchsia-500/10 rounded-3xl sticky top-24 animate-in fade-in slide-in-from-bottom-4 duration-300 text-right">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 mb-5 shadow-lg">
                <img src={selectedAd.image} alt={selectedAd.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[9px] text-purple-200 flex items-center gap-1">
                  <Calendar size={10} />
                  <span>{new Date(selectedAd.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
                <button 
                  onClick={() => setSelectedAd(null)}
                  className="absolute top-2 left-2 p-1 bg-black/60 hover:bg-black/85 rounded-full text-white cursor-pointer"
                  title="إغلاق التفاصيل"
                >
                  <X size={14} />
                </button>
              </div>

              <h3 className="font-extrabold text-base text-white mb-2 leading-tight">
                {selectedAd.title}
              </h3>

              <div className="h-px bg-white/5 my-4" />

              <div className="text-xs text-purple-200 leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto pr-1">
                {selectedAd.content}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                <button 
                  onClick={() => setSelectedAd(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-purple-300 font-bold rounded-xl text-xs text-center transition-all cursor-pointer"
                >
                  إغلاق التفاصيل ✕
                </button>
                <a 
                  href={`mailto:support@berrymist.com?subject=Inquiry: ${encodeURIComponent(selectedAd.title)}`}
                  className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-xl text-xs text-center transition-all flex items-center justify-center gap-1"
                >
                  <span>استفسار 📧</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-[#1A1625]/40 border border-white/5 border-dashed rounded-3xl text-center text-purple-400 sticky top-24">
              <Megaphone size={28} className="mx-auto mb-3 text-purple-500/30" />
              <h3 className="text-xs font-bold text-white mb-1">تصفح تفاصيل الإعلانات</h3>
              <p className="text-[10px] text-purple-400 leading-relaxed">اختر أي إعلان من القائمة الجانبية أو من شريط الإعلانات العلوي لعرض التفاصيل الكاملة وروابط المراسلة المباشرة.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
