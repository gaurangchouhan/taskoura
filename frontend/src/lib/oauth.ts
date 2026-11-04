/**
 * Resolves the backend OAuth authorization URL.
 * Strictly returns an absolute backend URL or throws if unconfigured in production.
 */
export function buildOAuthStartUrl(startUrl: string): string {
  if (!startUrl) {
    throw new Error('Social login is not configured');
  }

  // If already absolute (http:// or https://), return directly
  if (startUrl.startsWith('http://') || startUrl.startsWith('https://')) {
    return startUrl;
  }

  const envUrl = import.meta.env.VITE_API_URL;
  const isProd = import.meta.env.PROD;

  if (isProd && (!envUrl || !envUrl.trim())) {
    throw new Error('Social login is not configured');
  }

  const rawBase = (envUrl || 'http://localhost:8080').trim().replace(/\/+$/, '');
  if (!rawBase) {
    throw new Error('Social login is not configured');
  }

  // Strip trailing /api if provided in VITE_API_URL so /oauth2/... mounts on backend host origin
  const host = rawBase.endsWith('/api') ? rawBase.slice(0, -4) : rawBase;
  const normalizedPath = startUrl.startsWith('/') ? startUrl : `/${startUrl}`;

  const finalUrl = `${host}${normalizedPath}`;
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    throw new Error('Social login is not configured');
  }

  return finalUrl;
}

