export default function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-4 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="flex items-start gap-3">
        {/* Icon skeleton */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10" />
        
        {/* Content skeleton */}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function SkeletonFeedList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
