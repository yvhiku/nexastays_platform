import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { DomainEvent, DomainEventType } from './event-types';
import type { EventBusConsumer, EventBusPublisher, EventHandler } from './event-bus.interface';
import { assertValidEvent } from './contracts/validate';
import { normalizeEventType } from './contracts/registry';
import { RedisRetryQueue } from './retry-queue/retry-queue';

const STREAM_KEY = 'nexa:events';
const CONSUMER_GROUP = 'nexa-platform';

export class RedisStreamsEventPublisher implements EventBusPublisher {
  constructor(private readonly redis: Redis) {}

  async publish<T extends Record<string, unknown>>(
    type: string,
    source: string,
    payload: T,
  ): Promise<DomainEvent<T>> {
    const canonical = assertValidEvent(type, payload);
    const event: DomainEvent<T> = {
      id: randomUUID(),
      type: canonical,
      source,
      occurredAt: new Date().toISOString(),
      payload,
    };
    await this.publishEvent(event);
    return event;
  }

  /** Publish a pre-built (already validated) event — used by the resilient buffer flush. */
  async publishEvent<T extends Record<string, unknown>>(event: DomainEvent<T>): Promise<void> {
    await this.redis.xadd(STREAM_KEY, '*', 'event', JSON.stringify(event));
  }
}

export class RedisStreamsEventConsumer implements EventBusConsumer {
  private running = false;
  private handlers = new Map<DomainEventType, EventHandler[]>();
  private retryQueue: RedisRetryQueue | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly consumerName: string,
  ) {}

  async subscribe(types: (DomainEventType | string)[], handler: EventHandler): Promise<void> {
    for (const type of types) {
      const canonical = normalizeEventType(type);
      if (!canonical) continue;
      const list = this.handlers.get(canonical) ?? [];
      list.push(handler);
      this.handlers.set(canonical, list);
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('BUSYGROUP')) throw err;
    }
    this.retryQueue = new RedisRetryQueue(
      this.redis,
      `${CONSUMER_GROUP}:${this.consumerName}`,
      (event) => this.dispatch(event),
    );
    this.retryQueue.start();
    void this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.retryQueue?.stop();
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    const canonical = normalizeEventType(event.type) ?? event.type;
    const handlers = this.handlers.get(canonical as DomainEventType) ?? [];
    for (const h of handlers) {
      await h({ ...event, type: canonical as DomainEventType });
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const rows = (await this.redis.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          this.consumerName,
          'COUNT',
          10,
          'BLOCK',
          2000,
          'STREAMS',
          STREAM_KEY,
          '>',
        )) as [string, [string, string[]][]][] | null;

        if (!rows) continue;

        for (const [, messages] of rows) {
          for (const [id, fields] of messages) {
            const raw = fields[1];
            if (!raw) continue;
            let event: DomainEvent | null = null;
            try {
              event = JSON.parse(raw) as DomainEvent;
            } catch {
              await this.redis.xack(STREAM_KEY, CONSUMER_GROUP, id);
              continue; // malformed — ack and drop
            }
            try {
              await this.dispatch(event);
            } catch (err) {
              // Handler failed — hand off to retry queue with backoff + DLQ.
              await this.retryQueue?.scheduleRetry(event, 1, err);
            }
            await this.redis.xack(STREAM_KEY, CONSUMER_GROUP, id);
          }
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

export function createRedisClient(url?: string): Redis | null {
  const u = url ?? process.env.REDIS_URL;
  if (!u) return null;
  return new Redis(u, { maxRetriesPerRequest: 2, lazyConnect: true });
}
