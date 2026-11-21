import React, { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  format,
  parseISO,
} from 'date-fns';
import { X, Calendar as CalendarIcon, ArrowRight, User } from 'lucide-react';
import { DayCell, getStatusBadgeClass } from './DayCell';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * MonthGrid: builds the calendar grid using date-fns with weeks starting on Monday.
 * @param {Object} props
 * @param {Date} props.currentMonth
 * @param {any} [props.calendarData]
 * @param {boolean} [props.isLoading]
 * @param {(taskId: string) => void} [props.onTaskClick]
 */
export const MonthGrid = ({
  currentMonth,
  calendarData = { days: [] },
  isLoading = false,
  onTaskClick = undefined,
}) => {
  const [selectedDayData, setSelectedDayData] = useState(null);

  // Build 7-column grid of days starting on Monday
  const daysInGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Index tasks by plain date string "YYYY-MM-DD" for fast, timezone-safe lookup
  const tasksByDate = useMemo(() => {
    const map = new Map();
    if (calendarData?.days && Array.isArray(calendarData.days)) {
      for (const dayItem of calendarData.days) {
        if (dayItem && dayItem.date) {
          // Normalize date format if ISO timestamp is received
          const dateStr = typeof dayItem.date === 'string' && dayItem.date.includes('T')
            ? format(parseISO(dayItem.date), 'yyyy-MM-dd')
            : dayItem.date;
          map.set(dateStr, dayItem.tasks || []);
        }
      }
    }
    return map;
  }, [calendarData]);

  // Project deadline normalized date string
  const projectDeadlineStr = useMemo(() => {
    if (!calendarData?.projectDeadline) return null;
    const deadline = calendarData.projectDeadline;
    return typeof deadline === 'string' && deadline.includes('T')
      ? format(parseISO(deadline), 'yyyy-MM-dd')
      : deadline;
  }, [calendarData]);

  const handleSelectDay = (dayDate, tasks) => {
    // Only open mobile bottom sheet below md breakpoint
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSelectedDayData({ date: dayDate, tasks });
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Weekday Header: Mon - Sun */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div
          data-testid="month-grid"
          className={`grid grid-cols-7 border-l border-t border-slate-200 relative ${
            isLoading ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          {daysInGrid.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate.get(dateKey) || [];
            const isProjectDeadline = Boolean(projectDeadlineStr && projectDeadlineStr === dateKey);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <DayCell
                key={dateKey}
                dayDate={day}
                isCurrentMonth={isCurrentMonth}
                tasks={dayTasks}
                isProjectDeadline={isProjectDeadline}
                onTaskClick={onTaskClick}
                onSelectDay={handleSelectDay}
              />
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Sheet: Day's Tasks (below md) */}
      {selectedDayData && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs"
            onClick={() => setSelectedDayData(null)}
            aria-hidden="true"
          />

          {/* Sheet Container */}
          <div
            data-testid="mobile-day-sheet"
            className="relative bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 max-h-[80dvh] flex flex-col z-10 safe-bottom animate-slide-up"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {format(selectedDayData.date, 'EEEE, MMMM d, yyyy')}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {selectedDayData.tasks.length} {selectedDayData.tasks.length === 1 ? 'task' : 'tasks'} scheduled
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayData(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                aria-label="Close day sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tasks List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {selectedDayData.tasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No tasks due on this date.
                </div>
              ) : (
                selectedDayData.tasks.map((task) => {
                  const badgeClass = getStatusBadgeClass(task.status);
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedDayData(null);
                        if (onTaskClick) onTaskClick(task.id);
                      }}
                      className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between gap-3 cursor-pointer min-h-[44px]"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          {task.assigneeName ? (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{task.assigneeName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                          {task.status || 'Backlog'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MonthGrid;
