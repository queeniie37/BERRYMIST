import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle, ArrowLeft, Trash2, Shield, Calendar, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { BerryDatabase } from '../data';

interface ContactUsProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export default function ContactUs({ currentUser, onNavigate }: ContactUsProps) {
  const isOwner = currentUser?.role === 'OWNER';
  
  // State for the form
  const [name, setName] = useState(currentUser?.username || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  
  // Messages state for the Owner Panel
  const [messages, setMessages] = useState<ContactMessage[]>(() => 
    BerryDatabase.get<ContactMessage[]>('contact_messages', [])
  );
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة لضمان استلام رسالتك.');
      return;
    }

    const newMessage: ContactMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [newMessage, ...messages];
    BerryDatabase.set('contact_messages', updatedMessages);
    setMessages(updatedMessages);

    // Clear form
    setSubject('');
    setMessage('');
    setError('');
    setSuccess('تم إرسال رسالتك بنجاح! سيتواصل معك فريق الدعم الفني في أقرب وقت ممكن. 🍇');
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleDeleteMessage = (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذه الرسالة؟')) {
      const updated = messages.filter(m => m.id !== id);
      BerryDatabase.set('contact_messages', updated);
      setMessages(updated);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-right min-h-[80vh] select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 border-b border-white/5 pb-6">
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>العودة للرئيسية</span>
        </button>
        
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2 justify-end">
              <span>اتصل بنا</span>
              <Mail className="text-violet-400" size={24} />
            </h1>
            <p className="text-[10px] text-purple-400 mt-1">تواصل مباشرة مع إدارة بيري مست وسنجيبك في أسرع وقت</p>
          </div>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold rounded-2xl mb-6 flex items-center justify-end gap-2 animate-in slide-in-from-top duration-300">
          <span>{success}</span>
          <CheckCircle size={16} />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold rounded-2xl mb-6 flex items-center justify-end gap-2">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Contact Info & Owner Inbox */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Quick info panel */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 justify-end">
              <span>قنوات الدعم والاتصال الرسمي</span>
              <MessageSquare size={16} className="text-violet-400" />
            </h3>
            <p className="text-xs text-purple-200/85 mb-4 leading-relaxed">
              إذا واجهتك مشكلة تقنية، أو رغبت في الاستفسار عن ترجمة أو شراكة، يمكنك استخدام النموذج المجاور أو مراسلتنا مباشرة عبر القنوات التالية:
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-xs font-mono text-purple-100 select-all">support@berrymist.com</span>
                <span className="text-xs text-purple-300 font-bold">البريد الإلكتروني</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-xs font-bold text-violet-400">تذكرة الديسكورد الرسمية</span>
                <span className="text-xs text-purple-300 font-bold">الدعم الفني المباشر</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-xs text-purple-100 font-bold">24 ساعة / طوال أيام الأسبوع</span>
                <span className="text-xs text-purple-300 font-bold">ساعات العمل</span>
              </div>
            </div>
          </div>

          {/* Owner panel - Received Messages list */}
          {isOwner && (
            <div className="glass-panel p-6 rounded-2xl border border-violet-500/20 bg-violet-950/10">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between flex-row-reverse">
                <span className="flex items-center gap-1.5 flex-row-reverse">
                  <Shield size={16} className="text-violet-400" />
                  <span>بريد الإدارة المستلم ({messages.length})</span>
                </span>
                <span className="text-[9px] bg-violet-500/25 text-violet-300 px-1.5 py-0.5 rounded-full font-bold">خاص بالمالك</span>
              </h3>
              
              {messages.length === 0 ? (
                <div className="p-8 text-center bg-white/5 rounded-xl border border-white/5">
                  <p className="text-xs text-purple-400">لم تصلك أي رسائل جديدة بعد.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-right relative group">
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="absolute left-2 top-2 p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all"
                        title="حذف الرسالة"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="flex items-center gap-2 mb-1 justify-end pl-8">
                        <span className="text-xs font-bold text-violet-300 truncate">{msg.subject}</span>
                      </div>
                      <p className="text-[11px] text-purple-200/95 leading-relaxed mb-2 whitespace-pre-wrap">{msg.message}</p>
                      
                      <div className="flex flex-wrap items-center justify-between text-[9px] text-purple-400 border-t border-white/5 pt-2 gap-1">
                        <span className="font-mono">{new Date(msg.createdAt).toLocaleString('ar-EG', { numberingSystem: 'latn' })}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-purple-300 font-bold">{msg.name}</span>
                          <span className="text-purple-400">({msg.email})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h2 className="text-base font-bold text-white mb-2">نموذج التواصل السريع ✍️</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 text-right">
                <label className="text-[11px] text-purple-300 font-bold">اسمك الكريم / اسم المستخدم</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl py-2 px-3 text-white text-xs text-right"
                    placeholder="مثال: يوسف أحمد"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-right">
                <label className="text-[11px] text-purple-300 font-bold">عنوان بريدك الإلكتروني</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl py-2 px-3 text-white text-xs font-mono text-left"
                    placeholder="user@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-right">
              <label className="text-[11px] text-purple-300 font-bold">موضوع الرسالة</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl py-2 px-3 text-white text-xs text-right"
                placeholder="مثال: طلب شراكة / بلاغ عن مشكلة بفصل"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-right">
              <label className="text-[11px] text-purple-300 font-bold">تفاصيل الرسالة</label>
              <textarea
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-[#1A1625] border border-white/10 focus:border-violet-500 outline-none rounded-xl p-3 text-white text-xs text-right leading-relaxed resize-y"
                placeholder="اكتب رسالتك بالتفصيل هنا..."
              />
            </div>

            <div className="flex justify-end mt-2">
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/10 transition-all select-none"
              >
                <Send size={14} />
                <span>إرسال الرسالة الآن 🚀</span>
              </button>
            </div>
          </form>
        </div>

      </div>

    </div>
  );
}
