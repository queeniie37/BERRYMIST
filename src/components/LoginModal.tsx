import React, { useState } from 'react';
import { LogIn, UserPlus, X, Shield, Mail, Lock, User as UserIcon } from 'lucide-react';
import { User, UserRole } from '../types';
import { BerryDatabase, DEFAULT_USERS } from '../data';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password || (isRegister && !username)) {
      setError('يرجى ملء جميع الحقول المطلوبة.');
      return;
    }

    if (isRegister && !acceptPolicy) {
      setError('يجب الموافقة على سياسة وقوانين المنصة للمتابعة والتسجيل.');
      return;
    }

    const usersDb = BerryDatabase.get<any[]>('users_db', []);

    if (isRegister) {
      // Sign Up — new accounts are always created as regular MEMBER readers.
      // The owner account can never be (re)registered; the owner signs in
      // through the login form only. Otherwise anyone knowing the owner's
      // email could register it and gain full admin control.
      if (email.toLowerCase() === 'berrymist11@gmail.com') {
        setError('هذا البريد الإلكتروني محجوز لمالك المنصة. يرجى استخدام نموذج تسجيل الدخول بدلاً من إنشاء حساب.');
        return;
      }

      const emailExists = usersDb.some(u => u.email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        setError('البريد الإلكتروني مسجل بالفعل.');
        return;
      }

      const newUser: User & { password?: string } = {
        id: `user-${Date.now()}`,
        username: username,
        email: email.toLowerCase(),
        role: 'MEMBER',
        xp: 0,
        level: 1,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
        bio: 'قارئ شغوف وعضو جديد في عائلة بيري ميست الفاخرة.',
        password: password
      };

      BerryDatabase.set('users_db', [...usersDb, newUser]);
      BerryDatabase.set('current_user_data', newUser);
      BerryDatabase.set('current_role', 'MEMBER');

      setSuccess('تم إنشاء الحساب بنجاح كقارئ! 👤');
      setTimeout(() => {
        onLoginSuccess(newUser);
        onClose();
      }, 1500);

    } else {
      // Sign In
      // Check for hardcoded owner login
      if (email.toLowerCase() === 'berrymist11@gmail.com' && password === 'berry11@$$') {
        const customOwner = BerryDatabase.get<any>('custom_user_OWNER', null);
        const ownerUser = customOwner && customOwner.email?.toLowerCase() === 'berrymist11@gmail.com' ? customOwner : {
          ...DEFAULT_USERS.OWNER,
          email: 'berrymist11@gmail.com'
        };
        BerryDatabase.set('current_user_data', ownerUser);
        BerryDatabase.set('current_role', 'OWNER' as UserRole);
        setSuccess('تم تسجيل دخول المالك بنجاح! 👑');
        setTimeout(() => {
          onLoginSuccess(ownerUser);
          onClose();
        }, 1500);
        return;
      }

      // Check in user database
      const user = usersDb.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!user) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        return;
      }

      BerryDatabase.set('current_user_data', user);
      BerryDatabase.set('current_role', user.role);
      setSuccess(`أهلاً بك مجدداً، ${user.username}! ✨`);
      setTimeout(() => {
        onLoginSuccess(user);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex justify-center items-center p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto glass-panel p-6 rounded-3xl shadow-2xl border border-white/10 relative animate-in zoom-in-95 duration-200">
        <div className="absolute top-0 left-0 w-48 h-48 bg-violet-600/10 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-berry-600/10 rounded-full blur-[60px] pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 left-4 p-2 rounded-full bg-white/5 border border-white/5 text-purple-200 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <img src="/site_logo.png" alt="Logo" className="w-12 h-12 rounded-full object-cover filter drop-shadow-[0_0_15px_rgba(139,92,246,0.5)] mx-auto mb-3 block" referrerPolicy="no-referrer" />
          <h3 className="font-extrabold text-2xl text-white bg-gradient-to-r from-violet-400 to-berry-400 bg-clip-text text-transparent">
            {isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
          </h3>
          <p className="text-xs text-purple-300 mt-1">
            {isRegister ? 'انضم إلى مجتمع بيري ميست الفاخر للروايات' : 'سجل دخولك لمتابعة قراءاتك وطلباتك'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-right">
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

          {isRegister && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-purple-200">اسم المستخدم</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: قارئ_الضباب"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors text-right"
                  required
                />
                <UserIcon size={14} className="absolute top-3.5 right-3.5 text-purple-400" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-purple-200">البريد الإلكتروني</label>
            <div className="relative">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors text-right"
                dir="ltr"
                required
              />
              <Mail size={14} className="absolute top-3.5 right-3.5 text-purple-400" />
            </div>
            {/* Owner credentials display hidden for privacy and security */}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-purple-200">كلمة المرور</label>
            <div className="relative">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors text-right"
                required
              />
              <Lock size={14} className="absolute top-3.5 right-3.5 text-purple-400" />
            </div>
          </div>

          {isRegister && (
            <label className="flex items-start gap-2.5 cursor-pointer mt-1 select-none text-right">
              <input 
                type="checkbox"
                checked={acceptPolicy}
                onChange={(e) => setAcceptPolicy(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-violet-600 rounded cursor-pointer"
                required
              />
              <span className="text-[10px] text-purple-300 leading-relaxed">
                أوافق على <span className="font-bold text-white text-[11px]">سياسة المنصة الفاخرة</span>: عدم التلفظ بعبارات مخلة، احترام القراء الآخرين، عدم سرقة جهود المترجمين، وحفظ كافة الحقوق.
              </span>
            </label>
          )}

          <button 
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-berry-500 text-white rounded-xl text-xs font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-lg shadow-violet-500/20"
          >
            {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
            <span>{isRegister ? 'إنشاء حساب جديد وعضوية قارئ' : 'دخول للمنصة'}</span>
          </button>
        </form>

        {/* Switch mode */}
        <div className="mt-6 pt-4 border-t border-white/5 text-center text-xs text-purple-300">
          {isRegister ? (
            <span>
              لديك حساب بالفعل؟{' '}
              <button onClick={() => setIsRegister(false)} className="text-violet-400 hover:text-violet-300 font-bold underline cursor-pointer">
                تسجيل الدخول هنا
              </button>
            </span>
          ) : (
            <span>
              ليس لديك حساب بعد؟{' '}
              <button onClick={() => setIsRegister(true)} className="text-violet-400 hover:text-violet-300 font-bold underline cursor-pointer">
                أنشئ حساب قارئ الآن
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
