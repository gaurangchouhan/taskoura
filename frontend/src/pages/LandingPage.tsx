import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Fingerprint, 
  History, 
  Kanban,
  Menu,
  X
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1C30]">
      {/* Sticky Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="w-full max-w-[1680px] mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1E2761] to-[#00A896] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Layers className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-2xl text-[#1E2761] tracking-tight leading-none">Taskoura</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#00A896] mt-1">Student Agile Suite</span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <div className="hidden lg:flex items-center gap-10 text-base font-semibold text-slate-600">
            <a href="#hero" className="hover:text-[#00A896] transition-colors py-1.5 px-1">Home</a>
            <a href="#features" className="hover:text-[#00A896] transition-colors py-1.5 px-1">Features</a>
            <a href="#how-it-works" className="hover:text-[#00A896] transition-colors py-1.5 px-1">How it works</a>
            <a href="#checkin" className="hover:text-[#00A896] transition-colors py-1.5 px-1">Check-in</a>
            <a href="#about" className="hover:text-[#00A896] transition-colors py-1.5 px-1">About</a>
          </div>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-4">
            <Link
              to="/login"
              className="text-base font-semibold text-[#1E2761] hover:text-[#00A896] transition-colors px-4 py-2.5 rounded-xl hover:bg-slate-100"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="px-6 py-2.5 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white font-semibold text-base shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              Sign up
            </Link>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl text-slate-600 hover:text-[#1E2761] hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-[#1E2761]" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-6 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-4 text-base font-semibold text-slate-700">
              <a 
                href="#hero" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#00A896] transition-colors py-1"
              >
                Home
              </a>
              <a 
                href="#features" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#00A896] transition-colors py-1"
              >
                Features
              </a>
              <a 
                href="#how-it-works" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#00A896] transition-colors py-1"
              >
                How it works
              </a>
              <a 
                href="#checkin" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#00A896] transition-colors py-1"
              >
                Check-in
              </a>
              <a 
                href="#about" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#00A896] transition-colors py-1"
              >
                About
              </a>

              <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="w-full text-center py-2.5 rounded-xl border border-slate-300 font-semibold text-base text-[#1E2761] hover:bg-slate-50"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="w-full text-center py-2.5 rounded-xl bg-[#00A896] text-white font-semibold text-base shadow-sm hover:bg-[#008C7D]"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="hero" className="py-20 lg:py-28 px-6 sm:px-8 lg:px-12 w-full max-w-[1680px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse"></span>
              Built for Engineering Students & Capstone Cohorts
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1E2761] tracking-tight leading-[1.15]">
              Run your student project like a real software team
            </h1>

            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Agile Kanban workflows, team role tracking, immutable status logs, and physical biometric lab check-in — unified for modern student cohorts.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                className="px-7 py-3.5 rounded-xl bg-[#1E2761] hover:bg-[#151B44] text-white font-semibold text-base shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
              >
                Get started free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-[#1E2761] border border-slate-300 font-semibold text-base transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Floating Hero Preview */}
          <div className="relative">
            <div className="w-full bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <span className="ml-2 text-xs font-mono font-medium text-slate-400">Projects / Library Management System</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">Sprint 03</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-[#F1F5FD] p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-[#1E2761] uppercase tracking-wider">In Progress (3)</span>
                  <div className="mt-2.5 bg-white p-3 rounded-lg shadow-sm border border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">Backend</span>
                    <p className="text-xs font-semibold text-slate-800">Implement JWT Authentication</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                      <span>Alex Rivera</span>
                      <span className="text-red-500 font-semibold">High</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#F1F5FD] p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-[#1E2761] uppercase tracking-wider">Testing (2)</span>
                  <div className="mt-2.5 bg-white p-3 rounded-lg shadow-sm border border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">QA / Test</span>
                    <p className="text-xs font-semibold text-slate-800">Unit Tests for Project Members API</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                      <span>Neha Patel</span>
                      <span className="text-emerald-600 font-semibold">Pass</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badges */}
            <div className="absolute -top-4 -right-4 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00A896] animate-ping"></span>
              <span className="text-xs font-semibold text-[#1E2761]">Task moved to Testing</span>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-[#00A896]" />
              <span className="text-xs font-semibold text-[#1E2761]">Lab Check-in: Slot #01 Verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Strip */}
      <section className="bg-white border-y border-slate-200 py-10 px-6 sm:px-8 lg:px-12">
        <div className="w-full max-w-[1680px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="pt-4 md:pt-0">
            <p className="font-heading text-3xl lg:text-4xl font-extrabold text-[#1E2761]">4 Kanban Stages</p>
            <p className="text-sm lg:text-base text-slate-500 mt-1.5">Backlog, In Progress, Testing, and Completed</p>
          </div>
          <div className="pt-4 md:pt-0">
            <p className="font-heading text-3xl lg:text-4xl font-extrabold text-[#00A896]">Email-Verified</p>
            <p className="text-sm lg:text-base text-slate-500 mt-1.5">Secured signups with 4-digit OTP validation</p>
          </div>
          <div className="pt-4 md:pt-0">
            <p className="font-heading text-3xl lg:text-4xl font-extrabold text-[#1E2761]">Status Audit Logs</p>
            <p className="text-sm lg:text-base text-slate-500 mt-1.5">Every transition permanently recorded</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 sm:px-8 lg:px-12 w-full max-w-[1680px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-[#1E2761]">Designed for student engineering success</h2>
          <p className="mt-3 text-base lg:text-lg text-slate-600">Everything capstone software teams need to collaborate, ship code, and verify lab participation.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Layers, title: "Project Setup & Stacks", desc: "Define your frontend, backend, database, and testing tools upfront." },
            { icon: Kanban, title: "Agile Kanban Board", desc: "Visual task columns with priorities, categories, deadlines, and drag tracking." },
            { icon: History, title: "Status Change Audit", desc: "Detailed chronological logs showing who moved each task and when." },
            { icon: Users, title: "Team Roles & Invites", desc: "Distribute workload clearly between owners, contributors, and testers." },
            { icon: ShieldCheck, title: "Task Comments Thread", desc: "Keep technical discussions, PR links, and notes attached to the issue." },
            { icon: Fingerprint, title: "IoT Biometric Check-in", desc: "Register fingerprint slots (1-127) on the hardware sensor to log bench presence." },
          ].map((f, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-card hover:shadow-lifted hover:-translate-y-1 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5FD] flex items-center justify-center text-[#00A896] mb-6">
                <f.icon className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-xl text-[#1E2761] mb-2">{f.title}</h3>
              <p className="text-sm lg:text-base text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works Timeline */}
      <section id="how-it-works" className="py-24 bg-[#F1F5FD] px-6 sm:px-8 lg:px-12">
        <div className="w-full max-w-[1680px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-[#1E2761]">How Taskoura Works</h2>
            <p className="mt-3 text-base lg:text-lg text-slate-600">Four straightforward steps from project kick-off to submission day.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { num: "01", title: "Create a project", desc: "Specify name, description, deadlines, and chosen tech stack." },
              { num: "02", title: "Invite your team", desc: "Add teammates by email and assign owner/member permissions." },
              { num: "03", title: "Track on Kanban", desc: "Move tasks across columns as tests pass and features ship." },
              { num: "04", title: "Biometric check-in", desc: "Link hardware fingerprint slots to record physical lab attendance." },
            ].map((step, i) => (
              <div key={i} className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm relative">
                <span className="font-heading text-5xl font-extrabold text-[#CADCFC] block mb-3">{step.num}</span>
                <h4 className="font-heading font-bold text-lg text-[#1E2761] mb-2">{step.title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hardware Biometric Check-in Section */}
      <section id="checkin" className="py-24 px-6 sm:px-8 lg:px-12 w-full max-w-[1680px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#00A896]">IoT Device Integration</span>
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-[#1E2761] mt-2 mb-5">
              Real-world physical lab check-in with biometric hardware
            </h2>
            <p className="text-base text-slate-600 leading-relaxed mb-8">
              Taskoura pairs with a dedicated ESP32 and R307 optical fingerprint sensor module deployed at the university lab bench. Each student links a hardware slot ID (1-127), recording proof of attendance right inside project sprint reports.
            </p>

            <ul className="space-y-4">
              {[
                "Optical fingerprint scanner with instant LED confirmation",
                "Automated mapping of physical slots to authenticated team accounts",
                "Complete attendance audit logs exportable for lab instructors",
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3.5 text-base text-slate-700">
                  <CheckCircle2 className="w-6 h-6 text-[#00A896] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#1E2761] rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-[#00A896]/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <span className="text-sm font-mono text-[#00A896]">ESP32-R307-NODE #04</span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Sensor Ready
              </span>
            </div>

            <div className="my-10 flex flex-col items-center text-center">
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#00A896] to-teal-300/40 p-1 flex items-center justify-center shadow-glow-teal animate-pulse">
                <div className="w-full h-full bg-[#1E2761] rounded-full flex items-center justify-center">
                  <Fingerprint className="w-14 h-14 text-[#00A896]" />
                </div>
              </div>
              <p className="mt-5 font-mono text-base text-teal-300">Place Finger on Optical Prism</p>
              <p className="text-sm text-slate-400 mt-1">Slots 1-127 supported • Auto-synced to Taskoura</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="bg-[#1E2761] text-white py-20 px-6 sm:px-8 lg:px-12 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-3xl lg:text-4xl font-extrabold mb-4">Ready to elevate your student software project?</h2>
          <p className="text-slate-300 text-base lg:text-lg max-w-xl mx-auto mb-10">Sign up today, verify your email, and start running your team on a production-grade Agile workspace.</p>
          <Link
            to="/signup"
            className="px-10 py-4 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white font-semibold text-lg shadow-lg transition-all hover:shadow-teal-500/30"
          >
            Create your first project
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer id="about" className="bg-white border-t border-slate-200 py-12 px-6 sm:px-8 lg:px-12">
        <div className="w-full max-w-[1680px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E2761] flex items-center justify-center text-white">
              <Layers className="w-5 h-5 text-[#00A896]" />
            </div>
            <span className="font-heading font-bold text-xl text-[#1E2761]">Taskoura</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 Taskoura - Minor Project. Engineered for Student Software Teams.</p>
        </div>
      </footer>
    </div>
  );
};
