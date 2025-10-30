// Sentry Server-Side Configuration
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment
    environment: SENTRY_ENVIRONMENT,
    
    // Release tracking
    release: process.env.SENTRY_RELEASE || 'zzik-v2@development',
    
    // Performance Monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Integrations (Sentry v8)
    integrations: [
      Sentry.httpIntegration(),
      Sentry.postgresIntegration(),
    ],
    
    // Context enrichment
    beforeSend(event, hint) {
      // Don't send errors in development
      if (SENTRY_ENVIRONMENT === 'development') {
        console.log('[Sentry] Would send error:', event);
        return null;
      }
      
      // Add custom context
      event.contexts = event.contexts || {};
      event.contexts.app = {
        name: 'ZZIK v2 API',
        version: process.env.APP_VERSION || 'unknown',
      };
      
      // Filter sensitive data
      if (event.request) {
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }
        
        // Mask sensitive query params
        if (event.request.query_string && typeof event.request.query_string === 'string') {
          event.request.query_string = event.request.query_string
            .replace(/token=[^&]+/g, 'token=[REDACTED]')
            .replace(/key=[^&]+/g, 'key=[REDACTED]')
            .replace(/secret=[^&]+/g, 'secret=[REDACTED]');
        }
      }
      
      return event;
    },
    
    // Ignore specific errors
    ignoreErrors: [
      // Expected business logic errors
      'tier_limit_reached',
      'subscription_inactive',
      'rate_limit_exceeded',
      // Database connection pool exhaustion (handle separately)
      'Connection terminated unexpectedly',
    ],
  });
  
  console.log('[Sentry] Server initialized', {
    environment: SENTRY_ENVIRONMENT,
    dsn: SENTRY_DSN.substring(0, 30) + '...',
  });
} else {
  console.warn('[Sentry] Server not initialized: SENTRY_DSN not configured');
}
