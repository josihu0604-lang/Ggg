'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex h-[100dvh] items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 text-center max-w-md animate-liquid-appear">
        <div className="text-6xl mb-4" aria-hidden="true">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">문제가 발생했습니다</h1>
        <p className="text-sm text-gray-400 mb-6">
          일시적인 오류가 발생했습니다. 다시 시도해주세요.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left glass-card p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <summary className="cursor-pointer text-sm font-medium text-red-400 mb-2">
              개발자 정보
            </summary>
            <pre className="text-xs text-gray-400 overflow-auto max-h-32">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl font-semibold hover:scale-105 transition-transform"
          >
            다시 시도
          </button>
          <button
            onClick={() => window.location.href = '/feed'}
            className="w-full px-6 py-3 glass-card rounded-xl font-semibold hover:bg-white/5 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
