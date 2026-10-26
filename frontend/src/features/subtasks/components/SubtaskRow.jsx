import React from 'react';
import { Calendar, User, CheckCircle2, Clock, PlayCircle, Eye, Loader2 } from 'lucide-react';
import { useUpdateTaskStatus } from '../../../hooks/useTasks';
import { categoryConfig, priorityConfig } from '../../../components/TaskCard';

const statusConfig = {
  Backlog: { label: 'Backlog', color: 'text-slate-600 bg-slate-100 border-slate-200' },
  InProgress: { label: 'In Progress', color: 'text-sky-700 bg-sky-50 border-sky-200' },
  Testing: { label: 'Testing', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  Completed: { label: 'Completed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
};

/**
 * Single Subtask row with status select dropdown.
 * Reuses F5's useUpdateTaskStatus hook.
 */
export const SubtaskRow = ({ subtask, projectId = '', memberMap = new Map() }) => {
  const { mutate: updateStatus, isPending } = useUpdateTaskStatus(projectId);

  const isCompleted =
    subtask.status === 'Completed' || (subtask.status || '').toLowerCase() === 'completed';

  const cat = categoryConfig[subtask.category] || categoryConfig.Backend;
  const pri = priorityConfig[subtask.priority] || priorityConfig.Medium;

  // Assignee lookup
  const assignee = subtask.assignedTo ? memberMap.get(subtask.assignedTo) : null;
  const assigneeName = assignee?.userName || subtask.assignedToName || '';

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (newStatus === subtask.status || isPending) return;

    updateStatus({
      projectId,
      taskId: subtask.id,
      status: newStatus,
    });
  };

  return (
    <div
      data-testid={`subtask-row-${subtask.id}`}
      className={`p-3 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
        isCompleted
          ? 'bg-slate-50/70 border-slate-200/60 opacity-80'
          : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="pt-0.5 shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold tracking-tight truncate ${
              isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
          >
            {subtask.title}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
            {/* Category */}
            <span
              className={`inline-flex items-center px-1.5 py-0.2 rounded border font-medium ${cat.bg} ${cat.text} ${cat.border}`}
            >
              {cat.label}
            </span>

            {/* Priority */}
            <span
              className={`inline-flex items-center px-1.5 py-0.2 rounded border font-medium ${pri.badge}`}
            >
              {pri.label}
            </span>

            {/* Deadline */}
            {subtask.deadline && (
              <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{subtask.deadline}</span>
              </span>
            )}

            {/* Assignee */}
            {assigneeName && (
              <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                <User className="w-3 h-3 text-slate-400" />
                <span>{assigneeName}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Select */}
      <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-center">
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />}
        <select
          aria-label={`Status for ${subtask.title}`}
          data-testid={`subtask-status-select-${subtask.id}`}
          value={subtask.status || 'Backlog'}
          onChange={handleStatusChange}
          disabled={isPending}
          className={`text-xs font-semibold px-2.5 py-1 rounded-xl border cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-colors ${
            statusConfig[subtask.status]?.color ||
            'text-slate-700 bg-slate-50 border-slate-200'
          }`}
        >
          <option value="Backlog">Backlog</option>
          <option value="InProgress">In Progress</option>
          <option value="Testing">Testing</option>
          <option value="Completed">Completed</option>
        </select>
      </div>
    </div>
  );
};

export default SubtaskRow;
