import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

const PRODUCT_AREAS = [
  'Onboarding', 'Data room', 'Payment — payout account setup',
  'Partner portfolio', 'Operations console', 'Other — add an area',
];
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
// Keep in sync with DEFAULT_ASSIGNEE in src/lib/options.ts until HARVEST users are connected.
const DEFAULT_ASSIGNEE = 'admin@example.com';

const MAX_ATTACHMENTS = 5;

/** Legacy single-file arguments plus the `attachments` list, as one array. */
// Keep in sync with verify-attachment.js; resolver files are deployed separately.
function submittedAttachments(args) {
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
  const identity = ctx.identity;
  const claims = identity?.claims ?? {};
  // The preceding Lambda verifies live HARVEST membership in staging mode.
  // Existing Feedback-pool users retain the legacy claims path during migration.
  const harvest = ctx.prev?.result;
  if (harvest && (harvest.sub !== identity?.sub || harvest.username !== identity?.username)) {
    util.error('Could not verify your HARVEST account.', 'Unauthorized');
  }
  const accountPersona = harvest?.persona ?? claims['custom:clientPersona'] ?? claims['custom:persona'];
  const company = harvest?.company ?? claims['custom:company'];
  const reporterName = harvest?.reporterName ?? claims.name;
  const reporterEmail = harvest?.reporterEmail ?? claims.email;
  if (!identity?.sub || !identity.username || !reporterEmail || !reporterName || !company ||
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
  const severityByPriority = { BLOCKER: 'CRITICAL', BUG: 'MEDIUM', IMPROVEMENT: 'LOW' };
  if (severityByPriority[args.priority] !== args.severity) {
    util.error('Please choose a valid priority and severity.', 'InvalidInput');
  }
  const customArea = args.customArea?.trim();
  if (args.productArea === 'Other — add an area' && (!customArea || customArea.length > 80)) {
    util.error('Please name the product area (up to 80 characters).', 'InvalidInput');
  }
  if (args.sentryIssueId && !(harvest ? harvest.admin : (claims['cognito:groups'] ?? []).indexOf('admins') >= 0)) {
    util.error('Admin access required.', 'Unauthorized');
  }

  const attachments = submittedAttachments(args);
  const verifiedKeys = ctx.stash?.verifiedAttachmentKeys ?? (ctx.stash?.verifiedAttachmentKey ? [ctx.stash.verifiedAttachmentKey] : []);
  if (attachments.length !== (attachments.length ? verifiedKeys.length : 0)) {
    util.error('Attachment unavailable.', 'InvalidInput');
  }
  attachments.forEach((attachment, index) => {
    if (verifiedKeys[index] !== attachment.attachmentKey || !attachment.attachmentKey?.startsWith('feedback-media/') || !attachment.attachmentName ||
        FILE_TYPES.indexOf(attachment.attachmentType?.split(';')[0]) < 0 || attachment.attachmentSize == null ||
        attachment.attachmentSize <= 0 || attachment.attachmentSize > MAX_ATTACHMENT_BYTES) {
      util.error('Attachment unavailable.', 'InvalidInput');
    }
  });
  const hasAttachment = attachments.length > 0;

  const now = util.time.nowISO8601();
  const id = util.autoId();
  const item = {
    id,
    title: description.split('\n')[0].trim().slice(0, 110),
    description,
    productArea: args.productArea,
    priority: args.priority,
    severity: args.severity,
    reporterName,
    reporterEmail,
    persona,
    company,
    owner: `${identity.sub}::${identity.username}`,
    status: 'NEW',
    assignee: DEFAULT_ASSIGNEE,
    createdAt: now,
    updatedAt: now,
    ...(args.productArea === 'Other — add an area' ? { customArea } : {}),
    // The single fields mirror the first file for older clients.
    ...(hasAttachment ? {
      attachmentKey: attachments[0].attachmentKey,
      attachmentName: attachments[0].attachmentName,
      attachmentType: attachments[0].attachmentType,
      attachmentSize: attachments[0].attachmentSize,
      attachments: JSON.stringify(attachments),
    } : {}),
    ...(args.sentryIssueId ? { sentryIssueId: args.sentryIssueId } : {}),
  };
  return ddb.put({ key: { id }, item, condition: { id: { attributeExists: false } } });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  ctx.stash.submittedFeedback = ctx.result;
  return ctx.result;
}
