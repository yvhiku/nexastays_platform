import { sanitizeForTelemetry } from './redact';
import { getRequestContext } from './request-context';

export type NexaStageName =
  | 'development'
  | 'dogfood'
  | 'staging'
  | 'production';

export function resolveObsStage(
  env: NodeJS.ProcessEnv = process.env,
): NexaStageName {
  const explicit = (env.NEXA_ENV || env.APP_ENV || '').trim().toLowerCase();
  if (
    explicit === 'production' ||
    explicit === 'staging' ||
    explicit === 'dogfood' ||
    explicit === 'development'
  ) {
    return explicit;
  }
  if (env.NODE_ENV === 'production') return 'production';
  return 'development';
}

export interface ErrorMonitoringService {
  captureException(
    error: unknown,
    context?: Record<string, unknown>,
  ): void;
  captureMessage(
    message: string,
    level?: 'info' | 'warning' | 'error',
    context?: Record<string, unknown>,
  ): void;
  setContext(name: string, data: Record<string, unknown>): void;
  setUser(user: { id?: string } | null): void;
  flush(timeoutMs?: number): Promise<boolean>;
}

export class NoopErrorMonitoring implements ErrorMonitoringService {
  captureException(): void {}
  captureMessage(): void {}
  setContext(): void {}
  setUser(): void {}
  async flush(): Promise<boolean> {
    return true;
  }
}

export class ConsoleErrorMonitoring implements ErrorMonitoringService {
  constructor(private readonly service: string) {}

  captureException(error: unknown, context?: Record<string, unknown>): void {
    const ctx = getRequestContext();
    console.error(
      JSON.stringify({
        level: 'error',
        channel: 'error_monitoring',
        service: this.service,
        environment: resolveObsStage(),
        event: 'exception',
        request_id: ctx.requestId,
        error: sanitizeForTelemetry(error),
        context: sanitizeForTelemetry(context),
        ts: new Date().toISOString(),
      }),
    );
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'error',
    context?: Record<string, unknown>,
  ): void {
    console.log(
      JSON.stringify({
        level,
        channel: 'error_monitoring',
        service: this.service,
        environment: resolveObsStage(),
        event: 'message',
        message,
        context: sanitizeForTelemetry(context),
        ts: new Date().toISOString(),
      }),
    );
  }

  setContext(): void {}
  setUser(): void {}
  async flush(): Promise<boolean> {
    return true;
  }
}

/**
 * Sentry adapter — loads `@sentry/node` only when DSN is set.
 * Missing package → ConsoleErrorMonitoring fallback (does not crash boot).
 */
export class SentryErrorMonitoring implements ErrorMonitoringService {
  private readonly sentry: {
    captureException: (e: unknown, hint?: unknown) => void;
    captureMessage: (m: string, level?: string) => void;
    setContext: (n: string, d: Record<string, unknown>) => void;
    setUser: (u: { id?: string } | null) => void;
    flush: (t?: number) => Promise<boolean>;
  };

  constructor(
    private readonly service: string,
    sentry: SentryErrorMonitoring['sentry'],
  ) {
    this.sentry = sentry;
  }

  captureException(error: unknown, context?: Record<string, unknown>): void {
    const ctx = getRequestContext();
    this.sentry.captureException(error, {
      tags: {
        service: this.service,
        environment: resolveObsStage(),
      },
      extra: sanitizeForTelemetry({
        ...context,
        request_id: ctx.requestId,
      }) as Record<string, unknown>,
    });
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'error',
    context?: Record<string, unknown>,
  ): void {
    this.sentry.setContext(
      'nexa',
      sanitizeForTelemetry(context ?? {}) as Record<string, unknown>,
    );
    this.sentry.captureMessage(message, level === 'warning' ? 'warning' : level);
  }

  setContext(name: string, data: Record<string, unknown>): void {
    this.sentry.setContext(
      name,
      sanitizeForTelemetry(data) as Record<string, unknown>,
    );
  }

  setUser(user: { id?: string } | null): void {
    this.sentry.setUser(user?.id ? { id: user.id } : null);
  }

  flush(timeoutMs = 2000): Promise<boolean> {
    return this.sentry.flush(timeoutMs);
  }
}

export interface ErrorMonitoringConfig {
  service: string;
  dsn?: string;
  release?: string;
  environment?: string;
}

export function createErrorMonitoring(
  config: ErrorMonitoringConfig,
): ErrorMonitoringService {
  const dsn = (config.dsn || process.env.ERROR_MONITORING_DSN || '').trim();
  const stage = config.environment || resolveObsStage();
  const release =
    config.release ||
    process.env.GIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.BUILD_VERSION ||
    undefined;

  if (!dsn) {
    if (stage === 'development' || process.env.NODE_ENV === 'test') {
      return new NoopErrorMonitoring();
    }
    return new ConsoleErrorMonitoring(config.service);
  }

  try {
    // Dynamic optional dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      init: (o: Record<string, unknown>) => void;
      captureException: (e: unknown, hint?: unknown) => void;
      captureMessage: (m: string, level?: string) => void;
      setContext: (n: string, d: Record<string, unknown>) => void;
      setUser: (u: { id?: string } | null) => void;
      flush: (t?: number) => Promise<boolean>;
    };
    Sentry.init({
      dsn,
      environment: stage,
      release,
      serverName: config.service,
      sendDefaultPii: false,
      // Avoid uploading local source maps unless explicitly configured later.
      integrations: [],
    });
    return new SentryErrorMonitoring(config.service, Sentry);
  } catch {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'error_monitoring.sentry_unavailable',
        service: config.service,
        message:
          '@sentry/node not installed or failed to init; using console sink',
        ts: new Date().toISOString(),
      }),
    );
    return new ConsoleErrorMonitoring(config.service);
  }
}

/**
 * Production (real NEXA_ENV=production) requires ERROR_MONITORING_DSN.
 * Dogfood/staging/dev do not fail closed on missing DSN.
 */
export function assertProductionMonitoringConfigured(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const stage = resolveObsStage(env);
  if (stage !== 'production') return;
  if (!(env.ERROR_MONITORING_DSN || '').trim()) {
    throw new Error(
      'ERROR_MONITORING_DSN is required when NEXA_ENV=production (PROD-OPS-003). Soft-launch dogfood may omit it.',
    );
  }
}
