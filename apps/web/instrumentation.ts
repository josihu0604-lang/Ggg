/**
 * Next.js Instrumentation
 * 
 * This file is automatically loaded by Next.js on both server and edge runtime.
 * Use it to configure OpenTelemetry, Sentry, and other observability tools.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Skip Sentry initialization in development to reduce console noise
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      // Server-side instrumentation
      await import('./sentry.server.config');
      console.log('[Instrumentation] Server-side observability initialized');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      // Edge runtime instrumentation
      await import('./sentry.edge.config');
      console.log('[Instrumentation] Edge runtime observability initialized');
    }
  } else {
    console.log('[Instrumentation] Skipping Sentry in development mode');
  }
}

export async function onRequestError(
  err: Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  }
) {
  // This function is called for unhandled errors in API routes
  console.error('[Instrumentation] Request error:', {
    error: err.message,
    path: request.path,
    method: request.method,
    timestamp: new Date().toISOString(),
  });
  
  // Sentry will automatically capture this via its integration
}
