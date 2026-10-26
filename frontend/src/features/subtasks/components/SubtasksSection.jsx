import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  X, 
  Loader2, 
  AlertCircle, 
  AlertTriangle,
  Calendar,
  User
} from 'lucide-react';
import { useSubtasks, useCreateSubtask } from '../hooks';
import { SubtaskRow } from './SubtaskRow';
import { SubtaskProgress } from './SubtaskProgress';

/**
 * SubtasksSection component mounted in TaskPanel slot.
 * Handles subtasks listing, progress calculation, and inline subtask creation.
 * Hides "Add subtask" when the open task itself has a parentTaskId.
 */
export const SubtasksSection = ({ task, projectId = '', memberMap = new Map() }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Backend');
  const [priority, setPriority] = useState('Medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');

  const taskId = task?.id;
  const isNested = Boolean(task?.parentTaskId);

  const { data: subtasks = [], isLoading, isError, error } = useSubtasks(taskId);

  const createMutation = useCreateSubtask(taskId, projectId, {
    onSuccess: () => {
      setTitle('');
      setCategory('Backend');
      setPriority('Medium');
      setAssignedTo('');
      setDeadline('');
      setIsAdding(false);
      setErrorMessage('');
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create subtask';
      setErrorMessage(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || createMutation.isPending) return;

    setErrorMessage('');
    createMutation.mutate({
      parentId: taskId,
      projectId,
      title: title.trim(),
      category,
      priority,
      assignedTo: assignedTo || undefined,
      deadline: deadline || undefined,
    });
  };

  const handleCancel = () => {
    setTitle('');
    setIsAdding(false);
    setErrorMessage('');
  };

  const members = Array.from(memberMap.values());

  return (
    <div
      data-testid="section-subtasks"
      className="p-4 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Subtasks</span>
              <span
                data-testid="subtask-count-badge"
                className="text-xs px-2 py-0.2 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200"
              >
                {subtasks.length}
              </span>
            </h4>
          </div>
        </div>

        {/* Hide Add subtask when the open task itself has a parentTaskId */}
        {!isNested && !isAdding && (
          <button
            type="button"
            data-testid="add-subtask-btn"
            onClick={() => {
              setIsAdding(true);
              setErrorMessage('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 border border-sky-200/80 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subtask</span>
          </button>
        )}

        {isNested && (
          <span
            data-testid="nested-subtask-badge"
            className="text-[11px] font-medium text-slate-400 italic"
          >
            Subtask of another task
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {subtasks.length > 0 && <SubtaskProgress subtasks={subtasks} />}

      {/* Error message banner (e.g. nested subtask rejection) */}
      {errorMessage && (
        <div
          data-testid="subtask-error"
          className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Inline Add Subtask Form */}
      {isAdding && !isNested && (
        <form
          onSubmit={handleSubmit}
          data-testid="add-subtask-form"
          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 animate-fade-in"
        >
          <div>
            <label
              htmlFor="subtask-title"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="subtask-title"
              type="text"
              data-testid="subtask-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              autoFocus
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Category */}
            <div>
              <label
                htmlFor="subtask-category"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Category
              </label>
              <select
                id="subtask-category"
                data-testid="subtask-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800"
              >
                <option value="Frontend">Frontend</option>
                <option value="Backend">Backend</option>
                <option value="Database">Database</option>
                <option value="Testing">Testing</option>
                <option value="Documentation">Docs</option>
                <option value="Bug">Defect</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label
                htmlFor="subtask-priority"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Priority
              </label>
              <select
                id="subtask-priority"
                data-testid="subtask-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label
                htmlFor="subtask-assignee"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Assignee
              </label>
              <select
                id="subtask-assignee"
                data-testid="subtask-assignee-select"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId || m.id} value={m.userId || m.id}>
                    {m.userName || m.userEmail}
                  </option>
                ))}
              </select>
            </div>

            {/* Deadline */}
            <div>
              <label
                htmlFor="subtask-deadline"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Deadline
              </label>
              <input
                id="subtask-deadline"
                type="date"
                data-testid="subtask-deadline-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full text-xs px-2 py-1 rounded-xl border border-slate-200 bg-white text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              data-testid="subtask-cancel-btn"
              onClick={handleCancel}
              disabled={createMutation.isPending}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="subtask-submit-btn"
              disabled={!title.trim() || createMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>Add Subtask</span>
            </button>
          </div>
        </form>
      )}

      {/* Subtasks List */}
      <div className="space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center p-4 text-xs text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>Loading subtasks...</span>
          </div>
        )}

        {!isLoading && subtasks.length === 0 && !isAdding && (
          <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-xs text-slate-400">
              {isNested
                ? 'Subtasks cannot have nested subtasks.'
                : 'No subtasks yet. Break this task into smaller steps.'}
            </p>
          </div>
        )}

        {subtasks.map((subtask) => (
          <SubtaskRow
            key={subtask.id}
            subtask={subtask}
            projectId={projectId}
            memberMap={memberMap}
          />
        ))}
      </div>
    </div>
  );
};

export default SubtasksSection;
