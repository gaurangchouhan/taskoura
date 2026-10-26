import { apiClient } from '../../services/api';

/**
 * Request a password reset code.
 * POST /api/auth/forgot-password { email } -> { message }
 */
export async function forgotPassword({ email }) {
  const { data } = await apiClient.post('/api/auth/forgot-password', { email });
  return data;
}

/**
 * Complete a password reset with code and new password.
 * POST /api/auth/reset-password { email, otp, newPassword } -> { message }
 */
export async function resetPassword({ email, otp, newPassword }) {
  const { data } = await apiClient.post('/api/auth/reset-password', { email, otp, newPassword });
  return data;
}

export default {
  forgotPassword,
  resetPassword,
};
