import { runtime, util } from '@aws-appsync/utils';

export function request(ctx) {
  const args = ctx.args;
  if (!(args.attachmentKey || args.attachmentName || args.attachmentType || args.attachmentSize != null)) {
    runtime.earlyReturn(null);
  }
  return {
    operation: 'Invoke',
    payload: {
      identity: ctx.identity,
      token: ctx.request.headers.authorization,
      attachment: {
        attachmentKey: args.attachmentKey, attachmentName: args.attachmentName,
        attachmentType: args.attachmentType, attachmentSize: args.attachmentSize,
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error || !ctx.result?.attachmentKey || ctx.result.attachmentKey !== ctx.args.attachmentKey) {
    util.error('Attachment unavailable.', 'Unauthorized');
  }
  ctx.stash.verifiedAttachmentKey = ctx.result.attachmentKey;
  return null;
}
