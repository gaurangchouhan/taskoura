import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface CompletionRingProps {
  completedTasks: number;
  totalTasks: number;
  completionPercentage?: number;
  size?: number;
  strokeWidth?: number;
}

export const CompletionRing: React.FC<CompletionRingProps> = ({
  completedTasks = 0,
  totalTasks = 0,
  completionPercentage,
  size = 140,
  strokeWidth = 12,
}) => {
  // Guard against divide-by-zero or NaN when totalTasks is 0
  const safePercentage = totalTasks > 0
    ? (typeof completionPercentage === 'number' && !isNaN(completionPercentage)
        ? Math.min(100, Math.max(0, completionPercentage))
        : Math.min(100, Math.max(0, Math.round((completedTasks / totalTasks) * 10000) / 100)))
    : 0;

  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div
      data-testid="completion-ring"
      className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center space-y-4"
    >
      <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Sprint Completion
        </h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {completedTasks}/{totalTasks} tasks
        </span>
      </div>

      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#completionGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
          <defs>
            <linearGradient id="completionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            data-testid="completion-ring-percentage"
            className="text-2xl font-black text-slate-900 tracking-tight"
          >
            {safePercentage}%
          </span>
          <span className="text-[11px] font-semibold text-slate-400 -mt-0.5">
            Done
          </span>
        </div>
      </div>

      {totalTasks === 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>No tasks in sprint yet</span>
        </div>
      ) : safePercentage === 100 ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Sprint fully achieved!</span>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {totalTasks - completedTasks} remaining deliverable{totalTasks - completedTasks !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default CompletionRing;
