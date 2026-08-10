import { AlertSeverity, ALERT_SEVERITY_POLICY } from './severity';
import { sanitizeForTelemetry } from './redact';
import { resolveObsStage } from './error-monitoring';
import { getRequestContext } from './request-context';

export interface AlertPayload {
  key: string;
  severity: AlertSeverity;
  message: string;
  fingerprint?: string;
  /** Business context — sanitized before send */
  context?: Record<string, unknown>;
  /** When true, bypass dedupe (tests / explicit resolve paths) */
  force?: boolean;
}

export interface AlertingService {
  alert(payload: AlertPayload): Promise<void> | void;
  resolve(fingerprint: string, note?: string): Promise<void> | void;
}

type WindowCounter = { count: number; windowStart: number; lastAlertAt: number };

export class DedupingAlertingService implements AlertingService {
  private readonly windows = new Map<string, WindowCounter>();

  constructor(
    private readonly inner: AlertingService,
    private readonly windowMs = 60_000,
    private readonly minIntervalMs = 60_000,
  ) {}

  async alert(payload: AlertPayload): Promise<void> {
    const fp = payload.fingerprint || payload.key;
    const now = Date.now();
    let entry = this.windows.get(fp);
    if (!entry || now - entry.windowStart > this.windowMs) {
      entry = { count: 0, windowStart: now, lastAlertAt: 0 };
      this.windows.set(fp, entry);
    }
    entry.count += 1;

    if (!payload.force && entry.lastAlertAt && now - entry.lastAlertAt < this.minIntervalMs) {
      // Aggregate — emit spike summary only at window edges if count high
      if (entry.count === 10 || entry.count === 50 || entry.count === 100) {
        await this.inner.alert({
          ...payload,
          key: `${payload.key}_SPIKE`,
          message: `${payload.message} (aggregated count=${entry.count} window=${this.windowMs}ms)`,
          context: {
            ...payload.context,
            count: entry.count,
            window_ms: this.windowMs,
            original_key: payload.key,
          },
          fingerprint: `${fp}:spike`,
          force: true,
        });
      }
      return;
    }

    entry.lastAlertAt = now;
    await this.inner.alert({
      ...payload,
      context: { ...payload.context, count: entry.count },
    });
  }

  async resolve(fingerprint: string, note?: string): Promise<void> {
    this.windows.delete(fingerprint);
    await this.inner.resolve(fingerprint, note);
  }
}

export class ConsoleAlertingService implements AlertingService {
  constructor(private readonly service: string) {}

  alert(payload: AlertPayload): void {
    const ctx = getRequestContext();
    const policy = ALERT_SEVERITY_POLICY[payload.severity];
    console.error(
      JSON.stringify({
        level: payload.severity === 'P0' || payload.severity === 'P1' ? 'error' : 'warn',
        channel: 'alert',
        service: this.service,
        environment: resolveObsStage(),
        event: payload.key,
        severity: payload.severity,
        page: policy.page,
        message: payload.message,
        fingerprint: payload.fingerprint || payload.key,
        request_id: ctx.requestId,
        context: sanitizeForTelemetry(payload.context),
        ts: new Date().toISOString(),
      }),
    );
  }

  resolve(fingerprint: string, note?: string): void {
    console.log(
      JSON.stringify({
        level: 'info',
        channel: 'alert',
        event: 'alert.resolved',
        fingerprint,
        note,
        ts: new Date().toISOString(),
      }),
    );
  }
}

export class WebhookAlertingService implements AlertingService {
  constructor(
    private readonly service: string,
    private readonly webhookUrl: string,
    private readonly fallback: AlertingService = new ConsoleAlertingService(service),
  ) {}

  async alert(payload: AlertPayload): Promise<void> {
    this.fallback.alert(payload);
    const body = {
      service: this.service,
      environment: resolveObsStage(),
      severity: payload.severity,
      key: payload.key,
      message: payload.message,
      fingerprint: payload.fingerprint || payload.key,
      context: sanitizeForTelemetry(payload.context),
      request_id: getRequestContext().requestId,
      ts: new Date().toISOString(),
    };
    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'alert.webhook_failed',
            status: res.status,
            ts: new Date().toISOString(),
          }),
        );
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'alert.webhook_error',
          error: sanitizeForTelemetry(err),
          ts: new Date().toISOString(),
        }),
      );
    }
  }

  async resolve(fingerprint: string, note?: string): Promise<void> {
    this.fallback.resolve(fingerprint, note);
  }
}

export function createAlertingService(service: string): AlertingService {
  const url = (
    process.env.OPS_ALERT_WEBHOOK_URL ||
    process.env.PAYMENT_ALERT_WEBHOOK_URL ||
    ''
  ).trim();
  const base = url
    ? new WebhookAlertingService(service, url)
    : new ConsoleAlertingService(service);
  return new DedupingAlertingService(base);
}

/**
 * Real production requires an external alert destination webhook.
 * Dogfood/staging may use console sink.
 */
export function assertProductionAlertingConfigured(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (resolveObsStage(env) !== 'production') return;
  const url = (
    env.OPS_ALERT_WEBHOOK_URL ||
    env.PAYMENT_ALERT_WEBHOOK_URL ||
    ''
  ).trim();
  if (!url) {
    throw new Error(
      'OPS_ALERT_WEBHOOK_URL (or PAYMENT_ALERT_WEBHOOK_URL) is required when NEXA_ENV=production (PROD-OPS-003).',
    );
  }
}
