import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  createRedisClient,
  EVENTS,
  RedisStreamsEventConsumer,
  type BookingConfirmedPayload,
  type BookingCompletedPayload,
  type PaymentExpiredPayload,
  type ReviewCreatedPayload,
  type DomainEvent,
} from '@nexa/event-bus';
import { NotificationDispatcherService } from './notification-dispatcher.service';

/**
 * Consumes domain events (Redis Streams, with retry queue + DLQ from the bus)
 * and routes them to the multi-channel notification dispatcher.
 */
@Injectable()
export class EventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumerService.name);
  private consumer: RedisStreamsEventConsumer | null = null;

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

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
        EVENTS.BOOKING_COMPLETED,
        EVENTS.PAYMENT_SUCCEEDED,
        EVENTS.PAYMENT_EXPIRED,
        EVENTS.REVIEW_CREATED,
      ],
      (event) => this.handleDomainEvent(event),
    );
    await this.consumer.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.stop();
  }

  async handleDomainEvent(event: DomainEvent): Promise<void> {
    if (event.type === EVENTS.BOOKING_CONFIRMED) {
      const p = event.payload as unknown as BookingConfirmedPayload;
      await this.dispatcher.dispatch({
        userId: p.hostUserId,
        title: 'New booking',
        body: 'A guest booked your listing',
        reference: p.bookingId,
        amount: p.amount,
        direction: 'incoming',
        event: 'STAYS_BOOKING',
      });
      return;
    }

    if (event.type === EVENTS.BOOKING_COMPLETED) {
      const p = event.payload as unknown as BookingCompletedPayload;
      await Promise.all([
        this.dispatcher.dispatch({
          userId: p.guestUserId,
          title: 'Stay completed',
          body: 'Your stay has been completed.',
          reference: p.bookingId,
          amount: '',
          direction: 'info',
          event: 'STAYS_BOOKING_COMPLETED',
        }),
        this.dispatcher.dispatch({
          userId: p.hostUserId,
          title: 'Booking completed',
          body: 'Booking has been completed.',
          reference: p.bookingId,
          amount: '',
          direction: 'info',
          event: 'STAYS_BOOKING_COMPLETED',
        }),
      ]);
      return;
    }

    if (event.type === EVENTS.PAYMENT_EXPIRED) {
      const p = event.payload as unknown as PaymentExpiredPayload;
      await this.dispatcher.dispatch({
        userId: p.guestUserId,
        title: 'Payment expired',
        body: 'Your pending booking payment has expired.',
        reference: p.bookingId,
        amount: '',
        direction: 'warning',
        event: 'STAYS_PAYMENT_EXPIRED',
      });
      return;
    }

    if (event.type === EVENTS.REVIEW_CREATED) {
      const p = event.payload as unknown as ReviewCreatedPayload;
      await Promise.all([
        this.dispatcher.dispatch({
          userId: p.guestUserId,
          title: 'Thanks for your review',
          body: 'Thanks for reviewing your stay.',
          reference: p.reviewId,
          amount: '',
          direction: 'info',
          event: 'STAYS_REVIEW_CREATED',
        }),
        this.dispatcher.dispatch({
          userId: p.hostUserId,
          title: 'New review',
          body: 'You received a new review.',
          reference: p.reviewId,
          amount: '',
          direction: 'incoming',
          event: 'STAYS_REVIEW_CREATED',
        }),
      ]);
    }
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
