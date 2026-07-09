import React, { useState } from 'react';
import { FileText, Edit3, Save, CheckCircle, RefreshCw, Eye, ArrowLeft, Lock } from 'lucide-react';
import { User } from '../types';
import { BerryDatabase } from '../data';

interface TermsOfServiceProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
}

const DEFAULT_TERMS = `## شروط الاستخدام لموقع BerryMist 🍇

آخر تحديث: 9 يوليو 2026

مرحبًا بك في BerryMist. يُرجى قراءة شروط الاستخدام التالية بعناية قبل استخدام الموقع. إن دخولك إلى الموقع أو استخدامك لأي من خدماته يعني موافقتك على الالتزام بهذه الشروط.

---

### 1. قبول الشروط
باستخدامك لموقع BerryMist فإنك توافق على الالتزام بجميع شروط الاستخدام وسياسة الخصوصية وأي سياسات أخرى يتم نشرها على الموقع.
إذا كنت لا توافق على أي من هذه الشروط، فيُرجى عدم استخدام الموقع.

---

### 2. استخدام الموقع
يُسمح باستخدام الموقع للأغراض الشخصية والقانونية فقط.
ويتعهد المستخدم بعدم:
- استخدام الموقع في أي نشاط مخالف للأنظمة أو القوانين.
- محاولة اختراق الموقع أو الوصول غير المصرح به إلى أنظمته.
- نشر أي محتوى مسيء أو غير قانوني أو ينتهك حقوق الآخرين.
- استخدام برامج أو أدوات آلية تؤثر على أداء الموقع أو تجمع البيانات دون إذن.

---

### 3. حسابات المستخدمين
عند إنشاء حساب في BerryMist، يلتزم المستخدم بما يلي:
- تقديم معلومات صحيحة ودقيقة.
- الحفاظ على سرية بيانات تسجيل الدخول.
- تحمل المسؤولية الكاملة عن جميع الأنشطة التي تتم من خلال حسابه.
- إبلاغ إدارة الموقع فورًا عند الاشتباه في أي استخدام غير مصرح به للحساب.
يحتفظ BerryMist بحق تعليق أو إيقاف أي حساب يخالف هذه الشروط.

---

### 4. المحتوى
يسعى BerryMist إلى تقديم تجربة قراءة مميزة، إلا أننا لا نضمن خلو جميع المواد المنشورة من الأخطاء أو اكتمالها.
قد يتم تعديل أو تحديث أو حذف أي محتوى في أي وقت دون إشعار مسبق.

---

### 5. التعليقات والمشاركات
يجوز للمستخدم نشر التعليقات والمراجعات بما يتوافق مع الآداب العامة والأنظمة المعمول بها.
ويُمنع نشر:
- الإساءة أو التشهير أو خطاب الكراهية.
- الرسائل المزعجة أو الإعلانات غير المصرح بها.
- أي محتوى ينتهك حقوق الملكية الفكرية أو حقوق الآخرين.
- أي معلومات مضللة أو ضارة.
ويحتفظ BerryMist بحق حذف أي محتوى أو تعليق مخالف دون إشعار مسبق.

---

### 6. حقوق الملكية الفكرية
جميع عناصر الموقع، بما في ذلك التصميم، والشعار، والواجهة، والبرمجيات، والنصوص الخاصة بالموقع، محمية بحقوق الملكية الفكرية.
ولا يجوز نسخ أو إعادة نشر أو توزيع أي جزء من الموقع دون الحصول على إذن مسبق من BerryMist أو من صاحب الحقوق، حسب الحالة.
يتحمل المستخدم مسؤولية احترام حقوق الملكية الفكرية الخاصة بالمحتوى الذي يشاركه عبر الموقع.

---

### 7. الإعلانات والخدمات الخارجية
قد يعرض الموقع إعلانات أو روابط لخدمات ومواقع خارجية.
ولا يتحمل BerryMist أي مسؤولية عن محتوى أو سياسات أو خدمات تلك الجهات الخارجية.

---

### 8. إيقاف الخدمة
يحتفظ BerryMist بالحق في:
- تعليق أو إنهاء حساب أي مستخدم يخالف هذه الشروط.
- تعديل أو إيقاف أي جزء من خدمات الموقع في أي وقت.
- إزالة أي محتوى يرى أنه مخالف أو قد يسبب ضررًا للموقع أو مستخدميه.

---

### 9. حدود المسؤولية
يبذل BerryMist جهدًا معقولًا للحفاظ على استقرار الموقع، إلا أننا لا نضمن عمله دون انقطاع أو خلوه من الأخطاء التقنية.
ولا يتحمل الموقع المسؤولية عن أي خسائر أو أضرار تنتج عن استخدام الموقع أو عدم القدرة على استخدامه، وذلك بالقدر الذي يسمح به القانون.

---

### 10. التعديلات على الشروط
يجوز لـ BerryMist تعديل شروط الاستخدام في أي وقت.
وسيتم نشر النسخة المحدثة على هذه الصفحة، ويُعد استمرار استخدام الموقع بعد نشر التعديلات موافقة على الشروط الجديدة.

---

### 11. إنهاء الحساب
يجوز للمستخدم طلب حذف حسابه في أي وقت.
كما يجوز لإدارة BerryMist تعليق أو حذف أي حساب يخالف شروط الاستخدام أو يسيء استخدام خدمات الموقع.

---

### 12. القانون الواجب التطبيق
تخضع هذه الشروط وتُفسر وفقًا للأنظمة والقوانين المعمول بها، ويكون أي نزاع متعلق باستخدام الموقع خاضعًا للجهة القضائية المختصة وفقًا لتلك الأنظمة.

---

### 13. التواصل معنا
إذا كانت لديك أي استفسارات أو ملاحظات بشأن شروط الاستخدام، يمكنك التواصل معنا عبر صفحة اتصل بنا أو من خلال البريد الإلكتروني الرسمي للموقع عند توفره.

---

باستخدامك لموقع BerryMist فإنك تقر بأنك قرأت شروط الاستخدام هذه وفهمتها وتوافق على الالتزام بها.`;

