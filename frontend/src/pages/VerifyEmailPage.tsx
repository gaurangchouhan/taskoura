import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FolderGit2, AlertCircle, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/Navbar';
import { OtpInput } from '../components/auth/OtpInput';
import { useVerifyOtp, useResendOtp } from '../hooks/useAuthApi';
import { getErrorMessage, getErrorCode, getRetryAfterSeconds } from '../lib/errors';

export const VerifyEmailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const stateEmail = (location.state as { email?: string } | null)?.email;
  const emailParam = searchParams.get('email');
  const email = emailParam || stateEmail || '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [isDeliveryFailed, setIsDeliveryFailed] = useState(false);
  const [attemptsExceeded, setAttemptsExceeded] = useState(false);
  const [lastAction, setLastAction] = useState<'verify' | 'resend'>('resend');

  const verifyMutation = useVerifyOtp();
  const resendMutation = useResendOtp();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      setError('Please enter the 4-digit code.');
      return;
    }

    if (!email) {
      setError('Email address is missing.');
      return;
    }

    setError(null);
    setIsDeliveryFailed(false);
    setLastAction('verify');

    verifyMutation.mutate(
      { email, otp },
      {
        onSuccess: (data) => {
          toast.success(data?.message || 'Email verified successfully! Please log in.');
          navigate(`/login?email=${encodeURIComponent(email)}`, { state: { email } });
        },
        onError: (err: unknown) => {
          const code = getErrorCode(err);
          const msg = getErrorMessage(err);
          setError(msg);
          setOtp('');

          if (code === 'OTP_ATTEMPTS_EXCEEDED') {
            setAttemptsExceeded(true);
            setCountdown(0);
          } else if (code === 'EMAIL_DELIVERY_FAILED') {
            setIsDeliveryFailed(true);
          }
        },
      }
    );
  };

  const handleResend = () => {
    if ((countdown > 0 && !attemptsExceeded) || !email || resendMutation.isPending) return;
    setError(null);
    setIsDeliveryFailed(false);
    setLastAction('resend');

    resendMutation.mutate(
      { email },
      {
        onSuccess: (data) => {
          toast.success(data?.message || 'A new code has been sent to your email.');
          setCountdown(30);
          setAttemptsExceeded(false);
          setIsDeliveryFailed(false);
          setOtp('');
        },
        onError: (err: unknown) => {
          const code = getErrorCode(err);
          const msg = getErrorMessage(err);
          setError(msg);

          if (code === 'RATE_LIMITED') {
            const retrySecs = getRetryAfterSeconds(err) ?? 30;
            setCountdown(retrySecs);
          } else if (code === 'EMAIL_DELIVERY_FAILED') {
            setIsDeliveryFailed(true);
          } else if (code === 'OTP_ATTEMPTS_EXCEEDED') {
            setAttemptsExceeded(true);
            setCountdown(0);
            setOtp('');
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
          {/* Logo & Headline (same family as LoginPage) */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-md shadow-sky-500/20">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Verify your email
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              We sent a 4-digit verification code to
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5 break-all">
              {email || 'your email address'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              data-testid="verify-email-error"
              className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              {isDeliveryFailed && (
                <button
                  type="button"
                  data-testid="btn-verify-retry"
                  onClick={lastAction === 'verify' ? (e) => handleVerify(e as any) : handleResend}
                  className="text-xs font-bold underline hover:text-rose-800 shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 text-center">
                Enter 4-Digit Code
              </label>
              <OtpInput
                value={otp}
                onChange={setOtp}
                disabled={verifyMutation.isPending}
                error={Boolean(error)}
              />
            </div>

            <button
              type="submit"
              disabled={verifyMutation.isPending || otp.length < 4}
              className="w-full py-3 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <span>{verifyMutation.isPending ? 'Verifying...' : 'Verify'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Resend and Info */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={(!attemptsExceeded && countdown > 0) || resendMutation.isPending}
              className="text-sm font-semibold text-sky-600 hover:text-sky-700 disabled:text-slate-400 transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${countdown > 0 && !attemptsExceeded ? '' : 'hover:rotate-180 transition-transform'}`} />
              <span>
                {resendMutation.isPending
                  ? 'Sending...'
                  : countdown > 0 && !attemptsExceeded
                  ? `Resend code in ${countdown}s`
                  : 'Request a new code'}
              </span>
            </button>
            <p className="text-xs text-slate-400">The code expires in 10 minutes</p>

            <p className="text-sm text-slate-500 mt-3">
              Back to{' '}
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

export default VerifyEmailPage;
