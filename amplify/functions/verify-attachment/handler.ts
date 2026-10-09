import { CognitoIdentityClient, GetIdCommand } from '@aws-sdk/client-cognito-identity';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { validateAttachment, type AttachmentRequest } from './validation';

const identity = new CognitoIdentityClient({});
const storage = new S3Client({});

export async function handler(event: AttachmentRequest) {
  try {
    return await validateAttachment(event, {
      provider: process.env.USER_POOL_PROVIDER!,
      resolveIdentity: async token => (await identity.send(new GetIdCommand({
        IdentityPoolId: process.env.IDENTITY_POOL_ID,
        Logins: { [process.env.USER_POOL_PROVIDER!]: token },
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
