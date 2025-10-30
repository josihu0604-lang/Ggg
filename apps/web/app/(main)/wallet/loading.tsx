export default function WalletLoadingPage() {
  return (
    <div className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto p-4">
        {/* Balance Card Skeleton */}
        <div className="glass-card rounded-2xl p-6 mb-4 text-center animate-pulse">
          <div className="w-16 h-16 bg-white/10 rounded-full mx-auto mb-3" />
          <div className="h-4 bg-white/10 rounded w-24 mx-auto mb-2" />
          <div className="h-12 bg-white/10 rounded w-40 mx-auto mb-1" />
          <div className="h-3 bg-white/10 rounded w-16 mx-auto mb-6" />
          
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-white/10 rounded w-16 mx-auto" />
                <div className="h-6 bg-white/10 rounded w-24 mx-auto" />
              </div>
            ))}
          </div>
        </div>
        
        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 rounded-xl text-center space-y-2">
              <div className="w-8 h-8 bg-white/10 rounded mx-auto" />
              <div className="h-3 bg-white/10 rounded w-12 mx-auto" />
            </div>
          ))}
        </div>
        
        {/* Transaction History Skeleton */}
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-32 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/10 rounded w-1/4" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 bg-white/10 rounded w-16 ml-auto" />
                  <div className="h-3 bg-white/10 rounded w-20 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
