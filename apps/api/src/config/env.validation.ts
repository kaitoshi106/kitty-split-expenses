const REQUIRED = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'JWT_SECRET',
] as const;

/**
 * @description Validates environment variables at startup so misconfiguration fails fast
 * instead of surfacing as a 500 on the first request.
 * @param config - Raw environment loaded by ConfigModule.
 * @returns The unchanged config.
 * @throws {Error} When a required variable is missing, JWT_SECRET is shorter than 16 characters, or DATABASE_PORT is invalid.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}\n` +
        `Check apps/api/.env (see apps/api/.env.example)`,
    );
  }

  const secret = String(config['JWT_SECRET']);
  if (secret.length < 16) {
    throw new Error('JWT_SECRET is too short; at least 16 characters are required');
  }

  const port = Number(config['DATABASE_PORT']);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid DATABASE_PORT: ${config['DATABASE_PORT']}`);
  }

  return config;
}
