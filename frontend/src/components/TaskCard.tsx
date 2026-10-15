import React from 'react';
import { 
  Code2, 
  Server, 
  Database, 
  CheckCircle2, 
  FileText, 
  Bug, 
  Calendar, 
  AlertCircle,
  Clock,
  Layers
} from 'lucide-react';
import { Task, TaskCategory, Priority } from '../types';

interface TaskCardProps {
  task: Task;
  compact?: boolean;
  className?: string;
  isFloating?: boolean;
}

export const categoryConfig: Record<
  TaskCategory, 
  { label: string; icon: React.ElementType; bg: string; text: string; border: string; accent: string }
> = {
  Frontend: {
    label: 'Frontend',
    icon: Code2,
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    accent: '#0284c7',
  },
  Backend: {
    label: 'Backend',
    icon: Server,
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    accent: '#4f46e5',
  },
  Database: {
    label: 'Database',
    icon: Database,
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    accent: '#9333ea',
  },
  Testing: {
    label: 'Testing',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    accent: '#059669',
  },
  Documentation: {
    label: 'Docs',
    icon: FileText,
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    accent: '#64748b',
  },
  Bug: {
    label: 'Defect',
    icon: Bug,
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    accent: '#e11d48',
  },
};

export const priorityConfig: Record<Priority, { label: string; color: string; badge: string }> = {
  High: {
    label: 'High',
    color: 'text-rose-600',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  Medium: {
    label: 'Med',
    color: 'text-amber-600',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  Low: {
    label: 'Low',
    color: 'text-slate-500',
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
  },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  compact = false,
  className = '',
  isFloating = false,
}) => {
  const cat = categoryConfig[task.category] || categoryConfig.Frontend;
  const pri = priorityConfig[task.priority] || priorityConfig.Medium;
  const CategoryIcon = cat.icon;

  const initials = task.assignedToName
    ? task.assignedToName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'TK';

  return (
    <div
      className={`relative rounded-xl bg-white border border-slate-200/90 transition-all duration-200 ${
        isFloating
          ? 'shadow-xl shadow-sky-500/10 border-sky-300 ring-2 ring-sky-400/20'
          : 'shadow-sm hover:shadow-md hover:border-slate-300'
      } ${compact ? 'p-2.5' : 'p-3.5'} ${className}`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: cat.accent,
      }}
    >
      {/* Header: Category Badge + Priority */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cat.bg} ${cat.text} ${cat.border}`}
        >
          <CategoryIcon className="w-2.5 h-2.5" />
          <span>{cat.label}</span>
        </span>

        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${pri.badge}`}
        >
          {pri.label}
        </span>
      </div>

      {/* Task Title */}
      <h4
        className={`font-semibold text-slate-800 tracking-tight leading-snug line-clamp-2 ${
          compact ? 'text-xs mb-1.5' : 'text-sm mb-2.5'
        }`}
      >
        {task.title}
      </h4>

      {/* Optional Progress Bar */}
      {typeof task.progress === 'number' && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${task.progress}%`,
                backgroundColor: cat.accent,
              }}
            />
          </div>
        </div>
      )}

      {/* Footer Info: Deadline, Subtasks, Assignee */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          {task.deadline && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{task.deadline}</span>
            </span>
          )}

          {typeof task.subtaskCount === 'number' && task.subtaskCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Layers className="w-3 h-3 text-slate-400" />
              <span>
                {task.completedSubtaskCount || 0}/{task.subtaskCount}
              </span>
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        <div className="flex items-center">
          <div
            className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs ring-1 ring-white"
            title={task.assignedToName || 'Assigned'}
          >
            {initials}
          </div>
        </div>
      </div>
    </div>
  );
};
