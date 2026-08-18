import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, LogIn } from 'lucide-react';
import { attendanceApi } from '../api';

const ScanAttendance: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'not_logged_in'>('loading');
  const [message, setMessage] = useState('Skaner tekshirilmoqda...');

  useEffect(() => {
    const processScan = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
          setStatus('error');
          setMessage('Token eskirgan yoki yaroqsiz.');
          return;
        }

        if (!currentUser || !currentUser.id) {
          setStatus('not_logged_in');
          setMessage('Tizimga kirilmagan');
          return;
        }

        // JOYLASHUV MAJBURIY.
        //
        // Ilgari bu sahifa faqat token yuborardi, koordinatasiz. Backend esa
        // koordinata bo'lmasa hudud tekshiruvini o'tkazib yuborardi — ya'ni
        // QR rasmini uydan skanerlab davomat belgilash mumkin edi. Geofence
        // bor deb o'ylangan, amalda esa uni chetlab o'tish uchun hech narsa
        // qilish kerak emasdi.
        let geo: { lat: number; lng: number };
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              maximumAge: 0,
            }),
          );
          geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (geoErr: any) {
          setStatus('error');
          setMessage(
            geoErr?.code === 1
              ? "Joylashuvga ruxsat berilmadi. Davomat belgilash uchun brauzerda lokatsiyani yoqing."
              : "Joylashuv aniqlanmadi. Ochiq joyda qayta urinib ko'ring.",
          );
          return;
        }

        const res = await attendanceApi.checkIn({ employeeId: currentUser.id, token, ...geo });

        setStatus('success');
        if (res.data && res.data.checkOut) {
          setMessage("Siz muvaffaqiyatli ketdi (Check-out) deb belgilandingiz");
        } else {
          setMessage("Siz muvaffaqiyatli keldi (Check-in) deb belgilandingiz");
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.response?.data?.message || err?.message || 'Davomatni qayd etishda xatolik yuz berdi!');
      }
    };

    processScan();
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-sm w-full p-8 sm:p-10 rounded-card border border-slate-200 shadow-sm flex flex-col items-center text-center">

        {status === 'loading' && (
          <div className="flex flex-col items-center py-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-5">
              <Loader2 size={20} className="animate-spin" />
            </div>
            <h2 className="page-title">Skaner tekshirilmoqda...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center w-full py-2 animate-pop">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-5">
              <CheckCircle2 size={20} />
            </div>
            <h2 className="page-title mb-2">Davomat qayd etildi!</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-[250px]">
              {message}
            </p>

            <button
              onClick={() => window.location.href = '/'}
              className="btn-primary h-lg w-full"
            >
              Asosiy sahifaga o'tish
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {status === 'not_logged_in' && (
          <div className="flex flex-col items-center w-full py-2 animate-pop">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-5">
              <AlertCircle size={20} />
            </div>
            <h2 className="page-title mb-2">Iltimos, avval tizimga kiring</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-[250px]">
              {message}
            </p>

            <button
              onClick={() => window.location.href = '/'}
              className="btn-primary h-lg w-full mb-3"
            >
              Tizimga kirish
              <LogIn size={18} />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center w-full py-2 animate-pop">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-5">
              <AlertCircle size={20} />
            </div>
            <h2 className="page-title mb-2">Xatolik</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-[250px]">
              {message}
            </p>

            <button
              onClick={() => window.location.href = '/'}
              className="btn-outline h-lg w-full"
            >
              Asosiy sahifaga o'tish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanAttendance;
