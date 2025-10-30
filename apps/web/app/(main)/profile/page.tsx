import { getUserProfile } from '../../../lib/actions/profile';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
  return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default async function ProfilePage() {
  // Fetch user profile data
  const profile = await getUserProfile();
  
  return (
    <div className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto p-4">
        {/* Profile Header */}
        <header className="glass-card rounded-2xl p-6 text-center mb-4 animate-liquid-appear">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 mx-auto mb-4 flex items-center justify-center text-4xl">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span>👤</span>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
          <p className="text-sm text-gray-400 mb-4">{profile.email}</p>
          
          {profile.stats.level === 'PREMIUM' && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 text-orange-400 font-medium text-sm mb-4">
              <span aria-hidden="true">✨</span>
              <span>PREMIUM</span>
            </div>
          )}
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <div>
              <div className="text-2xl font-bold text-orange-400">{profile.stats.totalCheckIns}</div>
              <div className="text-xs text-gray-400">체크인</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-pink-400">{profile.stats.followers}</div>
              <div className="text-xs text-gray-400">팔로워</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{profile.stats.following}</div>
              <div className="text-xs text-gray-400">팔로잉</div>
            </div>
          </div>
        </header>

        {/* Token & Streak Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden="true">💰</span>
              <span className="text-sm text-gray-400">보유 토큰</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {profile.stats.totalTokens.toLocaleString()}
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden="true">🔥</span>
              <span className="text-sm text-gray-400">연속 체크인</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">
              {profile.stats.currentStreak}일
            </div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <section className="mb-4">
          <h2 className="text-lg font-semibold mb-3 px-1 flex items-center gap-2">
            <span aria-hidden="true">📊</span>
            <span>최근 활동</span>
          </h2>
          <div className="space-y-2">
            {profile.recentActivity.map((activity) => (
              <div key={activity.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="text-2xl" aria-hidden="true">{activity.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{activity.title}</div>
                  <time className="text-xs text-gray-400" dateTime={new Date(activity.timestamp).toISOString()}>
                    {formatTimeAgo(activity.timestamp)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="space-y-2 mb-4">
          <h2 className="sr-only">프로필 액션</h2>
          <button className="w-full glass-card p-4 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
            <span className="flex items-center gap-3">
              <span className="text-xl" aria-hidden="true">✏️</span>
              <span className="text-sm font-medium">프로필 편집</span>
            </span>
            <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
          </button>
          <button className="w-full glass-card p-4 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
            <span className="flex items-center gap-3">
              <span className="text-xl" aria-hidden="true">📊</span>
              <span className="text-sm font-medium">활동 통계</span>
            </span>
            <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
          </button>
          <button className="w-full glass-card p-4 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
            <span className="flex items-center gap-3">
              <span className="text-xl" aria-hidden="true">🎖️</span>
              <span className="text-sm font-medium">배지 & 업적</span>
            </span>
            <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
          </button>
        </section>
      </div>
    </div>
  );
}
