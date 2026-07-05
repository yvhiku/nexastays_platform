import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushDeviceToken } from './entities/push-device-token.entity';
import { FcmPushService } from './fcm-push.service';
import { EventsConsumerService, EventIngressService } from './events-consumer.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { PushChannel } from './channels/push.channel';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { InternalNotificationsController } from './internal-notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5433),
      username: process.env.DB_USERNAME ?? 'nexa_identity',
      password: process.env.DB_PASSWORD ?? 'nexa_identity_dev',
      database: process.env.DB_NAME ?? 'nexa_identity',
      entities: [PushDeviceToken],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([PushDeviceToken]),
  ],
  controllers: [InternalNotificationsController],
  providers: [
    FcmPushService,
    PushChannel,
    EmailChannel,
    SmsChannel,
    NotificationDispatcherService,
    EventsConsumerService,
    EventIngressService,
  ],
})
export class AppModule {}
