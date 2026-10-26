import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, AuthResponse, SessionInfo } from '../types';
import {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  isTokenExpired,
  getStoredSession,
  setStoredSession,
  clearStoredSession,
  computeServerOffsetMs,
  getSessionStartTime,
  setSessionStartTime,
} from '../lib/token';
import { broadcastAuthEvent, subscribeAuthEvents, AuthSyncEvent } from '../lib/sessionChannel';
import { authService } from '../services/authService';
import { apiClient } from '../services/api';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  session?: SessionInfo | null;
  isAuthenticated: boolean;
  login: (authResponse: AuthResponse) => void;
  logout: () => Promise<void> | void;
  updateUser: (user: User) => void;
  heartbeat?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 1 hour (3600 seconds) automatic logout duration
const ONE_HOUR_MS = 60 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // In case AuthProvider is rendered outside QueryClientProvider in a unit test
  }

  let navigate: ReturnType<typeof useNavigate> | null = null;
  try {
    navigate = useNavigate();
  } catch {
    // In case AuthProvider is rendered outside Router in a unit test
  }

  let location: ReturnType<typeof useLocation> | null = null;
  try {
    location = useLocation();
  } catch {
    // In case AuthProvider is rendered outside Router in a unit test
  }

  // Initialize state from token.ts, treating expired tokens as logged out
  const [token, setTokenState] = useState<string | null>(() => {
    const existing = getToken();
    if (!existing || isTokenExpired(existing)) {
      clearToken();
      return null;
    }
    return existing;
  });

  const [user, setUserState] = useState<User | null>(() => {
    const existing = getToken();
    if (!existing || isTokenExpired(existing)) {
      return null;
    }
    return getStoredUser();
  });

  const [session, setSessionState] = useState<SessionInfo | null>(() => {
    const existing = getToken();
    if (!existing || isTokenExpired(existing)) {
      return null;
    }
    return getStoredSession();
  });

  // Track session start time for 1-hour automatic logout (persisted across reloads)
  const sessionLoginTimeRef = useRef<number>(getSessionStartTime());

  // Refs for tracking timestamps & active session without stale closures
  const sessionRef = useRef<SessionInfo | null>(session);
  sessionRef.current = session;

  const serverOffsetRef = useRef<number>(
    session?.serverTime ? computeServerOffsetMs(session.serverTime) : 0
  );

  const lastThrottledRef = useRef(0);
  const lastUserActivityRef = useRef(Date.now());
  const lastHeartbeatTimeRef = useRef(Date.now());
  const isExpiringRef = useRef(false);

  const isAuthed = Boolean(token && !isTokenExpired(token));
  const isAuthedRef = useRef(isAuthed);
  isAuthedRef.current = isAuthed;

  // Send Heartbeat to backend and update session timing
  const sendHeartbeat = useCallback(async () => {
    try {
      const updatedTiming = await authService.heartbeat();
      lastHeartbeatTimeRef.current = Date.now();
      lastUserActivityRef.current = Date.now();

      const current = sessionRef.current || getStoredSession();
      const newSession: SessionInfo = {
        idleTimeoutSeconds: current?.idleTimeoutSeconds ?? 3600,
        warningSeconds: 0,
        idleExpiresAt: updatedTiming.idleExpiresAt,
        absoluteExpiresAt: updatedTiming.absoluteExpiresAt,
        serverTime: updatedTiming.serverTime,
      };

      setStoredSession(newSession);
      setSessionState(newSession);
      sessionRef.current = newSession;
      serverOffsetRef.current = computeServerOffsetMs(newSession.serverTime);

      // Broadcast extended event to other tabs
      broadcastAuthEvent({ type: 'extended', session: newSession });
    } catch (err) {
      console.error('[AuthContext] Heartbeat failed:', err);
    }
  }, []);

  // Expiration handler: logs out, clears cache, redirects with reason & from path
  const handleExpire = useCallback(
    async (reason = 'timeout', sessionReason?: string) => {
      if (isExpiringRef.current) return;
      isExpiringRef.current = true;

      // Stop active session immediately to prevent re-entrant interval ticks
      sessionRef.current = null;
      setSessionState(null);

      // 1. Call POST /api/auth/logout best-effort
      try {
        await apiClient.post('/api/auth/logout');
      } catch {
        // best effort
      }

      // 2. Clear token, user, session, and react-query cache
      clearToken();
      clearStoredSession();
      setTokenState(null);
      setUserState(null);

      if (queryClient) {
        queryClient.clear();
      }

      // 3. Sync logout across tabs
      broadcastAuthEvent({ type: 'logout', reason });

      // 4. Remember current path for the existing "from" mechanism
      const currentPath =
        (location && location.pathname !== '/login' ? location.pathname + (location.search || '') : null) ||
        (typeof window !== 'undefined' && window.location && window.location.pathname !== '/login'
          ? window.location.pathname + (window.location.search || '')
          : '/app/projects');

      if (currentPath && currentPath !== '/login' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('taskoura_auth_from', currentPath);
      }

      // 5. Redirect to /login?reason=timeout with clear message
      const params = new URLSearchParams();
      params.set('reason', reason);
      if (sessionReason) {
        params.set('sessionReason', sessionReason);
      }
      const redirectUrl = `/login?${params.toString()}`;

      if (navigate) {
        navigate(redirectUrl, {
          state: { from: { pathname: currentPath } },
          replace: true,
        });
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.href = redirectUrl;
      }
    },
    [location, navigate, queryClient]
  );

  // Logout button calls POST /api/auth/logout before clearing local state
  const logout = useCallback(async () => {
    // Initiate POST /api/auth/logout with token still present in storage
    const postPromise = apiClient.post('/api/auth/logout').catch(() => {});

    clearToken();
    clearStoredSession();
    setTokenState(null);
    setUserState(null);
    setSessionState(null);
    sessionRef.current = null;

    if (queryClient) {
      queryClient.clear();
    }

    broadcastAuthEvent({ type: 'logout' });

    if (navigate) {
      navigate('/login');
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/login';
    }

    await postPromise;
  }, [navigate, queryClient]);

  // Keep state synchronized if storage changes or expires
  useEffect(() => {
    const currentToken = getToken();
    if (!currentToken || isTokenExpired(currentToken)) {
      if (token !== null || user !== null) {
        clearToken();
        clearStoredSession();
        setTokenState(null);
        setUserState(null);
        setSessionState(null);
        sessionRef.current = null;
      }
    }
  }, [token, user]);

  // Multi-tab synchronization (BroadcastChannel with storage fallback)
  useEffect(() => {
    const unsubscribe = subscribeAuthEvents((event: AuthSyncEvent) => {
      if (event.type === 'activity') {
        lastUserActivityRef.current = event.timestamp;
        if (sessionRef.current?.idleTimeoutSeconds) {
          const timeoutMs = sessionRef.current.idleTimeoutSeconds * 1000;
          const newIdleExpires = new Date(Date.now() + serverOffsetRef.current + timeoutMs).toISOString();
          const updated = { ...sessionRef.current, idleExpiresAt: newIdleExpires };
          sessionRef.current = updated;
          setStoredSession(updated);
          setSessionState(updated);
        }
      } else if (event.type === 'extended') {
        sessionRef.current = event.session;
        setStoredSession(event.session);
        setSessionState(event.session);
        serverOffsetRef.current = computeServerOffsetMs(event.session.serverTime);
        lastHeartbeatTimeRef.current = Date.now();
        lastUserActivityRef.current = Date.now();
      } else if (event.type === 'logout') {
        clearToken();
        clearStoredSession();
        setTokenState(null);
        setUserState(null);
        setSessionState(null);
        sessionRef.current = null;

        if (queryClient) {
          queryClient.clear();
        }

        const reason = event.reason || 'timeout';
        const redirectUrl = `/login?reason=${encodeURIComponent(reason)}`;
        if (navigate) {
          navigate(redirectUrl, { replace: true });
        } else if (typeof window !== 'undefined' && window.location) {
          window.location.href = redirectUrl;
        }
      }
    });

    return unsubscribe;
  }, [navigate, queryClient]);

  // User activity listeners (throttled to once per second)
  useEffect(() => {
    if (!isAuthed) return;

    const handleUserActivity = () => {
      if (!isAuthedRef.current) return;
      const now = Date.now();
      if (now - lastThrottledRef.current < 1000) {
        return; // Throttled to once per second
      }
      lastThrottledRef.current = now;
      lastUserActivityRef.current = now;

      // Extend session in current tab
      if (sessionRef.current?.idleTimeoutSeconds) {
        const timeoutMs = sessionRef.current.idleTimeoutSeconds * 1000;
        const newIdleExpires = new Date(Date.now() + serverOffsetRef.current + timeoutMs).toISOString();
        const updated = { ...sessionRef.current, idleExpiresAt: newIdleExpires };
        sessionRef.current = updated;
        setStoredSession(updated);
        setSessionState(updated);
      }

      // Broadcast activity to other tabs
      broadcastAuthEvent({ type: 'activity', timestamp: now });
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
    };
  }, [isAuthed]);

  // Automatic logout timer: automatically and properly logs out after 1 hour (no alerts or popups)
  useEffect(() => {
    if (!isAuthed) return;

    const checkSessionState = () => {
      if (!isAuthedRef.current) return;
      const activeSession = sessionRef.current;

      // 1. If backend session timing is present, check against expiration
      if (activeSession?.idleExpiresAt || activeSession?.absoluteExpiresAt) {
        const nowServer = Date.now() + serverOffsetRef.current;
        if (activeSession.absoluteExpiresAt) {
          const absExpiresMs = new Date(activeSession.absoluteExpiresAt).getTime();
          if (absExpiresMs - nowServer <= 0) {
            handleExpire('timeout', 'ABSOLUTE_TIMEOUT');
            return;
          }
        }
        if (activeSession.idleExpiresAt) {
          const idleExpiresMs = new Date(activeSession.idleExpiresAt).getTime();
          if (idleExpiresMs - nowServer <= 0) {
            handleExpire('timeout', 'IDLE_TIMEOUT');
            return;
          }
        }
      }

      // 2. 1-hour session duration limit (3600 seconds)
      const elapsed = Date.now() - sessionLoginTimeRef.current;
      if (elapsed >= ONE_HOUR_MS) {
        handleExpire('timeout');
      }
    };

    checkSessionState();
    const interval = setInterval(checkSessionState, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthed, handleExpire]);

  const login = (authResponse: AuthResponse) => {
    setToken(authResponse.token);
    setStoredUser(authResponse.user);
    setTokenState(authResponse.token);
    setUserState(authResponse.user);

    if (authResponse.session) {
      setStoredSession(authResponse.session);
      setSessionState(authResponse.session);
      sessionRef.current = authResponse.session;
      serverOffsetRef.current = computeServerOffsetMs(authResponse.session.serverTime);
    }
    const loginNow = Date.now();
    setSessionStartTime(loginNow);
    sessionLoginTimeRef.current = loginNow;
    isExpiringRef.current = false;
    lastHeartbeatTimeRef.current = loginNow;
    lastUserActivityRef.current = loginNow;
  };

  const updateUser = (updatedUser: User) => {
    setStoredUser(updatedUser);
    setUserState(updatedUser);
  };

  const isAuthenticated = isAuthed;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        session,
        isAuthenticated,
        login,
        logout,
        updateUser,
        heartbeat: sendHeartbeat,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    const token = getToken();
    const isAuthed = Boolean(token && !isTokenExpired(token));
    return {
      user: isAuthed ? getStoredUser() : null,
      token: isAuthed ? token : null,
      session: isAuthed ? getStoredSession() : null,
      isAuthenticated: isAuthed,
      login: (authResponse: AuthResponse) => {
        setToken(authResponse.token);
        setStoredUser(authResponse.user);
        if (authResponse.session) {
          setStoredSession(authResponse.session);
        }
      },
      logout: () => {
        clearToken();
      },
      updateUser: (updatedUser: User) => {
        setStoredUser(updatedUser);
      },
    };
  }
  return context;
};

export default AuthContext;
