import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  FolderGit2, 
  Layers, 
  Calendar, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  BarChart3,
  Search,
  Sparkles,
  Server,
  Code2,
  Database
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { projectService } from '../services/api';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';

const DEMO_PROJECTS: Project[] = [
  {
    id: 'demo-1',
    name: 'Taskoura Engineering Platform',
    description: 'Autonomous project management & scrollytelling interface for software teams.',
    frontendStack: 'React + TypeScript + Vite + Tailwind',
    backendStack: 'Java 21 + Spring Boot 3.3',
    databaseStack: 'PostgreSQL + Cloudinary',
    testingStack: 'JUnit 5 + Mockito + Cypress',
    deadline: '2026-11-15',
    role: 'Owner',
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'demo-2',
    name: 'Autonomous Agent Dispatcher',
    description: 'High-throughput asynchronous task queue with WebSocket updates.',
    frontendStack: 'Next.js 14 + Shadcn UI',
    backendStack: 'Go + Gin + Redis',
    databaseStack: 'PostgreSQL',
    testingStack: 'Go Testify',
    deadline: '2026-12-01',
    role: 'Member',
    createdAt: '2026-09-15T12:00:00Z',
  },
];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFrontend, setNewFrontend] = useState('React + TypeScript');
  const [newBackend, setNewBackend] = useState('Spring Boot');
  const [newDatabase, setNewDatabase] = useState('PostgreSQL');
  const [newDeadline, setNewDeadline] = useState('2026-12-15');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await projectService.getAll();
        setProjects(data.length > 0 ? data : DEMO_PROJECTS);
      } catch {
        // Backend offline, fallback to demo projects
        setProjects(DEMO_PROJECTS);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const created = await projectService.create({
        name: newName,
        description: newDesc,
        frontendStack: newFrontend,
        backendStack: newBackend,
        databaseStack: newDatabase,
        deadline: newDeadline,
      });
      setProjects([created, ...projects]);
    } catch {
      // Offline fallback: add locally
      const mockProject: Project = {
        id: `project-${Date.now()}`,
        name: newName,
        description: newDesc,
        frontendStack: newFrontend,
        backendStack: newBackend,
        databaseStack: newDatabase,
        deadline: newDeadline,
        role: 'Owner',
        createdAt: new Date().toISOString(),
      };
      setProjects([mockProject, ...projects]);
    } finally {
      setCreating(false);
      setShowModal(false);
      setNewName('');
      setNewDesc('');
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header Greeting & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {user?.name?.split(' ')[0] || 'Developer'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select an active project workspace or initialize a new sprint.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Active Workspaces</span>
              <span className="text-2xl font-bold text-slate-900 block mt-1">{projects.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <FolderGit2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Engineering Tasks</span>
              <span className="text-2xl font-bold text-emerald-600 block mt-1">24 Active</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Release Readiness</span>
              <span className="text-2xl font-bold text-indigo-600 block mt-1">94% Passed</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name or technology stack..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors shadow-xs"
          />
        </div>

        {/* Project Cards Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            Loading project environments...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8">
            <FolderGit2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">No projects found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Create your first project to begin organizing sprints and assigning tasks.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-xl shadow-xs"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group relative flex flex-col justify-between p-6 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-200 hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                      {p.role || 'Project'}
                    </span>
                    {p.deadline && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Due {p.deadline}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1 mb-2">
                    {p.name}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                    {p.description || 'Collaborative software engineering workspace.'}
                  </p>

                  {/* Tech stack badges */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 text-[11px]">
                    {p.frontendStack && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Code2 className="w-3 h-3 text-sky-500" />
                        <span className="truncate">{p.frontendStack}</span>
                      </div>
                    )}
                    {p.backendStack && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Server className="w-3 h-3 text-indigo-500" />
                        <span className="truncate">{p.backendStack}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-sky-600">
                  <span>Open Kanban Workspace</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Project</h3>
            <p className="text-xs text-slate-500 mb-5">
              Set project name, stack architecture, and target release milestone.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Distributed Payment Engine"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Outline feature objectives, technical scope, and team goals..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Frontend Stack
                  </label>
                  <input
                    type="text"
                    value={newFrontend}
                    onChange={(e) => setNewFrontend(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Backend Stack
                  </label>
                  <input
                    type="text"
                    value={newBackend}
                    onChange={(e) => setNewBackend(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Database
                  </label>
                  <input
                    type="text"
                    value={newDatabase}
                    onChange={(e) => setNewDatabase(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Milestone Deadline
                  </label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-sky-500 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Initialize Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
