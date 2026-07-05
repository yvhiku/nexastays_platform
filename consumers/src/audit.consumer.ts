import { DOMAIN_EVENT_TYPES, type EventBusConsumer } from '@nexa/event-bus';
import { StructuredLogger } from '@nexa/telemetry';

const logger = new StructuredLogger('audit-consumer');

/**
 * Audit consumer — immutable cross-service audit trail of domain events.
 * Target store (append-only table / object storage) plugs in behind the sink.
 */
export async function registerAuditConsumer(consumer: EventBusConsumer): Promise<void> {
  await consumer.subscribe([...DOMAIN_EVENT_TYPES], async (event) => {
    logger.info('audit.domain_event', {
      eventType: event.type,
      eventId: event.id,
      source: event.source,
      occurredAt: event.occurredAt,
      payload: event.payload,
    });
  });
}
