import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Plus, 
  Users, 
  Calendar, 
  AlertCircle, 
  X, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  UserPlus, 
  Layers, 
  Bug, 
  FileText, 
  CheckCircle2, 
  Paperclip, 
  ListTree, 
  Sparkles,
  Download,
  Trash2,
  Check
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import api from '../api/client';

export interface Task {
  id: string | number;
  title: string;
  description: string;
  status: 'Backlog' | 'In Progress' | 'Testing' | 'Completed' | string;
  priority: 'High' | 'Medium' | 'Low' | string;
  category: 'Frontend' | 'Backend' | 'Database' | 'Testing' | 'Documentation' | string;
  deadline?: string;
  assigneeName?: string;
  assigneeId?: string | number;
  projectId: string | number;
  subtaskCount?: number;
}

export const ProjectBoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Drawer Tabs: 'details' | 'subtasks' | 'bugs' | 'testcases' | 'attachments' | 'history' | 'comments'
  const [drawerTab, setDrawerTab] = useState<'details' | 'subtasks' | 'bugs' | 'testcases' | 'attachments' | 'history' | 'comments'>('details');

  // Drawer Sub-resources
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  const [bugs, setBugs] = useState<any[]>([]);
  const [newBugTitle, setNewBugTitle] = useState('');
  const [newBugSeverity, setNewBugSeverity] = useState('High');

  const [testCases, setTestCases] = useState<any[]>([]);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestExpected, setNewTestExpected] = useState('');

  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Add Task Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCategory, setTaskCategory] = useState('Frontend');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDeadline, setTaskDeadline] = useState('2026-10-30');
  const [submittingTask, setSubmittingTask] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${projectId}/tasks`);
      setTasks(res.data || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchTasks();
  }, [projectId]);

  const loadTaskDrawerDetails = async (task: Task) => {
    setSelectedTask(task);
    setDrawerTab('details');

    try {
      const [logsRes, commentsRes, subtasksRes, bugsRes, testsRes, attRes] = await Promise.allSettled([
        api.get(`/tasks/${task.id}/status-logs`),
        api.get(`/tasks/${task.id}/comments`),
        api.get(`/tasks/${task.id}/subtasks`),
        api.get(`/tasks/${task.id}/bugs`),
        api.get(`/tasks/${task.id}/test-cases`),
        api.get(`/tasks/${task.id}/attachments`),
      ]);

      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data || []);
      if (commentsRes.status === 'fulfilled') setComments(commentsRes.value.data || []);
      if (subtasksRes.status === 'fulfilled') setSubtasks(subtasksRes.value.data || []);
      if (bugsRes.status === 'fulfilled') setBugs(bugsRes.value.data || []);
      if (testsRes.status === 'fulfilled') setTestCases(testsRes.value.data || []);
      if (attRes.status === 'fulfilled') setAttachments(attRes.value.data || []);
    } catch (err) {
      console.error('Failed to load sub-resources:', err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTask) return;
    try {
      await api.patch(`/tasks/${selectedTask.id}/status`, { status: newStatus });
      setSelectedTask({ ...selectedTask, status: newStatus });
      fetchTasks();
      const logsRes = await api.get(`/tasks/${selectedTask.id}/status-logs`);
      setLogs(logsRes.data || []);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    try {
      await api.post(`/tasks/${selectedTask.id}/subtasks`, {
        title: newSubtaskTitle,
        category: selectedTask.category || 'Development',
        priority: 'Medium',
      });
      setNewSubtaskTitle('');
      const res = await api.get(`/tasks/${selectedTask.id}/subtasks`);
      setSubtasks(res.data || []);
    } catch (err) {
      alert('Failed to add subtask');
    }
  };

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newBugTitle.trim()) return;
    try {
      await api.post(`/tasks/${selectedTask.id}/bugs`, {
        title: newBugTitle,
        severity: newBugSeverity,
      });
      setNewBugTitle('');
      const res = await api.get(`/tasks/${selectedTask.id}/bugs`);
      setBugs(res.data || []);
    } catch (err) {
      alert('Failed to log bug');
    }
  };

  const handleResolveBug = async (bugId: string) => {
    try {
      await api.patch(`/bugs/${bugId}/resolve`);
      if (selectedTask) {
        const res = await api.get(`/tasks/${selectedTask.id}/bugs`);
        setBugs(res.data || []);
      }
    } catch {
      alert('Failed to resolve bug');
    }
  };

  const handleCreateTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newTestTitle.trim()) return;
    try {
      await api.post(`/tasks/${selectedTask.id}/test-cases`, {
        title: newTestTitle,
        expectedResult: newTestExpected,
        status: 'PASSED',
      });
      setNewTestTitle('');
      setNewTestExpected('');
      const res = await api.get(`/tasks/${selectedTask.id}/test-cases`);
      setTestCases(res.data || []);
    } catch (err) {
      alert('Failed to add test case');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/tasks/${selectedTask.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const res = await api.get(`/tasks/${selectedTask.id}/attachments`);
      setAttachments(res.data || []);
    } catch {
      alert('Failed to upload file. Maximum size allowed is 10MB.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    try {
      await api.delete(`/attachments/${attId}`);
      if (selectedTask) {
        const res = await api.get(`/tasks/${selectedTask.id}/attachments`);
        setAttachments(res.data || []);
      }
    } catch {
      alert('Failed to delete attachment');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/tasks/${selectedTask.id}/comments`, { content: newComment });
      setNewComment('');
      const commentsRes = await api.get(`/tasks/${selectedTask.id}/comments`);
      setComments(commentsRes.data || []);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTask(true);
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title: taskTitle,
        description: taskDesc,
        category: taskCategory,
        priority: taskPriority,
        deadline: taskDeadline,
        status: 'Backlog',
      });
      setIsAddModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmittingTask(false);
    }
  };

  const columns = [
    { name: 'Backlog', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' },
    { name: 'In Progress', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
    { name: 'Testing', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
    { name: 'Completed', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden bg-[#F7F9FC]">
        {/* Top Board Bar */}
        <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-5 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Link to="/projects" className="hover:text-[#1E2761] transition-colors font-medium">Projects</Link>
                <span>/</span>
                <span className="font-semibold text-[#1E2761]">Project #{projectId}</span>
              </div>
              <h2 className="font-heading font-extrabold text-2xl lg:text-3xl text-[#1E2761]">Agile Kanban Workspace</h2>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={`/projects/${projectId}/dashboard`}
                className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold transition-colors flex items-center gap-2"
              >
                Analytics & Reports
              </Link>
              <Link
                to={`/projects/${projectId}/ai-planner`}
                className="px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#00A896] text-sm font-semibold border border-teal-200 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                AI Planner
              </Link>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add task
              </button>
            </div>
          </div>

          {/* Module Navigation Tabs */}
          <div className="flex items-center gap-8 mt-5 border-t border-slate-100 pt-4 text-sm font-semibold">
            <span className="text-[#00A896] border-b-2 border-[#00A896] pb-2.5 cursor-pointer font-bold">
              Kanban Board
            </span>
            <Link to={`/projects/${projectId}/team`} className="text-slate-500 hover:text-slate-800 pb-2.5 transition-colors">
              Team & Roles
            </Link>
            <Link to={`/projects/${projectId}/dashboard`} className="text-slate-500 hover:text-slate-800 pb-2.5 transition-colors">
              Dashboard Reports
            </Link>
            <Link to={`/projects/${projectId}/calendar`} className="text-slate-500 hover:text-slate-800 pb-2.5 transition-colors">
              Calendar & Deadlines
            </Link>
            <Link to={`/projects/${projectId}/ai-planner`} className="text-slate-500 hover:text-slate-800 pb-2.5 transition-colors">
              AI QA Suite
            </Link>
          </div>
        </header>

        {/* Board Columns Area */}
        <div className="flex-1 p-6 lg:p-8 overflow-x-auto">
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-10 h-10 border-4 border-[#00A896] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-500 font-medium">Loading board columns...</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-6 min-w-[1320px] h-full items-start">
              {columns.map((col) => {
                const columnTasks = tasks.filter(
                  (t) => (t.status || 'Backlog').toLowerCase() === col.name.toLowerCase()
                );

                return (
                  <div
                    key={col.name}
                    className="bg-[#F1F5FD]/80 rounded-2xl p-5 border border-slate-200 flex flex-col max-h-full"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${col.dot}`}></span>
                        <h3 className="font-heading font-bold text-base text-[#1E2761]">{col.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${col.badge}`}>
                          {columnTasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setTaskCategory('Frontend');
                          setIsAddModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-slate-700 p-1"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Cards Stack */}
                    <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                      {columnTasks.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                          <p className="text-xs text-slate-400 font-medium">No tasks in {col.name}</p>
                        </div>
                      ) : (
                        columnTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => loadTaskDrawerDetails(task)}
                            className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-card hover:-translate-y-0.5 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <span className="text-xs font-mono font-bold text-slate-500">
                                #{String(task.id).slice(0, 6)}
                              </span>
                              <span
                                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getPriorityBadge(
                                  task.priority
                                )}`}
                              >
                                {task.priority || 'Medium'}
                              </span>
                            </div>

                            <h4 className="font-heading font-bold text-sm lg:text-base text-[#1E2761] mb-3 group-hover:text-[#00A896] transition-colors line-clamp-2">
                              {task.title}
                            </h4>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                                {task.category || 'Feature'}
                              </span>
                              {task.deadline && (
                                <span className="flex items-center gap-1.5 font-mono font-medium">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {task.deadline}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task Detail Slide-in Drawer with All Sub-Module Tabs */}
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Drawer Header */}
                <div className="p-7 border-b border-slate-200 flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400 block mb-1">
                      Task #{String(selectedTask.id).slice(0, 8)}
                    </span>
                    <h3 className="font-heading font-bold text-xl text-[#1E2761]">
                      {selectedTask.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Status Dropdown */}
                <div className="px-7 py-4 bg-[#F7F9FC] border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Sprint Stage</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold text-[#1E2761] focus:outline-none focus:border-[#00A896]"
                  >
                    <option value="Backlog">Backlog</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Testing">Testing</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                {/* Sub-resource Tabs Strip */}
                <div className="flex border-b border-slate-200 px-6 text-sm font-semibold bg-white overflow-x-auto">
                  <button
                    onClick={() => setDrawerTab('details')}
                    className={`py-3.5 px-3.5 border-b-2 transition-colors ${
                      drawerTab === 'details' ? 'border-[#00A896] text-[#00A896]' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setDrawerTab('subtasks')}
                    className={`py-3.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                      drawerTab === 'subtasks' ? 'border-[#00A896] text-[#00A896]' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Subtasks ({subtasks.length})
                  </button>
                  <button
                    onClick={() => setDrawerTab('bugs')}
                    className={`py-3.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                      drawerTab === 'bugs' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Bugs ({bugs.length})
                  </button>
                  <button
                    onClick={() => setDrawerTab('testcases')}
                    className={`py-3.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                      drawerTab === 'testcases' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tests ({testCases.length})
                  </button>
                  <button
                    onClick={() => setDrawerTab('attachments')}
                    className={`py-3.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                      drawerTab === 'attachments' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Files ({attachments.length})
                  </button>
                  <button
                    onClick={() => setDrawerTab('history')}
                    className={`py-3.5 px-3.5 border-b-2 transition-colors ${
                      drawerTab === 'history' ? 'border-[#00A896] text-[#00A896]' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Audit
                  </button>
                  <button
                    onClick={() => setDrawerTab('comments')}
                    className={`py-3.5 px-3.5 border-b-2 transition-colors ${
                      drawerTab === 'comments' ? 'border-[#00A896] text-[#00A896]' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Chat ({comments.length})
                  </button>
                </div>

                {/* Tab 1: Overview */}
                {drawerTab === 'details' && (
                  <div className="p-7 space-y-5">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
                      <p className="text-sm text-slate-700 leading-relaxed bg-[#F7F9FC] p-4 rounded-xl border border-slate-100">
                        {selectedTask.description || 'No detailed specifications added yet.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-4 bg-[#F7F9FC] rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-400 block uppercase mb-1">Category</span>
                        <span className="text-sm font-bold text-[#1E2761]">{selectedTask.category || 'General'}</span>
                      </div>
                      <div className="p-4 bg-[#F7F9FC] rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-400 block uppercase mb-1">Priority</span>
                        <span className="text-sm font-bold text-[#1E2761]">{selectedTask.priority || 'Medium'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Subtasks Module */}
                {drawerTab === 'subtasks' && (
                  <div className="p-7 space-y-5">
                    <form onSubmit={handleCreateSubtask} className="flex gap-2.5">
                      <input
                        type="text"
                        required
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Add subtask checklist item..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        Add
                      </button>
                    </form>

                    <div className="space-y-2.5">
                      {subtasks.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No subtasks added yet.</p>
                      ) : (
                        subtasks.map((st: any) => (
                          <div key={st.id} className="p-3.5 rounded-xl bg-[#F7F9FC] border border-slate-200 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-800">{st.title}</span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              {st.status || 'Backlog'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 3: Bug Tracker Module */}
                {drawerTab === 'bugs' && (
                  <div className="p-7 space-y-5">
                    <form onSubmit={handleCreateBug} className="space-y-3.5 bg-red-50/60 p-4 rounded-xl border border-red-200/70">
                      <span className="text-xs font-bold text-red-800 block">Report a Defect / Bug</span>
                      <input
                        type="text"
                        required
                        value={newBugTitle}
                        onChange={(e) => setNewBugTitle(e.target.value)}
                        placeholder="Bug description (e.g. 500 error on duplicate email)"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none"
                      />
                      <div className="flex justify-between items-center">
                        <select
                          value={newBugSeverity}
                          onChange={(e) => setNewBugSeverity(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-medium"
                        >
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          Log Bug
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2.5">
                      {bugs.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No open bugs for this task.</p>
                      ) : (
                        bugs.map((bug: any) => (
                          <div key={bug.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between text-sm">
                            <div>
                              <p className={`font-semibold ${bug.resolved ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {bug.title}
                              </p>
                              <span className="text-xs text-red-600 font-bold uppercase">{bug.severity} Severity</span>
                            </div>
                            {!bug.resolved ? (
                              <button
                                onClick={() => handleResolveBug(bug.id)}
                                className="px-3.5 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors"
                              >
                                Mark Resolved
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                                <Check className="w-4 h-4" /> Resolved
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: Test Cases Module */}
                {drawerTab === 'testcases' && (
                  <div className="p-7 space-y-5">
                    <form onSubmit={handleCreateTestCase} className="space-y-3 bg-[#F1F5FD] p-4 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-[#1E2761] block">Add Test Specification</span>
                      <input
                        type="text"
                        required
                        value={newTestTitle}
                        onChange={(e) => setNewTestTitle(e.target.value)}
                        placeholder="Test scenario (e.g. Verify 401 when token is expired)"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={newTestExpected}
                        onChange={(e) => setNewTestExpected(e.target.value)}
                        placeholder="Expected outcome"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none"
                      />
                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          className="px-5 py-2 bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          Record Test
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2.5">
                      {testCases.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No test cases recorded yet.</p>
                      ) : (
                        testCases.map((tc: any) => (
                          <div key={tc.id} className="p-3.5 rounded-xl bg-white border border-slate-200 text-sm">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-bold text-[#1E2761]">{tc.title}</span>
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                                {tc.status || 'PASSED'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-mono bg-slate-50 p-2.5 rounded">
                              Expected: {tc.expectedResult || 'Passes unit assertions'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 5: Cloudinary Attachments Module */}
                {drawerTab === 'attachments' && (
                  <div className="p-7 space-y-5">
                    <div className="p-5 border-2 border-dashed border-slate-200 rounded-xl text-center bg-[#F7F9FC]">
                      <Paperclip className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <label className="cursor-pointer inline-block px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#1E2761] shadow-xs hover:bg-slate-50 transition-colors">
                        {uploadingFile ? 'Uploading to Cloudinary...' : 'Upload Attachment (Max 10MB)'}
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-slate-500 mt-2">Images, PDF reports, or architecture diagrams</p>
                    </div>

                    <div className="space-y-2.5">
                      {attachments.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">No attachments uploaded yet.</p>
                      ) : (
                        attachments.map((att: any) => (
                          <div key={att.id} className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <Paperclip className="w-4 h-4 text-[#00A896] shrink-0" />
                              <a
                                href={att.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-slate-800 hover:text-[#00A896] truncate"
                              >
                                {att.fileName || 'Attachment Document'}
                              </a>
                            </div>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="text-red-500 hover:text-red-700 p-1.5"
                              title="Delete attachment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 6: Status History Audit Trail */}
                {drawerTab === 'history' && (
                  <div className="p-7">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-5">
                      Immutable Audit Trail (task_status_logs)
                    </h4>
                    {logs.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No transitions logged yet.</p>
                    ) : (
                      <div className="space-y-4 relative before:absolute before:inset-0 before:left-2 before:w-0.5 before:bg-slate-200">
                        {logs.map((log) => (
                          <div key={log.id} className="relative flex items-start gap-3.5 pl-6">
                            <span className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-[#00A896] ring-4 ring-white"></span>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {log.fromStatus} → <span className="text-[#00A896] font-bold">{log.toStatus}</span>
                              </p>
                              <span className="text-xs text-slate-400">
                                by {log.changedByName || log.changedByEmail || 'Teammate'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 7: Comments Thread */}
                {drawerTab === 'comments' && (
                  <div className="p-7">
                    <div className="space-y-3.5 mb-5 max-h-80 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No comments yet. Start the conversation!</p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-bold text-[#1E2761]">{c.authorName || c.authorEmail || 'Member'}</span>
                              <span className="text-xs text-slate-400">{c.createdAt?.slice(0, 10)}</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddComment}>
                      <textarea
                        rows={3}
                        required
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment or paste PR link..."
                        className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00A896]"
                      />
                      <div className="flex justify-end mt-3">
                        <button
                          type="submit"
                          disabled={submittingComment}
                          className="px-5 py-2 rounded-lg bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold transition-colors"
                        >
                          {submittingComment ? 'Posting...' : 'Post comment'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E2761]/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-modal border border-slate-200 p-7">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <h3 className="font-heading font-bold text-lg text-[#1E2761]">Create New Task</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title *</label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Implement JWT filter"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Acceptance criteria and notes"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
                    <select
                      value={taskCategory}
                      onChange={(e) => setTaskCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                    >
                      <option value="Frontend">Frontend</option>
                      <option value="Backend">Backend</option>
                      <option value="Database">Database</option>
                      <option value="Testing">Testing</option>
                      <option value="Documentation">Documentation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deadline</label>
                  <input
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTask}
                    className="px-6 py-2.5 rounded-lg bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold shadow-sm transition-all"
                  >
                    {submittingTask ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
