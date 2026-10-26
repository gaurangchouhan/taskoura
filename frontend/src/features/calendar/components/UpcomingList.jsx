import React from 'react';
import { Clock, User, ArrowUpRight, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getStatusBadgeClass } from './DayCell';

/**
 * Returns CSS classes for the daysRemaining badge.
 * Critical requirement: Red at 0 to 1 days remaining.
 */
export function getDaysRemainingBadgeClass(daysRemaining) {
  const d = Number(daysRemaining);
  if (d <= 1) {
    // Red badge for urgent deadlines (0 or 1 day)
    return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
  }
  if (d <= 3) {
    return 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
}

export function formatDaysRemainingText(daysRemaining) {
  const d = Number(daysRemaining);
  if (d === 0) return 'Due today';
  if (d === 1) return '1 day left';
  return `${d} days left`;
}

/**
 * UpcomingList: lists upcoming task deadlines within 7, 14, or 30 days.
 * @param {Object} props
 * @param {any[]} [props.upcoming]
 * @param {number} [props.withinDays]
 * @param {(days: number) => void} [props.onDaysChange]
 * @param {boolean} [props.isLoading]
 * @param {(taskId: string) => void} [props.onTaskClick]
 */
export const UpcomingList = ({
  upcoming = [],
  withinDays = 7,
  onDaysChange = undefined,
  isLoading = false,
  onTaskClick = undefined,
}) => {
  const dayOptions = [7, 14, 30];

  return (
    <div
      data-testid="upcoming-list"
      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col h-full"
    >
      {/* Header and 7/14/30 Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-slate-900 text-base">Upcoming Deadlines</h3>
        </div>

        {/* Range Selector: 7, 14, 30 days */}
        <div data-testid="within-days-selector" className="inline-flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
          {dayOptions.map((days) => {
            const isActive = Number(withinDays) === days;
            return (
              <button
                key={days}
                type="button"
                data-testid={`days-btn-${days}`}
                onClick={() => onDaysChange && onDaysChange(days)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {days}d
              </button>
            );
          })}
        </div>
      </div>

      {/* List / Empty State */}
      <div className="mt-4 flex-1">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="w-3/4 h-4 bg-slate-200 rounded" />
                  <div className="w-1/3 h-3 bg-slate-100 rounded" />
                </div>
                <div className="w-16 h-6 bg-slate-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div data-testid="empty-upcoming" className="py-12 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nothing due soon</p>
            <p className="text-xs text-slate-400 mt-0.5">
              No tasks due in the next {withinDays} days.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {upcoming.map((task) => {
              const taskId = task.taskId || task.id;
              const formattedDeadline = task.deadline
                ? format(parseISO(task.deadline), 'MMM d')
                : 'No date';
              const daysBadgeClass = getDaysRemainingBadgeClass(task.daysRemaining);
              const statusClass = getStatusBadgeClass(task.status);

              return (
                <div
                  key={taskId}
                  data-testid={`upcoming-item-${taskId}`}
                  onClick={() => onTaskClick && onTaskClick(taskId)}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                        {task.title}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-600 shrink-0 transition-colors" />
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${statusClass}`}>
                        {task.status || 'Backlog'}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3 text-slate-400" />
                        {formattedDeadline}
                      </span>
                      {task.assignedToName && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <User className="w-3 h-3 text-slate-400" />
                          {task.assignedToName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* daysRemaining badge (red if <= 1) */}
                  <span
                    data-testid={`days-badge-${taskId}`}
                    className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 shadow-2xs ${daysBadgeClass}`}
                  >
                    {formatDaysRemainingText(task.daysRemaining)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingList;
