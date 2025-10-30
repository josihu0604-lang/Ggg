import { getRecentCheckIns, getUserStats } from '../../../lib/actions/feed';
import FeedList from '../../../components/feed/FeedList';

export default async function FeedPage() {
  // Fetch data server-side
  const [checkIns, userStats] = await Promise.all([
    getRecentCheckIns(15),
    getUserStats(),
  ]);

  return (
    <div className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto p-4">
        <FeedList initialCheckIns={checkIns} userStats={userStats} />
      </div>
    </div>
  );
}
