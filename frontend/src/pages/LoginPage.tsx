import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FolderGit2, ArrowRight, Lock, Mail, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { useLogin, useResendOtp } from '../hooks/useAuthApi';
import { getErrorMessage } from '../lib/errors';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login: setAuthSession } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const reasonParam = searchParams.get('reason');
  const sessionReasonParam = searchParams.get('sessionReason');
  const emailParam = searchParams.get('email') || (location.state as { email?: string } | null)?.email || '';

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [is403Unverified, setIs403Unverified] = useState(false);

  const loginMutation = useLogin();
  const resendMutation = useResendOtp();

  let sessionMessage: string | null = null;
  if (reasonParam === 'timeout' || reasonParam === 'idle') {
    if (sessionReasonParam === 'ABSOLUTE_TIMEOUT') {
      sessionMessage = 'Your session was too old and has ended. Please log in again.';
    } else if (sessionReasonParam === 'REVOKED') {
      sessionMessage = 'You were signed out elsewhere. Please log in again.';
    } else if (sessionReasonParam === 'LEGACY_TOKEN') {
      sessionMessage = 'Your session expired, please log in again.';
    } else {
      sessionMessage = 'You were signed out due to inactivity. Please log in again.';
    }
  } else if (reasonParam === 'session_too_old' || sessionReasonParam === 'ABSOLUTE_TIMEOUT') {
    sessionMessage = 'Your session was too old and has ended. Please log in again.';
  } else if (reasonParam === 'signed_out_elsewhere' || sessionReasonParam === 'REVOKED') {
    sessionMessage = 'You were signed out elsewhere. Please log in again.';
  } else if (reasonParam === 'expired' || sessionReasonParam === 'LEGACY_TOKEN') {
    sessionMessage = 'Your session expired, please log in again.';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIs403Unverified(false);

    loginMutation.mutate(
      { email: email.trim().toLowerCase(), password },
      {
        onSuccess: (data) => {
          setAuthSession(data);
          const stateFrom = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
          const savedFrom = typeof window !== 'undefined' ? sessionStorage.getItem('taskoura_auth_from') : null;
          if (savedFrom && typeof window !== 'undefined') {
            sessionStorage.removeItem('taskoura_auth_from');
          }
          const from = stateFrom || savedFrom || '/app/projects';
          navigate(from, { replace: true });
        },
        onError: (err: unknown) => {
          const status =
            err &&
            typeof err === 'object' &&
            'response' in err
              ? (err as { response?: { status?: number; data?: { message?: string } } }).response?.status
              : undefined;

          if (status === 401) {
            setError('Incorrect email or password');
          } else if (status === 403) {
            setIs403Unverified(true);
            const msg =
              (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
              'Account not verified. Please verify your email.';
            setError(msg);
          } else {
            setError(getErrorMessage(err));
          }
        },
      }
    );
  };

  const handleVerifyEmailClick = () => {
    // Trigger resend and navigate to /verify-email?email=<email>
    if (email) {
      resendMutation.mutate({ email: email.trim().toLowerCase() });
      navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
        state: { email: email.trim().toLowerCase() },
      });
    }
  };

  const fillDemoAccount = () => {
    setEmail('developer@taskoura.dev');
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 via-[#f8fafc] to-white flex flex-col justify-between">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-28">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-sky-500/5">
          {/* Logo & Headline */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-md shadow-sky-500/20">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Sign in to Taskoura
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Access your software development projects and task boards
            </p>
          </div>

          {/* Expired / Timeout Session Notice */}
          {sessionMessage && !error && (
            <div
              data-testid="session-notice"
              className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{sessionMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              {is403Unverified && (
                <button
                  type="button"
                  onClick={handleVerifyEmailClick}
                  className="mt-1 text-sm font-semibold text-sky-600 hover:text-sky-700 underline text-left flex items-center gap-1 cursor-pointer"
                >
                  <span>Verify your email now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@taskoura.dev"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <span>{loginMutation.isPending ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={fillDemoAccount}
              className="text-sm font-semibold text-sky-600 hover:text-sky-700 underline cursor-pointer"
            >
              Prefill with standard credentials
            </button>
            <p className="text-sm text-slate-500 mt-4">
              Don&apos;t have an account yet?{' '}
              <Link to="/register" className="font-semibold text-sky-600 hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
