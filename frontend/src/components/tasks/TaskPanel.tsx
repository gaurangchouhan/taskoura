import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  X, 
  Calendar, 
  Clock, 
  CheckCircle2,
  Pencil,
  Trash2,
  Loader2
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Task, TaskStatus, TaskCategory, Priority, UpdateTaskRequest } from '../../types/task';
import { ProjectMember } from '../../types/member';
import { useUpdateTaskStatus, useUpdateTask, useDeleteTask } from '../../hooks/useTasks';
import { useCurrentMembership, useMembers } from '../../hooks/useMembers';
import { useProject } from '../../hooks/useProjects';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { timeAgo, formatDateTime, useTimeZone } from '../../lib/datetime';
import { getFieldErrors, getErrorMessage } from '../../lib/errors';
import { ConfirmDialog } from '../../features/attachments/components/ConfirmDialog';
import { StatusHistory } from './StatusHistory';
import { CommentsSection } from '../comments/CommentsSection';
import { Avatar } from '../common/Avatar';
import { QualitySection } from '../quality/QualitySection';
import { AttachmentsSection } from '../../features/attachments/components/AttachmentsSection';
import { SubtasksSection } from '../../features/subtasks';
import { categoryConfig, priorityConfig } from '../TaskCard';

interface TaskPanelProps {
  projectId: string;
  tasks: Task[];
  memberMap: Map<string, ProjectMember>;
  isLoadingTasks: boolean;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  projectId,
  tasks,
  memberMap,
  isLoadingTasks,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get('task');
  const queryClient = useQueryClient();
  const timeZone = useTimeZone();

  const { user } = useAuth();
  const { isOwner: isMemberOwner } = useCurrentMembership(projectId);
  const { data: project } = useProject(projectId);
  const { data: fetchedMembers = [] } = useMembers(projectId);

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateTaskStatus(projectId);
  const { mutateAsync: updateTaskMutation, isPending: isUpdating } = useUpdateTask(projectId);
  const { mutateAsync: deleteTaskMutation, isPending: isDeleting } = useDeleteTask(projectId);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Frontend');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Populate form with task data
  const resetForm = (task: Task) => {
    setTitle(task.title || '');
    setDescription(task.description || '');
    const validCat = ['Frontend', 'Backend', 'Database', 'Testing', 'Documentation'].includes(task.category)
      ? (task.category as TaskCategory)
      : 'Frontend';
    setCategory(validCat);
    setPriority(task.priority || 'Medium');
    setAssignedTo(task.assignedTo || '');
    setDeadline(task.deadline || '');
    setFieldErrors({});
  };

  useEffect(() => {
    if (selectedTask) {
      resetForm(selectedTask);
      setIsEditing(false);
    }
  }, [selectedTask?.id]);

  // Close helper
  const handleClose = () => {
    setIsEditing(false);
    searchParams.delete('task');
    setSearchParams(searchParams, { replace: true });
  };

  // If ?task points to an invalid ID once tasks have finished loading, close and toast
  useEffect(() => {
    if (selectedTaskId && !isLoadingTasks && !selectedTask) {
      toast.error('Task not found');
      handleClose();
    }
  }, [selectedTaskId, isLoadingTasks, selectedTask]);

  const memberList = useMemo(() => {
    if (fetchedMembers.length > 0) return fetchedMembers;
    return Array.from(memberMap.values());
  }, [fetchedMembers, memberMap]);

  if (!selectedTaskId || !selectedTask) {
    return null;
  }

  // Permission checks
  const isOwner = Boolean(
    isMemberOwner ||
    project?.role === 'Owner' ||
    (user?.id && project?.ownerId === user.id)
  );

  const creatorId =
    typeof selectedTask.createdBy === 'object' && selectedTask.createdBy !== null
      ? selectedTask.createdBy.id
      : typeof selectedTask.createdBy === 'string'
      ? selectedTask.createdBy
      : undefined;

  const isCreator = Boolean(user?.id && creatorId && user.id === creatorId);
  const canDelete = isOwner || isCreator;

  // Edited check: updatedAt exists and is later than createdAt
  const hasBeenEdited = Boolean(
    selectedTask.updatedAt &&
    selectedTask.createdAt &&
    new Date(selectedTask.updatedAt).getTime() > new Date(selectedTask.createdAt).getTime()
  );

