import '../globals.css';
import BottomDock from '../../components/common/BottomDock';

export const metadata = {
  title: 'ZZIK v2 - 찍먹',
  description: 'Location-based check-in rewards platform',
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Main content area */}
      <main className="h-[100dvh]">{children}</main>
      
      {/* Fixed bottom navigation dock */}
      <BottomDock />
    </>
  );
}
