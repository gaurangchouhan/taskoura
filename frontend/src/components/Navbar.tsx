import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Bell
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
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Body scroll lock without layout jump when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [mobileMenuOpen]);

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

  // Handle outside click and Escape key for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        hamburgerButtonRef.current?.focus();
      }
    };

    const handleOutsideTap = (e: MouseEvent | TouchEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        hamburgerButtonRef.current &&
        !hamburgerButtonRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleOutsideTap);
      document.addEventListener('touchstart', handleOutsideTap);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideTap);
      document.removeEventListener('touchstart', handleOutsideTap);
    };
  }, [mobileMenuOpen]);

  // Focus trap inside mobile drawer
  const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !mobileMenuRef.current) return;

    const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }, []);

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
      className={`fixed top-0 left-0 right-0 z-50 safe-top transition-all duration-300 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-md shadow-sm border-b border-slate-200/80 py-3.5'
          : 'bg-white/60 backdrop-blur-sm border-b border-transparent py-5'
      }`}
    >
      <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex items-center justify-between">
          {/* Logo & Wordmark */}
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 group shrink-0">
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

          {/* Desktop Nav Links (from lg / 1024px up, identical to today; collapsed below lg) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/70 p-1.5 rounded-full border border-slate-200/60 shadow-inner">
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

          {/* Right Action Bar: Logo, Bell and User Menu stay visible at every width */}
          <div className="flex items-center gap-2 sm:gap-3">
            {hasValidToken ? (
              <>
                {/* Notification Bell (always visible on bar when signed in) */}
                <NotificationBell />

                {/* User Menu Button (always visible on bar; shrinks to avatar on small screens) */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    data-testid="user-menu-btn"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-1 pr-1 sm:pl-1.5 sm:pr-2.5 py-1 rounded-full hover:bg-slate-100/80 border border-slate-200/80 bg-white/60 shadow-xs transition-all cursor-pointer select-none min-h-[40px]"
                    aria-label="Open user profile menu"
                    aria-expanded={userMenuOpen}
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
                    {/* Shrink user name to avatar on small screens below sm */}
                    <span
                      data-testid="topbar-user-name"
                      className="hidden sm:inline text-xs font-bold text-slate-800 max-w-[140px] truncate"
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

                {/* Open workspace desktop button (lg+) */}
                <Link
                  to="/app/projects"
                  className="hidden lg:inline-flex group relative items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all duration-200 whitespace-nowrap"
                >
                  <span>Open workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            ) : (
              /* Signed out desktop buttons (lg+) */
              <div className="hidden lg:flex items-center gap-3">
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
              </div>
            )}

            {/* Hamburger Button (visible below lg / 1024px) */}
            <button
              ref={hamburgerButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Full-width mobile & tablet panel below lg */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          data-testid="sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          onKeyDown={handleDrawerKeyDown}
          className="lg:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-4 sm:px-6 pt-4 pb-8 mt-3 space-y-4 shadow-xl max-h-[calc(100dvh-5rem)] overflow-y-auto safe-bottom"
        >
          {/* Navigation Links */}
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="flex items-center gap-3 px-3.5 py-3 min-h-[44px] text-sm font-semibold text-slate-700 hover:text-sky-600 hover:bg-slate-50 rounded-xl transition"
                >
                  <Icon className="w-5 h-5 text-sky-600 shrink-0" />
                  <span>{link.name}</span>
                </a>
              );
            })}
          </div>

          {/* Action Links */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
            {hasValidToken ? (
              <>
                <div className="px-3 py-2.5 bg-slate-50 rounded-xl mb-1 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
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
                    <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
                  </div>
                </div>

                <Link
                  to="/app/projects"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full min-h-[44px] text-left py-2.5 px-3.5 rounded-xl hover:bg-slate-100 text-slate-700 text-sm font-semibold transition flex items-center gap-2.5"
                >
                  <FolderGit2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Workspace</span>
                </Link>

                <Link
                  to="/app/profile"
                  data-testid="sidebar-profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full min-h-[44px] text-left py-2.5 px-3.5 rounded-xl hover:bg-slate-100 text-slate-700 text-sm font-semibold transition flex items-center gap-2.5"
                >
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Profile</span>
                </Link>

                <Link
                  to="/app/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full min-h-[44px] text-left py-2.5 px-3.5 rounded-xl hover:bg-slate-100 text-slate-700 text-sm font-semibold transition flex items-center gap-2.5"
                >
                  <Bell className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Notifications</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full min-h-[44px] text-left py-2.5 px-3.5 rounded-xl text-rose-600 text-sm font-semibold hover:bg-rose-50 transition flex items-center gap-2.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full min-h-[44px] text-center py-2.5 px-4 rounded-xl text-slate-700 border border-slate-200 text-sm font-semibold flex items-center justify-center hover:bg-slate-50 transition"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full min-h-[44px] text-center py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-sky-500/20 flex items-center justify-center hover:from-sky-500 hover:to-indigo-500 transition"
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
