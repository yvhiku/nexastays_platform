import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateNotificationInput, NotificationType } from '@nexa/event-bus';
import { UserNotification } from '../entities/user-notification.entity';

/** One inbox row per user + booking + type (checkout/review reminders). */
const ONCE_PER_BOOKING_TYPES = new Set<NotificationType>([
  'CHECKOUT_REMINDER',
  'REVIEW_REMINDER',
]);

export type InboxCreateResult = {
  notification: UserNotification;
  /** False when an existing row was reused (skip push). */
  created: boolean;
};

@Injectable()
export class NotificationInboxService {
  private readonly logger = new Logger(NotificationInboxService.name);

  constructor(
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
  ) {}

  async create(input: CreateNotificationInput): Promise<InboxCreateResult> {
    const eventId =
      (typeof input.eventId === 'string' && input.eventId.trim()) ||
      (typeof input.data?.event_id === 'string' ? input.data.event_id.trim() : '') ||
      null;

    if (eventId) {
      const byEvent = await this.repo
        .createQueryBuilder('n')
        .where('n.user_id = :userId', { userId: input.userId })
        .andWhere('n.type = :type', { type: input.type })
        .andWhere(
          // event_id column is uuid; jsonb ->> yields text — cast both sides to text
          // so Postgres never attempts `text = uuid`.
          `(n.event_id::text = :eventId OR n.data->>'event_id' = :eventId)`,
          { eventId },
        )
        .getOne();
      if (byEvent) return { notification: byEvent, created: false };
    }

    const bookingId =
      typeof input.data?.booking_id === 'string' ? input.data.booking_id : null;
    if (bookingId && ONCE_PER_BOOKING_TYPES.has(input.type)) {
      const qb = this.repo
        .createQueryBuilder('n')
        .where('n.user_id = :userId', { userId: input.userId })
        .andWhere('n.type = :type', { type: input.type })
        .andWhere("n.data->>'booking_id' = :bookingId", { bookingId });
      if (input.type === 'REVIEW_REMINDER') {
        const stage =
          typeof input.data?.reminder_stage === 'string'
            ? input.data.reminder_stage
            : '1h';
        qb.andWhere("n.data->>'reminder_stage' = :stage", { stage });
      }
      const existing = await qb.getOne();
      if (existing) return { notification: existing, created: false };
    }

    const data = {
      ...(input.data ?? {}),
      ...(eventId ? { event_id: eventId } : {}),
    };
    const row = this.repo.create({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data,
      event_id: eventId,
      is_read: false,
    });
    try {
      const saved = await this.repo.save(row);
      this.logger.log(
        JSON.stringify({
          event: 'notification_received',
          notificationId: saved.id,
          userId: saved.user_id,
          type: saved.type,
          eventId,
        }),
      );
      return { notification: saved, created: true };
    } catch (err) {
      // Unique (user_id, type, event_id) race — treat as idempotent hit.
      if (eventId) {
        const raced = await this.repo
          .createQueryBuilder('n')
          .where('n.user_id = :userId', { userId: input.userId })
          .andWhere('n.type = :type', { type: input.type })
          .andWhere('n.event_id = :eventId', { eventId })
          .getOne();
        if (raced) return { notification: raced, created: false };
      }
      throw err;
    }
  }
}
