import React from 'react';
import { Check, Clock, BellOff } from 'lucide-react';
import { Notification } from '../../types/notification';
import { formatTimeAgo } from '../comments/CommentItem';

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  isMarkingRead?: boolean;
  emptyMessage?: string;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onMarkRead,
  isMarkingRead = false,
  emptyMessage = 'No notifications found',
}) => {
  if (notifications.length === 0) {
    return (
      <div
        data-testid="empty-notifications"
        className="py-16 px-4 rounded-3xl border border-dashed border-slate-200 bg-white text-center space-y-3"
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
          <BellOff className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800">No updates to show</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="notification-list" className="space-y-2.5">
      {notifications.map((n) => (
        <div
          key={n.id}
          data-testid={`notification-row-${n.id}`}
          className={`p-4 rounded-2xl border transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            !n.isRead
              ? 'bg-sky-50/40 border-sky-200/80 hover:border-sky-300'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <span
              className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                !n.isRead ? 'bg-sky-600 shadow-xs' : 'bg-transparent'
              }`}
            />
            <div className="space-y-1 min-w-0 flex-1">
              <p
                className={`text-sm break-words leading-relaxed ${
                  !n.isRead ? 'font-bold text-slate-900' : 'text-slate-700'
                }`}
              >
                {n.message}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTimeAgo(n.createdAt)}</span>
              </div>
            </div>
          </div>

          {!n.isRead && (
            <button
              type="button"
              data-testid={`mark-read-btn-${n.id}`}
              disabled={isMarkingRead}
              onClick={() => onMarkRead(n.id)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold text-sky-700 bg-sky-100/70 hover:bg-sky-200/70 border border-sky-200 rounded-xl transition whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark as read</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotificationList;
