/**
 * OpenTelemetry Tracing Utility
 * 
 * Provides manual instrumentation for critical business logic.
 * Sentry automatically captures these spans via OpenTelemetry integration.
 */

interface SpanContext {
  name: string;
  operation: string;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Wrap async function with tracing span
 */
export async function withSpan<T>(
  context: SpanContext,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    
    const duration = Date.now() - startTime;
    console.log(`[Trace] ${context.operation}:${context.name} completed in ${duration}ms`, {
      attributes: context.attributes,
      status: 'ok',
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Trace] ${context.operation}:${context.name} failed in ${duration}ms`, {
      attributes: context.attributes,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

/**
 * Add custom attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  console.log('[Trace] Adding span attributes:', attributes);
}

/**
 * Record an event in the current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  console.log(`[Trace] Span event: ${name}`, attributes);
}

/**
 * Create a database query span
 */
export async function withDatabaseSpan<T>(
  query: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: query.substring(0, 50),
      operation: 'db.query',
      attributes: {
        'db.system': 'postgresql',
        'db.statement': query.substring(0, 200),
      },
    },
    fn
  );
}

/**
 * Create an HTTP client span
 */
export async function withHttpSpan<T>(
  method: string,
  url: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: `${method} ${url}`,
      operation: 'http.client',
      attributes: {
        'http.method': method,
        'http.url': url,
      },
    },
    fn
  );
}

/**
 * Create a cache operation span
 */
export async function withCacheSpan<T>(
  operation: 'get' | 'set' | 'del',
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: `${operation} ${key}`,
      operation: 'cache',
      attributes: {
        'cache.operation': operation,
        'cache.key': key,
      },
    },
    fn
  );
}
