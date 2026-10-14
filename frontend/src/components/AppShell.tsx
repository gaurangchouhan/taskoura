import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useParams, Link } from 'react-router-dom';
import { 
  LayoutGrid, 
  Fingerprint, 
  LogOut, 
  Layers, 
  Bell, 
  Calendar as CalendarIcon, 
  BarChart3, 
  Sparkles, 
  UserCheck, 
  Check, 
  User as UserIcon,
  X,
  Menu,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export interface NotificationItem {
  id: string;
  message: string;
  read: boolean;
  type?: string;
  createdAt?: string;
}

export const AppShell: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId || null);

  useEffect(() => {
    if (projectId) {
      setActiveProjectId(projectId);
      localStorage.setItem('taskoura_last_project', projectId);
    } else {
      const saved = localStorage.getItem('taskoura_last_project');
      if (saved) setActiveProjectId(saved);
    }
  }, [projectId]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const list = res.data || [];
      setNotifications(list);
      setUnreadCount(list.filter((n: NotificationItem) => !n.read).length);
    } catch {
      // Notification fetch fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Fallback
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#F7F9FC] text-[#0B1C30] overflow-hidden">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-[#1E2761]/40 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* 280px Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-sm transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Brand Logo */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1E2761] to-[#00A896] flex items-center justify-center text-white shadow-md">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <span className="font-heading font-extrabold text-xl text-[#1E2761] tracking-tight">Taskoura</span>
                <span className="block text-xs font-bold text-[#00A896] uppercase tracking-wider mt-0.5">Agile Lab Suite</span>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-3.5 py-2">
              Workspace Core
            </div>

            <NavLink
              to="/projects"
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-[#F1F5FD] text-[#1E2761] shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <LayoutGrid className="w-5 h-5 text-[#00A896]" />
              Projects & Templates
            </NavLink>

            {activeProjectId && (
              <>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-3.5 pt-4 pb-1.5">
                  Active Project Modules
                </div>

                <NavLink
                  to={`/projects/${activeProjectId}/board`}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isActive
                        ? 'bg-[#F1F5FD] text-[#1E2761]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <Layers className="w-5 h-5 text-[#1E2761]" />
                  Kanban & Tasks
                </NavLink>

                <NavLink
                  to={`/projects/${activeProjectId}/dashboard`}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isActive
                        ? 'bg-[#F1F5FD] text-[#1E2761]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Analytics & Reports
                </NavLink>

                <NavLink
                  to={`/projects/${activeProjectId}/ai-planner`}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-teal-50 to-indigo-50 text-[#1E2761] border border-teal-200/60'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <Sparkles className="w-5 h-5 text-[#00A896]" />
                  AI Planning & Tests
                </NavLink>

                <NavLink
                  to={`/projects/${activeProjectId}/calendar`}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isActive
                        ? 'bg-[#F1F5FD] text-[#1E2761]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <CalendarIcon className="w-5 h-5 text-amber-600" />
                  Calendar & Deadlines
                </NavLink>

                <NavLink
                  to={`/projects/${activeProjectId}/team`}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isActive
                        ? 'bg-[#F1F5FD] text-[#1E2761]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  Team & Roles
                </NavLink>
              </>
            )}

            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-3.5 pt-4 pb-1.5">
              Hardware & Profile
            </div>

            <NavLink
              to="/checkin"
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-[#F1F5FD] text-[#1E2761]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Fingerprint className="w-5 h-5 text-[#00A896]" />
              IoT Biometric Check-in
            </NavLink>

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-[#F1F5FD] text-[#1E2761]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <UserIcon className="w-5 h-5 text-slate-500" />
              Student Profile
            </NavLink>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          <div className="p-3.5 rounded-2xl bg-[#F7F9FC] border border-slate-100 mb-2.5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1E2761] to-[#00A896] flex items-center justify-center text-white font-bold text-sm uppercase shadow-sm">
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-bold text-[#1E2761] truncate">{user?.fullName || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 bg-white border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between shrink-0 shadow-xs z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-[#1E2761] hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-heading font-extrabold text-2xl text-[#1E2761] tracking-tight">{title || 'Workspace'}</h1>
          </div>
          
          <div className="flex items-center gap-4 lg:gap-6">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Hardware Synced
            </span>

            {/* Notification Bell Button */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-xl text-slate-500 hover:text-[#1E2761] hover:bg-slate-100 transition-colors"
                title="Notifications & Activity"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
                )}
              </button>

              {/* Notification Dropdown Menu */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-modal border border-slate-200 p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="font-heading font-bold text-xs text-[#1E2761]">
                      Notifications ({unreadCount} unread)
                    </span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400">No notifications yet</p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl text-xs transition-colors flex items-start justify-between gap-2 ${
                            n.read ? 'bg-slate-50 text-slate-600' : 'bg-teal-50/60 border border-teal-100 text-[#1E2761] font-medium'
                          }`}
                        >
                          <p className="leading-snug text-[11px]">{n.message}</p>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="text-[#00A896] hover:text-[#008C7D] shrink-0 p-1"
                              title="Mark read"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Top Bar Avatar Menu (Stitch Screen 5) */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                aria-label="User account menu"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1E2761] to-[#00A896] flex items-center justify-center text-white font-bold text-xs uppercase shadow-xs">
                  {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-modal border border-slate-200 p-2 z-50 animate-in fade-in-50 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-sm font-bold text-[#1E2761] truncate">{user?.fullName || 'Student Engineer'}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#1E2761] transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      Account Settings
                    </Link>
                    <Link
                      to="/checkin"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#1E2761] transition-colors"
                    >
                      <Fingerprint className="w-4 h-4 text-[#00A896]" />
                      Biometric Check-in
                    </Link>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
