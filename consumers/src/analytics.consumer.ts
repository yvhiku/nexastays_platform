import { DOMAIN_EVENT_TYPES, type EventBusConsumer } from '@nexa/event-bus';
import { StructuredLogger } from '@nexa/telemetry';

const logger = new StructuredLogger('analytics-consumer');

/**
 * Analytics consumer — records every domain event as a structured
 * analytics record. Swap the logger sink for a warehouse pipeline
 * (BigQuery, ClickHouse, Kafka Connect) without changing this consumer.
 */
export async function registerAnalyticsConsumer(consumer: EventBusConsumer): Promise<void> {
  await consumer.subscribe([...DOMAIN_EVENT_TYPES], async (event) => {
    logger.info('analytics.event', {
      eventType: event.type,
      eventId: event.id,
      source: event.source,
      occurredAt: event.occurredAt,
    });
  });
}
