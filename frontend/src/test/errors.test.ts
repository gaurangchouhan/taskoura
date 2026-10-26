import { describe, it, expect } from 'vitest';
import { getErrorMessage, getErrorCode, getFieldErrors, STATUS_FALLBACKS } from '../lib/errors';

describe('errors.ts - getErrorMessage', () => {
  describe('Body messages extraction', () => {
    it('extracts message when data.message is present', () => {
      const err = {
        response: {
          status: 400,
          data: { message: 'Email is already registered in the system.' },
        },
      };
      expect(getErrorMessage(err)).toBe('Email is already registered in the system.');
    });

    it('extracts error string when data.error is present and message is absent', () => {
      const err = {
        response: {
          status: 409,
          data: { error: 'AccountConflict' },
        },
      };
      expect(getErrorMessage(err)).toBe('AccountConflict');
    });

    it('extracts detail string when data.detail is present', () => {
      const err = {
        response: {
          status: 422,
          data: { detail: 'Field "title" cannot be blank.' },
        },
      };
      expect(getErrorMessage(err)).toBe('Field "title" cannot be blank.');
    });

    it('extracts plain string response bodies', () => {
      const err = {
        response: {
          status: 500,
          data: 'Gateway upstream connection dropped',
        },
      };
      expect(getErrorMessage(err)).toBe('Gateway upstream connection dropped');
    });
  });

  describe('Fallback statuses', () => {
    // Tests each fallback status defined in STATUS_FALLBACKS
    it.each(Object.entries(STATUS_FALLBACKS))(
      'returns fallback "%s" -> "%s" when body has no message',
      (statusStr, expectedMessage) => {
        const status = Number(statusStr);
        const err = {
          response: {
            status,
            data: {},
          },
        };
        expect(getErrorMessage(err)).toBe(expectedMessage);
      }
    );

    it('returns formatted HTTP Error message for unknown status code without body message', () => {
      const err = {
        response: {
          status: 418,
          data: {},
        },
      };
      expect(getErrorMessage(err)).toBe('HTTP Error 418');
    });
  });

  describe('Non-Axios and fallback errors', () => {
    it('returns error.message for standard Error instances', () => {
      const err = new Error('Database connection failed');
      expect(getErrorMessage(err)).toBe('Database connection failed');
    });

    it('returns string directly when err is a string', () => {
      expect(getErrorMessage('Custom error string')).toBe('Custom error string');
    });

    it('returns object message property if present on plain object', () => {
      expect(getErrorMessage({ message: 'Plain object failure' })).toBe('Plain object failure');
    });

    it('returns generic message for null or undefined or empty values', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
      expect(getErrorMessage('')).toBe('An unexpected error occurred');
    });
  });
});

describe('errors.ts - getErrorCode', () => {
  it('extracts error code from response.data.code', () => {
    const err = {
      response: {
        status: 400,
        data: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed for request',
        },
      },
    };
    expect(getErrorCode(err)).toBe('VALIDATION_FAILED');
  });

  it('extracts known contract error codes', () => {
    const codes = [
      'VALIDATION_FAILED',
      'UNAUTHENTICATED',
      'SESSION_EXPIRED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMITED',
      'EMAIL_DELIVERY_FAILED',
      'AI_UNAVAILABLE',
      'INTERNAL',
    ];

    for (const code of codes) {
      const err = { response: { data: { code } } };
      expect(getErrorCode(err)).toBe(code);
    }
  });

  it('falls back to err.code if response.data.code is absent', () => {
    const err = { code: 'ECONNABORTED' };
    expect(getErrorCode(err)).toBe('ECONNABORTED');
  });

  it('returns undefined when no code is present or on invalid inputs', () => {
    expect(getErrorCode(null)).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
    expect(getErrorCode({})).toBeUndefined();
    expect(getErrorCode({ response: { data: {} } })).toBeUndefined();
    expect(getErrorCode('some error string')).toBeUndefined();
  });
});

describe('errors.ts - getFieldErrors', () => {
  it('extracts fieldErrors map from response.data.fieldErrors', () => {
    const err = {
      response: {
        status: 400,
        data: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          fieldErrors: {
            title: 'Title is required',
            email: 'Email must be valid',
          },
        },
      },
    };

    expect(getFieldErrors(err)).toEqual({
      title: 'Title is required',
      email: 'Email must be valid',
    });
  });

  it('handles array values in fieldErrors by joining them', () => {
    const err = {
      response: {
        data: {
          fieldErrors: {
            password: ['Must be at least 8 characters', 'Must contain a number'],
          },
        },
      },
    };

    expect(getFieldErrors(err)).toEqual({
      password: 'Must be at least 8 characters, Must contain a number',
    });
  });

  it('returns empty object when fieldErrors is missing or input is non-object', () => {
    expect(getFieldErrors(null)).toEqual({});
    expect(getFieldErrors(undefined)).toEqual({});
    expect(getFieldErrors({})).toEqual({});
    expect(getFieldErrors({ response: { data: {} } })).toEqual({});
    expect(getFieldErrors('error string')).toEqual({});
    expect(getFieldErrors(new Error('something'))).toEqual({});
  });
});
