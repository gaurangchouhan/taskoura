import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Layers, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email: email.trim(), password });
      const { token, user: userData } = response.data;
      login(token, {
        email: userData?.email || email,
        fullName: userData?.name || 'Student Engineer',
        name: userData?.name,
        id: userData?.id
      });
      navigate('/projects');
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 403) {
        setError('Your email is not verified yet. Please verify your OTP code before logging in.');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F9FC]">
      {/* Left Panel: Navy to Teal Gradient with Branding */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#1E2761] via-[#151B44] to-[#00A896] p-12 lg:p-16 flex-col justify-between text-white relative overflow-hidden">
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <Layers className="w-5 h-5 text-teal-300" />
            </div>
            <span className="font-heading font-extrabold text-2xl text-white tracking-tight">Taskoura</span>
          </Link>

          <div className="mt-20">
            <h2 className="font-heading text-4xl font-extrabold leading-tight tracking-tight">
              Ship student projects like a real engineering team.
            </h2>
            <p className="mt-4 text-slate-300 text-base leading-relaxed">
              Agile Kanban tracking, sprint audit logs, and hardware biometric lab attendance — all in one unified workspace.
            </p>
          </div>
        </div>

        {/* Faint Kanban Illustration */}
        <div className="relative z-10 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/15 shadow-xl max-w-md">
          <div className="flex items-center justify-between text-xs font-semibold text-teal-200 mb-3">
            <span>Sprint Board</span>
            <span>4 Active Stages</span>
          </div>
          <div className="space-y-2">
            <div className="bg-white/15 p-2.5 rounded-lg text-xs font-medium flex justify-between">
              <span>TSK-102 Implement Auth API</span>
              <span className="text-teal-300">In Progress</span>
            </div>
            <div className="bg-white/15 p-2.5 rounded-lg text-xs font-medium flex justify-between">
              <span>TSK-105 Setup Fingerprint Slot Link</span>
              <span className="text-amber-300">Testing</span>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-400">Taskoura Engineering Workspace • Minor Project 2026</p>
      </div>

      {/* Right Panel: Clean White Auth Card */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-card border border-slate-200">
          <div className="mb-6">
            <h1 className="font-heading font-bold text-2xl text-[#1E2761]">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to access your student workspace.</p>
          </div>

          {/* Verification Alert Note */}
          <div className="p-3.5 mb-6 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
            <div className="text-xs text-[#1E2761] leading-relaxed">
              <span className="font-semibold block">Need to verify?</span>
              If you recently registered, please verify your email via the 4-digit OTP code before logging in.
            </div>
          </div>

          {error && (
            <div className="p-3.5 mb-6 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {error.toLowerCase().includes('verify') && (
                <Link
                  to={`/verify-otp?email=${encodeURIComponent(email)}`}
                  className="inline-block font-bold text-[#00A896] hover:underline ml-6"
                >
                  Click here to enter OTP and verify →
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#00A896] focus:ring-3 focus:ring-[#00A896]/15 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#00A896] focus:ring-3 focus:ring-[#00A896]/15 text-sm transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-lg bg-[#1E2761] hover:bg-[#151B44] text-white font-semibold text-sm transition-all shadow-sm hover:shadow disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          {/* Quick Demo Login Pill for Evaluators & Testing */}
          <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Demo Quick Fill</span>
              <span className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">Ready to test</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('alex@university.edu');
                  setPassword('password123');
                  setError(null);
                }}
                className="text-left px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#00A896] hover:bg-teal-50/30 transition-all text-xs"
              >
                <div className="font-semibold text-slate-800">Alex Rivera</div>
                <div className="text-[10px] text-slate-400 truncate">alex@university.edu</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('gaurangchouhan316@gmail.com');
                  setPassword('password123');
                  setError(null);
                }}
                className="text-left px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#00A896] hover:bg-teal-50/30 transition-all text-xs"
              >
                <div className="font-semibold text-slate-800">Gaurang</div>
                <div className="text-[10px] text-slate-400 truncate">gaurangchouhan316...</div>
              </button>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 text-center">
              Password for all accounts: <code className="font-mono text-slate-600 bg-slate-200/60 px-1 py-0.5 rounded">password123</code>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">or</span></div>
          </div>

          <div className="text-center text-xs text-slate-600">
            <span>New to Taskoura? </span>
            <Link to="/signup" className="font-semibold text-[#00A896] hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
