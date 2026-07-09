import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد الحذف',
  cancelText = 'إلغاء',
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-[#14101D] border border-white/10 rounded-3xl overflow-hidden text-right shadow-2xl animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-5">
        
        {/* Icon & Title */}
        <div className="flex items-start gap-4 flex-row-reverse">
          <div className={`p-3 rounded-2xl shrink-0 ${danger ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-white">{title}</h3>
            <p className="text-xs text-purple-200/80 mt-2 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5 justify-end mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all select-none shadow-lg ${
              danger 
                ? 'bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white shadow-red-600/10' 
                : 'bg-gradient-to-r from-violet-600 to-berry-500 hover:from-violet-500 hover:to-berry-400 text-white shadow-violet-500/10'
            }`}
          >
            <Check size={14} />
            <span>{confirmText}</span>
          </button>
        </div>
        
      </div>
    </div>
  );
}
