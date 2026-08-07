import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createHttpTelemetryMiddleware, initOpenTelemetry } from '@nexa/telemetry';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { getInternalServiceKey } from './secrets';

async function bootstrap() {
  initOpenTelemetry('nexa-notifications');
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    getInternalServiceKey();
    if (!process.env.DB_PASSWORD?.trim()) {
      throw new Error('DB_PASSWORD is required in production.');
    }
    if (!process.env.REDIS_URL?.trim()) {
      throw new Error('REDIS_URL is required in production.');
    }
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (isProd || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.disable('x-powered-by');
  app.use(json({ limit: process.env.BODY_LIMIT ?? '256kb' }));
  app.use(urlencoded({ extended: false, limit: process.env.BODY_LIMIT ?? '256kb' }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.use(createHttpTelemetryMiddleware({ service: 'nexa-notifications' }));
  const port = Number(process.env.PORT ?? 3003);
  await app.listen(port, '0.0.0.0');
  console.log(`Notifications service listening on :${port}`);
}
void bootstrap();
