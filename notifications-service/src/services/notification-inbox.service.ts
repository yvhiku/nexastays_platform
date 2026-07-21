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

@Injectable()
export class NotificationInboxService {
  private readonly logger = new Logger(NotificationInboxService.name);

  constructor(
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
  ) {}

  async create(input: CreateNotificationInput): Promise<UserNotification> {
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
      if (existing) return existing;
    }

    const row = this.repo.create({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      is_read: false,
    });
    const saved = await this.repo.save(row);
    this.logger.log(
      JSON.stringify({
        event: 'notification_received',
        notificationId: saved.id,
        userId: saved.user_id,
        type: saved.type,
      }),
    );
    return saved;
  }
}
