import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Layers, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api/client';

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/auth/register', {
        name: fullName,
        fullName: fullName,
        email: email.trim(),
        password,
      });
      // Navigate to OTP verification page with email prefilled in state
      navigate('/verify-otp', { state: { email } });
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 409 || err.response?.status === 400) {
        setError('Email already registered or invalid details. Please check your credentials.');
      } else {
        setError('Something went wrong during sign up. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F9FC]">
      {/* Left Panel */}
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
              Start building with your team today.
            </h2>
            <p className="mt-4 text-slate-300 text-base leading-relaxed">
              Create projects, assign roles, manage sprint deadlines, and link hardware biometric slots effortlessly.
            </p>
          </div>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 shadow-xl max-w-md">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-teal-300 shrink-0" />
            <p className="text-xs text-slate-200">
              Instant setup for student capstone groups, university project labs, and innovation cohorts.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-400">Taskoura Engineering Workspace • Minor Project 2026</p>
      </div>

      {/* Right Panel: Auth Card */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-card border border-slate-200">
          <div className="mb-6">
            <h1 className="font-heading font-bold text-2xl text-[#1E2761]">Create your account</h1>
            <p className="text-sm text-slate-500 mt-1">Get started with your free student engineering workspace.</p>
          </div>

          {error && (
            <div className="p-3.5 mb-6 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#00A896] focus:ring-3 focus:ring-[#00A896]/15 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">University / College email</label>
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
                  placeholder="At least 6 characters"
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
              <p className="text-[11px] text-slate-500 mt-1">Must contain at least 6 characters.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-lg bg-[#00A896] hover:bg-[#008C7D] text-white font-semibold text-sm transition-all shadow-sm hover:shadow disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-[11px] text-slate-500 text-center mt-2">
              We'll email you a 4-digit code to verify your account.
            </p>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">or</span></div>
          </div>

          <div className="text-center text-xs text-slate-600">
            <span>Already have an account? </span>
            <Link to="/login" className="font-semibold text-[#1E2761] hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
