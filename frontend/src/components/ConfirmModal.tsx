import React from 'react';
import Modal from './Modal';

// =============================================
// TASDIQLASH OYNASI
//
// Brauzerning `confirm()` va `alert()` iga o'rin qolmasligi uchun.
// Ular uch sababdan yaramaydi: ko'rinishi tizimning qolganiga o'xshamaydi,
// matni ingliz tilidagi tugmalar bilan chiqadi, va sahifani butunlay
// bloklaydi — mobil brauzerlarda esa ba'zan umuman ko'rsatilmaydi
// ("bu sayt yana dialog ko'rsatmasin" katagi bosilgan bo'lsa jimgina
// `false` qaytaradi va tugma ishlamay qo'yadi).
//
// Sahifalar ilgari har biri o'z `confirmModal` holatini yozar edi. Bu
// komponent shu takrorni yig'adi: holat baribir chaqiruvchida qoladi
// (qaysi yozuv o'chirilayotganini u biladi), lekin ko'rinish bitta joyda.
// =============================================

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  /** Asosiy savol. Uzun tushuntirish uchun `children` dan foydalaning. */
  message?: React.ReactNode;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** O'chirish kabi qaytarib bo'lmaydigan amallar uchun — qizil tugma. */
  danger?: boolean;
  /** So'rov ketayotganda tugmani bloklaydi (ikki marta bosilmasin). */
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  children,
  confirmText = 'Ha',
  cancelText = 'Bekor',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    type={danger ? 'danger' : 'warning'}
    maxWidth="max-w-sm"
  >
    {message && (
      <p className="text-sm font-semibold text-slate-600 leading-relaxed">{message}</p>
    )}
    {children}
    <div className="flex gap-3 pt-5 mt-4 border-t border-slate-100">
      <button type="button" onClick={onClose} className="btn-outline flex-1">
        {cancelText}
      </button>
      <button
        type="button"
        autoFocus
        disabled={busy}
        onClick={onConfirm}
        className={`flex-1 ${danger ? 'btn-danger-solid' : 'btn-primary'}`}
      >
        {busy && (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {confirmText}
      </button>
    </div>
  </Modal>
);

export default ConfirmModal;
