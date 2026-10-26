import React, { useMemo } from 'react';
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
import { DayCell } from './DayCell';

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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      {/* Weekday Header: Mon - Sun */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider"
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
            />
          );
        })}
      </div>
    </div>
  );
};

export default MonthGrid;
