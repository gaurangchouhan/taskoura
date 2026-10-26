import axios from 'axios';

export const STATUS_FALLBACKS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const STATUS_MESSAGES = STATUS_FALLBACKS;

/**
 * Extracts a user-friendly error message from an unknown error.
 * Prioritizes backend response body messages, falling back to HTTP status
 * descriptions, network/error messages, or generic fallbacks.
 */
export function getErrorMessage(err: unknown): string {
  if (!err) {
    return 'An unexpected error occurred';
  }

  // Handle Axios / HTTP errors
  if (axios.isAxiosError(err) || (typeof err === 'object' && err !== null && 'response' in err)) {
    const axErr = err as {
      response?: {
        status?: number;
        data?: unknown;
      };
      message?: string;
    };

    const data = axErr.response?.data;
    if (typeof data === 'string' && data.trim()) {
      return data.trim();
    }

    if (typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;
      if (typeof dataObj.message === 'string' && dataObj.message.trim()) {
        return dataObj.message.trim();
      }
      if (typeof dataObj.error === 'string' && dataObj.error.trim()) {
        return dataObj.error.trim();
      }
      if (typeof dataObj.detail === 'string' && dataObj.detail.trim()) {
        return dataObj.detail.trim();
      }
    }

    const status = axErr.response?.status;
    if (status && STATUS_FALLBACKS[status]) {
      return STATUS_FALLBACKS[status];
    }
    if (status) {
      return `HTTP Error ${status}`;
    }

    if (axErr.message && axErr.message.trim()) {
      return axErr.message.trim();
    }
  }

  // Handle Standard Error instance
  if (err instanceof Error) {
    return err.message || 'An unexpected error occurred';
  }

  // Handle String error
  if (typeof err === 'string' && err.trim()) {
    return err.trim();
  }

  // Handle objects with message property
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg.trim();
    }
  }

  return 'An unexpected error occurred';
}

/**
 * Extracts the backend error code from an error response if available.
 * e.g. VALIDATION_FAILED, UNAUTHENTICATED, SESSION_EXPIRED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, etc.
 */
export function getErrorCode(err: unknown): string | undefined {
  if (!err) {
    return undefined;
  }

  if (typeof err === 'object' && err !== null) {
    const axErr = err as {
      response?: {
        data?: unknown;
      };
      code?: string;
    };

    const data = axErr.response?.data;
    if (typeof data === 'object' && data !== null && 'code' in data) {
      const code = (data as Record<string, unknown>).code;
      if (typeof code === 'string' && code.trim()) {
        return code.trim();
      }
    }

    if (typeof axErr.code === 'string' && axErr.code.trim()) {
      return axErr.code.trim();
    }
  }

  return undefined;
}

/**
 * Extracts field-level validation errors from a backend error response.
 * Returns Record<string, string> mapping field names to error messages.
 */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!err || typeof err !== 'object') {
    return {};
  }

  const axErr = err as {
    response?: {
      data?: unknown;
    };
    fieldErrors?: unknown;
  };

  const data = axErr.response?.data;
  let rawFieldErrors: unknown = undefined;

  if (typeof data === 'object' && data !== null && 'fieldErrors' in data) {
    rawFieldErrors = (data as Record<string, unknown>).fieldErrors;
  } else if ('fieldErrors' in axErr) {
    rawFieldErrors = axErr.fieldErrors;
  }

  if (typeof rawFieldErrors === 'object' && rawFieldErrors !== null && !Array.isArray(rawFieldErrors)) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawFieldErrors as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        result[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }
    return result;
  }

  return {};
}

/**
 * Extracts retryAfterSeconds from rate-limited error responses.
 */
export function getRetryAfterSeconds(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }

  const axErr = err as {
    response?: {
      data?: unknown;
      headers?: Record<string, unknown>;
    };
    retryAfterSeconds?: unknown;
  };

  const data = axErr.response?.data;
  if (typeof data === 'object' && data !== null && 'retryAfterSeconds' in data) {
    const s = Number((data as Record<string, unknown>).retryAfterSeconds);
    if (!isNaN(s) && s > 0) return Math.round(s);
  }

  if ('retryAfterSeconds' in axErr) {
    const s = Number(axErr.retryAfterSeconds);
    if (!isNaN(s) && s > 0) return Math.round(s);
  }

  const retryHeader = axErr.response?.headers?.['retry-after'];
  if (retryHeader !== undefined && retryHeader !== null) {
    const s = Number(retryHeader);
    if (!isNaN(s) && s > 0) return Math.round(s);
  }

  return undefined;
}

