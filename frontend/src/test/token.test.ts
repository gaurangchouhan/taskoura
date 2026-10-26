import { describe, it, expect, beforeEach } from 'vitest';
import {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  decodeToken,
  isTokenExpired,
  TOKEN_KEY,
  USER_KEY,
} from '../lib/token';
import { User } from '../types';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

describe('token.ts utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Storage helpers', () => {
    it('sets, gets, and clears auth token', () => {
      expect(getToken()).toBeNull();
      setToken('my-test-token');
      expect(getToken()).toBe('my-test-token');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('my-test-token');

      clearToken();
      expect(getToken()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('sets, gets, and clears stored user', () => {
      const mockUser: User = {
        id: 'user-123',
        name: 'Gaurang',
        email: 'gaurang@example.com',
      };

      expect(getStoredUser()).toBeNull();
      setStoredUser(mockUser);
      expect(getStoredUser()).toEqual(mockUser);

      clearToken();
      expect(getStoredUser()).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });

    it('handles malformed stored user JSON gracefully', () => {
      localStorage.setItem(USER_KEY, '{invalid json');
      expect(getStoredUser()).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('returns null for empty, null, or undefined token', () => {
      expect(decodeToken('')).toBeNull();
      expect(decodeToken(null)).toBeNull();
      expect(decodeToken(undefined)).toBeNull();
    });

    it('returns null for malformed token structure (not 3 parts)', () => {
      expect(decodeToken('just-a-string')).toBeNull();
      expect(decodeToken('two.parts')).toBeNull();
      expect(decodeToken('four.parts.here.extra')).toBeNull();
    });

    it('returns null if payload is not valid base64 JSON', () => {
      expect(decodeToken('header.not_base64_json!@#.sig')).toBeNull();
    });

    it('decodes a valid JWT payload correctly', () => {
      const payload = { sub: 'user-abc', role: 'admin', exp: 1799999999 };
      const token = createJwt(payload);

      const decoded = decodeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('user-abc');
      expect(decoded?.role).toBe('admin');
      expect(decoded?.exp).toBe(1799999999);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true when token is null or undefined or empty', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired(undefined)).toBe(true);
      expect(isTokenExpired('')).toBe(true);
    });

    it('returns true for a malformed token', () => {
      expect(isTokenExpired('malformed.token')).toBe(true);
      expect(isTokenExpired('invalid-token-string')).toBe(true);
    });

    it('returns true for a token missing the exp claim', () => {
      const tokenWithoutExp = createJwt({ sub: 'user-no-exp', name: 'No Exp' });
      expect(decodeToken(tokenWithoutExp)).toEqual({ sub: 'user-no-exp', name: 'No Exp' });
      expect(isTokenExpired(tokenWithoutExp)).toBe(true);
    });

    it('returns true for an expired token', () => {
      const pastSeconds = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
      const expiredToken = createJwt({ sub: 'user-expired', exp: pastSeconds });
      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    it('returns false for a valid, non-expired token', () => {
      const futureSeconds = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const validToken = createJwt({ sub: 'user-valid', exp: futureSeconds });
      expect(isTokenExpired(validToken)).toBe(false);
    });

    it('checks localStorage token when no parameter is passed', () => {
      expect(isTokenExpired()).toBe(true);

      const futureSeconds = Math.floor(Date.now() / 1000) + 3600;
      setToken(createJwt({ sub: 'user-storage', exp: futureSeconds }));
      expect(isTokenExpired()).toBe(false);

      const pastSeconds = Math.floor(Date.now() / 1000) - 3600;
      setToken(createJwt({ sub: 'user-storage', exp: pastSeconds }));
      expect(isTokenExpired()).toBe(true);
    });
  });
});
