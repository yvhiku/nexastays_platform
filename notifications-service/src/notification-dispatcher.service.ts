import { Injectable, Logger } from '@nestjs/common';
import { PushChannel } from './channels/push.channel';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import type {
  NotificationChannel,
  NotificationChannelName,
  NotificationPayload,
} from './channels/notification-channel.interface';
import type { UserNotification } from './entities/user-notification.entity';

/**
 * Multi-channel dispatcher.
 * Default: push only (current behavior). Pass explicit channels to fan out.
 * A failing channel never blocks the others.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly channels: NotificationChannel[];

  constructor(push: PushChannel, email: EmailChannel, sms: SmsChannel) {
    this.channels = [push, email, sms];
  }

  /** Push delivery for a persisted inbox row. */
  async dispatchPush(row: UserNotification): Promise<void> {
    const actionUrl =
      typeof row.data?.action_url === 'string' ? row.data.action_url : '';
    const bookingId =
      typeof row.data?.booking_id === 'string' ? row.data.booking_id : row.id;
    await this.dispatch(
      {
        userId: row.user_id,
        notificationId: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        reference: bookingId,
        amount: '',
        direction: 'info',
        event: row.type,
        actionUrl,
      },
      ['push'],
    );
  }

  async dispatch(
    notification: NotificationPayload,
    channelNames: NotificationChannelName[] = ['push'],
  ): Promise<void> {
    const targets = this.channels.filter(
      (c) => channelNames.includes(c.name) && c.isEnabled(),
    );
    await Promise.all(
      targets.map(async (channel) => {
        try {
          await channel.send(notification);
        } catch (err) {
          this.logger.error(
            `Channel "${channel.name}" failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    );
  }
}
