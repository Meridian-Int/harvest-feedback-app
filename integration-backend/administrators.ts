import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
const db = new DynamoDBClient({});
const lambda = new LambdaClient({});
const cognito = new CognitoIdentityProviderClient({ region: 'us-east-2' });
export interface Administrator { sub: string; email: string; name: string | null }

/** Server-owned selections intersected with fresh HARVEST and Cognito state. */
export async function selectedAdministrators(): Promise<Administrator[]> {
  const table = process.env.ADMINS_TABLE;
  const functionArn = process.env.HARVEST_DIRECTORY_FUNCTION_ARN;
  const pool = process.env.HARVEST_USER_POOL_ID;
  if (!table || !pool || !/^arn:aws:lambda:us-east-2:938463256739:function:harvest-feedback-(dev|test)-directory$/.test(functionArn ?? '')) throw new Error('Trusted administrator directory is not configured.');
  const subjects = new Set<string>();
  let cursor: Record<string, any> | undefined;
  do {
    const page = await db.send(new ScanCommand({ TableName: table, ConsistentRead: true, ExclusiveStartKey: cursor }));
    for (const raw of page.Items ?? []) {
      const entry = unmarshall(raw);
      if (entry.enabled === true && typeof entry.id === 'string' && /^[a-f0-9-]{36}$/i.test(entry.id)) subjects.add(entry.id);
    }
    if (subjects.size > 100) throw new Error('Administrator directory exceeds its configured bound.');
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  if (!subjects.size) return [];
  const result = await lambda.send(new InvokeCommand({ FunctionName: functionArn, InvocationType: 'RequestResponse', Payload: Buffer.from(JSON.stringify({ operation: 'harvest-feedback-admin-directory', subjects: [...subjects] })) }));
  if (result.FunctionError || !result.Payload) throw new Error('HARVEST administrator lookup failed.');
  const rows: unknown = JSON.parse(Buffer.from(result.Payload).toString('utf8'));
  if (!Array.isArray(rows)) throw new Error('HARVEST administrator lookup returned an invalid response.');
  const active: Administrator[] = [];
  for (const row of rows) {
    if (!row || typeof row.sub !== 'string' || !subjects.has(row.sub) || typeof row.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error('HARVEST administrator lookup returned an invalid identity.');
    try {
      const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: pool, Username: row.sub }));
      const attributes = new Map(user.UserAttributes?.map(attribute => [attribute.Name, attribute.Value]));
      if (user.Enabled === true && user.UserStatus === 'CONFIRMED' && attributes.get('sub') === row.sub && attributes.get('email')?.toLowerCase() === row.email.toLowerCase()) {
        active.push({ sub: row.sub, email: row.email, name: typeof row.name === 'string' ? row.name : null });
      }
    } catch (cause) {
      if ((cause as Error).name !== 'UserNotFoundException') throw cause;
    }
  }
  return active;
}
