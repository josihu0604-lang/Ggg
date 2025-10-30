export default function ProfileLoadingPage() {
  return (
    <div className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto p-4">
        {/* Profile Header Skeleton */}
        <div className="glass-card rounded-2xl p-6 text-center mb-4 animate-pulse">
          <div className="w-24 h-24 rounded-full bg-white/10 mx-auto mb-4" />
          <div className="h-6 bg-white/10 rounded w-32 mx-auto mb-2" />
          <div className="h-4 bg-white/10 rounded w-48 mx-auto mb-6" />
          
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center space-y-2">
                <div className="h-8 bg-white/10 rounded w-12 mx-auto" />
                <div className="h-3 bg-white/10 rounded w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 gap-3 mb-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 space-y-2">
              <div className="h-4 bg-white/10 rounded w-24" />
              <div className="h-8 bg-white/10 rounded w-20" />
            </div>
          ))}
        </div>

        {/* Activity Skeleton */}
        <div className="mb-4 animate-pulse">
          <div className="h-6 bg-white/10 rounded w-32 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/10 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
