import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The web app calls relative '/api/...' paths (proxied in dev), identical in production.
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;

  // No-op in production.
  setupSwagger(app, port);

  // Bind to all interfaces: inside a container, 127.0.0.1 is unreachable from the host platform.
  await app.listen(port, '0.0.0.0');
  Logger.log(`Kitty API listening on http://localhost:${port}/api`);
}

bootstrap();
