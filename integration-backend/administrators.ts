import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
const lambda = new LambdaClient({});
const cognito = new CognitoIdentityProviderClient({ region: 'us-east-2' });
export interface Administrator { sub: string; email: string; name: string | null }

/** Live Operator members, with enabled Cognito identities. */
export async function selectedAdministrators(): Promise<Administrator[]> {
  const functionArn = process.env.HARVEST_DIRECTORY_FUNCTION_ARN;
  const pool = process.env.HARVEST_USER_POOL_ID;
  if (!pool || !/^arn:aws:lambda:us-east-2:938463256739:function:harvest-feedback-(dev|test)-directory$/.test(functionArn ?? '')) throw new Error('Trusted administrator directory is not configured.');
  const result = await lambda.send(new InvokeCommand({ FunctionName: functionArn, InvocationType: 'RequestResponse', Payload: Buffer.from(JSON.stringify({ operation: 'harvest-feedback-admin-directory' })) }));
  if (result.FunctionError || !result.Payload) throw new Error('HARVEST administrator lookup failed.');
  const rows: unknown = JSON.parse(Buffer.from(result.Payload).toString('utf8'));
  if (!Array.isArray(rows) || rows.length > 100) throw new Error('HARVEST administrator lookup returned an invalid response.');
  const active: Administrator[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.sub !== 'string' || !/^[a-f0-9-]{36}$/i.test(row.sub) || seen.has(row.sub) || typeof row.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error('HARVEST administrator lookup returned an invalid identity.');
    seen.add(row.sub);
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
