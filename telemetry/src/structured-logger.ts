export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Standard Nexa log record — every service logs this shape so central
 * aggregation (Loki / Datadog / ELK) can index consistently.
 */
export interface NexaLogRecord {
  level: LogLevel;
  service: string;
  event: string;
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
    const line = JSON.stringify(record);
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
    this.sink.write({
      level,
      service: this.service,
      event,
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
