import { useMutation } from '@tanstack/react-query';
import { forgotPassword, resetPassword } from './api';

/**
 * Hook to request a password reset email.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: ({ email }) => forgotPassword({ email }),
  });
}

/**
 * Hook to reset password using OTP and new password.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ email, otp, newPassword }) => resetPassword({ email, otp, newPassword }),
  });
}

export default {
  useForgotPassword,
  useResetPassword,
};
