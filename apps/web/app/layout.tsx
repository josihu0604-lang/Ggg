import './globals.css';
import { ToastProvider } from '../components/common/Toast';

export const metadata = {
  title: 'ZZIK v2 - 찍먹',
  description: 'Location-based check-in rewards platform',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-[oklch(0.15_0.004_280)] text-white antialiased">
        <ToastProvider>
          {/* Skip to content link for keyboard navigation */}
          <a 
            href="#content" 
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:glass-card focus:px-4 focus:py-2 focus:rounded-lg"
          >
            본문 바로가기
          </a>

          {/* Main content with proper landmark */}
          <div id="content" role="main" className="min-h-dvh pt-safe pb-24">
            {children}
          </div>

          {/* BottomDock will be injected in (main)/layout.tsx */}
        </ToastProvider>
      </body>
    </html>
  );
}
