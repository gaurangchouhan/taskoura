import { apiClient } from './api';
import {
  RegisterRequest,
  LoginRequest,
  VerifyOtpRequest,
  ResendOtpRequest,
  MessageResponse,
  AuthResponse,
  SessionInfo,
} from '../types/auth';

export const authService = {
  register: async (payload: RegisterRequest): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>('/api/auth/register', payload);
    return data;
  },

  verifyOtp: async (payload: VerifyOtpRequest): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>('/api/auth/verify-otp', payload);
    return data;
  },

  resendOtp: async (payload: ResendOtpRequest | string): Promise<MessageResponse> => {
    const body = typeof payload === 'string' ? { email: payload } : payload;
    const { data } = await apiClient.post<MessageResponse>('/api/auth/resend-otp', body);
    return data;
  },

  login: async (payload: LoginRequest): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/api/auth/login', payload);
    return data;
  },

  forgotPassword: async (payload: { email: string }): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>('/api/auth/forgot-password', payload);
    return data;
  },

  resetPassword: async (payload: { email: string; otp: string; newPassword: string }): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>('/api/auth/reset-password', payload);
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

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },
};

export default authService;
