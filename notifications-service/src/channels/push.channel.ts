import { Injectable } from '@nestjs/common';
import { FcmPushService } from '../fcm-push.service';
import type {
  NotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

/** Push channel — FCM via the existing push service. */
@Injectable()
export class PushChannel implements NotificationChannel {
  readonly name = 'push' as const;

  constructor(private readonly fcm: FcmPushService) {}

  isEnabled(): boolean {
    return true; // FCM silently no-ops without credentials
  }

  async send(notification: NotificationPayload): Promise<void> {
    await this.fcm.sendToUser(notification.userId, {
      title: notification.title,
      body: notification.body,
      reference: notification.reference,
      amount: notification.amount,
      direction: notification.direction,
      event: notification.event,
      notificationId: notification.notificationId,
      actionUrl: notification.actionUrl ?? '',
      type: notification.type,
    });
  }
}
