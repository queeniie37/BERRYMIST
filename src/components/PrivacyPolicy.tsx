import React, { useState } from 'react';
import { Shield, Edit3, Save, CheckCircle, RefreshCw, Eye, ArrowLeft, Lock } from 'lucide-react';
import { User } from '../types';
import { BerryDatabase } from '../data';

interface PrivacyPolicyProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
}

const DEFAULT_PRIVACY_POLICY = `## سياسة الخصوصية لموقع BerryMist 🍇

آخر تحديث: 9 يوليو 2026

مرحبًا بك في BerryMist. نحن نلتزم بحماية خصوصية مستخدمينا وضمان التعامل مع بياناتهم الشخصية بشفافية وأمان. باستخدامك للموقع فإنك توافق على سياسة الخصوصية الموضحة أدناه.

---

### 1. المعلومات التي نجمعها

قد نقوم بجمع المعلومات التالية:
- الاسم أو اسم المستخدم.
- عنوان البريد الإلكتروني.
- كلمة المرور (يتم حفظها بصورة مشفرة ولا يمكننا الاطلاع عليها).
- صورة الملف الشخصي (إذا قام المستخدم بإضافتها).
- سجل القراءة والإشارات المرجعية والفصول المحفوظة.
- التعليقات والتقييمات والمراجعات التي ينشرها المستخدم.
- بيانات تقنية مثل عنوان IP، نوع المتصفح، نوع الجهاز، نظام التشغيل، واللغة.
- ملفات تعريف الارتباط (Cookies) لتحسين تجربة الاستخدام.

---

### 2. كيفية استخدام المعلومات

نستخدم المعلومات من أجل:
- إنشاء وإدارة حساب المستخدم.
- حفظ تقدم القراءة والإعدادات الشخصية.
- تحسين أداء الموقع وتجربة المستخدم.
- تقديم المحتوى المناسب بناءً على اهتمامات المستخدم.
- الرد على الاستفسارات وطلبات الدعم الفني.
- حماية الموقع من إساءة الاستخدام أو الأنشطة غير القانونية.
- إرسال الإشعارات المتعلقة بالحساب أو التحديثات المهمة عند الحاجة.

---

### 3. ملفات تعريف الارتباط (Cookies)

يستخدم BerryMist ملفات تعريف الارتباط لتحسين الأداء وتذكر تفضيلات المستخدم وتحليل استخدام الموقع. يمكن للمستخدم تعطيل ملفات تعريف الارتباط من خلال إعدادات المتصفح، إلا أن ذلك قد يؤثر على بعض وظائف الموقع.

---

### 4. مشاركة المعلومات

لا نقوم ببيع أو تأجير أو مشاركة بيانات المستخدمين الشخصية مع أي طرف ثالث لأغراض تسويقية.

قد تتم مشاركة البيانات فقط في الحالات التالية:
- عند وجود التزام قانوني.
- لحماية حقوق BerryMist أو مستخدميه.
- مع مزودي الخدمات التقنيين الذين يساعدون في تشغيل الموقع، مع التزامهم بحماية البيانات.

---

### 5. حماية البيانات

نعتمد إجراءات وتقنيات أمنية مناسبة للمساعدة في حماية بيانات المستخدمين من الوصول غير المصرح به أو التعديل أو الإفصاح أو الإتلاف.

ورغم ذلك، لا يمكن ضمان أمان أي عملية نقل للبيانات عبر الإنترنت بنسبة 100%.

---

### 6. حسابات المستخدمين

يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات تسجيل الدخول الخاصة به، كما يتحمل مسؤولية جميع الأنشطة التي تتم باستخدام حسابه.

---

### 7. المحتوى والتعليقات

يتحمل المستخدم المسؤولية الكاملة عن أي محتوى أو تعليق أو مراجعة يقوم بنشرها.

ويحتفظ BerryMist بحق حذف أي محتوى يخالف القوانين أو ينتهك حقوق الآخرين أو يتعارض مع سياسة الموقع.

---

### 8. حقوق الملكية الفكرية

جميع التصاميم والشعارات والعلامات التجارية والبرمجيات الخاصة بموقع BerryMist محمية بحقوق الملكية الفكرية.

تبقى حقوق الروايات وأغلفتها وأسمائها وأعمالها الأصلية مملوكة لأصحابها وناشريها، ويجب احترام جميع حقوق النشر المعمول بها.

---

### 9. روابط المواقع الخارجية

قد يحتوي الموقع على روابط لمواقع أو خدمات خارجية، ولا يتحمل BerryMist مسؤولية سياسات الخصوصية أو محتوى تلك المواقع.

---

### 10. حقوق المستخدم

يجوز للمستخدم، وفقًا للقوانين المعمول بها، طلب:
- الاطلاع على بياناته الشخصية.
- تعديل بياناته.
- حذف حسابه وبياناته.
- سحب موافقته على معالجة البيانات متى كان ذلك ممكنًا.

---

### 11. خصوصية الأطفال

لا يستهدف BerryMist جمع البيانات الشخصية من الأطفال دون السن الذي تحدده القوانين المحلية، وإذا تبين لنا جمع بيانات من طفل دون موافقة ولي الأمر، فسنتخذ الإجراءات المناسبة لإزالتها.

---

### 12. التعديلات على سياسة الخصوصية

قد نقوم بتحديث هذه السياسة من وقت لآخر. وسيتم نشر أي تعديل على هذه الصفحة مع تحديث تاريخ آخر مراجعة.

ويعد استمرار استخدام الموقع بعد نشر التعديلات موافقة على السياسة المحدثة.

---

### 13. التواصل معنا

إذا كانت لديك أي استفسارات أو ملاحظات حول سياسة الخصوصية، يمكنك التواصل معنا من خلال صفحة اتصل بنا أو البريد الإلكتروني الرسمي للموقع عند توفره.

---

باستخدامك لموقع BerryMist فإنك تقر بأنك قرأت سياسة الخصوصية هذه وفهمتها وتوافق على الالتزام بها.`;

