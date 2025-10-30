// Sentry Client-Side Configuration
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment
    environment: SENTRY_ENVIRONMENT,
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || 'zzik-v2@development',
    
    // Performance Monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Integrations (Sentry v8)
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true, // Privacy: mask all text content
        blockAllMedia: true, // Privacy: block all media
      }),
    ],
    
    // Trace propagation
    tracePropagationTargets: [
      'localhost',
      /^\//,
      /^https:\/\/api\.zzik\.app/,
      /^https:\/\/.*\.zzik\.app/
    ],
    
    // Filtering
    beforeSend(event, hint) {
      // Don't send errors in development
      if (SENTRY_ENVIRONMENT === 'development') {
        console.log('[Sentry] Would send error:', event);
        return null;
      }
      
      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        
        // Ignore network errors (often user's connection)
        if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
          return null;
        }
        
        // Ignore browser extension errors
        if (message.includes('chrome-extension://') || message.includes('moz-extension://')) {
          return null;
        }
      }
      
      return event;
    },
    
    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'Non-Error promise rejection captured',
      // Network errors
      'Network request failed',
      'Failed to fetch',
      // User cancelled actions
      'AbortError',
      'User cancelled',
    ],
  });
} else {
  console.warn('[Sentry] Client not initialized: SENTRY_DSN not configured');
}
