import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  subtitle?: string;
  badge?: string;
  color?: 'sky' | 'emerald' | 'amber' | 'rose' | 'indigo';
  testId?: string;
}

const colorStyles = {
  sky: {
    iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
    border: 'border-slate-200/80 hover:border-sky-300',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    border: 'border-slate-200/80 hover:border-emerald-300',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
    border: 'border-slate-200/80 hover:border-amber-300',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
    border: 'border-slate-200/80 hover:border-rose-300',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  indigo: {
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    border: 'border-slate-200/80 hover:border-indigo-300',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  badge,
  color = 'sky',
  testId,
}) => {
  const styles = colorStyles[color];

  return (
    <div
      data-testid={testId || `stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className={`p-5 rounded-2xl bg-white border ${styles.border} shadow-xs hover:shadow-md transition-all flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {title}
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight block">
            {value}
          </span>
        </div>

        <div
          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${styles.iconBg}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtitle || badge) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {badge && (
            <span className={`px-2 py-0.5 rounded-full font-semibold border text-[11px] ${styles.badge}`}>
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
