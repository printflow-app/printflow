import { Handshake, Users, Building2, Clock, AlertTriangle } from 'lucide-react';

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

/** Top row: displayId + vendor + "my task" pill */
export function TaskIdentityBadges({ task, vendor, isMyTask }: IdentityProps) {
  return (
    <div className="flex items-center gap-1 mb-1.5 -mt-0.5 flex-wrap">
      <span className="text-[11px] font-medium font-mono text-slate-400">
        {task.displayId || `#${task.id.slice(-6).toUpperCase()}`}
      </span>
      {vendor && (
        <span className="badge-neutral gap-1 text-amber-700 bg-amber-50">
          <Handshake size={10} /> {vendor.name}
        </span>
      )}
      {isMyTask && (
        <span className="badge-neutral gap-1 text-sky-700 bg-sky-50">
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
