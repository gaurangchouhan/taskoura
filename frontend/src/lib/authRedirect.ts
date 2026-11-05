import {
  LOGIN,
  REGISTER,
  OAUTH_CALLBACK,
  WORKSPACE,
  VERIFY_EMAIL,
  VERIFY_OTP,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
} from '../routes/paths';

const AUTH_EXCLUDED_PATHS = new Set([
  LOGIN,
  REGISTER,
  OAUTH_CALLBACK,
  VERIFY_EMAIL,
  VERIFY_OTP,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
]);

/**
 * Validates and resolves the post-login destination path.
 * Returns `from` only when it is a safe same-site relative path:
 * - Starts with a single "/"
 * - Does not start with "//" or "/\"
 * - Contains no protocol (e.g. "http:", "https:", "javascript:") or host
 * - Contains no backslashes
 * - Is not an authentication, registration, or password reset route
 * Otherwise returns WORKSPACE ("/app/projects").
 */
export function getPostLoginPath(from?: string | null): string {
  if (!from || typeof from !== 'string') {
    return WORKSPACE;
  }

  const trimmed = from.trim();

  // Must start with a single "/" and not "//" or "/\"
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return WORKSPACE;
  }

  // Must not contain backslashes anywhere (browsers can normalize them to slashes)
  if (trimmed.includes('\\')) {
    return WORKSPACE;
  }

  // Must not contain protocol schemes like "http:", "https:", "javascript:", "data:", etc.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return WORKSPACE;
  }

  // Extract base pathname without query string or hash for auth exclusion check
  const pathname = trimmed.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  if (AUTH_EXCLUDED_PATHS.has(pathname)) {
    return WORKSPACE;
  }

  return trimmed;
}

export default getPostLoginPath;

