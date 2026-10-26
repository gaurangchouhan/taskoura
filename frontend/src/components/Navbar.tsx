import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Layers, 
  Sparkles, 
  BarChart3, 
  Workflow, 
  ArrowRight, 
  Menu, 
  X, 
  FolderGit2,
  User as UserIcon,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { isTokenExpired } from '../lib/token';
import { scrollToSection } from '../lib/scroll';
import { NotificationBell } from './notifications/NotificationBell';
import { useAuth } from '../context/AuthContext';

function getInitials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  );
}

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const hasValidToken = !isTokenExpired();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [userMenuOpen]);

  const navLinks = [
    { name: 'Features', href: '/#features', icon: Layers },
    { name: 'How It Works', href: '/#how-it-works', icon: Workflow },
    { name: 'AI Assistance', href: '/#ai-assistance', icon: Sparkles },
    { name: 'Analytics', href: '/#analytics', icon: BarChart3 },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    scrollToSection(href, navigate, location.pathname);
    setMobileMenuOpen(false);
  };

  const initials = getInitials(user?.name || '');
  const avatarUrl = (user as { profile?: { avatarUrl?: string | null }; avatarUrl?: string | null } | null)?.profile?.avatarUrl ||
    (user as { profile?: { avatarUrl?: string | null }; avatarUrl?: string | null } | null)?.avatarUrl;

  return (
    <header
      data-testid="topbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-md shadow-sm border-b border-slate-200/80 py-3.5'
          : 'bg-white/60 backdrop-blur-sm border-b border-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo & Wordmark */}
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-500 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
              <FolderGit2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors">
                Taskoura
              </span>
              <span className="text-xs tracking-wider uppercase font-semibold text-sky-600 -mt-0.5">
                Engineering OS
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 p-1.5 rounded-full border border-slate-200/60 shadow-inner">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-sky-600 hover:bg-white rounded-full transition-all duration-150"
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </a>
              );
            })}
          </nav>

          {/* Right Action Buttons / User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {hasValidToken ? (
              <div className="flex items-center gap-3">
                <NotificationBell />

                {/* Topbar User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    data-testid="user-menu-btn"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-slate-100/80 border border-slate-200/80 bg-white/60 shadow-xs transition-all cursor-pointer select-none"
                  >
                    <div
                      data-testid="topbar-avatar"
                      className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0 overflow-hidden"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={user?.name || 'User'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <span
                      data-testid="topbar-user-name"
                      className="text-xs font-bold text-slate-800 max-w-[140px] truncate"
                    >
                      {user?.name ? `${user.name} ▾` : 'Developer'}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div
                      data-testid="user-menu"
                      className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
                    >
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {user?.name || 'Developer'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {user?.email}
                        </div>
                      </div>

                      <Link
                        to="/app/profile"
                        data-testid="user-menu-profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Profile</span>
                      </Link>

                      <Link
                        to="/app/projects"
                        data-testid="user-menu-workspace"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                      >
                        <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Workspaces</span>
                      </Link>

                      <button
                        type="button"
                        data-testid="user-menu-logout"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>Log out</span>
                      </button>
                    </div>
                  )}
                </div>

                <Link
                  to="/app/projects"
                  className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all duration-200 whitespace-nowrap"
                >
                  <span>Open workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-2 transition-colors whitespace-nowrap"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile actions & hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            {hasValidToken && <NotificationBell />}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer / Sidebar */}
      {mobileMenuOpen && (
        <div
          data-testid="sidebar"
          className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-4 pt-3 pb-6 mt-3 space-y-3 shadow-xl"
        >
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 rounded-xl transition"
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </a>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {hasValidToken ? (
              <>
                <div className="px-3 py-2 bg-slate-50 rounded-xl mb-1 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user?.name || 'User'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{user?.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
                  </div>
                </div>

                <Link
                  to="/app/profile"
                  data-testid="sidebar-profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-left py-2.5 px-3.5 rounded-xl hover:bg-slate-100 text-slate-700 text-sm font-semibold transition flex items-center gap-2"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span>Profile</span>
                </Link>

                <Link
                  to="/app/projects"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-left py-2.5 px-3.5 rounded-xl hover:bg-slate-100 text-slate-700 text-sm font-semibold transition flex items-center gap-2"
                >
                  <FolderGit2 className="w-4 h-4 text-slate-400" />
                  <span>Workspace</span>
                </Link>

                <Link
                  to="/app/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-left py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                >
                  Notifications
                </Link>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left py-2.5 px-3.5 rounded-xl text-rose-600 text-sm font-semibold hover:bg-rose-50 transition flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 px-4 rounded-xl text-slate-700 border border-slate-200 text-sm font-medium"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-sky-500/20"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
