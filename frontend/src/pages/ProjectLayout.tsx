import React, { useRef, useEffect } from 'react';
import { useParams, Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  FolderGit2, 
  ChevronRight, 
  ArrowLeft, 
  Calendar, 
  Code2, 
  Server, 
  Database, 
  TestTube,
  Trash2
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Navbar } from '../components/Navbar';
import { projectTabs } from '../components/projects/projectTabs';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal';
import { BioLockSetupChecklist } from '../features/projects/components/BioLockSetupChecklist';
import { useProjects } from '../hooks/useProjects';
import { useMembers, useCurrentMembership } from '../hooks/useMembers';
import { useAuth } from '../context/AuthContext';

export const ProjectLayout: React.FC = () => {
  const { projectId: rawProjectId, id: rawId } = useParams<{ projectId?: string; id?: string }>();
  const projectId = rawProjectId || rawId;
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading, isError, error } = useProjects();
  const { isOwner: isMemberOwner } = useCurrentMembership(projectId);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);

  const tabScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  // Monitor query cache for 404 errors on any query related to this project
  const has404Error = React.useSyncExternalStore(
    React.useCallback((onStoreChange) => queryClient.getQueryCache().subscribe(onStoreChange), [queryClient]),
    React.useCallback(() => {
      if (!projectId) return false;
      const queries = queryClient.getQueryCache().getAll();
      return queries.some((q) => {
        const key = q.queryKey;
        const matchesProject =
          (key[0] === 'projects' && key[1] === projectId) ||
          (key[0] === 'tasks' && key[2] === projectId);
        if (!matchesProject) return false;
        const err = q.state.error as any;
        return err?.response?.status === 404 || err?.status === 404;
      });
    }, [queryClient, projectId])
  );

  const project = projects.find((p) => p.id === projectId);
  const isOwner = project?.role
    ? project.role === 'Owner'
    : Boolean((user?.id && project?.ownerId === user.id) || isMemberOwner);

  // Scroll active tab into view when route changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [location.pathname]);

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col layout-app">
        <Navbar />
        <main className="flex-1 max-w-page w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-28 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="w-48 h-4 bg-slate-200 rounded-md" />
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="w-1/3 h-6 bg-slate-200 rounded-md" />
              <div className="w-2/3 h-4 bg-slate-100 rounded-md" />
              <div className="flex gap-2 pt-2">
                <div className="w-20 h-6 bg-slate-100 rounded-lg" />
                <div className="w-20 h-6 bg-slate-100 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-4 border-b border-slate-200 pb-2">
              <div className="w-24 h-8 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Project not found state (or 404 on any project query)
  if (!project || has404Error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col layout-app">
        <Navbar />
        <main className="flex-1 max-w-page w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-28 pb-16 flex items-center justify-center">
          <div
            data-testid="project-not-found"
            className="text-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm max-w-md w-full"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <FolderGit2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Project not found</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              The project you requested either does not exist, has been removed, or you do not have permission to access it.
            </p>
            <Link
              to="/app/projects"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Projects</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col layout-app">
      <Navbar />

      <main className="flex-1 max-w-page w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-28 pb-16 min-w-0">
        {/* Breadcrumb Navigation - Truncates smoothly with ellipsis */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-semibold text-slate-500 mb-4 min-w-0">
          <Link
            to="/app/projects"
            className="hover:text-sky-600 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <FolderGit2 className="w-4 h-4 text-slate-400" />
            <span>Projects</span>
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-slate-900 font-bold truncate min-w-0">{project.name}</span>
        </nav>

        {/* Project Header Bar */}
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs mb-6 min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-2 flex-wrap min-w-0">
                {isOwner ? (
                  <span
                    data-testid="owner-badge"
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                  >
                    Owner
                  </span>
                ) : (
                  <span
                    data-testid="member-badge"
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 shrink-0"
                  >
                    {project.role || 'Member'}
                  </span>
                )}
                {project.deadline && (
                  <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Due {project.deadline}</span>
                  </span>
                )}
              </div>

              {/* Fluid heading clamped between 24px mobile and 30px desktop */}
              <h1
                className="font-extrabold text-slate-900 tracking-tight break-words [overflow-wrap:anywhere] min-w-0 max-w-full"
                style={{ fontSize: 'clamp(1.5rem, 2.5vw + 0.75rem, 1.875rem)' }}
              >
                {project.name}
              </h1>
              <p className="text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed break-words [overflow-wrap:anywhere]">
                {project.description || 'Collaborative software engineering workspace.'}
              </p>

              {/* Tech Stack Pills */}
              <div className="flex flex-wrap items-center gap-2 mt-3.5 text-xs font-medium">
                {project.frontendStack && (
                  <span className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>{project.frontendStack}</span>
                  </span>
                )}
                {project.backendStack && (
                  <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{project.backendStack}</span>
                  </span>
                )}
                {project.databaseStack && (
                  <span className="px-3 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-purple-600" />
                    <span>{project.databaseStack}</span>
                  </span>
                )}
                {project.testingStack && (
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                    <TestTube className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{project.testingStack}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions for Project Owner */}
            {isOwner && (
              <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                <button
                  type="button"
                  data-testid="delete-project-button"
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 rounded-xl transition-all cursor-pointer shadow-2xs"
                  aria-label="Delete project"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Delete project</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BioLock Setup Checklist for Project Owner */}
        <BioLockSetupChecklist projectId={project.id} isOwner={isOwner} />

        {/* Tab Strip with edge fade hints and horizontal scroll below md */}
        <div className="relative mb-6">
          {/* Edge fade hint on right for mobile */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#f8fafc] to-transparent z-10 md:hidden" />

          <div
            ref={tabScrollRef}
            className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto scroll-smooth snap-x snap-mandatory md:snap-none -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {projectTabs.map((tab) => {
              if (tab.ownerOnly && !isOwner) {
                return null;
              }

              const isBoardTab = tab.key === 'board' || tab.path === '' || tab.path === 'board';
              const isTabActive = isBoardTab
                ? location.pathname === `/app/projects/${projectId}` ||
                  location.pathname === `/app/projects/${projectId}/board` ||
                  location.pathname === `/projects/${projectId}`
                : location.pathname.endsWith(`/${tab.path}`);

              const targetPath = tab.path
                ? `/app/projects/${projectId}/${tab.path}`
                : `/app/projects/${projectId}`;

              return (
                <NavLink
                  key={tab.key}
                  to={targetPath}
                  end={tab.path === ''}
                  ref={isTabActive ? activeTabRef : null}
                  className={() =>
                    `px-5 py-3 text-sm font-bold rounded-t-xl transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap snap-start shrink-0 min-h-[44px] ${
                      isTabActive
                        ? 'border-sky-600 text-sky-600 bg-sky-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Child Tab Outlet */}
        <Outlet context={{ project }} />

        {/* Delete Project Modal */}
        {isOwner && project && (
          <DeleteProjectModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            project={project}
          />
        )}
      </main>
    </div>
  );
};

export default ProjectLayout;
