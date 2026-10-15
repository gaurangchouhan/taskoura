import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Sparkles, 
  Users, 
  TestTube, 
  Bug as BugIcon, 
  Calendar, 
  Filter, 
  Layers,
  Code2,
  Server,
  Database,
  CheckCircle2,
  AlertCircle,
  Play
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { KanbanBoard } from '../components/KanbanBoard';
import { taskService, projectService, aiService } from '../services/api';
import { Task, Project, KanbanStatus, TaskCategory, Priority } from '../types';

const DEFAULT_BOARD_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Implement Interactive Scrollytelling Hero',
    category: 'Frontend',
    priority: 'High',
    status: 'Completed',
    assignedToName: 'Gaurang C',
    deadline: 'Oct 28',
    progress: 100,
    subtaskCount: 4,
    completedSubtaskCount: 4,
  },
  {
    id: 't-2',
    title: 'PostgreSQL Hikari Pool & Dialect Optimization',
    category: 'Database',
    priority: 'High',
    status: 'Completed',
    assignedToName: 'Database Lead',
    deadline: 'Oct 29',
    progress: 100,
    subtaskCount: 3,
    completedSubtaskCount: 3,
  },
  {
    id: 't-3',
    title: 'Integrate Grok AI Sprint Story Decomposition',
    category: 'Backend',
    priority: 'High',
    status: 'InProgress',
    assignedToName: 'Alex Rivera',
    deadline: 'Nov 02',
    progress: 65,
    subtaskCount: 5,
    completedSubtaskCount: 3,
  },
  {
    id: 't-4',
    title: 'End-to-End Cypress Integration Test Suite',
    category: 'Testing',
    priority: 'Medium',
    status: 'Review',
    assignedToName: 'Maya Patel',
    deadline: 'Nov 04',
    progress: 85,
    subtaskCount: 4,
    completedSubtaskCount: 3,
  },
  {
    id: 't-5',
    title: 'Cloudinary Multi-file Attachment Uploader',
    category: 'Frontend',
    priority: 'Medium',
    status: 'Backlog',
    assignedToName: 'Frontend Lead',
    deadline: 'Nov 08',
    progress: 0,
    subtaskCount: 3,
    completedSubtaskCount: 0,
  },
  {
    id: 't-6',
    title: 'JWT Refresh Token Rotation & Blacklist',
    category: 'Backend',
    priority: 'High',
    status: 'Backlog',
    assignedToName: 'Security Lead',
    deadline: 'Nov 10',
    progress: 0,
    subtaskCount: 4,
    completedSubtaskCount: 0,
  },
];

