import React, { useState, useEffect } from 'react';
import { Award, CheckCircle, Clock, Send, Globe, MessageSquare, Briefcase } from 'lucide-react';
import { User, TranslatorRequest } from '../types';
import { BerryDatabase } from '../data';

interface TranslatorRequestFormProps {
  currentUser: User;
  onRequestSubmitted: () => void;
}

export default function TranslatorRequestForm({ currentUser, onRequestSubmitted }: TranslatorRequestFormProps) {
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [discord, setDiscord] = useState('');
  const [telegram, setTelegram] = useState('');
  
  const [myRequests, setMyRequests] = useState<TranslatorRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const languagesOptions = ['الكورية', 'الصينية', 'اليابانية', 'الإنجليزية', 'أخرى'];

  const loadRequests = () => {
    const allReqs = BerryDatabase.get<TranslatorRequest[]>('translator_requests', []);
    setMyRequests(allReqs.filter(r => r.email.toLowerCase() === currentUser.email.toLowerCase()));
  };

  useEffect(() => {
    loadRequests();
  }, [currentUser]);

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter(l => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (languages.length === 0) {
      setError('يرجى اختيار لغة ترجمة واحدة على الأقل.');
      return;
    }
    if (!experience.trim() || !reason.trim()) {
      setError('يرجى ملء جميع الحقول الإلزامية.');
      return;
    }

    setLoading(true);

    const newRequest: TranslatorRequest = {
      id: `req-${Date.now()}`,
      username: currentUser.username,
      email: currentUser.email,
      discord: discord || currentUser.discord,
      telegram: telegram || currentUser.telegram,
      experience: experience,
      languages: languages,
      reason: reason,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    // Save to DB
    const allReqs = BerryDatabase.get<TranslatorRequest[]>('translator_requests', []);
    BerryDatabase.set('translator_requests', [newRequest, ...allReqs]);

    // Send notifications to owner
    const allNotifs = BerryDatabase.get<any[]>('notifications', []);
    const newNotif = {
      id: `notif-req-${Date.now()}`,
      userId: 'berrymist-owner',
      title: '📥 طلب انضمام كمترجم جديد',
      message: `العضو "${currentUser.username}" أرسل طلب انضمام كـ مترجم لمراجعته وقبوله.`,
      type: 'ROLE',
      isRead: false,
      createdAt: 'الآن'
    };
    BerryDatabase.set('notifications', [...allNotifs, newNotif]);

    setTimeout(() => {
      setLoading(false);
      setSuccess('تم تقديم طلبك بنجاح! جاري مراجعته حالياً من قبل مالك المنصة. 🍇');
      setExperience('');
      setLanguages([]);
      setReason('');
      setDiscord('');
      setTelegram('');
      loadRequests();
      onRequestSubmitted();
    }, 1500);
  };

  const hasPending = myRequests.some(r => r.status === 'PENDING');

  return (
    <div className="w-full text-right mt-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full blur-[40px] pointer-events-none" />

        <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
          <div className="p-2 bg-violet-500/10 rounded-xl text-violet-400">
            <Award size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">طلب الانضمام كمترجم رسمي ✍️</h3>
            <p className="text-[10px] text-purple-400 mt-0.5">ترجم رواياتك المفضلة، انشر فصولها حياً، واحصل على دعم ومكافآت مجتمع بيري ميست.</p>
          </div>
        </div>

        {/* Existing requests status */}
        {myRequests.length > 0 && (
          <div className="mb-6 flex flex-col gap-3">
            <span className="text-xs font-bold text-purple-300">حالة طلباتك السابقة:</span>
            {myRequests.map((req) => (
              <div 
                key={req.id} 
                className={`p-4 rounded-2xl border text-xs flex justify-between items-center ${
                  req.status === 'PENDING' 
                    ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-300' 
                    : req.status === 'ACCEPTED' 
                      ? 'bg-green-500/5 border-green-500/20 text-green-300' 
                      : 'bg-red-500/5 border-red-500/20 text-red-300'
                }`}
              >
                <div className="flex flex-col gap-1 text-right">
                  <span className="font-bold">طلب انضمام بتاريخ: {new Date(req.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</span>
                  <span className="text-[10px] text-purple-400">اللغات: {req.languages.join('، ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold shrink-0">
                    {req.status === 'PENDING' && '⏳ قيد المراجعة'}
                    {req.status === 'ACCEPTED' && '✅ تم القبول (مبروك!)'}
                    {req.status === 'REJECTED' && '❌ تم الرفض'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasPending ? (
          <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-200 text-center font-semibold">
            لديك طلب معلق قيد المراجعة من الإدارة حالياً. يرجى الانتظار حتى يقوم مالك المنصة بمراجعته وقبوله. 🍇
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-semibold text-center animate-shake">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-300 font-semibold text-center">
                🎉 {success}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Experience */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-purple-200 flex items-center gap-1.5 justify-end">
                  <span>الخبرة السابقة والأعمال (إلزامي)</span>
                  <Briefcase size={14} className="text-purple-400" />
                </label>
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="مثال: ترجمت أكثر من 50 فصلاً في فرق أخرى، أو هذه أول تجربة لي ولكن لغتي ممتازة..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors h-28 text-right resize-none"
                  required
                />
              </div>

              {/* Reason */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-purple-200 flex items-center gap-1.5 justify-end">
                  <span>لماذا تريد الانضمام إلينا؟ (إلزامي)</span>
                  <MessageSquare size={14} className="text-purple-400" />
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="حدثنا عن دوافعك ورغبتك في إثراء المحتوى الروائي بالمنصة..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors h-28 text-right resize-none"
                  required
                />
              </div>
            </div>

            {/* Languages checkbox */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-purple-200 flex items-center gap-1.5 justify-end">
                <span>ما هي اللغات التي تترجم منها؟ (اختر واحدة أو أكثر)</span>
                <Globe size={14} className="text-purple-400" />
              </label>
              <div className="flex flex-wrap gap-2 justify-end">
                {languagesOptions.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      languages.includes(lang)
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-white/5 border-white/5 text-purple-300 hover:bg-white/10'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Discord */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-purple-200">حساب ديسكورد للتواصل (اختياري)</label>
                <input
                  type="text"
                  value={discord}
                  onChange={(e) => setDiscord(e.target.value)}
                  placeholder="username#0000"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors text-right"
                />
              </div>

              {/* Telegram */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-purple-200">حساب تليجرام للتواصل (اختياري)</label>
                <input
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@username"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors text-right"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-fit md:px-8 py-3 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2 mr-auto shadow-lg shadow-violet-500/10"
            >
              <Send size={14} />
              <span>{loading ? 'جاري التقديم...' : 'إرسال طلب الانضمام كـ مترجم'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
