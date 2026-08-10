import type { ErrorMonitoringService } from './error-monitoring';
import { ObsEvents } from './severity';

export interface FatalHandlerOptions {
  service: string;
  monitoring: ErrorMonitoringService;
  /** Default true — terminate after flush for uncaughtException */
  exitOnUncaught?: boolean;
  exit?: (code: number) => void;
}

/**
 * Capture fatal process errors, flush monitoring, then exit when appropriate.
 * Do NOT swallow fatals and keep running.
 */
export function installFatalHandlers(options: FatalHandlerOptions): void {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const exitOnUncaught = options.exitOnUncaught !== false;

  process.on('uncaughtException', (err) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: ObsEvents.UNCAUGHT_EXCEPTION,
        service: options.service,
        message: err?.message,
        name: err?.name,
        ts: new Date().toISOString(),
      }),
    );
    try {
      options.monitoring.captureException(err, {
        event: ObsEvents.UNCAUGHT_EXCEPTION,
      });
    } catch {
      /* ignore */
    }
    void options.monitoring.flush(2000).finally(() => {
      if (exitOnUncaught) exit(1);
    });
  });

  process.on('unhandledRejection', (reason) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: ObsEvents.UNHANDLED_REJECTION,
        service: options.service,
        reason:
          reason instanceof Error
            ? { name: reason.name, message: reason.message }
            : String(reason),
        ts: new Date().toISOString(),
      }),
    );
    try {
      options.monitoring.captureException(
        reason instanceof Error ? reason : new Error(String(reason)),
        { event: ObsEvents.UNHANDLED_REJECTION },
      );
    } catch {
      /* ignore */
    }
    void options.monitoring.flush(2000);
    // Do not exit on rejection by default — Nest may still recover; P1 signal via monitoring.
  });
}
