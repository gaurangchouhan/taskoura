import React from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Activity as ActivityIcon } from 'lucide-react';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { useActivity } from '../hooks/useActivity';
import { useMemberMap } from '../hooks/useMembers';
import { Project } from '../types/project';

export const ActivityPage: React.FC = () => {
  const { projectId: routeProjectId, id: routeId } = useParams<{ projectId?: string; id?: string }>();
  const projectId = routeProjectId || routeId || '';

  let outletContext: { project?: Project } | null = null;
  try {
    outletContext = useOutletContext<{ project?: Project } | null>();
  } catch {
    outletContext = null;
  }

  const { data: activities = [], isLoading } = useActivity(projectId);
  const memberMap = useMemberMap(projectId);

  return (
    <div data-testid="activity-page" className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs">
            <ActivityIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Project Activity Audit</h2>
            <p className="text-xs text-slate-500">Live chronological trail of team operations and state changes</p>
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
          {activities.length} total events
        </span>
      </div>

      {/* Activity Feed */}
      <ActivityFeed
        activities={activities}
        memberMap={memberMap}
        isLoading={isLoading}
      />
    </div>
  );
};

export default ActivityPage;
