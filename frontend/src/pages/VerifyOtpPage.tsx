import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import { authService } from '../services/api';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getErrorCode, getRetryAfterSeconds } from '../lib/errors';

export const VerifyOtpPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const searchParams = new URLSearchParams(location.search);
  const state = location.state as { email?: string; password?: string } | null;
  const initialEmail = state?.email || searchParams.get('email') || '';
  const initialPassword = state?.password || '';

  const [email, setEmail] = useState(initialEmail);
  const [password] = useState(initialPassword);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [isDeliveryFailed, setIsDeliveryFailed] = useState(false);
  const [attemptsExceeded, setAttemptsExceeded] = useState(false);
  const [lastAction, setLastAction] = useState<'verify' | 'resend'>('resend');

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{4}$/.test(pasted)) {
      const digits = pasted.split('');
      setOtp(digits);
      inputsRef.current[3]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 4) {
      setError('Please enter the full 4-digit code sent to your email.');
      return;
    }

    if (!email) {
      setError('Email address is missing. Please go back to registration.');
      return;
    }

    setError(null);
    setIsDeliveryFailed(false);
    setLastAction('verify');
    setSubmitting(true);

    try {
      await authService.verifyOtp({ email, otp: code });
      setSuccess('Account verified successfully!');

      // If password was preserved from registration, automatically log in and enter dashboard!
      if (password) {
        try {
          const authData = await authService.login({ email, password });
          login(authData);
          setSuccess('Account verified! Entering project management dashboard...');
          setTimeout(() => {
            navigate('/app/projects');
          }, 1000);
          return;
        } catch {
          // Fall back to login page
        }
      }

      setTimeout(() => {
        navigate('/login', { state: { email, message: 'Account verified! Please sign in.' } });
      }, 1500);
    } catch (err: unknown) {
      const codeType = getErrorCode(err);
      const msg = getErrorMessage(err);
      setError(msg || 'Invalid or expired OTP code. Please try again.');
      setOtp(['', '', '', '']);

      if (codeType === 'OTP_ATTEMPTS_EXCEEDED') {
        setAttemptsExceeded(true);
        setCountdown(0);
      } else if (codeType === 'EMAIL_DELIVERY_FAILED') {
        setIsDeliveryFailed(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if ((!attemptsExceeded && countdown > 0) || !email) return;
    setError(null);
    setIsDeliveryFailed(false);
    setLastAction('resend');
    try {
      await authService.resendOtp(email);
      setSuccess('A new 4-digit verification code has been dispatched to your email.');
      setCountdown(30);
      setAttemptsExceeded(false);
      setIsDeliveryFailed(false);
      setOtp(['', '', '', '']);
      inputsRef.current[0]?.focus();
    } catch (err: unknown) {
      const codeType = getErrorCode(err);
      const msg = getErrorMessage(err);
      setError(msg || 'Failed to resend code.');

      if (codeType === 'RATE_LIMITED') {
        const retrySecs = getRetryAfterSeconds(err) ?? 30;
        setCountdown(retrySecs);
      } else if (codeType === 'EMAIL_DELIVERY_FAILED') {
        setIsDeliveryFailed(true);
      } else if (codeType === 'OTP_ATTEMPTS_EXCEEDED') {
        setAttemptsExceeded(true);
        setCountdown(0);
        setOtp(['', '', '', '']);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 via-[#f8fafc] to-white flex flex-col justify-between">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-28">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-sky-500/5">
          {/* Header Icon */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-md shadow-sky-500/20">
              <Mail className="w-7 h-7" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Check your inbox
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              We sent a 4-digit verification code to
            </p>
            <p className="text-sm font-semibold text-sky-600 mt-0.5 break-all">
              {email || 'your email address'}
            </p>
          </div>

          {/* Feedback Alerts */}
          {success && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              {isDeliveryFailed && (
                <button
                  type="button"
                  onClick={lastAction === 'verify' ? handleVerify : handleResend}
                  className="text-xs font-bold underline hover:text-rose-800 shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* If email wasn't passed in state */}
          {!initialEmail && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 h-11 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all mb-4"
              />
            </div>
          )}

          {/* OTP Input Form */}
          <form onSubmit={handleVerify}>
            <div className="flex justify-center gap-3.5 mb-6" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputsRef.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-14 h-16 text-center text-2xl font-bold font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 transition-all shadow-inner"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting || otp.join('').length < 4}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold text-sm tracking-wide shadow-md shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {submitting ? (
                'Verifying code...'
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Account & Continue</span>
                </>
              )}
            </button>
          </form>

          {/* Resend and back links */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={handleResend}
              disabled={(!attemptsExceeded && countdown > 0)}
              className="text-sm font-semibold text-sky-600 hover:text-sky-700 disabled:text-slate-400 transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${countdown > 0 && !attemptsExceeded ? '' : 'hover:rotate-180 transition-transform'}`} />
              {countdown > 0 && !attemptsExceeded
                ? `Resend code in ${countdown}s`
                : 'Request a new code'}
            </button>
            <span className="text-xs text-slate-400">The code expires in 10 minutes</span>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
            Already verified?{' '}
            <Link to="/login" className="font-semibold text-sky-600 hover:text-sky-700 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
