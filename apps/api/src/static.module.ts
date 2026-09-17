import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';

/**
 * @description Serves the Angular build from the API when `SERVE_STATIC=true`: one container,
 * one origin, no CORS. Disabled in dev, where the Angular dev-server proxies to the API.
 * `/api/{*path}` must stay excluded, otherwise API requests fall through to index.html.
 */
@Module({
  imports:
    process.env['SERVE_STATIC'] === 'true'
      ? [
          ServeStaticModule.forRoot({
            // __dirname is dist/apps/api in the built output.
            rootPath: join(__dirname, '..', 'web', 'browser'),
            exclude: ['/api/{*path}'],
          }),
        ]
      : [],
})
export class StaticModule {}
