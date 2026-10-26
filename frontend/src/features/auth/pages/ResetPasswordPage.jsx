import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, FolderGit2, RefreshCw } from 'lucide-react';
import { OtpInput } from '../../../components/auth/OtpInput';
import { useResetPassword, useForgotPassword } from '../hooks';
import { getErrorMessage, getErrorCode, getRetryAfterSeconds } from '../../../lib/errors';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isDeliveryFailed, setIsDeliveryFailed] = useState(false);
  const [attemptsExceeded, setAttemptsExceeded] = useState(false);
  const [lastAction, setLastAction] = useState('reset');

  const navigate = useNavigate();
  const resetPasswordMutation = useResetPassword();
  const forgotPasswordMutation = useForgotPassword();

  const timerRef = useRef(null);

  // Sync email from search params if it arrives later
  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Countdown timer for resend code
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

  const handleResend = async () => {
    if ((!attemptsExceeded && resendCooldown > 0) || !email.trim() || forgotPasswordMutation.isPending) return;

    setError('');
    setIsDeliveryFailed(false);
    setLastAction('resend');
    try {
      await forgotPasswordMutation.mutateAsync({ email: email.trim() });
      setResendCooldown(30);
      setAttemptsExceeded(false);
      setIsDeliveryFailed(false);
      setSuccessMessage('A fresh password reset code has been sent.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      const code = getErrorCode(err);
      const msg = getErrorMessage(err) || 'Failed to resend reset code.';
      setError(msg);

      if (code === 'RATE_LIMITED') {
        const retrySecs = getRetryAfterSeconds(err) ?? 30;
        setResendCooldown(retrySecs);
      } else if (code === 'EMAIL_DELIVERY_FAILED') {
        setIsDeliveryFailed(true);
      } else if (code === 'OTP_ATTEMPTS_EXCEEDED') {
        setAttemptsExceeded(true);
        setResendCooldown(0);
        setOtp('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsDeliveryFailed(false);
    setLastAction('reset');

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    if (!otp || otp.length < 4) {
      setError('Please enter the full 4-digit reset code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const res = await resetPasswordMutation.mutateAsync({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });

      const msg = res?.message || 'Password reset successfully. You can now log in with your new password.';
      setSuccessMessage(msg);

      // Navigate to login after brief confirmation
      setTimeout(() => {
        navigate('/login', { state: { resetSuccess: true } });
      }, 1000);
    } catch (err) {
      const code = getErrorCode(err);
      const msg = getErrorMessage(err) || 'Invalid or expired reset code';
      setError(msg);

      if (code === 'OTP_ATTEMPTS_EXCEEDED') {
        setOtp('');
        setAttemptsExceeded(true);
        setResendCooldown(0);
      } else if (code === 'EMAIL_DELIVERY_FAILED') {
        setIsDeliveryFailed(true);
      }
    }
  };

  return (
    <div
      data-testid="reset-password-page"
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
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the code sent to your email along with your new password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5">
          {/* Feedback messages */}
          {successMessage && (
            <div
              data-testid="reset-password-success"
              className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div
              data-testid="reset-password-error"
              className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              {isDeliveryFailed && (
                <button
                  type="button"
                  data-testid="btn-reset-retry"
                  onClick={lastAction === 'reset' ? handleSubmit : handleResend}
                  className="text-xs font-bold underline hover:text-rose-800 shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Address */}
            <div>
              <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reset-email"
                  data-testid="input-reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@taskoura.dev"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* OTP Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                4-Digit Reset Code
              </label>
              <OtpInput
                value={otp}
                onChange={setOtp}
                error={Boolean(error && error.toLowerCase().includes('code'))}
                autoFocus={false}
              />
              <div className="flex justify-end -mt-3 mb-2">
                <button
                  type="button"
                  data-testid="btn-resend-code"
                  disabled={(!attemptsExceeded && resendCooldown > 0) || forgotPasswordMutation.isPending}
                  onClick={handleResend}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${forgotPasswordMutation.isPending ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 && !attemptsExceeded
                      ? `Resend code in ${resendCooldown}s`
                      : attemptsExceeded
                      ? 'Request a new code'
                      : 'Resend code'}
                  </span>
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="new-password"
                  data-testid="input-new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="confirm-password"
                  data-testid="input-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="btn-reset-submit"
              disabled={resetPasswordMutation.isPending}
              className="w-full py-3 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap cursor-pointer mt-4"
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Resetting password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
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

export default ResetPasswordPage;
