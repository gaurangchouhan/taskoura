import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import {
  parseServerDateTime,
  formatDateTime,
  formatDate,
  timeAgo,
  startOfLocalDay,
  isSameLocalDay,
  isToday,
  isYesterday,
  getBrowserTimeZone,
  getLocalDateString,
  useTimeZone,
  TimeZoneProvider,
} from '../lib/datetime';

describe('datetime.ts - parseServerDateTime', () => {
  it('parses ISO string with "Z" correctly as UTC', () => {
    const isoString = '2026-10-21T09:15:30.123Z';
    const parsed = parseServerDateTime(isoString);

    expect(parsed.toISOString()).toBe('2026-10-21T09:15:30.123Z');
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(9); // 0-indexed October
    expect(parsed.getUTCDate()).toBe(21);
    expect(parsed.getUTCHours()).toBe(9);
    expect(parsed.getUTCMinutes()).toBe(15);
    expect(parsed.getUTCSeconds()).toBe(30);
    expect(parsed.getUTCMilliseconds()).toBe(123);
  });

  it('parses ISO string with an offset correctly', () => {
    // 09:15:30 with +05:30 offset corresponds to 03:45:30 UTC
    const offsetString = '2026-10-21T09:15:30+05:30';
    const parsed = parseServerDateTime(offsetString);

    expect(parsed.toISOString()).toBe('2026-10-21T03:45:30.000Z');
    expect(parsed.getUTCHours()).toBe(3);
    expect(parsed.getUTCMinutes()).toBe(45);

    // Negative offset: 09:15:30 with -04:00 offset corresponds to 13:15:30 UTC
    const negativeOffsetString = '2026-10-21T09:15:30-04:00';
    const parsedNegative = parseServerDateTime(negativeOffsetString);
    expect(parsedNegative.toISOString()).toBe('2026-10-21T13:15:30.000Z');
  });

  it('parses string with no zone designator treating value strictly as UTC', () => {
    // Backend date-time missing Z: "2026-10-21T09:15:30"
    const noZoneString = '2026-10-21T09:15:30';
    const parsed = parseServerDateTime(noZoneString);

    // Must match the UTC instant directly, NOT shifted by browser local timezone
    expect(parsed.toISOString()).toBe('2026-10-21T09:15:30.000Z');
    expect(parsed.getTime()).toBe(new Date('2026-10-21T09:15:30Z').getTime());

    // With milliseconds but no Z
    const withMillisNoZone = '2026-10-21T09:15:30.456';
    const parsedMillis = parseServerDateTime(withMillisNoZone);
    expect(parsedMillis.toISOString()).toBe('2026-10-21T09:15:30.456Z');
    expect(parsedMillis.getTime()).toBe(new Date('2026-10-21T09:15:30.456Z').getTime());
  });

  it('handles existing Date instances, null, and empty strings gracefully', () => {
    const existing = new Date('2026-10-21T12:00:00Z');
    const parsed = parseServerDateTime(existing);
    expect(parsed.getTime()).toBe(existing.getTime());

    expect(isNaN(parseServerDateTime(null).getTime())).toBe(true);
    expect(isNaN(parseServerDateTime(undefined).getTime())).toBe(true);
    expect(isNaN(parseServerDateTime('').getTime())).toBe(true);
  });
});

