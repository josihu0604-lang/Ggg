import { SkeletonFeedList } from '../../../components/common/SkeletonCard';

export default function FeedLoadingPage() {
  return (
    <div className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header Skeleton */}
        <div className="mb-6 glass-card rounded-2xl p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-white/10 rounded w-32" />
              <div className="h-4 bg-white/10 rounded w-24" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <div className="text-center space-y-2">
              <div className="h-8 bg-white/10 rounded w-12 mx-auto" />
              <div className="h-3 bg-white/10 rounded w-16 mx-auto" />
            </div>
            <div className="text-center space-y-2">
              <div className="h-8 bg-white/10 rounded w-12 mx-auto" />
              <div className="h-3 bg-white/10 rounded w-16 mx-auto" />
            </div>
            <div className="text-center space-y-2">
              <div className="h-8 bg-white/10 rounded w-12 mx-auto" />
              <div className="h-3 bg-white/10 rounded w-16 mx-auto" />
            </div>
          </div>
        </div>

        {/* Feed Skeleton */}
        <section>
          <div className="h-6 bg-white/10 rounded w-32 mb-3" />
          <SkeletonFeedList count={8} />
        </section>
      </div>
    </div>
  );
}
