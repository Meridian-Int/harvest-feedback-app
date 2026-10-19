import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { listLinearTeams } from './linear';

const secrets = new SecretsManagerClient({});

export async function readConfiguredLinearTeams() {
  const name = process.env.LINEAR_TOKEN_SECRET_NAME;
  if (!name) return { configured: false, teams: [] };
  const token = (await secrets.send(new GetSecretValueCommand({ SecretId: name }))).SecretString;
  if (!token) throw new Error('Linear token is unavailable.');
  return { configured: true, teams: await listLinearTeams(token) };
}