describe('datetime.ts - isToday and isYesterday around local midnight using fake timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('evaluates isToday and isYesterday precisely across midnight in America/New_York', () => {
    const timeZone = 'America/New_York'; // In October, UTC-4 (EDT)

    // Set clock to 2026-10-24 23:59:00 EDT (which is 2026-10-25 03:59:00 UTC)
    const beforeMidnightUtc = new Date('2026-10-25T03:59:00Z');
    vi.setSystemTime(beforeMidnightUtc);

    const oct24 = new Date('2026-10-24T20:00:00-04:00'); // 8 PM Oct 24 in NY
    const oct23 = new Date('2026-10-23T20:00:00-04:00'); // 8 PM Oct 23 in NY
    const oct25 = new Date('2026-10-25T00:30:00-04:00'); // 12:30 AM Oct 25 in NY

    // Before midnight:
    // Today is Oct 24
    expect(isToday(oct24, timeZone)).toBe(true);
    expect(isYesterday(oct24, timeZone)).toBe(false);

    // Yesterday was Oct 23
    expect(isToday(oct23, timeZone)).toBe(false);
    expect(isYesterday(oct23, timeZone)).toBe(true);

    // Oct 25 has not happened yet
    expect(isToday(oct25, timeZone)).toBe(false);
    expect(isYesterday(oct25, timeZone)).toBe(false);

    // Advance clock by 2 minutes -> now 2026-10-25 00:01:00 EDT (04:01:00 UTC)
    vi.advanceTimersByTime(2 * 60 * 1000);

    // After midnight:
    // Oct 25 is now Today
    expect(isToday(oct25, timeZone)).toBe(true);
    expect(isYesterday(oct25, timeZone)).toBe(false);

    // Oct 24 is now Yesterday
    expect(isToday(oct24, timeZone)).toBe(false);
    expect(isYesterday(oct24, timeZone)).toBe(true);

    // Oct 23 is now two days ago (neither today nor yesterday)
    expect(isToday(oct23, timeZone)).toBe(false);
    expect(isYesterday(oct23, timeZone)).toBe(false);
  });

  it('evaluates isToday and isYesterday precisely across midnight in Asia/Kolkata', () => {
    const timeZone = 'Asia/Kolkata'; // UTC+5:30

    // Set clock to 2026-10-24 23:58:00 IST (which is 2026-10-24 18:28:00 UTC)
    vi.setSystemTime(new Date('2026-10-24T18:28:00Z'));

    const eventOct24 = new Date('2026-10-24T10:00:00Z'); // 15:30 IST on Oct 24
    const eventOct23 = new Date('2026-10-23T10:00:00Z'); // 15:30 IST on Oct 23
    const eventOct25 = new Date('2026-10-24T19:00:00Z'); // 00:30 IST on Oct 25

    // Before midnight:
    expect(isToday(eventOct24, timeZone)).toBe(true);
    expect(isYesterday(eventOct24, timeZone)).toBe(false);
    expect(isToday(eventOct23, timeZone)).toBe(false);
    expect(isYesterday(eventOct23, timeZone)).toBe(true);
    expect(isToday(eventOct25, timeZone)).toBe(false);

    // Advance 5 minutes past midnight (now 00:03:00 IST on Oct 25)
    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(isToday(eventOct25, timeZone)).toBe(true);
    expect(isYesterday(eventOct24, timeZone)).toBe(true);
    expect(isToday(eventOct24, timeZone)).toBe(false);
    expect(isYesterday(eventOct23, timeZone)).toBe(false);
  });
});

describe('datetime.ts - startOfLocalDay, formatDateTime, formatDate, timeAgo', () => {
  it('calculates startOfLocalDay for given timezone', () => {
    // Oct 25 15:00 UTC in America/New_York (EDT, UTC-4) -> date is Oct 25
    // Midnight EDT on Oct 25 corresponds to 2026-10-25 04:00:00 UTC
    const date = '2026-10-25T15:00:00Z';
    const startNY = startOfLocalDay(date, 'America/New_York');

    expect(startNY.toISOString()).toBe('2026-10-25T04:00:00.000Z');
    expect(getLocalDateString(startNY, 'America/New_York')).toBe('2026-10-25');

    // In UTC, start of day is 2026-10-25 00:00:00 UTC
    const startUtc = startOfLocalDay(date, 'UTC');
    expect(startUtc.toISOString()).toBe('2026-10-25T00:00:00.000Z');
  });

  it('formats date and datetime with timezone', () => {
    const instant = '2026-10-25T02:30:00Z';

    // In America/New_York (-4), 02:30 UTC is Oct 24, 10:30 PM
    const formattedNY = formatDateTime(instant, { hour12: true }, 'America/New_York');
    expect(formattedNY).toContain('Oct 24, 2026');
    expect(formattedNY).toContain('10:30');
    expect(formattedNY).toContain('PM');

    // In UTC, 02:30 UTC is Oct 25, 2:30 AM
    const formattedUtc = formatDateTime(instant, { hour12: true }, 'UTC');
    expect(formattedUtc).toContain('Oct 25, 2026');
    expect(formattedUtc).toContain('2:30');
    expect(formattedUtc).toContain('AM');

    // formatDate
    expect(formatDate(instant, undefined, 'America/New_York')).toBe('Oct 24, 2026');
    expect(formatDate(instant, undefined, 'UTC')).toBe('Oct 25, 2026');
  });

  it('formats timeAgo relative strings accurately', () => {
    const baseNow = new Date('2026-10-25T12:00:00Z');

    expect(timeAgo('2026-10-25T12:00:10Z', 'UTC', baseNow)).toBe('just now');
    expect(timeAgo('2026-10-25T11:59:45Z', 'UTC', baseNow)).toBe('just now');
    expect(timeAgo('2026-10-25T11:55:00Z', 'UTC', baseNow)).toBe('5m ago');
    expect(timeAgo('2026-10-25T10:00:00Z', 'UTC', baseNow)).toBe('2h ago');
    expect(timeAgo('2026-10-22T12:00:00Z', 'UTC', baseNow)).toBe('3d ago');
    expect(timeAgo('2026-10-10T12:00:00Z', 'UTC', baseNow)).toBe('Oct 10');
  });
});

describe('datetime.ts - TimeZoneContext & useTimeZone', () => {
  it('defaults to browser timezone when no provider override is provided', () => {
    const { result } = renderHook(() => useTimeZone());
    expect(result.current).toBe(getBrowserTimeZone());
  });

  it('provides overridden timezone via TimeZoneProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(TimeZoneProvider, { timeZone: 'Asia/Tokyo' }, children);

    const { result } = renderHook(() => useTimeZone(), { wrapper });
    expect(result.current).toBe('Asia/Tokyo');
  });
});
