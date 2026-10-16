import { runtime, util } from '@aws-appsync/utils';

const MAX_ATTACHMENTS = 5;

/** Legacy single-file arguments plus the `attachments` list, as one array. */
export function submittedAttachments(args) {
  const list = typeof args.attachments === 'string' ? JSON.parse(args.attachments) : args.attachments;
  if (list != null && !Array.isArray(list)) util.error('Attachment unavailable.', 'InvalidInput');
  const legacy = args.attachmentKey || args.attachmentName || args.attachmentType || args.attachmentSize != null
    ? [{ attachmentKey: args.attachmentKey, attachmentName: args.attachmentName, attachmentType: args.attachmentType, attachmentSize: args.attachmentSize }] : [];
  const all = legacy.concat((list ?? []).map(entry => ({
    attachmentKey: entry?.attachmentKey, attachmentName: entry?.attachmentName,
    attachmentType: entry?.attachmentType, attachmentSize: entry?.attachmentSize,
  })));
  if (all.length > MAX_ATTACHMENTS) util.error('Attachment unavailable.', 'InvalidInput');
  return all;
}

export function request(ctx) {
  const attachments = submittedAttachments(ctx.args);
  if (!attachments.length) {
    runtime.earlyReturn(null);
  }
  return {
    operation: 'Invoke',
    payload: {
      identity: ctx.identity,
      token: ctx.request.headers.authorization,
      attachment: attachments[0],
      attachments,
    },
  };
}

export function response(ctx) {
  const expected = submittedAttachments(ctx.args).map(entry => entry.attachmentKey);
  const verified = ctx.result?.attachmentKeys ?? (ctx.result?.attachmentKey ? [ctx.result.attachmentKey] : []);
  if (ctx.error || !verified.length || verified.length !== expected.length || verified.some((key, index) => key !== expected[index])) {
    util.error('Attachment unavailable.', 'Unauthorized');
  }
  ctx.stash.verifiedAttachmentKey = verified[0];
  ctx.stash.verifiedAttachmentKeys = verified;
  return null;
}
