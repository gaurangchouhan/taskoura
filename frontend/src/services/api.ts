import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { Project, Task, User, Bug, TestCase, KanbanStatus, SessionInfo, AuthResponse } from '../types';
import { getToken, clearToken, isTokenExpired, setToken, setStoredUser, getStoredUser, setStoredSession, getStoredSession } from '../lib/token';
import { getErrorCode } from '../lib/errors';

const rawApiUrl = import.meta.env.VITE_API_URL;
if (!rawApiUrl && import.meta.env.PROD) {
  console.warn('VITE_API_URL is missing in production environment.');
}

export const API_BASE = (rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '') || '';

export const WAKE_UP_TOAST_MESSAGE = 'Waking up the server, this can take up to a minute';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let activeSlowRequests = 0;
let wakeToastId: string | undefined;

function startSlowRequestTimer(config: InternalAxiosRequestConfig) {
  let timerFired = false;
  const timer = setTimeout(() => {
    timerFired = true;
    activeSlowRequests++;
    if (!wakeToastId) {
      wakeToastId = toast.loading(WAKE_UP_TOAST_MESSAGE);
    }
  }, 4000);

  (config as unknown as Record<string, unknown>).__clearWakeTimer = () => {
    clearTimeout(timer);
    if (timerFired) {
      activeSlowRequests--;
      if (activeSlowRequests <= 0) {
        activeSlowRequests = 0;
        if (wakeToastId) {
          toast.dismiss(wakeToastId);
          wakeToastId = undefined;
        }
      }
    }
  };
}

function settleSlowRequestTimer(config?: unknown) {
  if (config && typeof config === 'object' && '__clearWakeTimer' in config) {
    const clearFn = (config as { __clearWakeTimer?: () => void }).__clearWakeTimer;
    if (typeof clearFn === 'function') {
      clearFn();
    }
  }
}

export function handleAuthRedirect(reason: string = 'expired', sessionReason?: string): void {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const currentPath = window.location.pathname;
      if (currentPath && currentPath !== '/login' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('taskoura_auth_from', currentPath + (window.location.search || ''));
      }
      const params = new URLSearchParams();
      params.set('reason', reason);
      if (sessionReason) {
        params.set('sessionReason', sessionReason);
      }
      window.location.href = `/login?${params.toString()}`;
    } catch {
      // In non-browser / mock environments where location.href is not assignable
    }
  }
}

// Request Interceptor
apiClient.interceptors.request.use((config) => {
  startSlowRequestTimer(config);

  const rawUrl = config.url || '';
  const pathname = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? new URL(rawUrl).pathname
    : rawUrl;

  const isPublic = pathname.startsWith('/api/auth/') || pathname.startsWith('/api/health');

  if (!isPublic) {
    const token = getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // If sending FormData, do not set Content-Type so browser/runtime sets boundary automatically
  const isFormData =
    (typeof FormData !== 'undefined' && config.data instanceof FormData) ||
    (config.data && typeof config.data === 'object' && (config.data as { constructor?: { name?: string } }).constructor?.name === 'FormData');

  if (isFormData && config.headers) {
    delete (config.headers as Record<string, unknown>)['Content-Type'];
    delete (config.headers as Record<string, unknown>)['content-type'];
    if (typeof (config.headers as { delete?: (key: string) => void }).delete === 'function') {
      (config.headers as { delete: (key: string) => void }).delete('Content-Type');
      (config.headers as { delete: (key: string) => void }).delete('content-type');
    }
  }

  return config;
});

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => {
    settleSlowRequestTimer(response.config);
    return response;
  },
  (error: AxiosError) => {
    settleSlowRequestTimer(error.config);

    const status = error.response?.status;
    const rawUrl = error.config?.url || '';
    const pathname = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? new URL(rawUrl).pathname
      : rawUrl;
    const isAuthEndpoint = pathname.startsWith('/api/auth/');

    // 401 is definitive: clear auth and redirect to /login
    // Keep ?reason=expired for UNAUTHENTICATED (or default), ?reason=timeout for SESSION_EXPIRED
    if (status === 401 && !isAuthEndpoint) {
      clearToken();
      const code = getErrorCode(error);
      const data = error.response?.data as { code?: string; reason?: string } | undefined;
      const backendReason = data?.reason;

      let reason = 'expired';
      let sessionReason: string | undefined = undefined;

      if (code === 'SESSION_EXPIRED') {
        reason = 'timeout';
        sessionReason = backendReason;
      }
      handleAuthRedirect(reason, sessionReason);
      return Promise.reject(error);
    }

    // 403 compatibility fallback: only clear auth & redirect if token is missing or expired
    if (status === 403 && !isAuthEndpoint) {
      const token = getToken();
      if (!token || isTokenExpired(token)) {
        clearToken();
        handleAuthRedirect('expired');
      }
      return Promise.reject(error);
    }

    // In local development, if connection failed to localhost:8080 or localhost:8081,
    // seamlessly failover to the alternate port so developers never get stuck on port mismatches.
    const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error');
    const customConfig = error.config as (InternalAxiosRequestConfig & { _portFallbackTried?: boolean }) | undefined;

    if (import.meta.env.DEV && isNetworkError && customConfig && !customConfig._portFallbackTried) {
      customConfig._portFallbackTried = true;
      const currentBaseUrl = customConfig.baseURL || apiClient.defaults.baseURL || '';
      const currentUrl = customConfig.url || '';

      let targetPort: string | null = null;
      if (currentBaseUrl.includes(':8080') || currentUrl.includes(':8080')) {
        targetPort = '8081';
      } else if (currentBaseUrl.includes(':8081') || currentUrl.includes(':8081')) {
        targetPort = '8080';
      }

      if (targetPort) {
        const fromPort = targetPort === '8080' ? '8081' : '8080';
        if (customConfig.baseURL) {
          customConfig.baseURL = customConfig.baseURL.replace(`:${fromPort}`, `:${targetPort}`);
        }
        if (customConfig.url) {
          customConfig.url = customConfig.url.replace(`:${fromPort}`, `:${targetPort}`);
        }
        if (apiClient.defaults.baseURL) {
          apiClient.defaults.baseURL = apiClient.defaults.baseURL.replace(`:${fromPort}`, `:${targetPort}`);
        }
        console.warn(`[Taskoura API] Localhost port :${fromPort} unreachable. Auto-failing over to :${targetPort}...`);
        return apiClient(customConfig);
      }
    }

    return Promise.reject(error);
  }
);

