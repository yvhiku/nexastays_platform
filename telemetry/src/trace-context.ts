import { randomBytes } from 'crypto';

export const TRACE_HEADER = 'x-trace-id';
export const W3C_TRACEPARENT_HEADER = 'traceparent';

export function newTraceId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Extract a trace ID from incoming headers.
 * Supports both x-trace-id and W3C traceparent; generates one if absent.
 */
export function resolveTraceId(
  headers: Record<string, string | string[] | undefined>,
): string {
  const direct = headers[TRACE_HEADER];
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const traceparent = headers[W3C_TRACEPARENT_HEADER];
  if (typeof traceparent === 'string') {
    // traceparent: version-traceid-spanid-flags
    const parts = traceparent.split('-');
    if (parts.length >= 2 && parts[1]?.length === 32) return parts[1];
  }
  return newTraceId();
}

/** Headers to attach when calling another Nexa service. */
export function outgoingTraceHeaders(traceId: string): Record<string, string> {
  return { [TRACE_HEADER]: traceId };
}
