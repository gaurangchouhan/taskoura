import React, { useState, useMemo } from 'react';
import { useParams, Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Code2, 
  Server, 
  Database,
  LayoutTemplate
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { KanbanBoard } from '../components/KanbanBoard';
import { BoardToolbar } from '../components/tasks/BoardToolbar';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { TaskPanel } from '../components/tasks/TaskPanel';
import { NextTaskCard } from '../components/ai/NextTaskCard';
import { AiPlanModal } from '../components/ai/AiPlanModal';
import { TemplateGallery } from '../features/templates';
import { useTasks, useUpdateTaskStatus } from '../hooks/useTasks';
import { useMembers, useMemberMap } from '../hooks/useMembers';
import { useProject } from '../hooks/useProjects';
import { Task, TaskStatus, KanbanStatus } from '../types/task';
import { Project } from '../types/project';

export const ProjectBoardPage: React.FC = () => {
  const { projectId: routeProjectId, id: routeId } = useParams<{ projectId?: string; id?: string }>();
  const projectId = routeProjectId || routeId || '';

  const [searchParams, setSearchParams] = useSearchParams();

  let outletContext: { project?: Project } | null = null;
  try {
    outletContext = useOutletContext<{ project?: Project } | null>();
  } catch {
    outletContext = null;
  }
  const isInsideLayout = Boolean(outletContext);

  // Queries
  const { data: projectData } = useProject(projectId);
  const project = outletContext?.project || projectData;

  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks(projectId);
  const { data: members = [] } = useMembers(projectId);
  const memberMap = useMemberMap(projectId);

  // Status mutation (optimistic)
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus(projectId);
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // Modals state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAiPlanModal, setShowAiPlanModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Top-level tasks: the board shows only top-level tasks (filter out any task with a parentTaskId)
  const topLevelTasks = useMemo(() => {
    return tasks.filter((task) => !task.parentTaskId);
  }, [tasks]);

  // Filter tasks client-side
  const filteredTasks = useMemo(() => {
    return topLevelTasks.filter((task) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 2. Category
      if (categoryFilter && task.category !== categoryFilter) {
        return false;
      }

      // 3. Priority
      if (priorityFilter && task.priority !== priorityFilter) {
        return false;
      }

      // 4. Assignee
      if (assigneeFilter) {
        if (assigneeFilter === 'unassigned') {
          if (task.assignedTo) return false;
        } else if (task.assignedTo !== assigneeFilter) {
          return false;
        }
      }

      return true;
    });
  }, [topLevelTasks, searchQuery, categoryFilter, priorityFilter, assigneeFilter]);

  // Card click sets ?task=<id> in query params
  const handleTaskClick = (clickedTask: Task) => {
    searchParams.set('task', clickedTask.id);
    setSearchParams(searchParams);
  };

  // Status change handler (called on drop)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (updatingTaskIds.has(taskId)) return;

    setUpdatingTaskIds((prev) => new Set(prev).add(taskId));
    try {
      await updateTaskStatus({
        projectId,
        taskId,
        status: newStatus,
      });
    } catch {
      // Rollback and toast handled in useUpdateTaskStatus hook
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const boardActionsAndKanban = (
    <>
      {/* Board Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-bold text-slate-800">Sprint Kanban Board</span>
          <span className="text-xs text-slate-500 font-medium">({topLevelTasks.length} tasks)</span>
        </div>
      </div>

      {/* AI Next Task Recommendation Card */}
      <NextTaskCard projectId={projectId} />

      {/* Board Controls Toolbar */}
      <BoardToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
        onAddTask={() => setShowTaskModal(true)}
        onOpenAiPlan={() => setShowAiPlanModal(true)}
        onOpenTemplates={() => setShowTemplatesModal(true)}
        members={members}
        totalTasksCount={topLevelTasks.length}
        filteredTasksCount={filteredTasks.length}
      />

      {/* Empty Board State Call-to-Action */}
      {!isLoadingTasks && topLevelTasks.length === 0 && !searchQuery.trim() && !categoryFilter && !priorityFilter && !assigneeFilter && (
        <div
          data-testid="empty-board-state"
          className="mb-6 p-8 rounded-3xl bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/30 border-2 border-dashed border-sky-200 text-center shadow-xs animate-fade-in"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-3.5 shadow-md shadow-sky-500/20">
            <LayoutTemplate className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Sprint board is empty</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
            Kickstart your sprint in seconds by choosing a pre-built industry template or create tasks manually.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              data-testid="start-from-template-btn"
              onClick={() => setShowTemplatesModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>Start from a template</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTaskModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>
      )}

      {/* 4-Column Kanban Board */}
      {isLoadingTasks ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full animate-pulse items-start">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white border border-slate-200/80 p-3 shadow-xs" />
          ))}
        </div>
      ) : (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onAddTask={() => setShowTaskModal(true)}
          memberMap={memberMap}
          updatingTaskIds={updatingTaskIds}
        />
      )}
    </>
  );

  const modals = (
    <>
      <CreateTaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        projectId={projectId}
        members={members}
      />

      <TaskPanel
        projectId={projectId}
        tasks={tasks}
        memberMap={memberMap}
        isLoadingTasks={isLoadingTasks}
      />

      <AiPlanModal
        isOpen={showAiPlanModal}
        onClose={() => setShowAiPlanModal(false)}
        projectId={projectId}
      />

      <TemplateGallery
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        projectId={projectId}
        projectName={project?.name || 'this project'}
      />
    </>
  );

  if (isInsideLayout) {
    return (
      <div className="pb-8">
        {boardActionsAndKanban}
        {modals}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            to="/app/projects"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-sky-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </Link>
        </div>

        {/* Project Header Bar */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Active Sprint
              </span>
              {project?.deadline && (
                <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Due {project.deadline}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {project?.name || 'Project Workspace'}
            </h1>
            <p className="text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
              {project?.description || 'Collaborative agile task board.'}
            </p>

            {/* Tech Stack Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-3.5 text-xs font-medium">
              {project?.frontendStack && (
                <span className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" />
                  {project.frontendStack}
                </span>
              )}
              {project?.backendStack && (
                <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  {project.backendStack}
                </span>
              )}
              {project?.databaseStack && (
                <span className="px-3 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  {project.databaseStack}
                </span>
              )}
            </div>
          </div>
        </div>

        {boardActionsAndKanban}
      </main>

      {modals}
    </div>
  );
};

export default ProjectBoardPage;
