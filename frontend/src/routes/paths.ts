export const HOME = '/';
export const LOGIN = '/login';
export const REGISTER = '/register';
export const OAUTH_CALLBACK = '/auth/callback';
export const WORKSPACE = '/app/projects';
export const FORGOT_PASSWORD = '/forgot-password';
export const RESET_PASSWORD = '/reset-password';
export const VERIFY_EMAIL = '/verify-email';
export const VERIFY_OTP = '/verify-otp';
export const PROFILE = '/app/profile';
export const NOTIFICATIONS = '/app/notifications';

export const PATHS = {
  HOME,
  LOGIN,
  REGISTER,
  OAUTH_CALLBACK,
  WORKSPACE,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
  VERIFY_EMAIL,
  VERIFY_OTP,
  PROFILE,
  NOTIFICATIONS,
} as const;

export default PATHS;

