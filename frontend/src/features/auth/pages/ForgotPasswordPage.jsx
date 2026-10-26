import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, FolderGit2 } from 'lucide-react';
import { useForgotPassword } from '../hooks';
import { getErrorMessage, getErrorCode, getRetryAfterSeconds } from '../../../lib/errors';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isDeliveryFailed, setIsDeliveryFailed] = useState(false);
  const [attemptsExceeded, setAttemptsExceeded] = useState(false);
  const navigate = useNavigate();

  const forgotPasswordMutation = useForgotPassword();
  const timerRef = useRef(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!email.trim() || forgotPasswordMutation.isPending || (!attemptsExceeded && resendCooldown > 0)) return;

    setError('');
    setMessage('');
    setIsDeliveryFailed(false);

    try {
      const res = await forgotPasswordMutation.mutateAsync({ email: email.trim() });
      const msg = res?.message || 'If an account exists with that email, a password reset code has been sent.';
      setMessage(msg);
      setAttemptsExceeded(false);
      setIsDeliveryFailed(false);

      // Navigate to reset password page with email in query param
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`, {
        state: { message: msg },
      });
    } catch (err) {
      const code = getErrorCode(err);
      const errorMsg = getErrorMessage(err) || 'Failed to process request. Please try again.';
      setError(errorMsg);

      if (code === 'RATE_LIMITED') {
        const retrySecs = getRetryAfterSeconds(err) ?? 30;
        setResendCooldown(retrySecs);
      } else if (code === 'EMAIL_DELIVERY_FAILED') {
        setIsDeliveryFailed(true);
      } else if (code === 'OTP_ATTEMPTS_EXCEEDED') {
        setAttemptsExceeded(true);
        setResendCooldown(0);
      }
    }
  };

  return (
    <div
      data-testid="forgot-password-page"
      className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-sky-100/60 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-500 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <FolderGit2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors">
              Taskoura
            </span>
            <span className="text-[10px] tracking-wider uppercase font-semibold text-sky-600 -mt-0.5">
              Engineering OS
            </span>
          </div>
        </Link>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Forgot your password?
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email address and we'll send you a password reset code.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5">
          {/* Feedback messages */}
          {message && (
            <div
              data-testid="forgot-password-success"
              className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div
              data-testid="forgot-password-error"
              className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              {isDeliveryFailed && (
                <button
                  type="button"
                  data-testid="btn-forgot-retry"
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
              <label htmlFor="forgot-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="forgot-email"
                  data-testid="input-forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@taskoura.dev"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="btn-forgot-submit"
              disabled={forgotPasswordMutation.isPending || !email.trim() || (!attemptsExceeded && resendCooldown > 0)}
              className="w-full py-3 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap cursor-pointer mt-2"
            >
              {forgotPasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending reset code...</span>
                </>
              ) : resendCooldown > 0 && !attemptsExceeded ? (
                <span>Resend in {resendCooldown}s</span>
              ) : attemptsExceeded ? (
                <>
                  <span>Request a new code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Send Reset Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-sky-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
