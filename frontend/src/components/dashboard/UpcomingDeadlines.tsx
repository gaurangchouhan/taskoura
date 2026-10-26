import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, AlertTriangle, ArrowRight, User } from 'lucide-react';
import { UpcomingDeadline } from '../../types/dashboard';

interface UpcomingDeadlinesProps {
  projectId: string;
  deadlines: UpcomingDeadline[];
}

export const UpcomingDeadlines: React.FC<UpcomingDeadlinesProps> = ({
  projectId,
  deadlines,
}) => {
  const navigate = useNavigate();

  const handleDeadlineClick = (taskId: string) => {
    navigate(`/app/projects/${projectId}/board?task=${taskId}`);
  };

  const isOverdue = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d < today;
    } catch {
      return false;
    }
  };

  return (
    <div
      data-testid="upcoming-deadlines"
      className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Upcoming Deadlines
            </h3>
            <p className="text-xs text-slate-400">Critical deliverables and sprint targets</p>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {deadlines.length} Due
        </span>
      </div>

      {deadlines.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-1">
          <Clock className="w-6 h-6 stroke-[1.5] mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-medium">No deadlines scheduled</p>
          <p className="text-[11px]">Tasks with target dates will appear here</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto">
          {deadlines.map((d) => {
            const overdue = isOverdue(d.deadline);

            return (
              <div
                key={d.taskId}
                data-testid={`deadline-item-${d.taskId}`}
                onClick={() => handleDeadlineClick(d.taskId)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                  overdue
                    ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/80 hover:border-rose-300'
                    : 'border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate group-hover:text-sky-600 transition-colors">
                      {d.title}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Overdue</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{d.deadline}</span>
                    </span>

                    {d.status && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        {d.status}
                      </span>
                    )}

                    {d.priority && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        {d.priority}
                      </span>
                    )}

                    {d.assignedToName && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{d.assignedToName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UpcomingDeadlines;
