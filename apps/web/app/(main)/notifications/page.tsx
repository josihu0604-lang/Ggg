import { Metadata } from 'next';
import { getNotifications } from '../../../lib/actions/notifications';

export const metadata: Metadata = {
  title: 'Notifications - ZZIK',
  description: 'Your notifications',
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
  return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <main className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <span aria-hidden="true">🔔</span>
            <span>알림</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold bg-gradient-to-r from-orange-500 to-pink-500 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400">
            {notifications.length}개의 알림
          </p>
        </header>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="glass-card p-12 rounded-2xl text-center animate-liquid-appear">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-4">
              <span className="text-5xl">🔔</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">알림이 없습니다</h2>
            <p className="text-sm text-gray-400">
              새로운 오퍼나 이벤트가 있으면 알려드릴게요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`glass-card rounded-xl p-4 transition-colors hover:bg-white/5 ${
                  !notification.read ? 'border-l-4 border-orange-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0" aria-hidden="true">
                    {notification.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
                    <p className="text-sm text-gray-400 mb-2">{notification.message}</p>
                    <time className="text-xs text-gray-500" dateTime={new Date(notification.timestamp).toISOString()}>
                      {formatTimeAgo(notification.timestamp)}
                    </time>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" aria-label="Unread" />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
