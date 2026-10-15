import React from 'react';
import { Task, KanbanStatus } from '../types';
import { TaskCard } from './TaskCard';
import { Clock, PlayCircle, Eye, CheckCircle2, Plus } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: KanbanStatus) => void;
  className?: string;
  isHeroPreview?: boolean;
}

export const columnDefinitions: Array<{
  id: KanbanStatus;
  title: string;
  color: string;
  bgLight: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: React.ElementType;
}> = [
  {
    id: 'Backlog',
    title: 'Backlog',
    color: '#64748b',
    bgLight: 'bg-slate-50/70',
    badgeBg: 'bg-slate-200/70',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-300/80',
    icon: Clock,
  },
  {
    id: 'InProgress',
    title: 'In Progress',
    color: '#0284c7',
    bgLight: 'bg-sky-50/70',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    borderColor: 'border-sky-300/80',
    icon: PlayCircle,
  },
  {
    id: 'Review',
    title: 'Review',
    color: '#d97706',
    bgLight: 'bg-amber-50/70',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-300/80',
    icon: Eye,
  },
  {
    id: 'Completed',
    title: 'Completed',
    color: '#059669',
    bgLight: 'bg-emerald-50/70',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    borderColor: 'border-emerald-300/80',
    icon: CheckCircle2,
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onAddTask,
  className = '',
  isHeroPreview = false,
}) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full ${className}`}
    >
      {columnDefinitions.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        const Icon = col.icon;

        return (
          <div
            key={col.id}
            data-column-id={col.id}
            className={`flex flex-col rounded-2xl border ${col.borderColor} ${col.bgLight} backdrop-blur-md p-3 transition-all duration-300 shadow-sm`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <h3 className="font-semibold text-xs tracking-tight text-slate-800 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color: col.color }} />
                  <span>{col.title}</span>
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badgeBg} ${col.badgeText}`}
                >
                  {colTasks.length}
                </span>

                {onAddTask && (
                  <button
                    onClick={() => onAddTask(col.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
                    title={`Add task to ${col.title}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Task list container */}
            <div className="flex flex-col gap-2.5 min-h-[160px] flex-1 overflow-y-auto max-h-[480px] pr-0.5">
              {colTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 border border-dashed border-slate-300/70 rounded-xl text-slate-400 text-[11px]">
                  <span>No tasks yet</span>
                </div>
              ) : (
                colTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className={onTaskClick ? 'cursor-pointer' : ''}
                  >
                    <TaskCard task={task} compact={isHeroPreview} />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
