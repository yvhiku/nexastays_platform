/**
 * Shared telemetry redaction — never emit secrets/OTP/tokens.
 */

const SENSITIVE_KEY =
  /(token|authorization|password|passwd|pin|otp|phone|email|national_?id|secret|session|cookie|private_key|database_url|dsn|webhook|twilio|cmi_store|api[_-]?key)/i;

export function redactString(input: string): string {
  return input
    .replace(
      /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g,
      '[REDACTED]',
    )
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[REDACTED]')
    .replace(/\+?\d{8,15}/g, '[REDACTED]')
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, 'postgresql://[REDACTED]')
    .replace(/https?:\/\/[^\s"']*sentry[^\s"']*/gi, '[REDACTED_URL]');
}

export function sanitizeForTelemetry(value: unknown, key?: string): unknown {
  if (value == null) return value;
  if (key && SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack:
        process.env.NODE_ENV === 'production'
          ? undefined
          : value.stack
            ? redactString(value.stack)
            : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForTelemetry(item));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForTelemetry(v, k);
    }
    return out;
  }
  return value;
}

export function assertPayloadHasNoSecrets(payload: unknown): void {
  const dumped = JSON.stringify(payload ?? {});
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(dumped)) {
    throw new Error('Telemetry payload appears to contain a JWT');
  }
  if (/postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/i.test(dumped)) {
    throw new Error('Telemetry payload appears to contain a database URL');
  }
}
