import { StructuredLogger } from './structured-logger';
import { resolveTraceId, TRACE_HEADER } from './trace-context';

/** Minimal structural types — works with Express without depending on it. */
interface HttpRequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { userId?: string; sub?: string };
  traceId?: string;
}

interface HttpResponseLike {
  statusCode?: number;
  setHeader?(name: string, value: string): void;
  on(event: 'finish', cb: () => void): void;
}

export interface HttpTelemetryOptions {
  service: string;
  logger?: StructuredLogger;
  /** Paths to skip (health checks, metrics). */
  ignorePaths?: string[];
}

/**
 * Express-compatible middleware:
 * - assigns/propagates traceId (x-trace-id / W3C traceparent)
 * - measures request latency
 * - emits one structured log line per request: {traceId, service, userId, event, latencyMs}
 */
export function createHttpTelemetryMiddleware(options: HttpTelemetryOptions) {
  const logger = options.logger ?? new StructuredLogger(options.service);
  const ignore = new Set(options.ignorePaths ?? ['/api/v1/health', '/api/v1/metrics', '/api/v1/ping']);

  return function httpTelemetry(
    req: HttpRequestLike,
    res: HttpResponseLike,
    next: () => void,
  ): void {
    const traceId = resolveTraceId(req.headers);
    req.traceId = traceId;
    res.setHeader?.(TRACE_HEADER, traceId);

    const start = Date.now();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];

    res.on('finish', () => {
      if (ignore.has(path)) return;
      const latencyMs = Date.now() - start;
      const status = res.statusCode ?? 0;
      logger.log(status >= 500 ? 'error' : 'info', 'http.request', {
        traceId,
        userId: req.user?.userId ?? req.user?.sub,
        method: req.method,
        path,
        status,
        latencyMs,
      });
    });

    next();
  };
}
