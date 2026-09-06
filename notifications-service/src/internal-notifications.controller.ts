import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import {
  assertValidEvent,
  EventValidationError,
  type DomainEvent,
} from '@nexa/event-bus';
import { FcmPushService, type PushPayload } from './fcm-push.service';
import { EventIngressService } from './events-consumer.service';
import { getInternalServiceKey } from './secrets';

function assertInternalKey(key: string | undefined): void {
  const expected = getInternalServiceKey();
  if (!key) {
    throw new UnauthorizedException('Invalid internal service key');
  }
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
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
    if (!body?.userId?.trim() || !body?.title?.trim() || !body?.body?.trim()) {
      throw new BadRequestException('userId, title, and body are required');
    }
    await this.fcm.sendToUser(body.userId, body);
  }

  @Post('events')
  @HttpCode(204)
  async events(
    @Headers('x-internal-key') key: string | undefined,
    @Body() event: DomainEvent,
  ): Promise<void> {
    assertInternalKey(key);
    if (!event?.type || !event?.payload || typeof event.payload !== 'object') {
      throw new BadRequestException('event.type and event.payload are required');
    }
    try {
      const canonical = assertValidEvent(
        event.type,
        event.payload as Record<string, unknown>,
      );
      await this.ingress.ingest({ ...event, type: canonical });
    } catch (err) {
      if (err instanceof EventValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
