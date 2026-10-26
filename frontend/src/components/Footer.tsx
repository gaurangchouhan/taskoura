import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FolderGit2, Heart } from 'lucide-react';
import { scrollToSection } from '../lib/scroll';

export const Footer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    scrollToSection(href, navigate, location.pathname);
  };

  return (
    <footer className="bg-slate-50 border-t border-slate-200/80 py-12 text-slate-600 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-200">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-base text-slate-900 tracking-tight">
                Taskoura
              </span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              The unified engineering operating system for software development teams, capstone projects, and agile sprints.
            </p>
          </div>

          {/* Column 1: Product */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-3">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="/#how-it-works"
                  onClick={(e) => handleScroll(e, '/#how-it-works')}
                  className="hover:text-sky-600 transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="/#features"
                  onClick={(e) => handleScroll(e, '/#features')}
                  className="hover:text-sky-600 transition-colors"
                >
                  Sprint Kanban Board
                </a>
              </li>
              <li>
                <a
                  href="/#ai-assistance"
                  onClick={(e) => handleScroll(e, '/#ai-assistance')}
                  className="hover:text-sky-600 transition-colors"
                >
                  AI Task Generation
                </a>
              </li>
              <li>
                <a
                  href="/#qa"
                  onClick={(e) => handleScroll(e, '/#qa')}
                  className="hover:text-sky-600 transition-colors"
                >
                  QA & Test Cases
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Tech Architecture */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-3">
              Architecture
            </h4>
            <ul className="space-y-2">
              <li className="text-slate-500">
                Frontend: React, TypeScript, Vite & Tailwind
              </li>
              <li className="text-slate-500">
                Animation: GSAP ScrollTrigger
              </li>
              <li className="text-slate-500">
                Backend: Java 21, Spring Boot, Spring Security
              </li>
              <li className="text-slate-500">
                Database: PostgreSQL (Neon / local)
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Links */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-3">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/login" className="hover:text-sky-600 transition-colors">
                  User Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-sky-600 transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/app/projects" className="hover:text-sky-600 transition-colors">
                  Active Projects
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-xs gap-3">
          <p>© {new Date().getFullYear()} Taskoura. Built with precision for software engineering teams.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs">
              Crafted with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for developers
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
