/**
 * Request / correlation ID (PROD-OPS-003).
 * Header: X-Request-ID
 */

export const REQUEST_ID_HEADER = 'x-request-id';

/** UUID v4 or opaque safe tokens: 8–128 chars, [A-Za-z0-9._-] */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function isValidRequestId(value: string): boolean {
  if (!SAFE_REQUEST_ID.test(value)) return false;
  // Reject values that look like injection / whitespace abuse
  if (value.includes('..')) return false;
  return true;
}

export function extractIncomingRequestId(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers[REQUEST_ID_HEADER] ?? headers['X-Request-Id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!isValidRequestId(trimmed)) return undefined;
  return trimmed;
}

export function resolveRequestId(
  headers: Record<string, string | string[] | undefined>,
  generate: () => string,
): string {
  return extractIncomingRequestId(headers) ?? generate();
}
