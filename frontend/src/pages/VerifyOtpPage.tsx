import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../api/client';

export const VerifyOtpPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const initialEmail = (location.state as any)?.email || searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 4) {
      setError('Please enter the complete 4-digit code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.post('/auth/verify-otp', {
        email,
        otp: code,
      });

      setSuccess('Account verified successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Invalid or expired code. Please request a new one.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError(null);
    try {
      await api.post('/auth/resend-otp', { email });
      setSuccess('A new verification code has been dispatched.');
      setCountdown(60);
    } catch (err: any) {
      setError('Failed to resend verification code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] p-6">
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-card border border-slate-200 text-center">
        {/* Envelope Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#F0FDFA] border border-[#76F4E0] flex items-center justify-center text-[#00A896] mb-6">
          <Mail className="w-8 h-8" />
        </div>

        <h1 className="font-heading font-bold text-2xl text-[#1E2761]">Check your email</h1>
        <p className="text-sm text-slate-500 mt-2">
          We sent a 4-digit verification code to
        </p>
        <p className="text-sm font-semibold text-[#1E2761] mt-0.5">{email || 'your email address'}</p>

        <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
          💡 <em>Dev mode:</em> The 4-digit code is dispatched to the backend terminal log.
        </div>

        {success && (
          <div className="mt-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="mt-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-8">
          <div className="flex justify-center gap-3.5 mb-6">
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
                className="w-14 h-16 text-center text-2xl font-bold font-mono text-[#1E2761] bg-[#F7F9FC] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#00A896] focus:ring-4 focus:ring-[#00A896]/15 transition-all"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length < 4}
            className="w-full py-3 rounded-xl bg-[#1E2761] hover:bg-[#151B44] text-white font-semibold text-sm transition-all shadow-sm hover:shadow disabled:opacity-40"
          >
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={handleResend}
            disabled={countdown > 0}
            className="text-xs font-semibold text-[#00A896] hover:text-[#008C7D] disabled:text-slate-400 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${countdown > 0 ? '' : 'hover:rotate-180 transition-transform'}`} />
            {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
          </button>
          <span className="text-[11px] text-slate-400">The code expires in 10 minutes</span>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500">
          Already verified?{' '}
          <Link to="/login" className="font-semibold text-[#1E2761] hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};
