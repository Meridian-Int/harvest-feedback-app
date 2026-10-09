import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

const PRODUCT_AREAS = [
  'Onboarding', 'Data room', 'Payment — payout account setup',
  'Partner portfolio', 'Operations console', 'Other — add an area',
];
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function request(ctx) {
  const identity = ctx.identity;
  const claims = identity?.claims ?? {};
  const accountPersona = claims['custom:clientPersona'] ?? claims['custom:persona'];
  const company = claims['custom:company'];
  if (!identity?.sub || !identity.username || !claims.email || !claims.name || !company ||
      ['Company', 'Partner', 'Operator'].indexOf(accountPersona) < 0) {
    util.error('Your account profile is incomplete. Contact an administrator.', 'InvalidProfile');
  }

  const args = ctx.args;
  const persona = accountPersona;
  const description = args.description.trim();
  if (!description || description.length > 3000) {
    util.error('Please describe the bug or improvement (up to 3000 characters).', 'InvalidInput');
  }
  if (PRODUCT_AREAS.indexOf(args.productArea) < 0) {
    util.error('Please choose a product area.', 'InvalidInput');
  }
  const customArea = args.customArea?.trim();
  if (args.productArea === 'Other — add an area' && (!customArea || customArea.length > 80)) {
    util.error('Please name the product area (up to 80 characters).', 'InvalidInput');
  }
  if (args.sentryIssueId && (claims['cognito:groups'] ?? []).indexOf('admins') < 0) {
    util.error('Admin access required.', 'Unauthorized');
  }

  const hasAttachment = !!(args.attachmentKey || args.attachmentName || args.attachmentType || args.attachmentSize != null);
  if (hasAttachment && (ctx.stash?.verifiedAttachmentKey !== args.attachmentKey || !args.attachmentKey?.startsWith('feedback-media/') || !args.attachmentName ||
      FILE_TYPES.indexOf(args.attachmentType?.split(';')[0]) < 0 || args.attachmentSize == null ||
      args.attachmentSize <= 0 || args.attachmentSize > MAX_ATTACHMENT_BYTES)) {
    util.error('Attachment unavailable.', 'InvalidInput');
  }

  const now = util.time.nowISO8601();
  const id = util.autoId();
  const item = {
    id,
    title: description.split('\n')[0].trim().slice(0, 110),
    description,
    productArea: args.productArea,
    priority: args.priority,
    severity: args.severity,
    reporterName: claims.name,
    reporterEmail: claims.email,
    persona,
    company,
    owner: `${identity.sub}::${identity.username}`,
    status: 'NEW',
    createdAt: now,
    updatedAt: now,
    ...(args.productArea === 'Other — add an area' ? { customArea } : {}),
    ...(hasAttachment ? {
      attachmentKey: args.attachmentKey,
      attachmentName: args.attachmentName,
      attachmentType: args.attachmentType,
      attachmentSize: args.attachmentSize,
    } : {}),
    ...(args.sentryIssueId ? { sentryIssueId: args.sentryIssueId } : {}),
  };
  return ddb.put({ key: { id }, item, condition: { id: { attributeExists: false } } });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.result;
}
