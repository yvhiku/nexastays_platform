import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createHttpTelemetryMiddleware, initOpenTelemetry } from '@nexa/telemetry';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { getInternalServiceKey, getMediaSigningSecret } from './secrets';

async function bootstrap() {
  initOpenTelemetry('nexa-media');
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    getInternalServiceKey();
    getMediaSigningSecret();
    const publicUrl = new URL(process.env.MEDIA_PUBLIC_BASE_URL ?? '');
    if (publicUrl.protocol !== 'https:') {
      throw new Error('MEDIA_PUBLIC_BASE_URL must be an HTTPS URL in production.');
    }
    if (process.env.MEDIA_STORAGE_BACKEND !== 's3') {
      throw new Error('MEDIA_STORAGE_BACKEND=s3 is required in production.');
    }
    if (!process.env.MEDIA_S3_BUCKET?.trim()) {
      throw new Error('MEDIA_S3_BUCKET is required in production.');
    }
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (isProd || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProd
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
  console.log(`Media service listening on :${port}`);
}
void bootstrap();
