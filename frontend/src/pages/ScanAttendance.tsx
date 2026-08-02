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
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-sm w-full p-8 sm:p-10 rounded-3xl shadow-xl flex flex-col items-center text-center">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-6" />
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Skaner tekshirilmoqda...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center w-full py-2 animate-in fade-in zoom-in duration-500">
            <CheckCircle2 className="w-20 h-20 text-emerald-500 mb-6" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Davomat qayd etildi!</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed max-w-[250px]">
              {message}
            </p>
            
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl transition-colors shadow-md flex items-center justify-center gap-2"
            >
              Asosiy sahifaga o'tish
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {status === 'not_logged_in' && (
          <div className="flex flex-col items-center w-full py-2 animate-in fade-in zoom-in duration-500">
            <AlertCircle className="w-20 h-20 text-rose-500 mb-6" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Iltimos, avval tizimga kiring</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed max-w-[250px]">
              {message}
            </p>
            
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl transition-colors shadow-md flex items-center justify-center gap-2 mb-3"
            >
              Tizimga kirish
              <LogIn className="w-5 h-5" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center w-full py-2 animate-in fade-in zoom-in duration-500">
            <AlertCircle className="w-20 h-20 text-rose-500 mb-6" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Xatolik</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed max-w-[250px]">
              {message}
            </p>
            
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
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
