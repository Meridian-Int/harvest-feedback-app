import { createHmac } from 'node:crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { harvestNotificationFor } from './harvest-notification-events';

const secrets = new SecretsManagerClient({});
type StreamRecord = Parameters<typeof harvestNotificationFor>[0] & { dynamodb?: Parameters<typeof harvestNotificationFor>[0]['dynamodb'] & { SequenceNumber?: string } };
let cached: { value: string; until: number } | undefined;

async function signingSecret(): Promise<string> {
  const name = process.env.HARVEST_NOTIFICATION_SECRET_NAME;
  if (!name) throw new Error('HARVEST notification signing secret is not configured.');
  if (!cached || cached.until < Date.now()) {
    const value = (await secrets.send(new GetSecretValueCommand({ SecretId: name }))).SecretString;
    if (!value) throw new Error('HARVEST notification signing secret is empty.');
    cached = { value, until: Date.now() + 300_000 };
  }
  return cached.value;
}

export async function handler(event: { Records: StreamRecord[] }) {
  const api = process.env.HARVEST_API_BASE_URL;
  if (!api || new URL(api).origin !== 'https://hjyuhqzj1i.execute-api.us-east-2.amazonaws.com') throw new Error('HARVEST notification destination is not approved.');
  const destination = new URL('/api/comms/feedback/events', api);
  const failures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    try {
      const payload = harvestNotificationFor(record);
      if (!payload) continue;
      const body = JSON.stringify(payload);
      const signature = createHmac('sha256', await signingSecret()).update(body).digest('hex');
      const response = await fetch(destination, { method: 'POST', headers: { 'content-type': 'application/json', 'x-feedback-signature': `sha256=${signature}` }, body, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HARVEST notification delivery failed with HTTP ${response.status}.`);
    } catch {
      if (!record.dynamodb?.SequenceNumber) throw new Error('Feedback notification event has no retry identity.');
      failures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures: failures };
}
