import { CognitoIdentityClient, GetIdCommand } from '@aws-sdk/client-cognito-identity';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { validateAttachments, type AttachmentRequest } from './validation';

const identity = new CognitoIdentityClient({});
const storage = new S3Client({});

export async function handler(event: AttachmentRequest) {
  try {
    const stagingProvider = process.env.HARVEST_USER_POOL_PROVIDER;
    const provider = stagingProvider && event.identity?.claims?.iss === `https://${stagingProvider}`
      ? stagingProvider : process.env.USER_POOL_PROVIDER!;
    return await validateAttachments(event, {
      provider,
      resolveIdentity: async token => (await identity.send(new GetIdCommand({
        IdentityPoolId: process.env.IDENTITY_POOL_ID,
        Logins: { [provider]: token },
      }))).IdentityId,
      inspectObject: async key => {
        const object = await storage.send(new HeadObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: key }));
        return { size: object.ContentLength, type: object.ContentType };
      },
    });
  } catch {
    // Do not disclose another owner's file metadata, tokens or infrastructure errors.
    throw new Error('Attachment unavailable.');
  }
}
