import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createHttpTelemetryMiddleware, initOpenTelemetry } from '@nexa/telemetry';
import { AppModule } from './app.module';

async function bootstrap() {
  initOpenTelemetry('nexa-media');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(createHttpTelemetryMiddleware({ service: 'nexa-media' }));
  const port = Number(process.env.PORT ?? 3004);
  await app.listen(port, '0.0.0.0');
  console.log(`Media service listening on :${port}`);
}
void bootstrap();
