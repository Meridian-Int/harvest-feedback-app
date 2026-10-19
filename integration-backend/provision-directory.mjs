import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHmac, createHash, pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

if (!process.argv.includes('--apply')) throw new Error('Pass --apply only after reviewing the directory grant.');
const profileIndex = process.argv.indexOf('--profile');
const profile = profileIndex === -1 ? 'manasa' : process.argv[profileIndex + 1];
if (!/^[A-Za-z0-9_-]+$/.test(profile ?? '')) throw new Error('Choose a valid AWS profile.');
const targetArgument = process.env.FEEDBACK_TARGET ?? 'dev';
const outputs = JSON.parse(readFileSync(process.argv[2] ?? `.integration-outputs-${targetArgument}.json`, 'utf8'));
const names = Object.keys(outputs);
if (names.length !== 1 || !/^harvest-feedback-integration-(dev|test|production)$/.test(names[0])) throw new Error('A single Feedback stack is required.');
const target = names[0].split('-').at(-1), settings = outputs[names[0]];
if (target !== targetArgument || target === 'production' && (!process.argv.includes('--apply-production') || profileIndex === -1)) throw new Error('Production directory provisioning requires an explicit target, profile and --apply-production.');
const aws = args => JSON.parse(execFileSync('aws', [...args, '--profile', profile, '--region', 'us-east-2', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '{}');
if (aws(['sts', 'get-caller-identity']).Account !== '938463256739') throw new Error('Wrong AWS account.');
if (!settings.DirectorySecretArn?.startsWith(`arn:aws:secretsmanager:us-east-2:938463256739:secret:harvest-feedback/integration/${target}/directory-`)) throw new Error('Wrong directory secret.');
const secret = JSON.parse(aws(['secretsmanager', 'get-secret-value', '--secret-id', settings.DirectorySecretArn]).SecretString);
const role = `harvest_feedback_${target}_directory`;
const expectedHost = target === 'production'
  ? Object.fromEntries(aws(['cloudformation', 'describe-stacks', '--stack-name', 'harvest-refresh-backend-production']).Stacks?.[0]?.Outputs?.map(value => [value.OutputKey, value.OutputValue]) ?? []).DbEndpoint
  : 'harvest-refresh-staging.cj6wauecoveq.us-east-2.rds.amazonaws.com';
if (!new RegExp(`^harvest-refresh-${target === 'production' ? 'production' : 'staging'}\\.[a-z0-9]+\\.us-east-2\\.rds\\.amazonaws\\.com$`).test(expectedHost ?? '') || secret.username !== role || typeof secret.password !== 'string' || secret.host !== expectedHost || secret.dbname !== 'harvest_refresh') throw new Error('Invalid directory credentials.');
// The database sees a salted SCRAM verifier, never a plaintext password in SQL.
const salt = randomBytes(16), iterations = 4096;
const salted = pbkdf2Sync(secret.password.normalize('NFKC'), salt, iterations, 32, 'sha256');
const clientKey = createHmac('sha256', salted).update('Client Key').digest();
const storedKey = createHash('sha256').update(clientKey).digest('base64');
const serverKey = createHmac('sha256', salted).update('Server Key').digest('base64');
const verifier = `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
const statement = `DO $directory$
BEGIN
  IF current_setting('harvest.environment', true) <> '${target === 'production' ? 'production' : 'staging'}' THEN RAISE EXCEPTION 'Wrong HARVEST environment'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}' AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN RAISE EXCEPTION 'Unexpected privileged directory role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION; END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE roleid = (SELECT oid FROM pg_roles WHERE rolname = '${role}') OR member = (SELECT oid FROM pg_roles WHERE rolname = '${role}')) THEN RAISE EXCEPTION 'Unexpected directory role membership'; END IF;
  ALTER ROLE ${role} PASSWORD '${verifier}';
  ALTER ROLE ${role} CONNECTION LIMIT 3;
  ALTER ROLE ${role} SET default_transaction_read_only = on;
  GRANT CONNECT ON DATABASE harvest_refresh TO ${role};
  GRANT USAGE ON SCHEMA public TO ${role};
  GRANT SELECT (id, idp_subject, email, name) ON people TO ${role};
  GRANT SELECT (person_id, organisation_id, removed_at) ON memberships TO ${role};
  GRANT SELECT (id, kind) ON organisations TO ${role};
END $directory$;`;
const input = path.join(tmpdir(), `feedback-directory-${randomUUID()}.json`), output = input + '.result';
writeFileSync(input, JSON.stringify({ statements: [statement] }), { mode: 0o600 });
try {
  const result = aws(['lambda', 'invoke', '--function-name', `harvest-refresh-migrate-${target === 'production' ? 'production' : 'staging'}`, '--payload', `fileb://${input}`, output]);
  const response = JSON.parse(readFileSync(output, 'utf8'));
  if (result.FunctionError || response.ok !== true) throw new Error('Directory grant failed; inspect the private result file.');
  console.log(JSON.stringify({ directoryRole: role, configured: true, migrationsApplied: response.applied.length, scope: 'SELECT on required membership/profile columns only' }));
} finally { unlinkSync(input); if (process.env.KEEP_DIRECTORY_RESULT !== 'true') { try { unlinkSync(output); } catch {} } }
