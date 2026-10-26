import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderGit2, ArrowRight, Lock, Mail, User, AlertCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useRegister } from '../hooks/useAuthApi';
import { getErrorMessage, getErrorCode } from '../lib/errors';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeliveryFailed, setIsDeliveryFailed] = useState(false);

  const navigate = useNavigate();
  const registerMutation = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setFormError(null);
    setIsDeliveryFailed(false);

    // Validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Name is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }

    // Send only name, email and password
    registerMutation.mutate(
      {
        name: trimmedName,
        email: email.trim().toLowerCase(),
        password,
      },
      {
        onSuccess: () => {
          navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
            state: { email: email.trim().toLowerCase() },
          });
        },
        onError: (err: unknown) => {
          const code = getErrorCode(err);
          const is409 =
            err &&
            typeof err === 'object' &&
            'response' in err &&
            (err as { response?: { status?: number } }).response?.status === 409;

          if (is409) {
            setEmailError('Email already registered');
          } else {
            setFormError(getErrorMessage(err));
          }

          if (code === 'EMAIL_DELIVERY_FAILED') {
            setIsDeliveryFailed(true);
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 via-[#f8fafc] to-white flex flex-col justify-between">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-28">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-sky-500/5">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-md shadow-sky-500/20">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Create Taskoura Account
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Start managing agile software projects with your team
            </p>
          </div>

          {formError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
              {isDeliveryFailed && (
                <button
                  type="button"
                  data-testid="btn-register-retry"
                  onClick={handleSubmit}
                  className="text-xs font-bold underline hover:text-rose-800 shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Gaurang Chouhan"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                {emailError && (
                  <span className="text-xs text-rose-600 font-medium">
                    {emailError}
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="gaurang@taskoura.dev"
                  className={`w-full pl-10 pr-4 h-11 rounded-xl border bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${
                    emailError
                      ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full py-3 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <span>{registerMutation.isPending ? 'Registering...' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-sky-600 hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
