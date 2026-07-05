import { Injectable, Logger } from '@nestjs/common';
import type {
  NotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

/**
 * SMS channel — stub interface, provider wired later (Twilio, local aggregator).
 * Enabled with SMS_PROVIDER env; currently logs structured intent only.
 */
@Injectable()
export class SmsChannel implements NotificationChannel {
  readonly name = 'sms' as const;
  private readonly logger = new Logger(SmsChannel.name);

  isEnabled(): boolean {
    return Boolean(process.env.SMS_PROVIDER);
  }

  async send(notification: NotificationPayload): Promise<void> {
    // TODO: integrate provider (Twilio / aggregator) behind this interface.
    this.logger.log(
      JSON.stringify({
        event: 'notification.sms_stub',
        userId: notification.userId,
        title: notification.title,
      }),
    );
  }
}
