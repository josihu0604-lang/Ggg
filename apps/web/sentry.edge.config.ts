// Sentry Edge Runtime Configuration
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment
    environment: SENTRY_ENVIRONMENT,
    
    // Release tracking
    release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE || 'zzik-v2@development',
    
    // Performance Monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Edge runtime has limited integrations
    integrations: [],
    
    // Filtering
    beforeSend(event) {
      // Don't send errors in development
      if (SENTRY_ENVIRONMENT === 'development') {
        console.log('[Sentry Edge] Would send error:', event);
        return null;
      }
      
      return event;
    },
  });
} else {
  console.warn('[Sentry] Edge runtime not initialized: SENTRY_DSN not configured');
}
