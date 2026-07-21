import { randomUUID } from 'crypto';
import type { DomainEvent } from './event-types';
import type { EventBusPublisher } from './event-bus.interface';
import { assertValidEvent } from './contracts/validate';
import { retryWithBackoff } from './resilience/circuit-breaker';

/**
 * Dev fallback when Redis is unavailable — POST events to notifications internal API.
 * Payloads are schema-validated exactly like the Redis path.
 */
export class HttpFallbackEventPublisher implements EventBusPublisher {
  constructor(private readonly baseUrl: string) {}

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
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/internal/events`;
    try {
      await retryWithBackoff(
        async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Key':
                process.env.INTERNAL_SERVICE_KEY?.trim() ||
                (process.env.NODE_ENV === 'production'
                  ? (() => {
                      throw new Error(
                        'INTERNAL_SERVICE_KEY is required in production',
                      );
                    })()
                  : 'dev-internal-key'),
            },
            body: JSON.stringify(event),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        },
        { attempts: 2 },
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'event-bus',
          event: 'http_fallback_publish_failed',
          eventType: event.type,
          eventId: event.id,
          url,
          error: err instanceof Error ? err.message : String(err),
          ts: new Date().toISOString(),
        }),
      );
      throw err;
    }
    return event;
  }
}