  const cat = categoryConfig[selectedTask.category] || categoryConfig.Frontend;
  const pri = priorityConfig[selectedTask.priority] || priorityConfig.Medium;
  const CategoryIcon = cat.icon;

  // Resolve assignee
  const assigneeMember = selectedTask.assignedTo
    ? memberMap.get(selectedTask.assignedTo)
    : undefined;
  const assigneeName =
    assigneeMember?.userName || selectedTask.assignedToName || 'Unassigned';
  const assigneeAvatarUrl =
    assigneeMember?.avatarUrl || selectedTask.assignedToAvatar;

  // Check overdue
  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = Boolean(
    selectedTask.deadline &&
      selectedTask.status !== 'Completed' &&
      selectedTask.deadline < todayStr
  );

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === selectedTask.status || isUpdatingStatus) return;
    updateStatus({
      projectId,
      taskId: selectedTask.id,
      status: newStatus,
    });
  };

  // Unchanged calculation
  const trimmedTitle = title.trim();
  const initialTitle = selectedTask.title || '';
  const initialDescription = selectedTask.description || '';
  const initialCategory = selectedTask.category;
  const initialPriority = selectedTask.priority;
  const initialAssignedTo = selectedTask.assignedTo || '';
  const initialDeadline = selectedTask.deadline || '';

  const isUnchanged =
    title === initialTitle &&
    description === initialDescription &&
    category === initialCategory &&
    priority === initialPriority &&
    assignedTo === initialAssignedTo &&
    deadline === initialDeadline;

  const isInvalid = !trimmedTitle || trimmedTitle.length > 200 || description.length > 255;
  const isSaveDisabled = isUpdating || isUnchanged || isInvalid;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const clientErrors: Record<string, string> = {};
    if (!trimmedTitle) {
      clientErrors.title = 'Title is required';
    } else if (trimmedTitle.length > 200) {
      clientErrors.title = 'Title must be between 1 and 200 characters';
    }

    if (description.length > 255) {
      clientErrors.description = 'Description cannot exceed 255 characters';
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    const payload: UpdateTaskRequest = {
      title: trimmedTitle,
      description,
      category,
      priority,
      assignedTo: assignedTo ? assignedTo : null,
      deadline: deadline ? deadline : null,
    };

    try {
      await updateTaskMutation({
        taskId: selectedTask.id,
        task: payload,
        projectId,
      });
      toast.success('Task updated successfully');
      setIsEditing(false);
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 400) {
        const serverFieldErrors = getFieldErrors(err);
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
        } else {
          toast.error(getErrorMessage(err) || 'Validation failed');
        }
      } else if (status === 403 || status === 404) {
        const msg =
          getErrorMessage(err) ||
          (status === 403 ? 'You do not have permission to edit this task' : 'Task not found');
        toast.error(msg);
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        if (status === 404) {
          handleClose();
        }
      } else {
        toast.error(getErrorMessage(err) || 'Failed to update task');
      }
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteTaskMutation({
        taskId: selectedTask.id,
        projectId,
      });
      toast.success('Task deleted successfully');
      setIsConfirmDeleteOpen(false);
      handleClose();
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      const msg =
        getErrorMessage(err) ||
        (status === 403 ? 'You do not have permission to delete this task' : 'Task not found');
      toast.error(msg);
      setIsConfirmDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      if (status === 404) {
        handleClose();
      }
    }
  };

  const subtasksCount = selectedTask.subtaskCount ?? 0;
  const deleteConfirmMessage = subtasksCount > 0
    ? `Are you sure you want to delete this task? This action cannot be undone. This also deletes ${subtasksCount} subtasks.`
    : 'Are you sure you want to delete this task? This action cannot be undone.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Task Details Panel"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={handleClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-xl w-full flex pl-10">
        <div className="w-full bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full overflow-hidden animate-slide-in-right">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cat.bg} ${cat.text} ${cat.border}`}
              >
                <CategoryIcon className="w-3 h-3" />
                <span>{cat.label}</span>
              </span>

              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${pri.badge}`}
              >
                {pri.label} Priority
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm(selectedTask);
                    setIsEditing(true);
                  }}
                  data-testid="edit-task-button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Edit task"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}

              {!isEditing && canDelete && (
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  data-testid="delete-task-button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="Close task details panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isEditing ? (
              /* Edit Form Area */
              <form onSubmit={handleSave} className="space-y-4" data-testid="edit-task-form">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Task
                  </h3>
                  <span className="text-xs text-slate-400">
                    Update task parameters
                  </span>
                </div>

                {/* Task Title */}
                <div>
                  <label htmlFor="edit-task-title-input" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Task Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="edit-task-title-input"
                    data-testid="edit-task-title-input"
                    name="title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (fieldErrors.title) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.title;
                          return copy;
                        });
                      }
                    }}
                    placeholder="Task title"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-colors ${
                      fieldErrors.title
                        ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                        : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                    }`}
                  />
                  {fieldErrors.title && (
                    <p data-testid="field-error-title" className="text-xs text-rose-500 mt-1 font-medium">
                      {fieldErrors.title}
                    </p>
                  )}
                </div>

                {/* Description with Character Counter */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="edit-task-description-input" className="block text-sm font-semibold text-slate-700">
                      Description
                    </label>
                    <span
                      data-testid="description-char-counter"
                      className={`text-xs ${description.length > 255 ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}
                    >
                      {description.length}/255
                    </span>
                  </div>
                  <textarea
                    id="edit-task-description-input"
                    data-testid="edit-task-description-input"
                    name="description"
                    rows={4}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (fieldErrors.description) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.description;
                          return copy;
                        });
                      }
                    }}
                    placeholder="Add technical context, acceptance criteria, or design notes..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-colors ${
                      fieldErrors.description
                        ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                        : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                    }`}
                  />
                  {fieldErrors.description && (
                    <p data-testid="field-error-description" className="text-xs text-rose-500 mt-1 font-medium">
                      {fieldErrors.description}
                    </p>
                  )}
                </div>

                {/* Category & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-task-category-select" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Category
                    </label>
                    <select
                      id="edit-task-category-select"
                      data-testid="edit-task-category-select"
                      name="category"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value as TaskCategory);
                        if (fieldErrors.category) {
                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.category;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium text-slate-700 focus:ring-2 focus:outline-none bg-white transition-colors cursor-pointer shadow-xs ${
                        fieldErrors.category
                          ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                    >
                      <option value="Frontend">Frontend</option>
                      <option value="Backend">Backend</option>
                      <option value="Database">Database</option>
                      <option value="Testing">Testing</option>
                      <option value="Documentation">Documentation</option>
                    </select>
                    {fieldErrors.category && (
                      <p data-testid="field-error-category" className="text-xs text-rose-500 mt-1 font-medium">
                        {fieldErrors.category}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="edit-task-priority-select" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Priority
                    </label>
                    <select
                      id="edit-task-priority-select"
                      data-testid="edit-task-priority-select"
                      name="priority"
                      value={priority}
                      onChange={(e) => {
                        setPriority(e.target.value as Priority);
                        if (fieldErrors.priority) {
                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.priority;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium text-slate-700 focus:ring-2 focus:outline-none bg-white transition-colors cursor-pointer shadow-xs ${
                        fieldErrors.priority
                          ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                    {fieldErrors.priority && (
                      <p data-testid="field-error-priority" className="text-xs text-rose-500 mt-1 font-medium">
                        {fieldErrors.priority}
                      </p>
                    )}
                  </div>
                </div>

                {/* Assignee & Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
                    <label htmlFor="edit-task-assignee-select" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Assignee
                    </label>
                    <select
                      id="edit-task-assignee-select"
                      data-testid="edit-task-assignee-select"
                      name="assignedTo"
                      value={assignedTo}
                      onChange={(e) => {
                        setAssignedTo(e.target.value);
                        if (fieldErrors.assignedTo) {
                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.assignedTo;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium text-slate-700 focus:ring-2 focus:outline-none bg-white transition-colors cursor-pointer shadow-xs ${
                        fieldErrors.assignedTo
                          ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                    >
                      <option value="">Unassigned</option>
                      {memberList.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.userName || m.userEmail}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.assignedTo && (
                      <p data-testid="field-error-assignedTo" className="text-xs text-rose-500 mt-1 font-medium">
                        {fieldErrors.assignedTo}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="edit-task-deadline-input" className="block text-sm font-semibold text-slate-700">
                        Deadline
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
                        id="edit-task-deadline-input"
                        data-testid="edit-task-deadline-input"
                        name="deadline"
                        type="date"
                        value={deadline}
                        onChange={(e) => {
                          setDeadline(e.target.value);
                          if (fieldErrors.deadline) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.deadline;
                              return copy;
                            });
                          }
                        }}
                        className={`w-full h-11 pl-10 pr-9 rounded-xl border bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:outline-none transition-colors cursor-pointer shadow-xs ${
                          fieldErrors.deadline
                            ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                            : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                        }`}
                      />
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      {deadline && (
                        <button
                          type="button"
                          onClick={() => setDeadline('')}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 absolute right-2.5 transition-colors cursor-pointer"
                          aria-label="Clear deadline"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {fieldErrors.deadline && (
                      <p data-testid="field-error-deadline" className="text-xs text-rose-500 mt-1 font-medium">
                        {fieldErrors.deadline}
                      </p>
                    )}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm(selectedTask);
                      setIsEditing(false);
                    }}
                    disabled={isUpdating}
                    data-testid="cancel-edit-task-button"
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaveDisabled}
                    data-testid="save-task-button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{isUpdating ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode Area */
              <>
                {/* Title and Edited Subtitle */}
                <div>
                  <h2
                    data-testid="task-panel-title"
                    className="text-xl font-bold text-slate-900 leading-snug"
                  >
                    {selectedTask.title}
                  </h2>
                  {hasBeenEdited && selectedTask.updatedAt && (
                    <p
                      data-testid="task-edited-line"
                      title={formatDateTime(selectedTask.updatedAt, undefined, timeZone)}
                      className="text-xs text-slate-500 mt-1 cursor-default"
                    >
                      Edited {timeAgo(selectedTask.updatedAt, timeZone)} by {selectedTask.updatedBy?.name || 'Unknown'}
                    </p>
                  )}
                </div>

                {/* Quick Properties Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 gap-4 text-sm">
                  {/* Status Selector */}
                  <div>
                    <label
                      htmlFor="panel-status-select"
                      className="block text-xs font-semibold text-slate-500 mb-1"
                    >
                      Status
                    </label>
                    <select
                      id="panel-status-select"
                      value={selectedTask.status}
                      disabled={isUpdatingStatus}
                      onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white cursor-pointer disabled:opacity-50"
                    >
                      <option value="Backlog">Backlog</option>
                      <option value="InProgress">In Progress</option>
                      <option value="Testing">Testing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  {/* Assignee */}
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 mb-1">
                      Assignee
                    </span>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Avatar
                        src={assigneeAvatarUrl}
                        name={assigneeName && assigneeName !== 'Unassigned' ? assigneeName : 'U'}
                        size="xs"
                        className="rounded-full shadow-xs ring-1 ring-white"
                        title={assigneeName}
                      />
                      <span className="font-semibold text-slate-800 text-sm truncate">
                        {assigneeName}
                      </span>
                    </div>
                  </div>

                  {/* Deadline */}
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 mb-1">
                      Deadline
                    </span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {selectedTask.deadline ? (
                        <span
                          className={`font-semibold text-sm ${
                            isOverdue
                              ? 'text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200'
                              : 'text-slate-800'
                          }`}
                        >
                          {selectedTask.deadline}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">None</span>
                      )}
                    </div>
                  </div>

                  {/* Completed At */}
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 mb-1">
                      Resolution
                    </span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {selectedTask.status === 'Completed' ? (
                        <span className="text-emerald-700 font-semibold text-sm flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Completed</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Incomplete</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Description
                  </h3>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedTask.description || 'No description provided for this task.'}
                  </div>
                </div>

                {/* Status History */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Status History</span>
                  </h3>
                  <StatusHistory taskId={selectedTask.id} />
                </div>

                {/* Connected Modules */}
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Connected Modules
                  </h3>

                  {/* Subtasks Section */}
                  <SubtasksSection
                    task={selectedTask}
                    projectId={projectId}
                    memberMap={memberMap}
                  />

                  {/* Comments Section */}
                  <CommentsSection
                    taskId={selectedTask.id}
                    projectId={projectId}
                    memberMap={memberMap}
                  />

                  {/* Quality & Verification: Bugs and Tests */}
                  <QualitySection
                    taskId={selectedTask.id}
                    projectId={projectId}
                    memberMap={memberMap}
                  />

                  {/* Attachments Section */}
                  <AttachmentsSection
                    taskId={selectedTask.id}
                    projectId={projectId}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Delete Task"
        message={deleteConfirmMessage}
        confirmText="Delete"
        cancelText="Cancel"
        isPending={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default TaskPanel;
