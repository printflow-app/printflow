import { Handshake, Users, Building2, Clock, AlertTriangle } from 'lucide-react';

// =============================================
// TaskBadges — kanban card'idagi yuqori qismdagi pill'lar
// (displayId, vendor, my-task, deadline, branch).
// Topshiriqlar.tsx'dan ajratilgan — qayta foydalanish va o'qish uchun.
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

/** Top row: displayId + vendor + "my task" pill */
export function TaskIdentityBadges({ task, vendor, isMyTask }: IdentityProps) {
  return (
    <div className="flex items-center gap-1.5 mb-2 -mt-0.5 flex-wrap">
      {task.displayId ? (
        <span className="text-[8px] font-bold font-mono bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-md tracking-widest uppercase">
          {task.displayId}
        </span>
      ) : (
        <span className="text-[8px] font-bold font-mono bg-slate-50 text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md tracking-widest">
          #{task.id.slice(-6).toUpperCase()}
        </span>
      )}
      {vendor && (
        <span className="text-[8px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-1 shadow-sm shadow-amber-500/20">
          <Handshake size={7} /> {vendor.name}
        </span>
      )}
      {isMyTask && (
        <span className="text-[8px] font-bold bg-sky-500 text-white px-2 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-1">
          <Users size={7} /> Mening taskım
        </span>
      )}
    </div>
  );
}

interface DeadlineProps {
  task: Task;
  activeBranchId?: string;
  branches: { id: string; name: string }[];
}

/** Deadline + age + cross-branch badges row */
export function TaskDeadlineBadges({ task, activeBranchId, branches }: DeadlineProps) {
  const now = new Date();
  const created = task.createdAt ? new Date(task.createdAt) : null;
  const deadline = task.deadlineAt ? new Date(task.deadlineAt) : null;
  const ageHours = created ? (now.getTime() - created.getTime()) / 3600000 : 0;
  const isPastDeadline = deadline && now > deadline;
  const isDeadlineSoon = deadline && !isPastDeadline && (deadline.getTime() - now.getTime()) < 86400000;
  const isOld = !deadline && ageHours > 10;

  const crossBranch = !activeBranchId && task.branchId
    ? branches.find((b) => b.id === task.branchId)
    : null;

  if (!isPastDeadline && !isDeadlineSoon && !deadline && !isOld && !crossBranch) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {isPastDeadline && (
        <span className="text-[8px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200 uppercase flex items-center gap-1 animate-pulse">
          <AlertTriangle size={8} /> MUDDAT O'TDI
        </span>
      )}
      {isDeadlineSoon && (
        <span className="text-[8px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md border border-orange-200 uppercase flex items-center gap-1">
          <Clock size={8} /> {deadline!.toLocaleDateString('uz-UZ')} {deadline!.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {!isPastDeadline && !isDeadlineSoon && deadline && (
        <span className="text-[8px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 uppercase flex items-center gap-1">
          <Clock size={8} /> {deadline.toLocaleDateString('uz-UZ')} {deadline.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {isOld && (
        <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200 uppercase flex items-center gap-1 animate-pulse">
          <AlertTriangle size={8} /> {Math.floor(ageHours)}S KUTMOQDA
        </span>
      )}
      {crossBranch && (
        <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-200 uppercase flex items-center gap-1">
          <Building2 size={8} /> {crossBranch.name}
        </span>
      )}
    </div>
  );
}
