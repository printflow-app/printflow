import { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  size = 'md',
}: TabsProps<T>) {
  const isSm = size === 'sm';

  return (
    <div
      className={`inline-flex items-center gap-1 bg-slate-100 p-1 rounded-card border border-slate-200/50 max-w-full overflow-x-auto no-scrollbar ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-control font-medium transition-all duration-120 select-none whitespace-nowrap ${
              isSm
                ? 'px-3 py-1.5 text-xs h-[30px]'
                : 'px-4 py-2 text-sm h-[34px]'
            } ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {Icon && (
              <Icon
                size={isSm ? 14 : 16}
                className={isActive ? 'text-orange-600' : 'text-slate-500'}
              />
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  isActive
                    ? 'bg-orange-50 text-orange-700'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
