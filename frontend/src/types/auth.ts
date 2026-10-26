export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ResendOtpRequest {
  email: string;
}

export interface MessageResponse {
  message: string;
}

export interface SessionInfo {
  idleTimeoutSeconds?: number;
  warningSeconds?: number;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  serverTime: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  session?: SessionInfo;
}
