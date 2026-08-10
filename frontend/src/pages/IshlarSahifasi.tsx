import React from 'react';
import Topshiriqlar from './Topshiriqlar';
import Vazifalar from './Vazifalar';

// =============================================
// ISHLAR — Kanban va Jamoa vazifalari bitta sahifada, ikki tab.
//
// Ilgari ular chap menyuda ikkita alohida band edi va bir-biriga
// bog'liqligi ko'rinmasdi: Jamoa doskasida buyurtmalar ham chiqadi,
// lekin ularning bosqichi aynan Kanbanda boshqariladi. Endi ikkalasi
// bir sahifada — o'tish uchun menyuga qaytish shart emas.
//
// URL saqlanib qoldi: /dashboard/topshiriqlar va /dashboard/vazifalar
// ikkalasi ham ishlaydi, faqat ochiladigan tab boshqa. Shu sabab eski
// havolalar, tour qadamlari va Ctrl+K qidiruvi buzilmadi.
//
// RUXSAT: ikki bo'lim ikki xil ruxsatga tegishli (canViewTasks va
// canViewTeamTasks). Ruxsati yo'q tab umuman ko'rsatilmaydi — mavjud
// bo'lmagan sahifaga olib boradigan tugma chiqmasligi kerak.
// =============================================

type Bolim = 'kanban' | 'vazifalar';

const IshlarSahifasi: React.FC<{
  currentUser: any;
  activeBranchId?: string;
  bolim: Bolim;
  onBolim: (b: Bolim) => void;
}> = ({ currentUser, activeBranchId, bolim, onBolim }) => {
  const p = currentUser?.permissions || {};
  const isAdmin =
    currentUser?.role?.name?.toLowerCase() === 'admin' ||
    currentUser?.login === 'admin';

  const kanbanKorish = p.canViewTasks || isAdmin;
  const vazifaKorish = p.canViewTeamTasks || isAdmin;

  // Ruxsati bo'lmagan bo'limga tushib qolgan bo'lsa — ruxsat bori ochiladi.
  const joriy: Bolim =
    bolim === 'vazifalar' && !vazifaKorish ? 'kanban'
    : bolim === 'kanban' && !kanbanKorish ? 'vazifalar'
    : bolim;

  const ikkalasiHam = kanbanKorish && vazifaKorish;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tab qatori faqat ikkala bo'lim ham ochiq bo'lsa ko'rinadi —
          bitta tanlovli "tanlov" paneli chalg'itadi. */}
      {ikkalasiHam && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => onBolim('kanban')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${joriy === 'kanban' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Xizmatlar (Kanban)
          </button>
          <button
            onClick={() => onBolim('vazifalar')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${joriy === 'vazifalar' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Jamoa vazifalari
          </button>
        </div>
      )}

      {joriy === 'kanban' && kanbanKorish && (
        <Topshiriqlar currentUser={currentUser} activeBranchId={activeBranchId} />
      )}
      {joriy === 'vazifalar' && vazifaKorish && (
        <Vazifalar currentUser={currentUser} activeBranchId={activeBranchId} />
      )}
    </div>
  );
};

export default IshlarSahifasi;
