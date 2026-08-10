import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createHttpTelemetryMiddleware, initOpenTelemetry } from '@nexa/telemetry';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import {
  assertProductionObjectStorageConfigured,
  getInternalServiceKey,
  getMediaSigningSecret,
  isHardProductionRuntime,
  resolveMediaStage,
} from './secrets';

async function bootstrap() {
  initOpenTelemetry('nexa-media');
  const stage = resolveMediaStage();
  const hardProd = isHardProductionRuntime();
  const nodeProd = process.env.NODE_ENV === 'production';

  assertProductionObjectStorageConfigured();

  if (hardProd || nodeProd) {
    getInternalServiceKey();
    getMediaSigningSecret();
  }

  // Soft-launch dogfood may use local disk; real production requires S3.
  if (hardProd) {
    if (process.env.MEDIA_STORAGE_BACKEND !== 's3') {
      throw new Error('MEDIA_STORAGE_BACKEND=s3 is required in production.');
    }
    if (!process.env.MEDIA_S3_BUCKET?.trim()) {
      throw new Error('MEDIA_S3_BUCKET is required in production.');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (hardProd || nodeProd || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: hardProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.use(createHttpTelemetryMiddleware({ service: 'nexa-media' }));
  const port = Number(process.env.PORT ?? 3004);
  await app.listen(port, '0.0.0.0');
  console.log(`Media service listening on :${port} (stage=${stage})`);
}
void bootstrap();
