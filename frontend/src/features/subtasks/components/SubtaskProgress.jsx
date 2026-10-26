import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * SubtaskProgress component displaying "M of N done" and a visual progress bar.
 * @param {{ subtasks?: Array<{ id: string; status: string }> }} props
 */
export const SubtaskProgress = ({ subtasks = [] }) => {
  const total = subtasks.length;
  if (total === 0) return null;

  const completed = subtasks.filter(
    (s) => s.status === 'Completed' || (s.status || '').toLowerCase() === 'completed'
  ).length;

  const percentage = Math.round((completed / total) * 100);
  const isAllDone = completed === total && total > 0;

  return (
    <div
      data-testid="subtask-progress"
      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-3"
    >
      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
        <span
          data-testid="subtask-progress-label"
          className="text-slate-700 flex items-center gap-1.5"
        >
          {isAllDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          <span>{completed} of {total} done</span>
        </span>
        <span
          data-testid="subtask-progress-percent"
          className={isAllDone ? 'text-emerald-600 font-bold' : 'text-slate-500'}
        >
          {percentage}%
        </span>
      </div>

      <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
        <div
          data-testid="subtask-progress-bar"
          className={`h-full rounded-full transition-all duration-300 ${
            isAllDone
              ? 'bg-emerald-500'
              : percentage > 0
              ? 'bg-gradient-to-r from-sky-500 to-indigo-500'
              : 'bg-transparent'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default SubtaskProgress;
