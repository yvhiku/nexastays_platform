import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import type { NotificationRequestedPayload } from '@nexa/event-bus';
import { PushDeviceToken } from './entities/push-device-token.entity';

export interface PushPayload {
  title: string;
  body: string;
  reference: string;
  amount: string;
  direction: string;
  event: string;
  notificationId?: string;
  actionUrl?: string;
  type?: string;
}

/** Pure FCM sender — event consumption lives in EventsConsumerService. */
@Injectable()
export class FcmPushService {
  constructor(
    @InjectRepository(PushDeviceToken)
    private readonly tokenRepo: Repository<PushDeviceToken>,
  ) {
    this.initFirebase();
  }

  private initFirebase(): void {
    if (admin.apps.length > 0) return;
    const json = process.env.FCM_SERVICE_ACCOUNT_JSON;
    const path = process.env.FCM_SERVICE_ACCOUNT_PATH;
    if (!json && !path) return;
    const credential = json
      ? admin.credential.cert(JSON.parse(json))
      : admin.credential.cert(require(path!));
    admin.initializeApp({ credential });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (admin.apps.length === 0) return;
    const rows = await this.tokenRepo.find({
      where: { user_id: userId, active: true, notifications_enabled: true },
    });
    const tokens = rows.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: {
        reference: payload.reference,
        amount: payload.amount,
        direction: payload.direction,
        event: payload.event,
        notification_id: payload.notificationId ?? '',
        action_url: payload.actionUrl ?? '',
        type: payload.type ?? payload.event,
      },
    });
  }

  async sendFromNotificationPayload(p: NotificationRequestedPayload): Promise<void> {
    await this.sendToUser(p.userId, p);
  }
}
