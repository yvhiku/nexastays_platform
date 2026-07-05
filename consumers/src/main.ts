import 'dotenv/config';
import { createRedisClient, RedisStreamsEventConsumer } from '@nexa/event-bus';
import { StructuredLogger } from '@nexa/telemetry';
import { registerAnalyticsConsumer } from './analytics.consumer';
import { registerAuditConsumer } from './audit.consumer';
import { registerFraudDetectionConsumer } from './fraud-detection.consumer';
import { registerIdentityCacheConsumer } from './identity-cache.consumer';

const logger = new StructuredLogger('nexa-consumers');

async function main(): Promise<void> {
  const redis = createRedisClient();
  if (!redis) {
    logger.error('consumers.start_failed', { message: 'REDIS_URL is required' });
    process.exit(1);
  }
  await redis.connect().catch(() => undefined);

  const consumer = new RedisStreamsEventConsumer(redis, `consumers-${process.pid}`);

  await registerAnalyticsConsumer(consumer);
  await registerAuditConsumer(consumer);
  await registerFraudDetectionConsumer(consumer);
  await registerIdentityCacheConsumer(consumer);

  await consumer.start();
  logger.info('consumers.started', {
    message: 'analytics, audit, fraud-detection, identity-cache consumers running',
  });

  const shutdown = async () => {
    await consumer.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
