import { sanitizeForTelemetry } from './redact';
import { getRequestContext } from './request-context';
import { resolveObsStage } from './error-monitoring';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Standard Nexa log record — every service logs this shape so central
 * aggregation (Loki / Datadog / ELK) can index consistently.
 */
export interface NexaLogRecord {
  level: LogLevel;
  service: string;
  event: string;
  environment?: string;
  request_id?: string;
  traceId?: string;
  userId?: string;
  latencyMs?: number;
  message?: string;
  ts: string;
  [key: string]: unknown;
}

/**
 * Sink abstraction — swap ConsoleJsonSink for a Loki/Datadog/ELK shipper
 * without touching call sites.
 */
export interface LogSink {
  write(record: NexaLogRecord): void;
}

export class ConsoleJsonSink implements LogSink {
  write(record: NexaLogRecord): void {
    const safe = sanitizeForTelemetry(record) as NexaLogRecord;
    const line = JSON.stringify(safe);
    if (record.level === 'error') console.error(line);
    else if (record.level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export class StructuredLogger {
  constructor(
    private readonly service: string,
    private readonly sink: LogSink = new ConsoleJsonSink(),
  ) {}

  log(
    level: LogLevel,
    event: string,
    fields: Omit<Partial<NexaLogRecord>, 'level' | 'service' | 'event' | 'ts'> = {},
  ): void {
    const ctx = getRequestContext();
    this.sink.write({
      level,
      service: this.service,
      event,
      environment: resolveObsStage(),
      request_id:
        typeof fields.request_id === 'string'
          ? fields.request_id
          : ctx.requestId,
      traceId:
        typeof fields.traceId === 'string' ? fields.traceId : ctx.traceId,
      ts: new Date().toISOString(),
      ...fields,
    });
  }

  debug(event: string, fields?: Partial<NexaLogRecord>): void {
    this.log('debug', event, fields);
  }

  info(event: string, fields?: Partial<NexaLogRecord>): void {
    this.log('info', event, fields);
  }

  warn(event: string, fields?: Partial<NexaLogRecord>): void {
    this.log('warn', event, fields);
  }

  error(event: string, fields?: Partial<NexaLogRecord>): void {
    this.log('error', event, fields);
  }
}
