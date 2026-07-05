import type Redis from 'ioredis';
import type { DomainEvent } from './event-types';
import type { EventBusPublisher } from './event-bus.interface';
import { RedisStreamsEventPublisher } from './redis-streams-event-bus';
import { InMemoryEventBuffer } from './retry-queue/memory-buffer';
import { assertValidEvent } from './contracts/validate';
import { randomUUID } from 'crypto';

const FLUSH_INTERVAL_MS = 5_000;

/**
 * Publisher with Redis-failure resilience:
 *
 * 1. Payload is schema-validated — invalid events throw (never silently published).
 * 2. Publish goes to Redis Streams.
 * 3. On Redis failure the event is held in a bounded in-memory buffer
 *    and flushed automatically when Redis recovers.
 */
export class ResilientEventPublisher implements EventBusPublisher {
  private readonly inner: RedisStreamsEventPublisher;
  private readonly buffer: InMemoryEventBuffer;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly redis: Redis) {
    this.inner = new RedisStreamsEventPublisher(redis);
    this.buffer = new InMemoryEventBuffer(1000, (dropped) => {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'event-bus',
          event: 'event.buffer_overflow_drop',
          eventType: dropped.type,
          eventId: dropped.id,
          ts: new Date().toISOString(),
        }),
      );
    });
    this.startFlushLoop();
  }

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
    try {
      await this.inner.publishEvent(event);
    } catch {
      this.buffer.push(event as DomainEvent);
    }
    return event;
  }

  private startFlushLoop(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    if (typeof this.flushTimer.unref === 'function') this.flushTimer.unref();
  }

  private async flush(): Promise<void> {
    if (this.buffer.size === 0) return;
    try {
      await this.redis.ping();
    } catch {
      return; // still down
    }
    const events = this.buffer.drain();
    const failed: DomainEvent[] = [];
    for (const event of events) {
      try {
        await this.inner.publishEvent(event);
      } catch {
        failed.push(event);
      }
    }
    if (failed.length) this.buffer.requeueFront(failed);
  }
}
