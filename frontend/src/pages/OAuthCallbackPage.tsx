import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FolderGit2, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { exchangeOAuthCode } from '../services/oauthService';
import { LOGIN, REGISTER } from '../routes/paths';
import { getPostLoginPath } from '../lib/authRedirect';

export const OAUTH_ERROR_MAP: Record<string, string> = {
  ACCESS_DENIED: 'You cancelled the sign-in',
  EMAIL_MISSING: 'The provider did not share an email address',
  EMAIL_UNVERIFIED: 'Your provider email is not verified',
  ACCOUNT_EXISTS_UNVERIFIED:
    'An account with this email exists but was never verified. Verify it with the code we emailed you (use Resend code), then try again',
  ACCOUNT_EXISTS_USE_PASSWORD:
    'An account with this email already exists. Log in with your password, then connect Google or GitHub from your profile',
  PROVIDER_DISABLED: 'This login provider is currently disabled',
  PROVIDER_ERROR: 'An error occurred with the authentication provider. Please try again.',
  STATE_INVALID: 'The sign-in session expired. Please try again',
};

export const OAUTH_ERROR_MESSAGES = OAUTH_ERROR_MAP;

export function resolveOAuthErrorMessage(
  error?: string | null,
  methods?: string | null
): string {
  if (!error) return 'Sign-in failed. Please try again.';

  if (error === 'ACCOUNT_EXISTS_UNVERIFIED') {
    return 'An account with this email exists but was never verified. Verify it with the code we emailed you (use Resend code), then try again';
  }

  if (error === 'ACCOUNT_EXISTS_USE_PASSWORD') {
    if (methods) {
      const parts = methods
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const hasPassword = parts.includes('password');
      const providers = parts.filter((p) => p === 'google' || p === 'github');

      if (hasPassword) {
        return 'An account with this email already exists. Log in with your password, then connect Google or GitHub from your profile';
      }

      if (providers.length > 0) {
        const labels = providers.map((p) => (p === 'google' ? 'Google' : 'GitHub'));
        const providerText = labels.join(' and ');
        return `This email is already registered with ${providerText}. Sign in with that provider, then connect the other one from your profile`;
      }
    }
    return 'An account with this email already exists. Log in with your password, then connect Google or GitHub from your profile';
  }

  return OAUTH_ERROR_MAP[error] || 'Sign-in failed. Please try again.';
}

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSlowWakeup, setIsSlowWakeup] = useState(false);
  const [exchangeCompleted, setExchangeCompleted] = useState(false);
  const exchangedRef = useRef(false);

  // Capture params once and immediately strip from URL to prevent exposure in history / referrers
  const initialParamsRef = useRef<{ code: string | null; error: string | null; methods: string | null } | null>(null);

  if (!initialParamsRef.current) {
    const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(rawSearch);
    const code = params.get('code') || searchParams.get('code');
    const error = params.get('error') || searchParams.get('error');
    const methods = params.get('methods') || searchParams.get('methods');
    initialParamsRef.current = { code, error, methods };

    if (typeof window !== 'undefined' && window.history?.replaceState && (code || error || rawSearch)) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // 4-second timer for slow server wakeup notice
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSlowWakeup(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const { code, error, methods } = initialParamsRef.current || { code: null, error: null, methods: null };

    // 1. If neither code nor error is present: redirect to /login immediately
    if (!code && !error) {
      navigate(LOGIN, { replace: true });
      return;
    }

    // 2. If provider error returned in query string
    if (error) {
      const msg = resolveOAuthErrorMessage(error, methods);
      setErrorMessage(msg);
      return;
    }

    // 3. If code present: exchange one-time code
    if (code) {
      if (exchangedRef.current) return;
      exchangedRef.current = true;

      exchangeOAuthCode(code)
        .then((data) => {
          login(data);
          const provider = (data.user as any)?.oauthProvider || (data.user as any)?.provider;
          const label = provider === 'github' ? 'GitHub' : provider === 'google' ? 'Google' : 'Google/GitHub';
          toast.success(`Signed in with ${label}`);
          setExchangeCompleted(true);
        })
        .catch((err: any) => {
          const status = err?.response?.status;
          const errorCode = err?.response?.data?.code || err?.response?.data?.error;
          const errorMethods = err?.response?.data?.methods || methods;
          if (status === 400 || errorCode === 'VALIDATION_FAILED') {
            setErrorMessage('This sign-in link expired or was already used. Please try again.');
          } else if (errorCode) {
            setErrorMessage(resolveOAuthErrorMessage(errorCode, errorMethods));
          } else {
            setErrorMessage(
              err?.response?.data?.message || 'An error occurred with the authentication provider. Please try again.'
            );
          }
        });
    }
  }, [login, navigate]);

  // Navigate only after authenticated state is committed in AuthContext
  useEffect(() => {
    if (exchangeCompleted && isAuthenticated) {
      const savedFrom =
        typeof window !== 'undefined' ? sessionStorage.getItem('taskoura_auth_from') : null;
      if (savedFrom && typeof window !== 'undefined') {
        sessionStorage.removeItem('taskoura_auth_from');
      }
      const target = getPostLoginPath(savedFrom);
      navigate(target, { replace: true });
    }
  }, [exchangeCompleted, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div
        data-testid="oauth-callback-card"
        className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-sky-500/5 text-center"
      >
        {errorMessage ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-1">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Sign-in Notice</h2>
            <p className="text-sm text-slate-600 mb-4">{errorMessage}</p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                type="button"
                onClick={() => navigate(LOGIN)}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => navigate(REGISTER)}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Create Account with Email
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-700">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mb-1 shadow-md shadow-sky-500/20">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
            <p className="text-sm font-semibold">Completing sign-in...</p>
            {isSlowWakeup ? (
              <p
                className="text-xs text-amber-600 font-medium"
                data-testid="slow-server-notice"
              >
                Waking up the server, this can take up to a minute
              </p>
            ) : (
              <p className="text-xs text-slate-500">Connecting your account to Taskoura</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
