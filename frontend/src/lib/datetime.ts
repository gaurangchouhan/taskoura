import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Returns the default browser IANA timezone or 'UTC' if unavailable.
 */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * TimeZoneContext provides the active timezone across the application.
 * Defaults to the client's browser timezone.
 */
export const TimeZoneContext = createContext<string>(getBrowserTimeZone());

export function useTimeZone(): string {
  return useContext(TimeZoneContext);
}

export const SetTimeZoneContext = createContext<((tz: string) => void) | undefined>(undefined);

export function useSetTimeZone(): (tz: string) => void {
  const setter = useContext(SetTimeZoneContext);
  return setter || (() => {});
}

export interface TimeZoneProviderProps {
  timeZone?: string;
  children?: React.ReactNode;
}

export const TimeZoneProvider: React.FC<TimeZoneProviderProps> = ({
  timeZone: propTimeZone,
  children,
}) => {
  const [overrideZone, setOverrideZone] = useState<string | null>(null);

  // Sync if propTimeZone changes
  useEffect(() => {
    if (propTimeZone) {
      setOverrideZone(propTimeZone);
    }
  }, [propTimeZone]);

  let authUserZone: string | undefined;
  try {
    const auth = useAuth();
    authUserZone = (auth?.user as { profile?: { timeZone?: string }; timeZone?: string } | null)?.profile?.timeZone ||
      (auth?.user as { profile?: { timeZone?: string }; timeZone?: string } | null)?.timeZone;
  } catch {
    // Rendered outside AuthProvider
  }

  const resolvedZone = overrideZone || propTimeZone || authUserZone || getBrowserTimeZone();

  return React.createElement(
    SetTimeZoneContext.Provider,
    { value: setOverrideZone },
    React.createElement(
      TimeZoneContext.Provider,
      { value: resolvedZone },
      children
    )
  );
};

/**
 * Parses an ISO date-time string from the backend server.
 * Contract:
 * - If there is no zone designator ('Z' or offset like +05:30), the value is treated as UTC.
 * - Handles strings with 'Z', with offsets, or without zone designator.
 */
export function parseServerDateTime(value: string | Date | null | undefined): Date {
  if (!value) {
    return new Date(NaN);
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value !== 'string') {
    return new Date(NaN);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return new Date(NaN);
  }

  // Regex to detect existing timezone designator:
  // - 'Z' or 'z' at the end
  // - [+-]HH(:?MM)? at the end (e.g. +05:30, -04:00, +0000, +05)
  const hasTimezone = /[zZ]$|[+-]\d{2}(:?\d{2})?$/.test(trimmed);

  if (!hasTimezone) {
    // If it contains a time separator (T or space followed by HH:MM...)
    if (trimmed.includes('T')) {
      return new Date(`${trimmed}Z`);
    }
    if (/\s\d{2}:\d{2}/.test(trimmed)) {
      return new Date(`${trimmed.replace(' ', 'T')}Z`);
    }
    // If it is a plain date (YYYY-MM-DD), treat as UTC midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`);
    }
    // Fallback: append Z
    return new Date(`${trimmed}Z`);
  }

  return new Date(trimmed);
}

/**
 * Extracts a calendar date string (YYYY-MM-DD) for a Date in a specific timezone.
 */
export function getLocalDateString(
  date: string | Date,
  timeZone: string = getBrowserTimeZone()
): string {
  const d = parseServerDateTime(date);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Helper to get decomposed local date and time parts in a specific timezone.
 */
function getPartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Returns a Date representing the exact instant of midnight (00:00:00.000)
 * at the start of the local day in the given timezone.
 */
export function startOfLocalDay(
  date: string | Date,
  timeZone: string = getBrowserTimeZone()
): Date {
  const d = parseServerDateTime(date);
  if (isNaN(d.getTime())) return new Date(NaN);

  const localDateStr = getLocalDateString(d, timeZone);
  if (!localDateStr) return new Date(NaN);

  const [year, month, day] = localDateStr.split('-').map(Number);
  let guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  for (let i = 0; i < 3; i++) {
    const parts = getPartsInTimeZone(guess, timeZone);
    const guessLocalUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const targetLocalUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
    const diff = targetLocalUtc - guessLocalUtc;
    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

/**
 * Checks whether two dates fall on the same calendar day in the given timezone.
 */
export function isSameLocalDay(
  date1: string | Date,
  date2: string | Date,
  timeZone: string = getBrowserTimeZone()
): boolean {
  const s1 = getLocalDateString(date1, timeZone);
  const s2 = getLocalDateString(date2, timeZone);
  if (!s1 || !s2) return false;
  return s1 === s2;
}

/**
 * Checks whether a date falls on today's local calendar day in the given timezone.
 */
export function isToday(
  date: string | Date,
  timeZone: string = getBrowserTimeZone(),
  now: Date = new Date()
): boolean {
  return isSameLocalDay(date, now, timeZone);
}

/**
 * Checks whether a date falls on yesterday's local calendar day in the given timezone.
 */
export function isYesterday(
  date: string | Date,
  timeZone: string = getBrowserTimeZone(),
  now: Date = new Date()
): boolean {
  const todayStr = getLocalDateString(now, timeZone);
  if (!todayStr) return false;

  const [year, month, day] = todayStr.split('-').map(Number);
  const prevDate = new Date(Date.UTC(year, month - 1, day - 1));
  const yesterdayStr = prevDate.toISOString().slice(0, 10);

  const targetStr = getLocalDateString(date, timeZone);
  return targetStr === yesterdayStr;
}

/**
 * Formats a date-time into a human-readable localized string.
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  timeZone: string = getBrowserTimeZone()
): string {
  if (!date) return '';
  const d = parseServerDateTime(date);
  if (isNaN(d.getTime())) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/**
 * Formats a date into a localized calendar date string (e.g. "Oct 24, 2026").
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  timeZone: string = getBrowserTimeZone()
): string {
  if (!date) return '';
  const d = parseServerDateTime(date);
  if (isNaN(d.getTime())) return '';

  const resolvedOptions: Intl.DateTimeFormatOptions = options
    ? { timeZone, ...options }
    : {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      };

  try {
    return new Intl.DateTimeFormat('en-US', resolvedOptions).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Formats a relative time string ("just now", "Xm ago", "Xh ago", "Xd ago", or formatted date).
 */
export function timeAgo(
  date: string | Date | null | undefined,
  timeZone: string = getBrowserTimeZone(),
  now: Date = new Date()
): string {
  if (!date) return '';
  const d = parseServerDateTime(date);
  if (isNaN(d.getTime())) return '';

  const diffMs = now.getTime() - d.getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(d, { month: 'short', day: 'numeric' }, timeZone);
}
