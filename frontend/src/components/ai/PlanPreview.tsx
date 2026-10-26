import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  Loader2,
  ArrowRight,
  Trash2,
  RotateCcw,
  Plus,
  AlertCircle,
  X,
} from 'lucide-react';
import { PlanModule, PlanTask } from '../../types/ai';

export interface DraftTask {
  id: string;
  title: string;
  category: string;
  priority: string;
  description: string;
  selected: boolean;
  original: {
    title: string;
    category: string;
    priority: string;
    description: string;
  };
}

export interface DraftModule {
  id: string;
  name: string;
  originalName: string;
  tasks: DraftTask[];
}

export interface TaskErrors {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
}

export interface ModuleErrors {
  name?: string;
}

export interface PlanPreviewProps {
  modules: PlanModule[];
  onConfirm: (selectedModules: PlanModule[]) => void;
  isConfirming: boolean;
  serverFieldErrors?: Record<string, string>;
  onDirtyChange?: (isDirty: boolean) => void;
  onCancel?: () => void;
}

export function getCategoryBadge(category: string) {
  const cat = category?.toLowerCase();
  if (cat?.includes('front')) {
    return 'bg-sky-50 text-sky-700 border-sky-200';
  }
  if (cat?.includes('back')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
  if (cat?.includes('data')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (cat?.includes('test')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-purple-50 text-purple-700 border-purple-200';
}

export function getPriorityBadge(priority: string) {
  const p = priority?.toLowerCase();
  if (p === 'high') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (p === 'medium') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

const initializeDraft = (mods: PlanModule[]): DraftModule[] => {
  return (mods || []).map((mod, mIdx) => ({
    id: `mod-${mIdx}-${Math.random().toString(36).slice(2, 7)}`,
    name: mod.name || 'General',
    originalName: mod.name || 'General',
    tasks: (mod.tasks || []).map((task, tIdx) => ({
      id: `task-${mIdx}-${tIdx}-${Math.random().toString(36).slice(2, 7)}`,
      title: task.title || '',
      category: task.category || 'Backend',
      priority: task.priority || 'Medium',
      description: task.description || '',
      selected: true,
      original: {
        title: task.title || '',
        category: task.category || 'Backend',
        priority: task.priority || 'Medium',
        description: task.description || '',
      },
    })),
  }));
};

export const PlanPreview: React.FC<PlanPreviewProps> = ({
  modules,
  onConfirm,
  isConfirming,
  serverFieldErrors,
  onDirtyChange,
  onCancel,
}) => {
  const [draftModules, setDraftModules] = useState<DraftModule[]>(() =>
    initializeDraft(modules)
  );

  // Store mapping of the last submitted modules and task IDs for server error routing
  const lastSentMappingRef = useRef<string[][] | null>(null);

  // Sync draft when initial modules change
  useEffect(() => {
    setDraftModules(initializeDraft(modules));
  }, [modules]);

  // Compute if draft is dirty compared to original
  const isDirty = useMemo(() => {
    if (draftModules.length !== modules.length) return true;
    for (let m = 0; m < draftModules.length; m++) {
      const dMod = draftModules[m];
      const oMod = modules[m];
      if (!oMod || dMod.name !== (oMod.name || 'General')) return true;
      if (dMod.tasks.length !== oMod.tasks.length) return true;
      for (let t = 0; t < dMod.tasks.length; t++) {
        const dTask = dMod.tasks[t];
        const oTask = oMod.tasks[t];
        if (!oTask) return true;
        if (
          dTask.title !== (oTask.title || '') ||
          dTask.category !== (oTask.category || 'Backend') ||
          dTask.priority !== (oTask.priority || 'Medium') ||
          dTask.description !== (oTask.description || '')
        ) {
          return true;
        }
      }
    }
    return false;
  }, [draftModules, modules]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Live Counts
  const totalTasksCount = useMemo(() => {
    return draftModules.reduce((acc, m) => acc + m.tasks.length, 0);
  }, [draftModules]);

  const selectedCount = useMemo(() => {
    return draftModules.reduce(
      (acc, m) => acc + m.tasks.filter((t) => t.selected).length,
      0
    );
  }, [draftModules]);

  // Server Errors mapped to task / module IDs
  const mappedServerErrors = useMemo(() => {
    const result: {
      taskErrors: Record<string, TaskErrors>;
      moduleErrors: Record<string, ModuleErrors>;
    } = { taskErrors: {}, moduleErrors: {} };

    if (!serverFieldErrors || Object.keys(serverFieldErrors).length === 0) {
      return result;
    }

    const currentMapping: { modId: string; taskIds: string[] }[] = [];
    draftModules.forEach((m) => {
      const selectedTaskIds = m.tasks.filter((t) => t.selected).map((t) => t.id);
      if (selectedTaskIds.length > 0) {
        currentMapping.push({ modId: m.id, taskIds: selectedTaskIds });
      }
    });

    Object.entries(serverFieldErrors).forEach(([path, errorMsg]) => {
      const taskMatch = path.match(/^modules\[(\d+)\]\.tasks\[(\d+)\]\.(\w+)$/);
      if (taskMatch) {
        const mIdx = parseInt(taskMatch[1], 10);
        const tIdx = parseInt(taskMatch[2], 10);
        const field = taskMatch[3] as keyof TaskErrors;

        let targetTaskId: string | undefined;
        if (lastSentMappingRef.current && lastSentMappingRef.current[mIdx]?.[tIdx]) {
          targetTaskId = lastSentMappingRef.current[mIdx][tIdx];
        } else if (currentMapping[mIdx]?.taskIds[tIdx]) {
          targetTaskId = currentMapping[mIdx].taskIds[tIdx];
        } else if (draftModules[mIdx]?.tasks[tIdx]) {
          targetTaskId = draftModules[mIdx].tasks[tIdx].id;
        }

        if (targetTaskId) {
          if (!result.taskErrors[targetTaskId]) result.taskErrors[targetTaskId] = {};
          result.taskErrors[targetTaskId][field] = errorMsg;
        }
        return;
      }

      const modMatch = path.match(/^modules\[(\d+)\]\.(\w+)$/);
      if (modMatch) {
        const mIdx = parseInt(modMatch[1], 10);
        const field = modMatch[2] as keyof ModuleErrors;

        let targetModId: string | undefined;
        if (currentMapping[mIdx]) {
          targetModId = currentMapping[mIdx].modId;
        } else if (draftModules[mIdx]) {
          targetModId = draftModules[mIdx].id;
        }

        if (targetModId) {
          if (!result.moduleErrors[targetModId]) result.moduleErrors[targetModId] = {};
          result.moduleErrors[targetModId][field] = errorMsg;
        }
      }
    });

    return result;
  }, [serverFieldErrors, draftModules]);

  // Validation functions
  const getTaskErrors = (task: DraftTask): TaskErrors => {
    const errors: TaskErrors = {};
    if (!task.title.trim()) {
      errors.title = 'Title is required (1-200 characters)';
    } else if (task.title.length > 200) {
      errors.title = 'Title must be 200 characters or less';
    }

    if (task.description && task.description.length > 255) {
      errors.description = 'Description must be 255 characters or less';
    }

    const validCategories = [
      'frontend',
      'backend',
      'database',
      'testing',
      'documentation',
    ];
    if (!validCategories.includes(task.category?.toLowerCase() || '')) {
      errors.category =
        'Category must be one of: Frontend, Backend, Database, Testing, Documentation';
    }

    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(task.priority?.toLowerCase() || '')) {
      errors.priority = 'Priority must be High, Medium, or Low';
    }

    // Merge with server errors if present
    const sErrors = mappedServerErrors.taskErrors[task.id];
    if (sErrors) {
      if (sErrors.title) errors.title = sErrors.title;
      if (sErrors.description) errors.description = sErrors.description;
      if (sErrors.category) errors.category = sErrors.category;
      if (sErrors.priority) errors.priority = sErrors.priority;
    }

    return errors;
  };

  const getModuleErrors = (mod: DraftModule): ModuleErrors => {
    const errors: ModuleErrors = {};
    if (!mod.name.trim()) {
      errors.name = 'Module name is required (1-100 characters)';
    } else if (mod.name.length > 100) {
      errors.name = 'Module name must be 100 characters or less';
    }

    const sErrors = mappedServerErrors.moduleErrors[mod.id];
    if (sErrors?.name) {
      errors.name = sErrors.name;
    }

    return errors;
  };

  // Has validation errors
  const hasValidationErrors = useMemo(() => {
    if (selectedCount === 0 || selectedCount > 100) return true;

    for (const mod of draftModules) {
      const selectedTasks = mod.tasks.filter((t) => t.selected);
      if (selectedTasks.length > 0) {
        const modErrors = getModuleErrors(mod);
        if (modErrors.name) return true;

        for (const task of selectedTasks) {
          const taskErrors = getTaskErrors(task);
          if (
            taskErrors.title ||
            taskErrors.description ||
            taskErrors.category ||
            taskErrors.priority
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }, [draftModules, selectedCount, mappedServerErrors]);

  // Draft Mutations
  const toggleTask = (mIdx: number, tIdx: number) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        return {
          ...mod,
          tasks: mod.tasks.map((task, j) => {
            if (j !== tIdx) return task;
            return { ...task, selected: !task.selected };
          }),
        };
      })
    );
  };

  const toggleModule = (mIdx: number) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        const allSelected = mod.tasks.every((t) => t.selected);
        return {
          ...mod,
          tasks: mod.tasks.map((task) => ({
            ...task,
            selected: !allSelected,
          })),
        };
      })
    );
  };

  const updateModuleName = (mIdx: number, name: string) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => (i === mIdx ? { ...mod, name } : mod))
    );
  };

  const updateTaskTitle = (mIdx: number, tIdx: number, title: string) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        return {
          ...mod,
          tasks: mod.tasks.map((task, j) => {
            if (j !== tIdx) return task;
            return { ...task, title };
          }),
        };
      })
    );
  };

  const updateTaskDescription = (mIdx: number, tIdx: number, description: string) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        return {
          ...mod,
          tasks: mod.tasks.map((task, j) => {
            if (j !== tIdx) return task;
            return { ...task, description };
          }),
        };
      })
    );
  };

  const updateTaskCategory = (mIdx: number, tIdx: number, category: string) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        return {
          ...mod,
          tasks: mod.tasks.map((task, j) => {
            if (j !== tIdx) return task;
            return { ...task, category };
          }),
        };
      })
    );
  };

  const updateTaskPriority = (mIdx: number, tIdx: number, priority: string) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        return {
          ...mod,
          tasks: mod.tasks.map((task, j) => {
            if (j !== tIdx) return task;
            return { ...task, priority };
          }),
        };
      })
    );
  };

  const resetTask = (mIdx: number, tIdx: number) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        return {
          ...mod,
          tasks: mod.tasks.map((task, j) => {
            if (j !== tIdx) return task;
            return {
              ...task,
              title: task.original.title,
              category: task.original.category,
              priority: task.original.priority,
              description: task.original.description,
            };
          }),
        };
      })
    );
  };

  const removeTask = (mIdx: number, tIdx: number) => {
    setDraftModules((prev) => {
      const next = prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        return {
          ...mod,
          tasks: mod.tasks.filter((_, j) => j !== tIdx),
        };
      });
      // Empty modules disappear automatically
      return next.filter((mod) => mod.tasks.length > 0);
    });
  };

  const removeModule = (mIdx: number) => {
    setDraftModules((prev) => prev.filter((_, i) => i !== mIdx));
  };

  const addTask = (mIdx: number) => {
    setDraftModules((prev) =>
      prev.map((mod, i) => {
        if (i !== mIdx) return mod;
        const newTask: DraftTask = {
          id: `task-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: '',
          category: 'Frontend',
          priority: 'Medium',
          description: '',
          selected: true,
          original: {
            title: '',
            category: 'Frontend',
            priority: 'Medium',
            description: '',
          },
        };
        return {
          ...mod,
          tasks: [...mod.tasks, newTask],
        };
      })
    );
  };

  const isTaskEdited = (task: DraftTask) => {
    return (
      task.title !== task.original.title ||
      task.category !== task.original.category ||
      task.priority !== task.original.priority ||
      task.description !== task.original.description
    );
  };

  const handleConfirm = () => {
    const sentMapping: string[][] = [];
    const filteredModules: PlanModule[] = [];

    draftModules.forEach((mod) => {
      const selectedTasks = mod.tasks.filter((t) => t.selected);
      if (selectedTasks.length > 0) {
        const taskIds: string[] = [];
        const tasks: PlanTask[] = [];

        selectedTasks.forEach((task) => {
          taskIds.push(task.id);
          const taskPayload: PlanTask = {
            title: task.title.trim(),
            category: task.category,
            priority: task.priority,
          };
          if (task.description && task.description.trim()) {
            taskPayload.description = task.description.trim();
          }
          tasks.push(taskPayload);
        });

        sentMapping.push(taskIds);
        filteredModules.push({
          name: mod.name.trim() || 'General',
          tasks,
        });
      }
    });

    lastSentMappingRef.current = sentMapping;
    onConfirm(filteredModules);
  };

  return (
    <div data-testid="plan-preview" className="space-y-5">
      {/* Overview header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">
            {draftModules.length} modules proposed • {totalTasksCount} total tasks
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 100 && (
            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Max 100 tasks
            </span>
          )}
          <span
            data-testid="selected-tasks-count"
            className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full"
          >
            {selectedCount} selected
          </span>
        </div>
      </div>

      {/* Modules list */}
      <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
        {draftModules.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
            No modules or tasks remaining in the plan.
          </div>
        ) : (
          draftModules.map((mod, mIdx) => {
            const selectedInMod = mod.tasks.filter((t) => t.selected).length;
            const isAllModSelected =
              mod.tasks.length > 0 && selectedInMod === mod.tasks.length;
            const modErrors = getModuleErrors(mod);

            return (
              <div
                key={mod.id}
                data-testid={`plan-module-${mIdx}`}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs transition"
              >
                {/* Module Group Header */}
                <div className="p-3.5 bg-slate-50/80 border-b border-slate-200/80">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isAllModSelected}
                        aria-label={`Select module ${mod.name}`}
                        data-testid={`checkbox-module-${mIdx}`}
                        onChange={() => toggleModule(mIdx)}
                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />
                      <span className="sr-only">{mod.name}</span>
                      <input
                        type="text"
                        value={mod.name}
                        data-testid={`module-name-input-${mIdx}`}
                        aria-label="Module name"
                        onChange={(e) => updateModuleName(mIdx, e.target.value)}
                        placeholder="Module name"
                        className={`text-sm font-bold text-slate-800 bg-transparent border-b px-1 py-0.5 rounded transition focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 flex-1 max-w-sm ${
                          modErrors.name
                            ? 'border-rose-400 text-rose-800'
                            : 'border-transparent hover:border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-slate-500">
                        {selectedInMod} / {mod.tasks.length} tasks
                      </span>
                      <button
                        type="button"
                        onClick={() => addTask(mIdx)}
                        data-testid={`add-task-btn-${mIdx}`}
                        aria-label="Add task"
                        title="Add task to this module"
                        className="p-1 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeModule(mIdx)}
                        data-testid={`remove-module-btn-${mIdx}`}
                        aria-label="Remove module"
                        title="Remove module"
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {modErrors.name && (
                    <div
                      data-testid={`module-name-error-${mIdx}`}
                      className="text-xs text-rose-600 font-medium mt-1 pl-6"
                    >
                      {modErrors.name}
                    </div>
                  )}
                </div>

                {/* Tasks in Module */}
                <div className="divide-y divide-slate-100">
                  {mod.tasks.map((task, tIdx) => {
                    const taskErrors = getTaskErrors(task);
                    const isEdited = isTaskEdited(task);

                    return (
                      <div
                        key={task.id}
                        data-testid={`plan-task-${mIdx}-${tIdx}`}
                        className={`p-3.5 space-y-2 transition ${
                          task.selected
                            ? 'bg-white'
                            : 'bg-slate-50/50 opacity-60'
                        }`}
                      >
                        {/* Row 1: Checkbox + Title + Category + Priority + Reset + Remove */}
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={task.selected}
                            aria-label={`Select task ${task.title}`}
                            data-testid={`checkbox-task-${mIdx}-${tIdx}`}
                            onChange={() => toggleTask(mIdx, tIdx)}
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={task.title}
                              data-testid={`task-title-input-${mIdx}-${tIdx}`}
                              aria-label="Task title"
                              aria-errormessage={`task-title-error-${mIdx}-${tIdx}`}
                              onChange={(e) =>
                                updateTaskTitle(mIdx, tIdx, e.target.value)
                              }
                              placeholder="Task title"
                              className={`w-full text-sm font-medium rounded-lg border px-2.5 py-1 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                taskErrors.title
                                  ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                              }`}
                            />
                          </div>

                          {/* Category select */}
                          <div className="shrink-0">
                            <select
                              value={task.category}
                              data-testid={`task-category-select-${mIdx}-${tIdx}`}
                              aria-label="Task category"
                              aria-errormessage={`task-category-error-${mIdx}-${tIdx}`}
                              onChange={(e) =>
                                updateTaskCategory(mIdx, tIdx, e.target.value)
                              }
                              className={`text-xs font-semibold rounded-lg border py-1 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                taskErrors.category
                                  ? 'border-rose-400 bg-rose-50 text-rose-800'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <option value="Frontend">Frontend</option>
                              <option value="Backend">Backend</option>
                              <option value="Database">Database</option>
                              <option value="Testing">Testing</option>
                              <option value="Documentation">Documentation</option>
                            </select>
                          </div>

                          {/* Priority select */}
                          <div className="shrink-0">
                            <select
                              value={task.priority}
                              data-testid={`task-priority-select-${mIdx}-${tIdx}`}
                              aria-label="Task priority"
                              aria-errormessage={`task-priority-error-${mIdx}-${tIdx}`}
                              onChange={(e) =>
                                updateTaskPriority(mIdx, tIdx, e.target.value)
                              }
                              className={`text-xs font-semibold rounded-lg border py-1 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                taskErrors.priority
                                  ? 'border-rose-400 bg-rose-50 text-rose-800'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isEdited && (
                              <button
                                type="button"
                                onClick={() => resetTask(mIdx, tIdx)}
                                data-testid={`reset-task-btn-${mIdx}-${tIdx}`}
                                aria-label="Reset to AI suggestion"
                                title="Reset to AI suggestion"
                                className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => removeTask(mIdx, tIdx)}
                              data-testid={`remove-task-btn-${mIdx}-${tIdx}`}
                              aria-label="Remove task"
                              title="Remove task"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title Error */}
                        {taskErrors.title && (
                          <div
                            id={`task-title-error-${mIdx}-${tIdx}`}
                            data-testid={`task-title-error-${mIdx}-${tIdx}`}
                            className="text-xs text-rose-600 font-medium pl-6.5"
                          >
                            {taskErrors.title}
                          </div>
                        )}

                        {/* Category or Priority Error */}
                        {(taskErrors.category || taskErrors.priority) && (
                          <div className="text-xs text-rose-600 font-medium pl-6.5 flex gap-4">
                            {taskErrors.category && (
                              <span
                                id={`task-category-error-${mIdx}-${tIdx}`}
                                data-testid={`task-category-error-${mIdx}-${tIdx}`}
                              >
                                {taskErrors.category}
                              </span>
                            )}
                            {taskErrors.priority && (
                              <span
                                id={`task-priority-error-${mIdx}-${tIdx}`}
                                data-testid={`task-priority-error-${mIdx}-${tIdx}`}
                              >
                                {taskErrors.priority}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Row 2: Description Textarea + Counter */}
                        <div className="pl-6.5 space-y-1">
                          <div className="relative">
                            <textarea
                              value={task.description}
                              data-testid={`task-description-input-${mIdx}-${tIdx}`}
                              aria-label="Task description"
                              aria-errormessage={`task-description-error-${mIdx}-${tIdx}`}
                              onChange={(e) =>
                                updateTaskDescription(mIdx, tIdx, e.target.value)
                              }
                              rows={2}
                              placeholder="Task description (optional, max 255 characters)"
                              className={`w-full text-xs rounded-lg border p-2 resize-none transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                taskErrors.description
                                  ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300 focus:bg-white'
                              }`}
                            />
                            <div className="flex items-center justify-between text-[11px] mt-0.5">
                              {taskErrors.description ? (
                                <span
                                  id={`task-description-error-${mIdx}-${tIdx}`}
                                  data-testid={`task-description-error-${mIdx}-${tIdx}`}
                                  className="text-rose-600 font-medium"
                                >
                                  {taskErrors.description}
                                </span>
                              ) : (
                                <span />
                              )}
                              <span
                                data-testid={`description-counter-${mIdx}-${tIdx}`}
                                className={`text-[10px] font-medium ml-auto select-none ${
                                  task.description.length > 255
                                    ? 'text-rose-600 font-bold'
                                    : 'text-slate-400'
                                }`}
                              >
                                {task.description.length}/255
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirm Action Bar */}
      <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Selected tasks will be created in your{' '}
          <span className="font-semibold text-slate-700">Backlog</span>.
        </div>

        <div className="flex items-center gap-2.5">
          {onCancel && (
            <button
              type="button"
              data-testid="cancel-plan-btn"
              onClick={onCancel}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            data-testid="confirm-plan-btn"
            disabled={selectedCount === 0 || hasValidationErrors || isConfirming}
            onClick={handleConfirm}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition shadow-md shadow-indigo-600/20 whitespace-nowrap shrink-0"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Creating tasks...</span>
              </>
            ) : (
              <>
                <span>Add {selectedCount} tasks?</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanPreview;
