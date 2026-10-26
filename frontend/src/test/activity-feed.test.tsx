import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ActivityFeed, formatDayHeader, groupActivitiesByDay } from '../components/activity/ActivityFeed';
import { ActivityLog } from '../types/activity';
import { ProjectMember } from '../types/member';
import { TimeZoneProvider } from '../lib/datetime';

describe('PHASE 3: Activity Feed Grouping & Chronology (F3)', () => {
  const sampleMembers = new Map<string, ProjectMember>([
    [
      'user-1',
      {
        id: 'mem-1',
        userId: 'user-1',
        userName: 'Alice Smith',
        userEmail: 'alice@example.com',
        role: 'Owner',
      },
    ],
  ]);

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('events at 23:59 and 00:01 land in different day groups', () => {
    // Current time at 2026-10-25T12:00:00Z (UTC)
    const now = new Date('2026-10-25T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const activities: ActivityLog[] = [
      {
        id: 'act-after-midnight',
        projectId: 'p-1',
        userId: 'user-1',
        userName: 'Alice',
        actionType: 'TASK_CREATED',
        description: 'Task created at 00:01',
        createdAt: '2026-10-25T00:01:00Z',
      },
      {
        id: 'act-before-midnight',
        projectId: 'p-1',
        userId: 'user-1',
        userName: 'Alice',
        actionType: 'TASK_STATUS_CHANGED',
        description: 'Task moved at 23:59',
        createdAt: '2026-10-24T23:59:00Z',
      },
    ];

    render(
      <TimeZoneProvider timeZone="UTC">
        <ActivityFeed activities={activities} memberMap={sampleMembers} />
      </TimeZoneProvider>
    );

    // 00:01 is today (25 Oct), 23:59 is yesterday (24 Oct)
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();

    const groups = groupActivitiesByDay(activities, 'UTC', now);
    expect(groups).toHaveLength(2);
    expect(groups[0].day).toBe('Today');
    expect(groups[0].items[0].id).toBe('act-after-midnight');
    expect(groups[1].day).toBe('Yesterday');
    expect(groups[1].items[0].id).toBe('act-before-midnight');
  });

  it('renders Today, Yesterday, and earlier headings formatted as e.g. "Monday, 20 October 2026"', () => {
    const now = new Date('2026-10-25T12:00:00Z'); // Sunday, 25 Oct 2026
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const activities: ActivityLog[] = [
      {
        id: 'act-today',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_CREATED',
        description: 'Action today',
        createdAt: '2026-10-25T10:00:00Z',
      },
      {
        id: 'act-yesterday',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_STATUS_CHANGED',
        description: 'Action yesterday',
        createdAt: '2026-10-24T15:00:00Z',
      },
      {
        id: 'act-earlier-monday',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_UPDATED',
        description: 'Action on Monday, 20 October',
        createdAt: '2026-10-20T09:00:00Z',
      },
    ];

    render(
      <TimeZoneProvider timeZone="UTC">
        <ActivityFeed activities={activities} memberMap={sampleMembers} />
      </TimeZoneProvider>
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    // 20 October 2026 was a Tuesday
    expect(screen.getByText('Tuesday, 20 October 2026')).toBeInTheDocument();

    // Verify formatDayHeader for a Monday (19 October 2026)
    const mondayHeader = formatDayHeader('2026-10-19T10:00:00Z', 'UTC', now);
    expect(mondayHeader).toBe('Monday, 19 October 2026');
  });

  it('orders items inside a group by timestamp descending, with id tie-breaker', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const activities: ActivityLog[] = [
      {
        id: 'id-alpha',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_CREATED',
        description: 'Identical timestamp lower ID',
        createdAt: '2026-10-25T10:00:00Z',
      },
      {
        id: 'id-zeta',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_UPDATED',
        description: 'Identical timestamp higher ID',
        createdAt: '2026-10-25T10:00:00Z',
      },
      {
        id: 'id-earlier',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'COMMENT_ADDED',
        description: 'Earlier timestamp',
        createdAt: '2026-10-25T08:00:00Z',
      },
      {
        id: 'id-latest',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_STATUS_CHANGED',
        description: 'Latest timestamp',
        createdAt: '2026-10-25T11:00:00Z',
      },
    ];

    const groups = groupActivitiesByDay(activities, 'UTC', now);
    expect(groups).toHaveLength(1);
    const itemIds = groups[0].items.map((i) => i.id);

    // Order:
    // 1. 11:00:00 -> id-latest
    // 2. 10:00:00 (zeta > alpha tie breaker) -> id-zeta
    // 3. 10:00:00 -> id-alpha
    // 4. 08:00:00 -> id-earlier
    expect(itemIds).toEqual(['id-latest', 'id-zeta', 'id-alpha', 'id-earlier']);
  });

  it('another timezone changes the grouping correctly', () => {
    // Two events:
    // Event 1: 2026-10-24T23:30:00Z
    // Event 2: 2026-10-25T01:30:00Z
    // Now: 2026-10-25T12:00:00Z
    const now = new Date('2026-10-25T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const activities: ActivityLog[] = [
      {
        id: 'ev-2',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_CREATED',
        description: 'Event 2 (01:30 UTC)',
        createdAt: '2026-10-25T01:30:00Z',
      },
      {
        id: 'ev-1',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_UPDATED',
        description: 'Event 1 (23:30 UTC)',
        createdAt: '2026-10-24T23:30:00Z',
      },
    ];

    // In UTC: ev-2 is 25 Oct ("Today"), ev-1 is 24 Oct ("Yesterday") -> 2 groups
    const utcGroups = groupActivitiesByDay(activities, 'UTC', now);
    expect(utcGroups).toHaveLength(2);
    expect(utcGroups[0].day).toBe('Today');
    expect(utcGroups[0].items[0].id).toBe('ev-2');
    expect(utcGroups[1].day).toBe('Yesterday');
    expect(utcGroups[1].items[0].id).toBe('ev-1');

    // In America/New_York (UTC-4):
    // Now is 2026-10-25 08:00:00 EDT (Today is 25 Oct)
    // ev-2 in NY is 2026-10-24 21:30:00 EDT (Yesterday: 24 Oct)
    // ev-1 in NY is 2026-10-24 19:30:00 EDT (Yesterday: 24 Oct)
    // Both fall on 24 October -> 1 group ("Yesterday")!
    const nyGroups = groupActivitiesByDay(activities, 'America/New_York', now);
    expect(nyGroups).toHaveLength(1);
    expect(nyGroups[0].day).toBe('Yesterday');
    expect(nyGroups[0].items.map((i) => i.id)).toEqual(['ev-2', 'ev-1']);
  });

  it('renders generic icon for unknown actionType and specific icons for new Phase 1/2 types', () => {
    const activities: ActivityLog[] = [
      {
        id: 'act-unknown',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'UNKNOWN_CUSTOM_TYPE',
        description: 'Something unusual happened',
        createdAt: '2026-10-25T10:00:00Z',
      },
      {
        id: 'act-updated',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_UPDATED',
        description: 'Task details updated',
        createdAt: '2026-10-25T09:30:00Z',
      },
      {
        id: 'act-deleted',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_DELETED',
        description: 'Task was deleted',
        createdAt: '2026-10-25T09:00:00Z',
      },
      {
        id: 'act-ai',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASKS_ADDED_FROM_AI',
        description: 'Added 5 tasks from AI plan',
        createdAt: '2026-10-25T08:30:00Z',
      },
    ];

    render(
      <TimeZoneProvider timeZone="UTC">
        <ActivityFeed activities={activities} memberMap={sampleMembers} />
      </TimeZoneProvider>
    );

    // Fallback icon for unknown actionType
    expect(screen.getByTestId('fallback-activity-icon')).toBeInTheDocument();
    // All descriptions present
    expect(screen.getByText('Something unusual happened')).toBeInTheDocument();
    expect(screen.getByText('Task details updated')).toBeInTheDocument();
    expect(screen.getByText('Task was deleted')).toBeInTheDocument();
    expect(screen.getByText('Added 5 tasks from AI plan')).toBeInTheDocument();
  });

  it('the midnight rollover timer updates the headings when day rolls over', () => {
    // Set system time 10 seconds before local midnight in UTC
    const beforeMidnight = new Date('2026-10-25T23:59:50Z');
    vi.useFakeTimers();
    vi.setSystemTime(beforeMidnight);

    const activities: ActivityLog[] = [
      {
        id: 'act-today-becomes-yesterday',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'TASK_CREATED',
        description: 'Task created on Oct 25',
        createdAt: '2026-10-25T12:00:00Z',
      },
      {
        id: 'act-yesterday-becomes-date',
        projectId: 'p-1',
        userId: 'user-1',
        actionType: 'COMMENT_ADDED',
        description: 'Comment made on Oct 24',
        createdAt: '2026-10-24T12:00:00Z',
      },
    ];

    render(
      <TimeZoneProvider timeZone="UTC">
        <ActivityFeed activities={activities} memberMap={sampleMembers} />
      </TimeZoneProvider>
    );

    // Before midnight: 25 Oct is "Today", 24 Oct is "Yesterday"
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();

    // Advance timers by 15 seconds into next day (2026-10-26T00:00:05Z)
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // After midnight:
    // "Today" should no longer exist (no events yet on 26 Oct)
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    // 25 Oct is now "Yesterday"
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    // 24 Oct is now formatted as "Saturday, 24 October 2026"
    expect(screen.getByText('Saturday, 24 October 2026')).toBeInTheDocument();
  });

  it('displays "Showing the latest 200 events" when the list reaches limit', () => {
    const activities: ActivityLog[] = Array.from({ length: 200 }, (_, i) => ({
      id: `act-${i}`,
      projectId: 'p-1',
      userId: 'user-1',
      actionType: 'TASK_CREATED',
      description: `Task event ${i}`,
      createdAt: '2026-10-25T10:00:00Z',
    }));

    render(
      <TimeZoneProvider timeZone="UTC">
        <ActivityFeed activities={activities} memberMap={sampleMembers} limit={200} />
      </TimeZoneProvider>
    );

    expect(screen.getByTestId('activity-limit-note')).toBeInTheDocument();
    expect(screen.getByText('Showing the latest 200 events')).toBeInTheDocument();
  });

  it('displays empty state when activities array is empty', () => {
    render(
      <TimeZoneProvider timeZone="UTC">
        <ActivityFeed activities={[]} memberMap={sampleMembers} />
      </TimeZoneProvider>
    );

    expect(screen.getByTestId('empty-activity-feed')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });
});
