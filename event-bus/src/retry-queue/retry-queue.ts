import type Redis from 'ioredis';
import type { DomainEvent } from '../event-types';

const RETRY_ZSET_PREFIX = 'nexa:events:retry:';
const DLQ_STREAM = 'nexa:events:dlq';
const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000;

interface RetryEnvelope {
  event: DomainEvent;
  attempt: number;
  lastError: string;
  consumerGroup: string;
}

export interface RetryQueueOptions {
  maxAttempts?: number;
  baseBackoffMs?: number;
  pollIntervalMs?: number;
  onDeadLetter?: (envelope: RetryEnvelope) => void;
}

/**
 * Redis-backed retry queue with exponential backoff and a dead-letter stream.
 *
 * - Failed handler executions are scheduled in a sorted set (score = next attempt time).
 * - Exhausted events land in the `nexa:events:dlq` stream for ops inspection.
 */
export class RedisRetryQueue {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly pollIntervalMs: number;
  private readonly retryKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly consumerGroup: string,
    private readonly redeliver: (event: DomainEvent) => Promise<void>,
    private readonly options: RetryQueueOptions = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseBackoffMs = options.baseBackoffMs ?? BASE_BACKOFF_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    // Per-group key — one group's failures never steal another group's retries.
    this.retryKey = RETRY_ZSET_PREFIX + consumerGroup.replace(/[^a-zA-Z0-9:_-]/g, '_');
  }

  async scheduleRetry(event: DomainEvent, attempt: number, error: unknown): Promise<void> {
    const lastError = error instanceof Error ? error.message : String(error);
    if (attempt >= this.maxAttempts) {
      await this.deadLetter({ event, attempt, lastError, consumerGroup: this.consumerGroup });
      return;
    }
    const envelope: RetryEnvelope = {
      event,
      attempt,
      lastError,
      consumerGroup: this.consumerGroup,
    };
    const backoff = this.baseBackoffMs * 2 ** attempt;
    const dueAt = Date.now() + backoff;
    await this.redis.zadd(this.retryKey, dueAt, JSON.stringify(envelope));
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    try {
      const due = await this.redis.zrangebyscore(this.retryKey, 0, Date.now(), 'LIMIT', 0, 10);
      for (const raw of due) {
        // Claim atomically — only one consumer instance processes each entry.
        const removed = await this.redis.zrem(this.retryKey, raw);
        if (removed === 0) continue;
        let envelope: RetryEnvelope;
        try {
          envelope = JSON.parse(raw) as RetryEnvelope;
        } catch {
          continue;
        }
        try {
          await this.redeliver(envelope.event);
        } catch (err) {
          await this.scheduleRetry(envelope.event, envelope.attempt + 1, err);
        }
      }
    } catch {
      /* redis unavailable — next tick */
    }
  }

  private async deadLetter(envelope: RetryEnvelope): Promise<void> {
    try {
      await this.redis.xadd(
        DLQ_STREAM,
        'MAXLEN',
        '~',
        10000,
        '*',
        'envelope',
        JSON.stringify(envelope),
      );
    } catch {
      /* DLQ write failed — surface via callback below */
    }
    this.options.onDeadLetter?.(envelope);
    // Structured dead-letter log — central logging picks this up from stdout.
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'event-bus',
        event: 'event.dead_letter',
        eventType: envelope.event.type,
        eventId: envelope.event.id,
        attempts: envelope.attempt,
        lastError: envelope.lastError,
        consumerGroup: envelope.consumerGroup,
        ts: new Date().toISOString(),
      }),
    );
  }
}

export { RETRY_ZSET_PREFIX, DLQ_STREAM };
export type { RetryEnvelope };
