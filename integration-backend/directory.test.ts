import { beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ secret: vi.fn(), query: vi.fn(), release: vi.fn(), pool: vi.fn() }));
vi.mock('@aws-sdk/client-secrets-manager', () => ({ SecretsManagerClient: class { send = sdk.secret }, GetSecretValueCommand: class { constructor(public input: unknown) {} } }));
vi.mock('pg', () => ({ default: { Pool: class { constructor(settings: unknown) { sdk.pool(settings); } connect = async () => ({ query: sdk.query, release: sdk.release }); } } }));
const sub = 'e18b45b0-6011-70c6-4052-644877433da2';
beforeEach(() => {
  vi.clearAllMocks(); vi.resetModules(); vi.stubEnv('FEEDBACK_TARGET', 'dev'); vi.stubEnv('DIRECTORY_SECRET_ARN', 'own-directory-secret');
  sdk.secret.mockResolvedValue({ SecretString: JSON.stringify({ username: 'harvest_feedback_dev_directory', password: 'private-random-password', host: 'harvest-refresh-staging.cj6wauecoveq.us-east-2.rds.amazonaws.com', dbname: 'harvest_refresh' }) });
  sdk.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [{ sub, email: 'sahil+admin@withmeridian.ai', name: 'Sahil' }] : [] }));
});
it('uses verified TLS, a dedicated login, read-only transactions and live membership rows', async () => {
  const { handler } = await import('./directory');
  expect(await handler({ operation: 'harvest-feedback-admin-directory', subjects: [sub] })).toHaveLength(1);
  expect(sdk.pool.mock.calls[0][0]).toMatchObject({ user: 'harvest_feedback_dev_directory', ssl: { rejectUnauthorized: true } });
  expect(sdk.query.mock.calls[0][0]).toBe('BEGIN READ ONLY');
  expect(sdk.query.mock.calls[1][0]).toContain('m.removed_at IS NULL');
  expect(sdk.query.mock.calls[1][1]).toEqual([[sub]]);
  sdk.query.mockResolvedValue({ rows: [] });
  expect(await handler({ operation: 'harvest-feedback-admin-directory', subjects: [sub] })).toEqual([]);
});
it('denies HTTP-shaped, unbounded, and malformed lookups before touching credentials', async () => {
  const { handler } = await import('./directory');
  for (const event of [{ operation: 'harvest-feedback-admin-directory', subjects: [sub], requestContext: {} }, { operation: 'harvest-feedback-admin-directory', subjects: ['injection'] }, { operation: 'harvest-feedback-admin-directory', subjects: Array(101).fill(sub) }]) await expect(handler(event)).rejects.toThrow('Invalid directory request');
  expect(sdk.secret).not.toHaveBeenCalled();
});
it('refuses master credentials and rolls back database failures', async () => {
  const { handler } = await import('./directory');
  sdk.secret.mockResolvedValue({ SecretString: JSON.stringify({ username: 'postgres' }) });
  await expect(handler({ operation: 'harvest-feedback-admin-directory', subjects: [sub] })).rejects.toThrow('lookup failed');
  expect(sdk.pool).not.toHaveBeenCalled();
});
