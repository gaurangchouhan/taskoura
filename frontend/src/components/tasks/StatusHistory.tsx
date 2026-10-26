import React from 'react';
import { History, ArrowRight, UserCheck, Clock } from 'lucide-react';
import { useStatusLogs } from '../../hooks/useTasks';
import { TaskStatusLog } from '../../types/task';
import { timeAgo } from '../../lib/datetime';

interface StatusHistoryProps {
  taskId: string;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  return timeAgo(dateString);
}

export const StatusHistory: React.FC<StatusHistoryProps> = ({ taskId }) => {
  const { data: logs = [], isLoading } = useStatusLogs(taskId);

  if (isLoading) {
    return (
      <div className="space-y-3 py-2 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-xl" />
        <div className="h-10 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
        <p className="text-sm text-slate-500 font-medium">No status changes recorded yet.</p>
        <p className="text-xs text-slate-400 mt-0.5">Moving this card between columns will generate history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="status-history-timeline">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-sm"
        >
          <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
            <History className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap font-semibold text-slate-800">
              <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-xs font-semibold">
                {log.fromStatus}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-xs font-semibold">
                {log.toStatus}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {log.changedByName || 'Team Member'}
              </span>
              <span>•</span>
              <span title={log.changedAt}>{formatRelativeTime(log.changedAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatusHistory;
