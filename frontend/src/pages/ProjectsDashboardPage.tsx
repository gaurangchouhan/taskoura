import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Layers, Clock, ArrowRight, X, AlertCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import api from '../api/client';

export interface Project {
  id: number;
  name: string;
  description: string;
  frontendStack?: string;
  backendStack?: string;
  databaseStack?: string;
  testingTools?: string;
  deadline?: string;
  ownerId?: number;
}

export const ProjectsDashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frontendStack, setFrontendStack] = useState('React, TypeScript, Tailwind');
  const [backendStack, setBackendStack] = useState('Spring Boot 3, Java 21');
  const [databaseStack, setDatabaseStack] = useState('PostgreSQL');
  const [testingTools, setTestingTools] = useState('JUnit 5, Mockito');
  const [deadline, setDeadline] = useState('2026-12-15');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/projects');
      setProjects(res.data || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await api.post('/projects', {
        name,
        description,
        frontendStack,
        backendStack,
        databaseStack,
        testingTools,
        deadline,
      });

      setIsModalOpen(false);
      setName('');
      setDescription('');
      fetchProjects();
    } catch (err: any) {
      setFormError('Failed to create project. Please verify all fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="My Projects">
      <div className="p-6 lg:p-10 w-full max-w-[1680px] mx-auto">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-heading font-extrabold text-2xl lg:text-3xl text-[#1E2761]">Active Projects & Curated Templates</h2>
            <p className="text-sm lg:text-base text-slate-500 mt-1">
              Student software engineering capstones, starter templates, and team workspaces
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white font-semibold text-base shadow-sm transition-all hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            New project
          </button>
        </div>

        {/* Academic Project Templates Strip */}
        <div className="mb-10 p-6 lg:p-8 bg-gradient-to-r from-white to-[#F1F5FD] rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#00A896]">Ready-Made Starter Packs</span>
              <h3 className="font-heading font-bold text-lg lg:text-xl text-[#1E2761]">Faculty-Approved Capstone Project Templates</h3>
            </div>
            <span className="text-xs lg:text-sm text-slate-500 font-medium">Pre-populated with tasks, epics & tech stacks</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                key: 'library-management',
                title: 'Library Management System',
                stack: 'Spring Boot + React + Postgres',
                tasks: '8 Pre-built Tasks',
                desc: 'Book cataloging, student checkout workflows, fine calculation, and barcode scans.'
              },
              {
                key: 'iot-attendance',
                title: 'IoT Biometric Attendance Node',
                stack: 'ESP32 + Embedded C + REST API',
                tasks: '6 Pre-built Tasks',
                desc: 'R307 optical fingerprint reader, OLED live status, and Wi-Fi sync to cloud.'
              },
              {
                key: 'campus-event-portal',
                title: 'Campus Hackathon & Event Hub',
                stack: 'Node.js / React + Stripe / JWT',
                tasks: '7 Pre-built Tasks',
                desc: 'Team registration, dynamic ticketing, QR check-in, and judge evaluation rubric.'
              }
            ].map((tmpl) => (
              <div key={tmpl.key} className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-[#00A896]/50 transition-all">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-[#00A896] bg-[#00A896]/10 px-2 py-0.5 rounded">{tmpl.tasks}</span>
                    <span className="text-slate-500 font-mono text-xs">{tmpl.stack}</span>
                  </div>
                  <h4 className="font-heading font-bold text-base text-[#1E2761] mb-2">{tmpl.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">{tmpl.desc}</p>
                </div>
                <button
                  onClick={() => {
                    setName(tmpl.title);
                    setDescription(tmpl.desc);
                    setIsModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-lg bg-[#F1F5FD] hover:bg-[#CADCFC]/40 text-[#1E2761] text-xs font-bold transition-colors text-center"
                >
                  Use this template
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-[#00A896] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-slate-500 font-medium">Loading project catalog...</p>
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm">
            <div className="w-20 h-20 rounded-2xl bg-[#F1F5FD] flex items-center justify-center text-[#1E2761] mx-auto mb-5">
              <Layers className="w-10 h-10 text-[#00A896]" />
            </div>
            <h3 className="font-heading font-bold text-xl text-[#1E2761] mb-3">No projects created yet</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">
              Kick off your first capstone workspace by creating a project with team roles, tech stack specs, and milestone deadlines.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-[#1E2761] text-white font-semibold text-base shadow hover:bg-[#151B44] transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="bg-white rounded-2xl p-7 border border-slate-200/90 shadow-card hover:shadow-lifted hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0FDFA] text-[#00A896] border border-[#76F4E0]/40">
                      Owner
                    </span>
                    {proj.deadline && (
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {proj.deadline}
                      </span>
                    )}
                  </div>

                  <h3 className="font-heading font-bold text-xl text-[#1E2761] mb-2 leading-snug">
                    {proj.name}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-6">
                    {proj.description || 'No description provided.'}
                  </p>

                  {/* Tech Stack Chips */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {proj.frontendStack && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#EFF6FF] text-[#2563EB] border border-blue-100">
                        {proj.frontendStack.split(',')[0]}
                      </span>
                    )}
                    {proj.backendStack && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#F1F5FD] text-[#1E2761] border border-indigo-100">
                        {proj.backendStack.split(',')[0]}
                      </span>
                    )}
                    {proj.databaseStack && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {proj.databaseStack}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-[#1E2761] text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-xs">
                      AR
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#00A896] text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-xs">
                      PS
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold border-2 border-white shadow-xs">
                      +2
                    </div>
                  </div>

                  <Link
                    to={`/projects/${proj.id}/board`}
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#00A896] hover:text-[#008C7D] transition-colors bg-[#00A896]/10 px-4 py-2 rounded-lg"
                  >
                    Open board
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Project Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E2761]/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-modal border border-slate-200 p-8 relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-heading font-bold text-xl text-[#1E2761]">Create new project</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateProject} className="mt-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Library Management System"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896] focus:ring-2 focus:ring-[#00A896]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief summary of goals and scope"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896] focus:ring-2 focus:ring-[#00A896]/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Frontend Stack</label>
                    <input
                      type="text"
                      value={frontendStack}
                      onChange={(e) => setFrontendStack(e.target.value)}
                      placeholder="React, TypeScript"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Backend Stack</label>
                    <input
                      type="text"
                      value={backendStack}
                      onChange={(e) => setBackendStack(e.target.value)}
                      placeholder="Spring Boot, Java"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Database</label>
                    <input
                      type="text"
                      value={databaseStack}
                      onChange={(e) => setDatabaseStack(e.target.value)}
                      placeholder="PostgreSQL"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Testing Tools</label>
                    <input
                      type="text"
                      value={testingTools}
                      onChange={(e) => setTestingTools(e.target.value)}
                      placeholder="JUnit 5, Mockito"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                  />
                </div>

                <div className="pt-5 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-lg bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold shadow-sm transition-all"
                  >
                    {submitting ? 'Creating...' : 'Create Project'}
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
