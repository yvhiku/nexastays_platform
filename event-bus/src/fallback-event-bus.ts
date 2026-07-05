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
    const url = `${this.baseUrl.replace(/\/$/, '')}/internal/events`;
    try {
      await retryWithBackoff(
        async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Key': process.env.INTERNAL_SERVICE_KEY ?? 'dev-internal-key',
            },
            body: JSON.stringify(event),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        },
        { attempts: 2 },
      );
    } catch {
      /* non-blocking side effect */
    }
    return event;
  }
}
