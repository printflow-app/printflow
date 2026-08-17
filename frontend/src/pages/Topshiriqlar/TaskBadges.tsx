import { useState } from 'react';
import { Handshake, Users, Building2, Clock, AlertTriangle, Copy, Check } from 'lucide-react';

// =============================================
// TaskBadges — kanban card'idagi yuqori qismdagi pill'lar
// (displayId, vendor, my-task, deadline, branch).
// Topshiriqlar.tsx'dan ajratilgan — qayta foydalanish va o'qish uchun.
// Dizayn tizimi: 11px, normal registr (sana/raqam), rang = semantik holat.
// =============================================

interface Task {
  id: string;
  displayId?: string | null;
  createdAt: string;
  deadlineAt?: string | null;
  branchId?: string | null;
}

interface IdentityProps {
  task: Task;
  vendor?: { name: string } | null;
  isMyTask: boolean;
}

/**
 * BUYURTMA ID — ko'rinadigan va nusxa olinadigan.
 *
 * Ilgari bu oddiy so'nik kulrang matn edi (`text-slate-400`) va umuman
 * bosilmasdi: ID kundalik ishda mijozga yuborish uchun kerak, lekin uni
 * qo'lda belgilab nusxa olishga to'g'ri kelardi. Endi brend rangidagi
 * tugmacha: ko'zga tashlanadi, yonidagi ikonka bosilishini bildiradi.
 *
 * `stopPropagation` shart — pill kartochkaning ichida, aks holda bosilganda
 * buyurtma tafsiloti oynasi ochilib ketadi.
 */
function IdPill({ id }: { id: string }) {
  const [nusxalandi, setNusxalandi] = useState(false);

  const nusxaOl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setNusxalandi(true);
      setTimeout(() => setNusxalandi(false), 1500);
    } catch {
      // Clipboard API yopiq (HTTPS emas yoki ruxsat berilmagan) — hech
      // bo'lmasa matn ko'rinib turadi, foydalanuvchi qo'lda belgilay oladi.
    }
  };

  return (
    <button
      type="button"
      onClick={nusxaOl}
      title={nusxalandi ? 'Nusxalandi' : 'ID dan nusxa olish'}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold font-mono tracking-tight transition-colors ${
        nusxalandi
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300'
      }`}
    >
      {nusxalandi ? <Check size={10} strokeWidth={3} /> : <Copy size={10} className="opacity-70" />}
      {id}
    </button>
  );
}

/** Top row: displayId + vendor + "my task" pill */
export function TaskIdentityBadges({ task, vendor, isMyTask }: IdentityProps) {
  return (
    <div className="flex items-center gap-1 mb-1.5 -mt-0.5 flex-wrap">
      <IdPill id={task.displayId || `#${task.id.slice(-6).toUpperCase()}`} />
      {vendor && (
        <span className="badge-neutral gap-1 text-amber-700 bg-amber-50">
          <Handshake size={10} /> {vendor.name}
        </span>
      )}
      {isMyTask && (
        <span className="badge-neutral gap-1 text-slate-700 bg-slate-50">
          <Users size={10} /> Menda
        </span>
      )}
    </div>
  );
}

interface DeadlineProps {
  task: Task;
  activeBranchId?: string;
  branches: { id: string; name: string }[];
  /** Buyurtma "bajarildi" ustunidami — muddat ogohlantirishi berilmaydi. */
  bajarilgan?: boolean;
}

/** Deadline + age + cross-branch badges row */
export function TaskDeadlineBadges({ task, activeBranchId, branches, bajarilgan }: DeadlineProps) {
  const now = new Date();
  const created = task.createdAt ? new Date(task.createdAt) : null;
  const deadline = task.deadlineAt ? new Date(task.deadlineAt) : null;
  const ageHours = created ? (now.getTime() - created.getTime()) / 3600000 : 0;

  // TOPSHIRILGAN BUYURTMA KECHIKKAN BO'LMAYDI.
  //
  // Ilgari bu yer faqat sanaga qarardi: ish allaqachon topshirilgan
  // bo'lsa ham, muddati o'tgan bo'lsa karta qizarib "Muddat o'tdi" deb
  // turardi. Doskaning yarmi doim qizil bo'lib, ogohlantirish ma'nosini
  // yo'qotardi — haqiqatan kechikkan ish ko'zga tashlanmasdi.
  // Bajarilgan ustunda muddat oddiy sana bo'lib ko'rsatiladi.
  const isPastDeadline = !bajarilgan && deadline && now > deadline;
  const isDeadlineSoon = !bajarilgan && deadline && !isPastDeadline && (deadline.getTime() - now.getTime()) < 86400000;
  const isOld = !bajarilgan && !deadline && ageHours > 10;

  const crossBranch = !activeBranchId && task.branchId
    ? branches.find((b) => b.id === task.branchId)
    : null;

  if (!isPastDeadline && !isDeadlineSoon && !deadline && !isOld && !crossBranch) return null;

  const fmtDl = (d: Date) =>
    `${d.toLocaleDateString('uz-UZ')} ${d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {isPastDeadline && (
        <span className="badge-danger gap-1">
          <AlertTriangle size={10} /> Muddat o'tdi
        </span>
      )}
      {isDeadlineSoon && (
        <span className="badge-primary gap-1">
          <Clock size={10} /> {fmtDl(deadline!)}
        </span>
      )}
      {!isPastDeadline && !isDeadlineSoon && deadline && (
        <span className="badge-neutral gap-1">
          <Clock size={10} /> {fmtDl(deadline)}
        </span>
      )}
      {isOld && (
        <span className="badge-primary gap-1">
          <AlertTriangle size={10} /> {Math.floor(ageHours)} soat kutmoqda
        </span>
      )}
      {crossBranch && (
        <span className="badge-neutral gap-1">
          <Building2 size={10} /> {crossBranch.name}
        </span>
      )}
    </div>
  );
}
