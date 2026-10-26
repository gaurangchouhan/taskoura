import { User, SessionInfo } from '../types';

export const TOKEN_KEY = 'taskoura_token';
export const USER_KEY = 'taskoura_user';
export const SESSION_KEY = 'taskoura_session';
export const SERVER_OFFSET_KEY = 'taskoura_server_offset';

export interface DecodedToken {
  sub?: string;
  exp?: number;
  [key: string]: unknown;
}

export function computeServerOffsetMs(serverTimeStr: string): number {
  const serverTimeMs = new Date(serverTimeStr).getTime();
  const localTimeMs = Date.now();
  return isNaN(serverTimeMs) ? 0 : serverTimeMs - localTimeMs;
}

export function getServerOffset(): number {
  const raw = localStorage.getItem(SERVER_OFFSET_KEY);
  if (!raw) return 0;
  const num = parseInt(raw, 10);
  return isNaN(num) ? 0 : num;
}

export function getStoredSession(): SessionInfo | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

export function setStoredSession(session: SessionInfo): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session.serverTime) {
    const offset = computeServerOffsetMs(session.serverTime);
    localStorage.setItem(SERVER_OFFSET_KEY, offset.toString());
  }
}

export const SESSION_START_KEY = 'taskoura_session_start';

export function getSessionStartTime(): number {
  const raw = localStorage.getItem(SESSION_START_KEY);
  if (!raw) {
    const now = Date.now();
    localStorage.setItem(SESSION_START_KEY, now.toString());
    return now;
  }
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? Date.now() : parsed;
}

export function setSessionStartTime(timestamp: number): void {
  localStorage.setItem(SESSION_START_KEY, timestamp.toString());
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SERVER_OFFSET_KEY);
  localStorage.removeItem(SESSION_START_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearStoredSession();
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function decodeToken(token?: string | null): DecodedToken | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as DecodedToken;
  } catch {
    return null;
  }
}

export function isTokenExpired(token?: string | null): boolean {
  const t = token !== undefined ? token : getToken();
  if (!t) return true;
  const decoded = decodeToken(t);
  if (!decoded || typeof decoded.exp !== 'number') return true;
  return decoded.exp * 1000 <= Date.now();
}
