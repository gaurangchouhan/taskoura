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
    const { data } = await apiClient.post<MessageResponse>('/auth/register', payload);
    return data;
  },

  verifyOtp: async (payload: VerifyOtpRequest): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>('/auth/verify-otp', payload);
    return data;
  },

  resendOtp: async (payload: ResendOtpRequest | string): Promise<MessageResponse> => {
    const body = typeof payload === 'string' ? { email: payload } : payload;
    const { data } = await apiClient.post<MessageResponse>('/auth/resend-otp', body);
    return data;
  },

  login: async (payload: LoginRequest): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  forgotPassword: async (payload: { email: string }): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>('/auth/forgot-password', payload);
    return data;
  },

  resetPassword: async (payload: { email: string; otp: string; newPassword: string }): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>('/auth/reset-password', payload);
    return data;
  },

  heartbeat: async (): Promise<SessionInfo> => {
    const { data } = await apiClient.post<SessionInfo>('/auth/session/heartbeat');
    return data;
  },

  getSession: async (): Promise<SessionInfo> => {
    const { data } = await apiClient.get<SessionInfo>('/auth/session');
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};

export default authService;
