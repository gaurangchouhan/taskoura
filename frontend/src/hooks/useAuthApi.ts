import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { authService } from '../services/authService';
import {
  RegisterRequest,
  LoginRequest,
  VerifyOtpRequest,
  ResendOtpRequest,
  MessageResponse,
  AuthResponse,
} from '../types/auth';

export const useRegister = (
  options?: UseMutationOptions<MessageResponse, unknown, RegisterRequest>
) => {
  return useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
    ...options,
  });
};

export const useVerifyOtp = (
  options?: UseMutationOptions<MessageResponse, unknown, VerifyOtpRequest>
) => {
  return useMutation({
    mutationFn: (data: VerifyOtpRequest) => authService.verifyOtp(data),
    ...options,
  });
};

export const useResendOtp = (
  options?: UseMutationOptions<MessageResponse, unknown, ResendOtpRequest | string>
) => {
  return useMutation({
    mutationFn: (data: ResendOtpRequest | string) => authService.resendOtp(data),
    ...options,
  });
};

export const useLogin = (
  options?: UseMutationOptions<AuthResponse, unknown, LoginRequest>
) => {
  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    ...options,
  });
};
