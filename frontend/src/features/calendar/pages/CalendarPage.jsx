import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { addMonths, subMonths, format } from 'date-fns';
import { MonthNav } from '../components/MonthNav';
import { MonthGrid } from '../components/MonthGrid';
import { UpcomingList } from '../components/UpcomingList';
import { useCalendar, useUpcoming } from '../hooks';

/**
 * CalendarPage: displays the project monthly calendar grid alongside upcoming deadlines.
 * Registered as the "calendar" tab in projectTabs.
 */
export const CalendarPage = () => {
  const { projectId: routeProjectId, id: routeId } = useParams();
  const projectId = routeProjectId || routeId || '';

  const navigate = useNavigate();
  const location = useLocation();

  // Current visible month (defaults to current date)
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  // Upcoming deadline filter range (7, 14, 30 days)
  const [withinDays, setWithinDays] = useState(7);

  const monthParam = format(currentMonth, 'yyyy-MM');

  // Fetch calendar data for the visible month
  const {
    data: calendarData,
    isLoading: isLoadingCalendar,
  } = useCalendar(projectId, monthParam);

  // Fetch upcoming deadlines for the selected withinDays window
  const {
    data: upcoming = [],
    isLoading: isLoadingUpcoming,
  } = useUpcoming(projectId, withinDays);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  // Navigates to ?task=<id> on the board route
  const handleTaskClick = (taskId) => {
    if (!taskId) return;
    const basePath = location.pathname.replace(/\/calendar\/?$/, '');
    navigate(`${basePath}/board?task=${taskId}`);
  };

  return (
    <div data-testid="calendar-page" className="space-y-6">
      {/* Month Navigation Header */}
      <MonthNav
        currentMonth={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />

      {/* Main Content Layout: MonthGrid (2/3) + UpcomingList (1/3) on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <MonthGrid
            currentMonth={currentMonth}
            calendarData={calendarData}
            isLoading={isLoadingCalendar}
            onTaskClick={handleTaskClick}
          />
        </div>

        <div className="lg:col-span-1">
          <UpcomingList
            upcoming={upcoming}
            withinDays={withinDays}
            onDaysChange={setWithinDays}
            isLoading={isLoadingUpcoming}
            onTaskClick={handleTaskClick}
          />
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