export default function PrivacyPolicy({ currentUser, onNavigate }: PrivacyPolicyProps) {
  const isOwner = currentUser?.role === 'OWNER';
  
  const [content, setContent] = useState(() => {
    const saved = BerryDatabase.get<string>('privacy_policy_text', '');
    if (!saved || saved.trim() === '' || saved.includes('سياسة الخصوصية وحماية البيانات لمنصة بيري مست')) {
      BerryDatabase.set('privacy_policy_text', DEFAULT_PRIVACY_POLICY);
      return DEFAULT_PRIVACY_POLICY;
    }
    return saved;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(content);
  const [success, setSuccess] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    BerryDatabase.set('privacy_policy_text', editVal);
    setContent(editVal);
    setIsEditing(false);
    setSuccess('تم حفظ وتحديث سياسة الخصوصية بنجاح! 💾');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleResetDefault = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في استعادة النص الافتراضي لسياسة الخصوصية؟')) {
      setEditVal(DEFAULT_PRIVACY_POLICY);
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
              <span>سياسة الخصوصية وحماية البيانات</span>
              <Shield className="text-violet-400" size={24} />
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
              <span className="text-[10px] text-purple-300 block">لديك الصلاحية الكاملة لتعديل وصياغة سياسة الخصوصية هذه بما يتوافق مع رؤيتك.</span>
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
                <span>عرض السياسة</span>
              </>
            ) : (
              <>
                <Edit3 size={14} />
                <span>تعديل سياسة الخصوصية</span>
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
            <span className="text-xs text-purple-300 font-bold">محرر السياسة (يدعم صياغة النصوص والـ Markdown) ✍️</span>
          </div>

          <textarea
            required
            rows={18}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            className="bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl p-4 text-white text-xs font-sans leading-relaxed min-h-[50vh] resize-y"
            placeholder="اكتب سياسة الخصوصية هنا..."
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
              <span>حفظ وتحديث السياسة 💾</span>
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
