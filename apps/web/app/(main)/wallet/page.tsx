import { getWalletData } from '../../../lib/actions/wallet';
import WalletContent from '../../../components/wallet/WalletContent';

export default async function WalletPage() {
  // Fetch wallet data
  const wallet = await getWalletData();
  
  return (
    <div className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto p-4">
        <WalletContent wallet={wallet} />
      </div>
    </div>
  );
}
