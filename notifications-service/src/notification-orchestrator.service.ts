import { Injectable, Logger } from '@nestjs/common';
import type { CreateNotificationInput } from '@nexa/event-bus';
import { NotificationInboxService } from './services/notification-inbox.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import type { UserNotification } from './entities/user-notification.entity';

/**
 * Persist-first notification pipeline: store → push.
 * Never send push without a persisted inbox row.
 */
@Injectable()
export class NotificationOrchestratorService {
  private readonly logger = new Logger(NotificationOrchestratorService.name);

  constructor(
    private readonly inbox: NotificationInboxService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async process(input: CreateNotificationInput): Promise<UserNotification> {
    const saved = await this.inbox.create(input);
    try {
      await this.dispatcher.dispatchPush(saved);
    } catch (err) {
      this.logger.error(
        `Push failed for notification ${saved.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return saved;
  }

  async processMany(inputs: CreateNotificationInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => this.process(input)));
  }
}
