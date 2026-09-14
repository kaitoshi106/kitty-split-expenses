import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseSsl } from './config/database-ssl';
import * as entities from './entities';

/**
 * DataSource for the TypeORM CLI (generating and running migrations), which runs outside Nest
 * and therefore reads `process.env` directly.
 *
 * dotenv is deliberately not imported: it is a devDependency missing from the production image.
 * The caller loads env instead: `node --env-file=apps/api/.env` locally, Docker in the container.
 */

export default new DataSource({
  type: 'postgres',
  host: process.env['DATABASE_HOST'],
  port: Number(process.env['DATABASE_PORT']),
  username: process.env['DATABASE_USER'],
  password: process.env['DATABASE_PASSWORD'],
  database: process.env['DATABASE_NAME'],
  ssl: databaseSsl(process.env['DATABASE_SSL']),
  entities: Object.values(entities),
  // Resolved from __dirname rather than the cwd so it works both from source
  // (apps/api/src) and from the compiled build inside the container.
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
