import { Injectable, Logger } from '@nestjs/common';
import type {
  NotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

/**
 * Email channel — stub interface, provider wired later (SES, Resend, SMTP).
 * Enabled with EMAIL_PROVIDER env; currently logs structured intent only.
 */
@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly name = 'email' as const;
  private readonly logger = new Logger(EmailChannel.name);

  isEnabled(): boolean {
    return Boolean(process.env.EMAIL_PROVIDER);
  }

  async send(notification: NotificationPayload): Promise<void> {
    // TODO: integrate provider (SES / Resend / SMTP) behind this interface.
    this.logger.log(
      JSON.stringify({
        event: 'notification.email_stub',
        userId: notification.userId,
        title: notification.title,
      }),
    );
  }
}
