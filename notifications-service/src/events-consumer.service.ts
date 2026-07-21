import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  createRedisClient,
  EVENTS,
  RedisStreamsEventConsumer,
  type DomainEvent,
} from '@nexa/event-bus';
import { NotificationOrchestratorService } from './notification-orchestrator.service';
import { mapDomainEventToNotifications } from './notification-mapper';

/**
 * Consumes domain events (Redis Streams, with retry queue + DLQ from the bus)
 * and routes them through the persist-first notification pipeline.
 */
@Injectable()
export class EventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumerService.name);
  private consumer: RedisStreamsEventConsumer | null = null;

  constructor(private readonly orchestrator: NotificationOrchestratorService) {}

  async onModuleInit(): Promise<void> {
    const redis = createRedisClient();
    if (!redis) {
      this.logger.warn('REDIS_URL not set — HTTP ingress only');
      return;
    }
    await redis.connect().catch(() => undefined);
    this.consumer = new RedisStreamsEventConsumer(
      redis,
      `notifications-${process.pid}`,
    );
    await this.consumer.subscribe(
      [
        EVENTS.BOOKING_CONFIRMED,
        EVENTS.BOOKING_CANCELLED,
        EVENTS.BOOKING_HOST_APPROVED,
        EVENTS.PAYMENT_SUCCEEDED,
        EVENTS.REVIEW_CREATED,
        EVENTS.REVIEW_REMINDER,
        EVENTS.CHECKOUT_REMINDER,
        EVENTS.REVIEW_REPLY,
        EVENTS.MESSAGE_RECEIVED,
        EVENTS.CONVERSATION_ARCHIVED,
      ],
      (event) => this.handleDomainEvent(event),
    );
    await this.consumer.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.stop();
  }

  async handleDomainEvent(event: DomainEvent): Promise<void> {
    const inputs = mapDomainEventToNotifications(event);
    if (!inputs.length) {
      this.logger.debug(`No notification mapping for event ${event.type}`);
      return;
    }
    await this.orchestrator.processMany(inputs);
  }
}

/** HTTP fallback ingress when Redis is unavailable. */
@Injectable()
export class EventIngressService {
  constructor(private readonly consumer: EventsConsumerService) {}

  async ingest(event: DomainEvent): Promise<void> {
    await this.consumer.handleDomainEvent(event);
  }
}
