import { Amplify } from 'aws-amplify';
import { CognitoIdentityClient, GetCredentialsForIdentityCommand, GetIdCommand } from '@aws-sdk/client-cognito-identity';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getUsableHarvestTokens } from './harvest-shared-session';

interface StorageAccess {
  identityId: string;
  bucket: string;
  client: S3Client;
}

async function storageAccess(): Promise<StorageAccess> {
  const config = Amplify.getConfig();
  const cognito = config.Auth?.Cognito;
  const identityPoolId = cognito && 'identityPoolId' in cognito ? cognito.identityPoolId : undefined;
  const userPoolId = cognito?.userPoolId;
  const bucket = config.Storage?.S3?.bucket;
  const region = config.Storage?.S3?.region;
  if (!identityPoolId || !userPoolId || !bucket || !region) {
    throw new Error('Feedback attachments are not configured.');
  }
  const { idToken } = await getUsableHarvestTokens();
  const identityRegion = identityPoolId.split(':')[0];
  const poolRegion = userPoolId.split('_')[0];
  const logins = { [`cognito-idp.${poolRegion}.amazonaws.com/${userPoolId}`]: idToken };
  const identity = new CognitoIdentityClient({ region: identityRegion });
  const id = await identity.send(new GetIdCommand({ IdentityPoolId: identityPoolId, Logins: logins }));
  if (!id.IdentityId) throw new Error('Feedback attachment identity is unavailable.');
  const result = await identity.send(new GetCredentialsForIdentityCommand({ IdentityId: id.IdentityId, Logins: logins }));
  const credentials = result.Credentials;
  if (!credentials?.AccessKeyId || !credentials.SecretKey || !credentials.SessionToken) {
    throw new Error('Feedback attachment access is unavailable.');
  }
  return {
    identityId: id.IdentityId,
    bucket,
    client: new S3Client({ region, credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretKey,
      sessionToken: credentials.SessionToken,
    } }),
  };
}

export async function uploadSharedAttachment(file: File, name: string, contentType: string): Promise<string> {
  const { identityId, bucket, client } = await storageAccess();
  const key = `feedback-media/${identityId}/${name}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: new Uint8Array(await file.arrayBuffer()), ContentType: contentType }));
  return key;
}

export async function getSharedAttachmentProperties(key: string): Promise<{ size: number }> {
  const { bucket, client } = await storageAccess();
  const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (result.ContentLength == null) throw new Error('Attachment unavailable.');
  return { size: result.ContentLength };
}

export async function getSharedAttachmentUrl(key: string): Promise<string> {
  const { bucket, client } = await storageAccess();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) throw new Error('Attachment unavailable.');
  const bytes = await result.Body.transformToByteArray();
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: result.ContentType ?? 'application/octet-stream' }));
}

export async function removeSharedAttachment(key: string): Promise<void> {
  const { identityId, bucket, client } = await storageAccess();
  if (!key.startsWith(`feedback-media/${identityId}/`)) throw new Error('Attachment unavailable.');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function sharedAttachmentIdentityId(): Promise<string> {
  return (await storageAccess()).identityId;
}
