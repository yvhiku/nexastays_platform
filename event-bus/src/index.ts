export * from './event-types';
export * from './notification-types';
export * from './event-bus.interface';
export * from './redis-streams-event-bus';
export * from './fallback-event-bus';
export * from './resilient-publisher';
export * from './contracts/registry';
export * from './contracts/validate';
export { EVENT_SCHEMAS } from './contracts/schemas';
export * from './retry-queue/retry-queue';
export * from './retry-queue/memory-buffer';
export * from './resilience/circuit-breaker';

import type { EventBusPublisher } from './event-bus.interface';
import { createRedisClient } from './redis-streams-event-bus';
import { ResilientEventPublisher } from './resilient-publisher';
import { HttpFallbackEventPublisher } from './fallback-event-bus';

/**
 * Default publisher factory:
 * - Redis configured → resilient Redis Streams publisher (validated + buffered on outage)
 * - No Redis → HTTP fallback to notifications-service (validated)
 */
export function createEventBusPublisher(): EventBusPublisher {
  const redis = createRedisClient();
  if (redis) {
    void redis.connect().catch(() => undefined);
    return new ResilientEventPublisher(redis);
  }
  const notificationsUrl =
    process.env.NOTIFICATIONS_SERVICE_URL ?? 'http://127.0.0.1:3003';
  return new HttpFallbackEventPublisher(notificationsUrl);
}
