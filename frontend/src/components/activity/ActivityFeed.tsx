import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  ArrowRightLeft, 
  Pencil,
  Trash2,
  Sparkles,
  UserPlus, 
  MessageSquare, 
  Bug, 
  ShieldCheck, 
  Beaker, 
  Activity as GenericActivityIcon, 
  Clock, 
  Inbox 
} from 'lucide-react';
import { ActivityLog } from '../../types/activity';
import { ProjectMember } from '../../types/member';
import { formatTimeAgo } from '../comments/CommentItem';
import { 
  startOfLocalDay, 
  isSameLocalDay, 
  parseServerDateTime, 
  getBrowserTimeZone, 
  useTimeZone 
} from '../../lib/datetime';

export interface ActivityGroup {
  day: string;
  dateKey: number;
  items: ActivityLog[];
}

export interface ActivityFeedProps {
  activities: ActivityLog[];
  memberMap?: Map<string, ProjectMember>;
  isLoading?: boolean;
  timeZone?: string;
  limit?: number;
}

/**
 * Formats a date into a local calendar day header ("Today", "Yesterday", or "Monday, 20 October 2026")
 * strictly using startOfLocalDay and isSameLocalDay in the given local timezone.
 */
export function formatDayHeader(
  dateStrOrDate: string | Date,
  timeZone: string = getBrowserTimeZone(),
  now: Date = new Date()
): string {
  try {
    const d = parseServerDateTime(dateStrOrDate);
    if (isNaN(d.getTime())) return 'Recent Activity';

    if (isSameLocalDay(d, now, timeZone)) {
      return 'Today';
    }

    const todayStart = startOfLocalDay(now, timeZone);
    // 12 hours before today's start is safely inside yesterday for all timezones
    const yesterdayInstant = new Date(todayStart.getTime() - 12 * 60 * 60 * 1000);
    if (isSameLocalDay(d, yesterdayInstant, timeZone)) {
      return 'Yesterday';
    }

    // Format earlier days using en-GB to produce e.g. "Monday, 20 October 2026"
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(d);
  } catch {
    return 'Recent Activity';
  }
}

/**
 * Sorts activities strictly descending by timestamp, using id as tie-breaker.
 */
export function sortActivitiesDescending(activities: ActivityLog[]): ActivityLog[] {
  return [...activities].sort((a, b) => {
    const tA = parseServerDateTime(a.createdAt).getTime();
    const tB = parseServerDateTime(b.createdAt).getTime();
    if (tA !== tB) {
      return tB - tA; // newest timestamp first
    }
    // Tie-breaker: ID descending (lexicographical)
    return (b.id || '').localeCompare(a.id || '');
  });
}

/**
 * Groups activities by local calendar day in the given timezone, newest day first.
 */
export function groupActivitiesByDay(
  activities: ActivityLog[],
  timeZone: string = getBrowserTimeZone(),
  now: Date = new Date()
): ActivityGroup[] {
  const sorted = sortActivitiesDescending(activities);
  const groups: ActivityGroup[] = [];

  for (const item of sorted) {
    const itemDate = parseServerDateTime(item.createdAt);
    const dayStart = startOfLocalDay(itemDate, timeZone);
    const dateKey = isNaN(dayStart.getTime()) ? 0 : dayStart.getTime();

    const currentGroup = groups[groups.length - 1];
    if (currentGroup && isSameLocalDay(itemDate, new Date(currentGroup.dateKey), timeZone)) {
      currentGroup.items.push(item);
    } else {
      const heading = formatDayHeader(dayStart, timeZone, now);
      groups.push({
        day: heading,
        dateKey,
        items: [item],
      });
    }
  }

  return groups;
}

/**
 * Calculates milliseconds until the next local midnight in the specified timezone.
 */
export function getMsUntilNextLocalMidnight(timeZone: string, fromDate: Date = new Date()): number {
  const todayStart = startOfLocalDay(fromDate, timeZone);
  let tomorrowStart = startOfLocalDay(new Date(todayStart.getTime() + 26 * 60 * 60 * 1000), timeZone);
  if (tomorrowStart.getTime() <= fromDate.getTime()) {
    tomorrowStart = startOfLocalDay(new Date(tomorrowStart.getTime() + 26 * 60 * 60 * 1000), timeZone);
  }
  const diff = tomorrowStart.getTime() - fromDate.getTime();
  return Math.max(100, diff + 50);
}

