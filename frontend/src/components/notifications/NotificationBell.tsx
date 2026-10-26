import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, ArrowRight } from 'lucide-react';
import { useNotifications, useUnreadCount, useMarkRead } from '../../hooks/useNotifications';
import { formatTimeAgo } from '../comments/CommentItem';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useNotifications({
    unreadOnly: false,
    refetchInterval: 60000,
    isBackground: true,
  });

  const { unreadCount, displayCount, hasUnread } = useUnreadCount({ isBackground: true });
  const { mutate: markRead, isPending: isMarkingRead } = useMarkRead();

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Latest 8 notifications
  const latestNotifications = notifications.slice(0, 8);

  const handleNotificationClick = (id: string, isRead: boolean) => {
    if (!isRead) {
      markRead(id);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        data-testid="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-slate-600 hover:text-slate-900 transition-colors" />

        {/* Unread badge: hides at zero and caps at 99+ */}
        {hasUnread && (
          <span
            data-testid="unread-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in"
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-scale-up origin-top-right"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
              {hasUnread && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                  {unreadCount} new
                </span>
              )}
            </div>

            <Link
              to="/app/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition"
            >
              Inbox
            </Link>
          </div>

          {/* List of latest 8 */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : latestNotifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <CheckCheck className="w-7 h-7 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-700">All caught up</p>
                <p className="text-xs text-slate-400 mt-0.5">No notifications right now.</p>
              </div>
            ) : (
              latestNotifications.map((n) => (
                <div
                  key={n.id}
                  data-testid={`notification-item-${n.id}`}
                  onClick={() => handleNotificationClick(n.id, n.isRead)}
                  className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-slate-50/80 ${
                    !n.isRead ? 'bg-sky-50/40' : 'bg-white'
                  }`}
                >
                  {/* Unread indicator */}
                  <div className="pt-1.5 shrink-0">
                    <span
                      className={`block w-2 h-2 rounded-full ${
                        !n.isRead ? 'bg-sky-600 shadow-xs' : 'bg-transparent'
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p
                      className={`text-xs break-words leading-relaxed ${
                        !n.isRead ? 'font-semibold text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {n.message}
                    </p>
                    <span className="text-[11px] text-slate-400 block">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Link */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
            <Link
              to="/app/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-sky-600 transition"
            >
              <span>View all notifications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
