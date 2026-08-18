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

import Tabs from '../components/ui/Tabs';
import { Kanban, CheckSquare } from 'lucide-react';

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
      {/* Tab qatori faqat ikkala bo'lim ham ochiq bo'lsa ko'rinadi */}
      {ikkalasiHam && (
        <Tabs<Bolim>
          tabs={[
            { id: 'kanban', label: 'Xizmatlar (Kanban)', icon: Kanban },
            { id: 'vazifalar', label: 'Jamoa vazifalari', icon: CheckSquare },
          ]}
          activeTab={joriy}
          onChange={onBolim}
        />
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
