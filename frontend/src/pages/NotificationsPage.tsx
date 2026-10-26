import React, { useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { NotificationList } from '../components/notifications/NotificationList';
import { useNotifications, useMarkRead, useUnreadCount } from '../hooks/useNotifications';

export const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const {
    data: notifications = [],
    isLoading,
  } = useNotifications({
    unreadOnly: activeTab === 'unread',
    refetchInterval: 60000,
  });

  const { unreadCount } = useUnreadCount();
  const { mutate: markRead, isPending: isMarkingRead } = useMarkRead();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
                <Bell className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Notifications Inbox
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Review assignment alerts, project mentions, and sprint activity updates.
            </p>
          </div>

          {/* Tab Selector: All vs Unread */}
          <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              data-testid="tab-all-notifications"
              onClick={() => setActiveTab('all')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All</span>
            </button>

            <button
              type="button"
              data-testid="tab-unread-notifications"
              onClick={() => setActiveTab('unread')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'unread'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
              <span className="text-xs">Loading notifications...</span>
            </div>
          ) : (
            <NotificationList
              notifications={notifications}
              onMarkRead={(id) => markRead(id)}
              isMarkingRead={isMarkingRead}
              emptyMessage={
                activeTab === 'unread'
                  ? "You're all caught up! No unread notifications right now."
                  : 'No notifications logged in your workspace yet.'
              }
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;
