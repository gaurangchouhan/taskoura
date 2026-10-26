import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

/**
 * MonthNav: previous, next, today navigation.
 * Displays formatted month & year and triggers visible month updates.
 */
export const MonthNav = ({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
}) => {
  const monthTitle = format(currentMonth, 'MMMM yyyy');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-2">
      {/* Month & Year Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-xs">
          <CalendarIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 data-testid="calendar-month-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {monthTitle}
          </h2>
          <span className="text-xs text-slate-500 font-medium">Weeks start on Monday</span>
        </div>
      </div>

      {/* Nav Controls: Prev, Today, Next */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onToday}
          className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          Today
        </button>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default MonthNav;
