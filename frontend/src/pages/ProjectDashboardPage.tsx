import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Layers,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  LayoutDashboard,
  Loader2,
} from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { StatCard } from '../components/dashboard/StatCard';
import { CompletionRing } from '../components/dashboard/CompletionRing';
import { StatusDonut } from '../components/dashboard/StatusDonut';
import { MemberBars } from '../components/dashboard/MemberBars';
import { UpcomingDeadlines } from '../components/dashboard/UpcomingDeadlines';
import { NextTaskCard } from '../components/ai/NextTaskCard';

export const ProjectDashboardPage: React.FC = () => {
  const { projectId: routeProjectId, id: routeId } = useParams<{
    projectId?: string;
    id?: string;
  }>();
  const projectId = routeProjectId || routeId || '';

  const { data: dashboard, isLoading, error } = useDashboard(projectId);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-sky-600" />
        <span className="text-sm font-medium">Loading project metrics...</span>
      </div>
    );
  }

  const stats = dashboard || {
    totalTasks: 0,
    completedTasks: 0,
    completionPercentage: 0,
    tasksByStatus: { Backlog: 0, InProgress: 0, Testing: 0, Completed: 0 },
    tasksByMember: [],
    upcomingDeadlines: [],
  };

  // Calculate overdue tasks count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = stats.upcomingDeadlines.filter((d) => {
    try {
      return new Date(d.deadline) < today;
    } catch {
      return false;
    }
  }).length;

  const inProgressCount = stats.tasksByStatus.InProgress ?? 0;

  return (
    <div data-testid="project-dashboard-page" className="space-y-8 pb-16">
      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Sprint Dashboard</h2>
            <p className="text-xs text-slate-500">Live analytics, progress completion and deadline tracker</p>
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
          {stats.totalTasks} Total Tasks
        </span>
      </div>

      {/* AI Recommendation Banner */}
      <NextTaskCard projectId={projectId} />

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tasks"
          value={stats.totalTasks}
          icon={Layers}
          color="sky"
          subtitle="Top-level sprint tasks"
          testId="stat-total-tasks"
        />
        <StatCard
          title="Completed"
          value={stats.completedTasks}
          icon={CheckCircle2}
          color="emerald"
          badge={`${stats.completionPercentage}%`}
          subtitle="Finished deliverables"
          testId="stat-completed-tasks"
        />
        <StatCard
          title="In Progress"
          value={inProgressCount}
          icon={PlayCircle}
          color="indigo"
          subtitle="Active development"
          testId="stat-inprogress-tasks"
        />
        <StatCard
          title="Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          color="rose"
          subtitle="Target date elapsed"
          testId="stat-overdue-tasks"
        />
      </div>

      {/* Sprint Progress Ring & Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CompletionRing
            completedTasks={stats.completedTasks}
            totalTasks={stats.totalTasks}
            completionPercentage={stats.completionPercentage}
          />
        </div>
        <div className="lg:col-span-2">
          <StatusDonut tasksByStatus={stats.tasksByStatus} />
        </div>
      </div>

      {/* Member Workload & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MemberBars tasksByMember={stats.tasksByMember} />
        <UpcomingDeadlines projectId={projectId} deadlines={stats.upcomingDeadlines} />
      </div>
    </div>
  );
};

export default ProjectDashboardPage;
