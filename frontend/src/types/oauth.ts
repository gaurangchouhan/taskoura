export interface OAuthProvider {
  key: 'google' | 'github';
  label: string;
  startUrl: string;
}

export interface OAuthProvidersResponse {
  providers: OAuthProvider[];
}

export type OAuthErrorCode =
  | 'ACCESS_DENIED'
  | 'EMAIL_MISSING'
  | 'EMAIL_UNVERIFIED'
  | 'ACCOUNT_EXISTS_USE_PASSWORD'
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_ERROR'
  | 'STATE_INVALID';

