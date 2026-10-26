import React, { useState, useRef, useEffect } from 'react';
import { format, isToday } from 'date-fns';
import { Flag, X, ArrowUpRight, User, CheckCircle2 } from 'lucide-react';

export function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('progress')) {
    return 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100';
  }
  if (s.includes('review')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
  }
  if (s.includes('complete') || s.includes('done')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 line-through';
  }
  if (s.includes('block')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
}

/**
 * DayCell: displays a single day in the MonthGrid.
 * @param {Object} props
 * @param {Date} props.dayDate
 * @param {boolean} [props.isCurrentMonth]
 * @param {any[]} [props.tasks]
 * @param {boolean} [props.isProjectDeadline]
 * @param {(taskId: string) => void} [props.onTaskClick]
 */
export const DayCell = ({
  dayDate,
  isCurrentMonth = true,
  tasks = [],
  isProjectDeadline = false,
  onTaskClick = undefined,
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef(null);

  const formattedDayNumber = format(dayDate, 'd');
  const dateKey = format(dayDate, 'yyyy-MM-dd');
  const isCurrentDay = isToday(dayDate);

  const maxVisibleTasks = 3;
  const visibleTasks = tasks.slice(0, maxVisibleTasks);
  const extraCount = tasks.length - maxVisibleTasks;

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  const handleChipClick = (e, taskId) => {
    e.stopPropagation();
    if (onTaskClick) {
      onTaskClick(taskId);
    }
  };

  return (
    <div
      data-testid={`day-cell-${dateKey}`}
      className={`min-h-[110px] sm:min-h-[125px] p-1.5 sm:p-2 border-b border-r border-slate-200 relative flex flex-col justify-between transition-colors ${
        !isCurrentMonth ? 'bg-slate-50/70 text-slate-400' : 'bg-white text-slate-800'
      } ${isCurrentDay ? 'bg-sky-50/30' : ''}`}
    >
      {/* Top Header: Day Number + Optional Project Deadline Marker */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <span
          className={`text-xs font-semibold inline-flex items-center justify-center ${
            isCurrentDay
              ? 'w-6 h-6 rounded-full bg-sky-600 text-white shadow-xs font-bold'
              : isCurrentMonth
              ? 'text-slate-700'
              : 'text-slate-400'
          }`}
        >
          {formattedDayNumber}
        </span>

        {isProjectDeadline && (
          <span
            data-testid="project-deadline-marker"
            title="Project Deadline"
            className="inline-flex items-center gap-1 text-[10px] font-bold tracking-tight text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs"
          >
            <Flag className="w-2.5 h-2.5 text-amber-700" />
            <span className="hidden sm:inline">Deadline</span>
          </span>
        )}
      </div>

      {/* Task Chips Container */}
      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
        {visibleTasks.map((task) => {
          const badgeClass = getStatusBadgeClass(task.status);
          return (
            <button
              key={task.id}
              type="button"
              data-testid={`task-chip-${task.id}`}
              onClick={(e) => handleChipClick(e, task.id)}
              className={`w-full text-left truncate text-[11px] font-medium px-1.5 py-0.5 rounded border transition-colors cursor-pointer shadow-2xs ${badgeClass}`}
              title={`${task.title} (${task.status || 'No status'})`}
            >
              {task.title}
            </button>
          );
        })}

        {/* "+N more" Button */}
        {extraCount > 0 && (
          <button
            type="button"
            data-testid="more-tasks-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowPopover(true);
            }}
            className="text-left text-[11px] font-semibold text-sky-700 hover:text-sky-800 hover:underline px-1 py-0.5 rounded cursor-pointer whitespace-nowrap mt-auto"
          >
            +{extraCount} more
          </button>
        )}
      </div>

      {/* Popover for All Tasks on this Day */}
      {showPopover && (
        <div
          ref={popoverRef}
          data-testid="day-popover"
          className="absolute z-30 left-2 right-2 top-2 bg-white rounded-xl shadow-xl border border-slate-200 p-3 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <span className="text-xs font-bold text-slate-800">
              {format(dayDate, 'MMMM d, yyyy')} ({tasks.length} tasks)
            </span>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                data-testid={`popover-task-${task.id}`}
                onClick={(e) => {
                  setShowPopover(false);
                  handleChipClick(e, task.id);
                }}
                className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-900 truncate">
                    {task.title}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${getStatusBadgeClass(task.status)}`}>
                    {task.status || 'Backlog'}
                  </span>
                  {task.assignedToName && (
                    <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                      <User className="w-2.5 h-2.5" />
                      {task.assignedToName}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DayCell;
