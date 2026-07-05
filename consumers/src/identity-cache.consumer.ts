import { EVENTS, type EventBusConsumer, type KycUpdatedPayload } from '@nexa/event-bus';
import { IdentityReadModel } from '@nexa/identity-read-model';
import { StructuredLogger } from '@nexa/telemetry';

const logger = new StructuredLogger('identity-cache-consumer');

/**
 * Keeps the Redis identity read model fresh:
 * kyc.updated.v1 → invalidate the user's cached snapshot so product
 * services pick up the new KYC state on their next read.
 */
export async function registerIdentityCacheConsumer(
  consumer: EventBusConsumer,
): Promise<void> {
  const readModel = new IdentityReadModel({
    identityBaseUrl:
      process.env.IDENTITY_BASE_URL ?? 'http://127.0.0.1:3001/api/v1',
    redisUrl: process.env.REDIS_URL,
    serviceName: 'identity-cache-consumer',
  });

  await consumer.subscribe([EVENTS.KYC_UPDATED], async (event) => {
    const p = event.payload as unknown as KycUpdatedPayload;
    await readModel.invalidate(p.userId);
    logger.info('identity_cache.invalidated', {
      userId: p.userId,
      eventId: event.id,
      kycStatus: p.kycStatus,
    });
  });
}
