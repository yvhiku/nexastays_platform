import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushDeviceToken } from './entities/push-device-token.entity';
import { UserNotification } from './entities/user-notification.entity';
import { FcmPushService } from './fcm-push.service';
import { EventsConsumerService, EventIngressService } from './events-consumer.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationOrchestratorService } from './notification-orchestrator.service';
import { NotificationInboxService } from './services/notification-inbox.service';
import { PushChannel } from './channels/push.channel';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { InternalNotificationsController } from './internal-notifications.controller';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

const isProd = process.env.NODE_ENV === 'production';

function databaseSsl() {
  if (!isProd) return undefined;
  if (process.env.DB_SSL !== 'true') {
    throw new Error('DB_SSL=true is required in production.');
  }
  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'default', ttl: 60000, limit: 300 },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5433),
      username: process.env.DB_USERNAME ?? 'nexa_identity',
      password:
        process.env.DB_PASSWORD ??
        (isProd
          ? (() => {
              throw new Error('DB_PASSWORD is required in production.');
            })()
          : 'nexa_identity_dev'),
      database: process.env.DB_NAME ?? 'nexa_identity',
      entities: [PushDeviceToken, UserNotification],
      synchronize: false,
      ssl: databaseSsl(),
    }),
    TypeOrmModule.forFeature([PushDeviceToken, UserNotification]),
  ],
  controllers: [InternalNotificationsController],
  providers: [
    FcmPushService,
    PushChannel,
    EmailChannel,
    SmsChannel,
    NotificationInboxService,
    NotificationDispatcherService,
    NotificationOrchestratorService,
    EventsConsumerService,
    EventIngressService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
