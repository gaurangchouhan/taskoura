import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  FolderGit2, 
  Layers, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  BarChart3,
  Search,
  Server,
  Code2,
  Database,
  TestTube,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { data: projects = [], isLoading, isError, error, refetch } = useProjects();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase()) ||
    p.frontendStack?.toLowerCase().includes(search.toLowerCase()) ||
    p.backendStack?.toLowerCase().includes(search.toLowerCase())
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

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Workspaces</span>
              <span className="text-2xl font-bold text-slate-900 block mt-1">{projects.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <FolderGit2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Engineering Tasks</span>
              <span className="text-2xl font-bold text-emerald-600 block mt-1">24 Active</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Release Readiness</span>
              <span className="text-2xl font-bold text-indigo-600 block mt-1">94% Passed</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name or technology stack..."
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors shadow-xs"
          />
        </div>

        {/* Project States: Loading, Error, Empty, or Cards Grid */}
        {isLoading ? (
          <div data-testid="projects-skeleton" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs animate-pulse flex flex-col justify-between h-56"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-16 h-4 bg-slate-200 rounded-full" />
                    <div className="w-20 h-4 bg-slate-100 rounded-full" />
                  </div>
                  <div className="w-3/4 h-5 bg-slate-200 rounded-md mb-3" />
                  <div className="w-full h-3 bg-slate-100 rounded-md mb-2" />
                  <div className="w-2/3 h-3 bg-slate-100 rounded-md" />
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="w-24 h-4 bg-slate-200 rounded-md" />
                  <div className="w-4 h-4 bg-slate-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div data-testid="projects-error" className="py-12 text-center bg-white rounded-3xl border border-rose-200 p-8 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-rose-900 text-base">Failed to load projects</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              {(error as Error)?.message === 'Network Error'
                ? 'Unable to connect to the backend server. Please verify the backend is running (mvn spring-boot:run).'
                : (error as Error)?.message || 'An error occurred while fetching your projects.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              Try Again
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div data-testid="empty-projects" className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No projects found</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5 max-w-sm mx-auto">
              Create your first project to begin organizing sprints and assigning engineering tasks.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Create your first project</span>
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <p className="text-sm text-slate-600">
              No projects match your search for "{search}".
            </p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-3 text-sm text-sky-600 font-semibold hover:underline cursor-pointer"
            >
              Clear search filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((p) => {
              const isOwner = p.role ? p.role === 'Owner' : Boolean(user?.id && p.ownerId === user.id);

              return (
                <Link
                  key={p.id}
                  to={`/app/projects/${p.id}`}
                  className="group relative flex flex-col justify-between p-6 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-200 hover:-translate-y-1"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      {isOwner ? (
                        <span
                          data-testid="owner-badge"
                          className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          Owner
                        </span>
                      ) : (
                        <span
                          data-testid="member-badge"
                          className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200"
                        >
                          {p.role || 'Member'}
                        </span>
                      )}
                      {p.deadline && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Due {p.deadline}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1 mb-2">
                      {p.name}
                    </h3>

                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4">
                      {p.description || 'Collaborative software engineering workspace.'}
                    </p>

                    {/* Tech stack badges */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                      {p.frontendStack && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Code2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="truncate">{p.frontendStack}</span>
                        </div>
                      )}
                      {p.backendStack && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Server className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{p.backendStack}</span>
                        </div>
                      )}
                      {p.databaseStack && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Database className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="truncate">{p.databaseStack}</span>
                        </div>
                      )}
                      {p.testingStack && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <TestTube className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">{p.testingStack}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-sky-600">
                    <span>Open Workspace</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      <CreateProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
};

export default DashboardPage;