export function renderActionIcon(actionType: string) {
  switch (actionType) {
    case 'TASK_CREATED':
      return (
        <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
          <PlusCircle className="w-4 h-4" />
        </div>
      );
    case 'TASK_STATUS_CHANGED':
      return (
        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
          <ArrowRightLeft className="w-4 h-4" />
        </div>
      );
    case 'TASK_UPDATED':
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
          <Pencil className="w-4 h-4" />
        </div>
      );
    case 'TASK_DELETED':
      return (
        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
          <Trash2 className="w-4 h-4" />
        </div>
      );
    case 'TASKS_ADDED_FROM_AI':
      return (
        <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
      );
    case 'MEMBER_INVITED':
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
          <UserPlus className="w-4 h-4" />
        </div>
      );
    case 'COMMENT_ADDED':
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4" />
        </div>
      );
    case 'BUG_REPORTED':
      return (
        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
          <Bug className="w-4 h-4" />
        </div>
      );
    case 'BUG_RESOLVED':
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
      );
    case 'TEST_CASE_ADDED':
      return (
        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
          <Beaker className="w-4 h-4" />
        </div>
      );
    default:
      // Generic fallback for unknown actionType
      return (
        <div
          data-testid="fallback-activity-icon"
          className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0"
        >
          <GenericActivityIcon className="w-4 h-4" />
        </div>
      );
  }
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  memberMap,
  isLoading = false,
  timeZone: timeZoneProp,
  limit = 200,
}) => {
  const contextTimeZone = useTimeZone();
  const activeTimeZone = timeZoneProp || contextTimeZone || getBrowserTimeZone();

  const [now, setNow] = useState(() => new Date());

  // Midnight rollover timer: recompute groups when the day changes while the page stays open
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    const scheduleTimer = () => {
      const current = new Date();
      const delay = getMsUntilNextLocalMidnight(activeTimeZone, current);
      timerId = setTimeout(() => {
        setNow(new Date());
        scheduleTimer();
      }, delay);
    };

    scheduleTimer();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [activeTimeZone]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200/80 animate-pulse flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-200 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/3 bg-slate-200 rounded-md" />
              <div className="h-3 w-2/3 bg-slate-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div
        data-testid="empty-activity-feed"
        className="py-16 px-4 rounded-3xl border border-dashed border-slate-200 bg-white text-center space-y-3"
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
          <Inbox className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800">No activity yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Actions taken in this workspace (creating tasks, status updates, comments, and member invites) will appear here.
          </p>
        </div>
      </div>
    );
  }

  const grouped = groupActivitiesByDay(activities, activeTimeZone, now);

  return (
    <div data-testid="activity-feed" className="space-y-8">
      {/* Note when list reaches or exceeds limit */}
      {activities.length >= limit && (
        <div
          data-testid="activity-limit-note"
          className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs font-semibold text-slate-500"
        >
          Showing the latest {limit} events
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.dateKey ? `${group.day}-${group.dateKey}` : group.day} className="space-y-3">
          {/* Day Group Header */}
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {group.day}
            </h3>
            <div className="flex-1 h-px bg-slate-200/70" />
          </div>

          {/* Group Entries */}
          <div className="space-y-2.5">
            {group.items.map((log) => {
              const member = memberMap?.get(log.userId);
              const actorName = member ? member.userName : (log.userName || 'Team member');
              const initials = actorName
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'TM';

              return (
                <div
                  key={log.id}
                  data-testid={`activity-item-${log.id}`}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition shadow-xs flex items-start gap-3.5"
                >
                  {/* Action Icon */}
                  {renderActionIcon(log.actionType)}

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm text-slate-800 break-words leading-relaxed font-medium">
                      {log.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <span className="font-semibold text-slate-700">{actorName}</span>
                      </div>

                      <span className="text-slate-300">•</span>

                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTimeAgo(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;
