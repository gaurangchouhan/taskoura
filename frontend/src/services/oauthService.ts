import { apiClient } from './api';
import { OAuthProvidersResponse } from '../types/oauth';
import { AuthResponse } from '../types/auth';

/**
 * Fetch available and configured OAuth providers from backend.
 * GET /api/auth/oauth/providers
 */
export async function getOAuthProviders(): Promise<OAuthProvidersResponse> {
  const { data } = await apiClient.get<OAuthProvidersResponse>('/auth/oauth/providers');
  return data;
}

/**
 * Exchange one-time OAuth authorization code for session & JWT.
 * POST /api/auth/oauth/exchange { code }
 */
export async function exchangeOAuthCode(code: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/oauth/exchange', { code });
  return data;
}

export default {
  getOAuthProviders,
  exchangeOAuthCode,
};

