import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * @description Mounts Swagger UI at `/api/docs` outside production. Gated on NODE_ENV only,
 * with no separate toggle, so the full API map cannot be exposed in production by accident.
 * @param app - Nest application.
 * @param port - Port used in the startup log line.
 */
export function setupSwagger(app: INestApplication, port: string | number): void {
  if (process.env['NODE_ENV'] === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('Kitty API')
    .setDescription(
      [
        'Group expense splitting API. All amounts are integer **minor units**:',
        'VND has no fractional digits, so 100000 means 100,000 ₫; USD has 2,',
        'so 1050 means $10.50. Floating point never enters the money path.',
        '',
        '**Getting a token to try it out:**',
        '1. `POST /api/groups` creates a group; the response includes a `token`',
        '2. Click **Authorize** at the top and paste the token',
        '',
        'A token is bound to ONE group. Using it against another group returns 403.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      // Must match the name used in @ApiBearerAuth() on controllers.
      'token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      // Keep the token across page reloads.
      persistAuthorization: true,
    },
  });

  Logger.log(`API docs: http://localhost:${port}/api/docs`);
}
