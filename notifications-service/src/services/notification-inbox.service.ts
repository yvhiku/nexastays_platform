import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateNotificationInput } from '@nexa/event-bus';
import { UserNotification } from '../entities/user-notification.entity';

@Injectable()
export class NotificationInboxService {
  private readonly logger = new Logger(NotificationInboxService.name);

  constructor(
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
  ) {}

  async create(input: CreateNotificationInput): Promise<UserNotification> {
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
