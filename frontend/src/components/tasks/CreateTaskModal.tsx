import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X, Plus, AlertCircle, Calendar, User, Tag, ShieldAlert, AlertTriangle, Clock } from 'lucide-react';
import { format, isBefore, startOfDay, addDays, parseISO } from 'date-fns';
import { useCreateTask } from '../../hooks/useTasks';
import { ProjectMember } from '../../types/member';
import { TaskCategory, Priority, Task } from '../../types/task';
import { getErrorMessage } from '../../lib/errors';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  members: ProjectMember[];
  onTaskCreated?: (task: Task) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  projectId,
  members,
  onTaskCreated,
}) => {
  const { mutateAsync: createTask, isPending } = useCreateTask(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Frontend');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [titleError, setTitleError] = useState('');

  const isPastDeadline = deadline ? isBefore(parseISO(deadline), startOfDay(new Date())) : false;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Task title is required');
      return;
    }

    try {
      // CRITICAL: NEVER send status. Backend always initializes status as "Backlog".
      const created = await createTask({
        projectId,
        task: {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          priority,
          assignedTo: assignedTo.trim() || undefined,
          deadline: deadline || undefined,
        },
      });

      toast.success(`Task "${created.title}" added to Backlog`);
      setTitle('');
      setDescription('');
      setCategory('Frontend');
      setPriority('Medium');
      setAssignedTo('');
      setDeadline('');
      setTitleError('');

      onClose();
      if (onTaskCreated) onTaskCreated(created);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      toast.error(msg);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 id="create-task-title" className="text-lg font-bold text-slate-900">
              Create New Task
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              New tasks automatically start in the <strong>Backlog</strong> column.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-5">
          {/* Task Title (Required) */}
          <div>
            <label htmlFor="task-title-input" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              placeholder="e.g. Implement resilient WebSocket connection"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-colors ${
                titleError
                  ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                  : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
              }`}
            />
            {titleError && (
              <p className="text-xs text-rose-500 mt-1 font-medium">{titleError}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-description-input" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              id="task-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add technical context, acceptance criteria, or design notes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-category-select" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Category
              </label>
              <select
                id="task-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white transition-colors cursor-pointer shadow-xs"
              >
                <option value="Frontend">Frontend</option>
                <option value="Backend">Backend</option>
                <option value="Database">Database</option>
                <option value="Testing">Testing</option>
                <option value="Documentation">Documentation</option>
                <option value="Bug">Defect / Bug</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-priority-select" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Priority
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white transition-colors cursor-pointer shadow-xs"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Assignee & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label htmlFor="task-assignee-select" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Assignee (Optional)
              </label>
              <select
                id="task-assignee-select"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white transition-colors cursor-pointer shadow-xs"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userName || m.userEmail}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="task-deadline-input" className="block text-sm font-semibold text-slate-700">
                  Target Deadline
                </label>
                {deadline && (
                  <button
                    type="button"
                    onClick={() => setDeadline('')}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative flex items-center">
                <input
                  id="task-deadline-input"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-11 pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors cursor-pointer shadow-xs"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                {deadline && (
                  <button
                    type="button"
                    onClick={() => setDeadline('')}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 absolute right-2.5 transition-colors cursor-pointer"
                    title="Clear date"
                    aria-label="Clear date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium">Quick:</span>
                <button
                  type="button"
                  onClick={() => setDeadline(format(new Date(), 'yyyy-MM-dd'))}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 transition-colors border border-slate-200/60 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDeadline(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 transition-colors border border-slate-200/60 cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setDeadline(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 transition-colors border border-slate-200/60 cursor-pointer"
                >
                  +1 Week
                </button>
              </div>

              {/* Past Deadline Warning */}
              {isPastDeadline && (
                <div data-testid="deadline-warning" className="flex items-center gap-1.5 text-xs text-amber-700 font-medium mt-2 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-lg animate-fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Selected deadline is in the past.</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{isPending ? 'Creating...' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
