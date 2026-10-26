import React from 'react';
import { ProjectBoardPage } from '../../pages/ProjectBoardPage';
import { ProjectDashboardPage } from '../../pages/ProjectDashboardPage';
import { CalendarPage } from '../../features/calendar/pages/CalendarPage';
import { TeamPage } from '../../pages/TeamPage';
import { ActivityPage } from '../../pages/ActivityPage';
import { ReportPage } from '../../pages/ReportPage';

export interface ProjectTab {
  key: string;
  label: string;
  path: string;
  element: React.ReactNode;
  ownerOnly?: boolean;
}

export const projectTabs: ProjectTab[] = [
  {
    key: 'board',
    label: 'Board',
    path: '',
    element: React.createElement(ProjectBoardPage),
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: 'dashboard',
    element: React.createElement(ProjectDashboardPage),
  },
  {
    key: 'calendar',
    label: 'Calendar',
    path: 'calendar',
    element: React.createElement(CalendarPage),
  },
  {
    key: 'team',
    label: 'Team',
    path: 'team',
    element: React.createElement(TeamPage),
  },
  {
    key: 'activity',
    label: 'Activity',
    path: 'activity',
    element: React.createElement(ActivityPage),
  },
  {
    key: 'report',
    label: 'Report',
    path: 'report',
    element: React.createElement(ReportPage),
    ownerOnly: true,
  },
];

export default projectTabs;
