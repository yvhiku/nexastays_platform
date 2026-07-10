import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { DomainEvent } from '@nexa/event-bus';
import { FcmPushService, type PushPayload } from './fcm-push.service';
import { EventIngressService } from './events-consumer.service';
import { getInternalServiceKey } from './secrets';

function assertInternalKey(key: string | undefined): void {
  if (key !== getInternalServiceKey()) {
    throw new UnauthorizedException('Invalid internal service key');
  }
}

@Controller('internal')
export class InternalNotificationsController {
  constructor(
    private readonly fcm: FcmPushService,
    private readonly ingress: EventIngressService,
  ) {}

  @Post('push')
  @HttpCode(204)
  async push(
    @Headers('x-internal-key') key: string | undefined,
    @Body() body: PushPayload & { userId: string },
  ): Promise<void> {
    assertInternalKey(key);
    await this.fcm.sendToUser(body.userId, body);
  }

  @Post('events')
  @HttpCode(204)
  async events(
    @Headers('x-internal-key') key: string | undefined,
    @Body() event: DomainEvent,
  ): Promise<void> {
    assertInternalKey(key);
    await this.ingress.ingest(event);
  }
}