export default function TermsOfService({ currentUser, onNavigate }: TermsOfServiceProps) {
  const isOwner = currentUser?.role === 'OWNER';

  const [content, setContent] = useState(() => {
    const saved = BerryDatabase.get<string>('terms_of_service_text', '');
    if (!saved || saved.trim() === '') {
      BerryDatabase.set('terms_of_service_text', DEFAULT_TERMS);
      return DEFAULT_TERMS;
    }
    return saved;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(content);
  const [success, setSuccess] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    BerryDatabase.set('terms_of_service_text', editVal);
    setContent(editVal);
    setIsEditing(false);
    setSuccess('تم حفظ وتحديث شروط الاستخدام بنجاح! 💾');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleResetDefault = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في استعادة النص الافتراضي لشروط الاستخدام؟')) {
      setEditVal(DEFAULT_TERMS);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-right min-h-[70vh]">
      
      {/* Header and Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 border-b border-white/5 pb-6">
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
        >
          <ArrowLeft size={14} />
          <span>العودة للرئيسية</span>
        </button>
        
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2 justify-end">
              <span>شروط الخدمة والاستخدام</span>
              <FileText className="text-violet-400" size={24} />
            </h1>
            <p className="text-[10px] text-purple-400 mt-1">آخر تحديث: 9 يوليو 2026</p>
          </div>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold rounded-2xl mb-6 flex items-center justify-end gap-2 animate-in slide-in-from-top duration-300">
          <span>{success}</span>
          <CheckCircle size={16} />
        </div>
      )}

      {/* Owner controls */}
      {isOwner && (
        <div className="mb-6 p-4 bg-violet-950/15 border border-violet-500/25 rounded-2xl flex items-center justify-between flex-row-reverse">
          <div className="flex items-center gap-2 flex-row-reverse text-right">
            <Lock className="text-violet-400" size={16} />
            <div>
              <span className="text-xs font-extrabold text-white block">مرحباً يا مالك الموقع 👤</span>
              <span className="text-[10px] text-purple-300 block">لديك الصلاحية الكاملة لتعديل وصياغة شروط الاستخدام هذه بما يتوافق مع رؤيتك.</span>
            </div>
          </div>
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              if (!isEditing) setEditVal(content);
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-lg shadow-violet-600/10"
          >
            {isEditing ? (
              <>
                <Eye size={14} />
                <span>عرض الشروط</span>
              </>
            ) : (
              <>
                <Edit3 size={14} />
                <span>تعديل شروط الاستخدام</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* View or Edit mode */}
      {isEditing && isOwner ? (
        <form onSubmit={handleSave} className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 font-bold cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>استعادة النص الافتراضي</span>
            </button>
            <span className="text-xs text-purple-300 font-bold">محرر الشروط (يدعم صياغة النصوص والـ Markdown) ✍️</span>
          </div>

          <textarea
            required
            rows={18}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl p-4 text-white text-xs font-sans leading-relaxed min-h-[50vh] resize-y"
            placeholder="اكتب شروط الاستخدام هنا..."
          />

          <div className="flex gap-2 justify-end border-t border-white/5 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              إلغاء التعديل
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-violet-500/10"
            >
              <Save size={14} />
              <span>حفظ وتحديث الشروط 💾</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/5 leading-relaxed text-xs md:text-sm text-purple-100 flex flex-col gap-4 text-right">
          {/* Simple parser or markdown display */}
          <div className="whitespace-pre-wrap select-text selection:bg-violet-500/30">
            {content.split('\n').map((line, idx) => {
              if (line.startsWith('## ')) {
                return <h2 key={idx} className="text-base md:text-lg font-extrabold text-white mt-4 mb-2 pb-1 border-b border-white/5">{line.substring(3)}</h2>;
              }
              if (line.startsWith('### ')) {
                return <h3 key={idx} className="text-xs md:text-sm font-extrabold text-violet-400 mt-4 mb-1.5">{line.substring(4)}</h3>;
              }
              if (line.startsWith('- ')) {
                return <li key={idx} className="mr-4 list-disc text-purple-200 my-1">{line.substring(2)}</li>;
              }
              if (line.startsWith('---')) {
                return <hr key={idx} className="border-white/5 my-4" />;
              }
              return <p key={idx} className="text-[12.5px] leading-relaxed text-purple-200/90 mb-2">{line}</p>;
            })}
          </div>
        </div>
      )}

    </div>
  );
}