// Expose on window for easy browser console verification
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).apiClient = apiClient;
}

// Health Service
export const healthService = {
  getHealth: async (): Promise<{ status: string; service?: string }> => {
    const { data } = await apiClient.get<{ status: string; service?: string }>('/api/health');
    return data;
  },
  check: async (): Promise<{ status: string; service?: string }> => {
    const { data } = await apiClient.get<{ status: string; service?: string }>('/api/health');
    return data;
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).healthService = healthService;
}

// Auth Service
export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    const { data } = await apiClient.post<AuthResponse>('/api/auth/login', credentials);
    setToken(data.token);
    setStoredUser(data.user);
    if (data.session) {
      setStoredSession(data.session);
    }
    return data;
  },

  register: async (payload: { name: string; email: string; password: string }) => {
    const { data } = await apiClient.post<User>('/api/auth/register', payload);
    return data;
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/api/users/me');
    return data;
  },

  verifyOtp: async (payload: { email: string; otp: string }) => {
    const { data } = await apiClient.post<{ message: string }>('/api/auth/verify-otp', payload);
    return data;
  },

  resendOtp: async (email: string) => {
    const { data } = await apiClient.post<{ message: string }>('/api/auth/resend-otp', { email });
    return data;
  },

  heartbeat: async (): Promise<SessionInfo> => {
    const { data } = await apiClient.post<SessionInfo>('/api/auth/session/heartbeat');
    return data;
  },

  getSession: async (): Promise<SessionInfo> => {
    const { data } = await apiClient.get<SessionInfo>('/api/auth/session');
    return data;
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // best effort
    } finally {
      clearToken();
    }
  },

  getStoredUser,
  getStoredSession,
};

// Projects Service
export { projectService } from './projectService';
export { memberService } from './memberService';

// Tasks Service
export { taskService } from './taskService';
export { commentService } from './commentService';
export { qualityService } from './qualityService';

// Bugs & QA
export const qaService = {
  getBugs: async (projectId: string): Promise<Bug[]> => {
    const { data } = await apiClient.get<Bug[]>(`/api/projects/${projectId}/bugs`);
    return data;
  },

  getTestCases: async (projectId: string): Promise<TestCase[]> => {
    const { data } = await apiClient.get<TestCase[]>(`/api/projects/${projectId}/test-cases`);
    return data;
  },
};

// AI Service
export { aiService } from './aiService';

// Notifications & Activity
export { notificationService } from './notificationService';
export { activityService } from './activityService';

// Dashboard & Report
export { dashboardService } from './dashboardService';
