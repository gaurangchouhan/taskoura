import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderPlus, 
  Layers, 
  Users, 
  CheckSquare, 
  TestTube, 
  Bug, 
  Sparkles, 
  BarChart3, 
  ArrowRight, 
  Cpu, 
  Calendar, 
  ShieldCheck,
  Code2,
  Workflow,
  Clock,
  TrendingUp,
  GitBranch,
  Bot
} from 'lucide-react';

export const FeatureSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workflow' | 'qa' | 'ai' | 'analytics'>('workflow');

  useEffect(() => {
    const syncFromHash = (hashStr: string) => {
      const clean = hashStr.replace(/^#/, '');
      if (clean === 'ai' || clean === 'ai-assistance') {
        setActiveTab('ai');
      } else if (clean === 'analytics') {
        setActiveTab('analytics');
      } else if (clean === 'qa') {
        setActiveTab('qa');
      } else if (clean === 'workflow' || clean === 'features') {
        setActiveTab('workflow');
      }
    };

    if (typeof window !== 'undefined' && window.location.hash) {
      syncFromHash(window.location.hash);
    }

    const handleSwitch = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      syncFromHash(detail);
    };

    const handleHashChange = () => {
      syncFromHash(window.location.hash);
    };

    window.addEventListener('switch-feature-tab', handleSwitch);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('switch-feature-tab', handleSwitch);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const workflowSteps = [
    {
      step: '01',
      title: 'Create & Architect Project',
      desc: 'Define scope, select frontend, backend, database stacks, and set delivery milestones.',
      icon: FolderPlus,
      color: 'from-sky-500 to-blue-600',
    },
    {
      step: '02',
      title: 'Select Technology Stacks',
      desc: 'Record your frontend, backend, database and testing stack for every project.',
      icon: Layers,
      color: 'from-indigo-500 to-purple-600',
    },
    {
      step: '03',
      title: 'Invite Team & Assign Roles',
      desc: 'Role-based access controls (Owner and Member) with secure JWT authenticated sessions.',
      icon: Users,
      color: 'from-purple-500 to-pink-600',
    },
    {
      step: '04',
      title: 'Decompose Tasks & Subtasks',
      desc: 'Parent-child task hierarchies with granular completion progress indicators.',
      icon: CheckSquare,
      color: 'from-amber-500 to-orange-600',
    },
    {
      step: '05',
      title: 'QA Testing & Defect Tracking',
      desc: 'Log bugs, attach error screenshots, link test cases, and verify release readiness.',
      icon: TestTube,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      step: '06',
      title: 'Analyze & Ship with Confidence',
      desc: 'Completion progress, member contributions, and test pass/fail audits.',
      icon: BarChart3,
      color: 'from-cyan-500 to-blue-600',
    },
  ];

  return (
    <div className="relative py-24 bg-white overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#f0f7ff] to-white pointer-events-none" />
      <div className="absolute top-1/3 -left-48 w-96 h-96 bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header: How It Works */}
        <div id="how-it-works" className="text-center max-w-3xl mx-auto mb-20 scroll-mt-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold mb-3">
            <Workflow className="w-3.5 h-3.5" />
            <span>Structured Engineering Lifecycle</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How Taskoura Powers Software Teams
          </h2>
          <p className="mt-4 text-base text-slate-600">
            A cohesive platform designed specifically for students, software engineers, and agile squads to progress from raw idea to validated production deployment.
          </p>
        </div>

        {/* 6-Step Workflow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-28">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="group relative p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-white hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${step.color} flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-110 transition-transform duration-200`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-slate-200 group-hover:text-sky-300 transition-colors font-mono">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Interactive Feature Deep Dives: Tabs */}
        <div id="features" className="scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Modern Development
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Explore specialized modules crafted to eliminate project silos.
            </p>

            {/* Tab Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6 p-1.5 bg-slate-100 rounded-xl max-w-xl mx-auto border border-slate-200">
              <button
                onClick={() => setActiveTab('workflow')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'workflow'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Project Management
              </button>
              <button
                onClick={() => setActiveTab('qa')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'qa'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                QA & Defect Tracking
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'ai'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AI Planning
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white text-cyan-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Analytics & Reports
              </button>
            </div>
          </div>

          {/* Tab 1: Project Management */}
          <div id="workflow" className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center p-8 rounded-3xl bg-gradient-to-br from-sky-50/60 via-white to-slate-50 border border-sky-100 shadow-lg scroll-mt-24 ${activeTab === 'workflow' ? '' : 'hidden'}`}>
            <div className="space-y-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                <Layers className="w-3.5 h-3.5" />
                <span>Sprint & Task Orchestration</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                Granular task control with parent-child subtasks
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Break monolithic deliverables into discrete engineering tickets. Assign developers, specify technology category tags, track completion percentages, and manage deadlines without losing the big picture.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckSquare className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Four-State Kanban Pipeline</h4>
                    <p className="text-xs text-slate-500">Backlog, In Progress, Testing, and Completed stages with automated status logs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                    <GitBranch className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Technology Stack Alignment</h4>
                    <p className="text-xs text-slate-500">Every card tags its domain: Frontend, Backend, Database, or Testing.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Graphic Mockup */}
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-md space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Parent Task: Payment Gateway Integration</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full">3 of 4 Done</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <span className="text-emerald-900 font-medium">1. Create Stripe Webhook Handler</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Completed</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <span className="text-emerald-900 font-medium">2. Secure API Key & Environment Vars</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Completed</span>
                </div>
                <div className="p-2.5 rounded-lg bg-sky-50/80 border border-sky-200 flex items-center justify-between">
                  <span className="text-sky-900 font-medium">3. Frontend Checkout Modal</span>
                  <span className="text-[10px] text-sky-700 font-bold">In Progress</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab 2: QA & Defect Tracking */}
          <div id="qa" className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center p-8 rounded-3xl bg-gradient-to-br from-emerald-50/60 via-white to-slate-50 border border-emerald-100 shadow-lg scroll-mt-24 ${activeTab === 'qa' ? '' : 'hidden'}`}>
              <div className="space-y-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  <TestTube className="w-3.5 h-3.5" />
                  <span>Quality Assurance & Bug Management</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Unify testing scenarios and bug resolution
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Never lose a reported defect. Log QA bugs directly into your sprint boards, attach reproduction logs and screenshots via Cloudinary, and execute test cases with immediate pass/fail tracking.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs">
                    <span className="font-bold text-emerald-700 block text-lg font-mono">100%</span>
                    <span className="text-slate-600">Traceable defects</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs">
                    <span className="font-bold text-emerald-700 block text-lg font-mono">Zero</span>
                    <span className="text-slate-600">Untested code commits</span>
                  </div>
                </div>
              </div>

              {/* Graphic Mockup */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-md space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Bug className="w-3.5 h-3.5 text-rose-500" />
                    Bug Report: CORS Preflight Failure
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full">Critical</span>
                </div>
                <p className="text-xs text-slate-500">
                  Preflight OPTIONS request rejected on login endpoint from localhost:5173 origin.
                </p>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-700">
                  PATCH /api/bugs/14/status → Resolved
                </div>
              </div>
          </div>

          {/* Tab 3: AI Planning */}
          <div id="ai-assistance" className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center p-8 rounded-3xl bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 border border-indigo-100 shadow-lg scroll-mt-24 ${activeTab === 'ai' ? '' : 'hidden'}`}>
              <div className="space-y-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Sprint Copilot</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Deconstruct user stories into actionable code tasks
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Input a high-level feature description (e.g. &ldquo;Build OTP phone verification system&rdquo;). Taskoura&apos;s integrated Grok/LLM engine automatically suggests necessary frontend UI components, backend APIs, database migrations, and QA test assertions.
                </p>

                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                  <Bot className="w-4 h-4" />
                  <span>Integrated with backend Grok / Llama-3.3 engine</span>
                </div>
              </div>

              {/* Graphic Mockup */}
              <div className="rounded-2xl bg-white p-5 border border-indigo-200/80 shadow-md space-y-3">
                <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 block mb-1">User Story Prompt</span>
                  <span className="font-medium text-slate-800">&ldquo;Implement secure password reset with expiring tokens&rdquo;</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-700 font-medium">1. POST /api/auth/forgot-password</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Backend</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-700 font-medium">2. Reset Password Modal with Regex validation</span>
                    <span className="text-[10px] text-sky-600 font-semibold">Frontend</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-700 font-medium">3. Add tokenExpiry column to Users table</span>
                    <span className="text-[10px] text-purple-600 font-semibold">Database</span>
                  </div>
                </div>
              </div>
          </div>

          {/* Tab 4: Analytics & Reports */}
          <div id="analytics" className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center p-8 rounded-3xl bg-gradient-to-br from-cyan-50/60 via-white to-slate-50 border border-cyan-100 shadow-lg scroll-mt-24 ${activeTab === 'analytics' ? '' : 'hidden'}`}>
              <div className="space-y-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Executive Velocity Metrics</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Real-time visibility into engineering output
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Generate instant sprint burndown metrics, individual team member completion statistics, and open defect trends. Perfect for team standups and project grading presentations.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="p-3 bg-white rounded-xl border border-cyan-200 shadow-xs">
                    <span className="text-lg font-bold text-cyan-700 font-mono">94%</span>
                    <span className="text-[11px] text-slate-500 block">Sprint Velocity</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-cyan-200 shadow-xs">
                    <span className="text-lg font-bold text-emerald-700 font-mono">18</span>
                    <span className="text-[11px] text-slate-500 block">Tasks Shipped</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-cyan-200 shadow-xs">
                    <span className="text-lg font-bold text-indigo-700 font-mono">0</span>
                    <span className="text-[11px] text-slate-500 block">Critical Blockers</span>
                  </div>
                </div>
              </div>

              {/* Graphic Mockup */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-md space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Sprint Health Overview</span>
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> +14% vs Last Sprint
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Sprint Completion</span>
                    <span className="font-bold">82%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full w-[82%]" />
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 pt-2">
                    <span>Automated Test Coverage</span>
                    <span className="font-bold">96%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full w-[96%]" />
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* Final CTA Strip */}
        <div className="mt-28 p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 text-white text-center shadow-xl shadow-sky-500/20 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Ready to streamline your software team?
            </h2>
            <p className="text-sm sm:text-base text-sky-100">
              Join students and engineering squads building reliable software on Taskoura today.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/register"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-sky-700 font-bold text-sm shadow-md hover:bg-sky-50 transition-colors text-center"
              >
                Create Free Project
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-700/60 hover:bg-sky-700 text-white font-semibold text-sm border border-sky-400/40 transition-colors text-center"
              >
                Sign In to Workspace
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