export const ProjectBoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_BOARD_TASKS);
  const [loading, setLoading] = useState(true);

  // New Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Frontend');
  const [taskPriority, setTaskPriority] = useState<Priority>('Medium');
  const [taskStatus, setTaskStatus] = useState<KanbanStatus>('Backlog');
  const [taskAssignee, setTaskAssignee] = useState('Alex Rivera');
  const [taskDeadline, setTaskDeadline] = useState('Nov 15');

  // AI Task Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId) return;
      try {
        const projData = await projectService.getById(projectId);
        setProject(projData);
        const taskData = await taskService.getByProject(projectId);
        if (taskData && taskData.length > 0) {
          setTasks(taskData);
        }
      } catch {
        // Backend offline, fallback to mock project
        setProject({
          id: projectId,
          name: 'Taskoura Engineering Platform',
          description: 'Autonomous project management & scrollytelling interface for software teams.',
          frontendStack: 'React + TypeScript + Vite + Tailwind',
          backendStack: 'Java 21 + Spring Boot 3.3',
          databaseStack: 'PostgreSQL + Cloudinary',
          deadline: '2026-11-15',
          role: 'Owner',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProjectData();
  }, [projectId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: taskTitle,
      category: taskCategory,
      priority: taskPriority,
      status: taskStatus,
      assignedToName: taskAssignee,
      deadline: taskDeadline,
      progress: taskStatus === 'Completed' ? 100 : taskStatus === 'InProgress' ? 40 : 0,
      subtaskCount: 2,
      completedSubtaskCount: taskStatus === 'Completed' ? 2 : 0,
    };

    if (projectId) {
      try {
        await taskService.create(projectId, newTask);
      } catch {
        // Fallback local
      }
    }

    setTasks([newTask, ...tasks]);
    setShowTaskModal(false);
    setTaskTitle('');
  };

  const handleTaskClick = async (clickedTask: Task) => {
    // Cycle status through workflow on click: Backlog -> InProgress -> Review -> Completed
    const cycle: Record<KanbanStatus, KanbanStatus> = {
      Backlog: 'InProgress',
      InProgress: 'Review',
      Review: 'Completed',
      Completed: 'Backlog',
    };
    const nextStatus = cycle[clickedTask.status];

    try {
      await taskService.updateStatus(clickedTask.id, nextStatus);
    } catch {
      // Local fallback
    }

    setTasks(
      tasks.map((t) =>
        t.id === clickedTask.id
          ? {
              ...t,
              status: nextStatus,
              progress: nextStatus === 'Completed' ? 100 : nextStatus === 'InProgress' ? 50 : 0,
            }
          : t
      )
    );
  };

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingAi(true);

    try {
      if (projectId) {
        const aiTasks = await aiService.generateTasks(projectId, aiPrompt);
        if (aiTasks && aiTasks.length > 0) {
          setTasks([...aiTasks, ...tasks]);
          setShowAiModal(false);
          setAiPrompt('');
          return;
        }
      }
    } catch {
      // Offline fallback: generate structured tasks locally
    }

    const generatedMock: Task[] = [
      {
        id: `ai-${Date.now()}-1`,
        title: `Implement ${aiPrompt} UI Components`,
        category: 'Frontend',
        priority: 'High',
        status: 'Backlog',
        assignedToName: 'Sarah Lin',
        deadline: 'Nov 12',
        progress: 0,
      },
      {
        id: `ai-${Date.now()}-2`,
        title: `Create REST Controller & DTOs for ${aiPrompt}`,
        category: 'Backend',
        priority: 'High',
        status: 'Backlog',
        assignedToName: 'Alex Rivera',
        deadline: 'Nov 14',
        progress: 0,
      },
      {
        id: `ai-${Date.now()}-3`,
        title: `Write Unit Tests for ${aiPrompt} Service Logic`,
        category: 'Testing',
        priority: 'Medium',
        status: 'Backlog',
        assignedToName: 'Maya Patel',
        deadline: 'Nov 16',
        progress: 0,
      },
    ];

    setTasks([...generatedMock, ...tasks]);
    setGeneratingAi(false);
    setShowAiModal(false);
    setAiPrompt('');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Project Header Bar */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Active Sprint
              </span>
              {project?.deadline && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Due {project.deadline}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {project?.name || 'Project Workspace'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              {project?.description || 'Collaborative agile task board.'}
            </p>

            {/* Tech Stack Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
              {project?.frontendStack && (
                <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  {project.frontendStack}
                </span>
              )}
              {project?.backendStack && (
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  {project.backendStack}
                </span>
              )}
              {project?.databaseStack && (
                <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {project.databaseStack}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAiModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>AI Plan Tasks</span>
            </button>

            <button
              onClick={() => {
                setTaskStatus('Backlog');
                setShowTaskModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Board Instruction Tip */}
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span>
              <strong>Tip:</strong> Click any task card to advance it through the workflow pipeline (Backlog → In Progress → Review → Completed).
            </span>
          </div>
          <span className="text-[11px] font-semibold text-sky-600 hidden sm:inline">
            Total {tasks.length} tasks
          </span>
        </div>

        {/* 4-Column Kanban Board */}
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onAddTask={(status) => {
            setTaskStatus(status);
            setShowTaskModal(true);
          }}
        />
      </main>

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create Task</h3>
            <p className="text-xs text-slate-500 mb-5">
              Add a new ticket to your project sprint.
            </p>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Implement OTP Verification"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value as TaskCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white"
                  >
                    <option value="Frontend">Frontend</option>
                    <option value="Backend">Backend</option>
                    <option value="Database">Database</option>
                    <option value="Testing">Testing</option>
                    <option value="Documentation">Docs</option>
                    <option value="Bug">Defect / Bug</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as KanbanStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white"
                  >
                    <option value="Backlog">Backlog</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assignee
                  </label>
                  <input
                    type="text"
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-sky-500 transition-colors"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Task Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">AI Task Breakdown Copilot</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Enter a high-level user story. Taskoura will generate specialized frontend, backend, and testing tickets automatically.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Feature or User Story Description
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Implement Google OAuth2 Social Login with JWT session generation"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={generatingAi || !aiPrompt.trim()}
                  onClick={handleGenerateAi}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-xs font-bold rounded-xl shadow-md hover:from-indigo-500 hover:to-sky-500 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generatingAi ? 'Generating Tasks...' : 'Generate Sprint Tasks'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
