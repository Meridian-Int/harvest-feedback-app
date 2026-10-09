import { Panel, Button, Input, Select, Textarea } from '../../components/ui';
import * as feedback from '../../lib/feedback';
import { MAX_ATTACHMENT_BYTES, PRODUCT_AREAS, PRIORITY_LABELS, SEVERITY_LABELS } from '../../lib/options';
import type { Priority, Severity } from '../../lib/types';
import type { ClientApi, ClientControls, Choices } from './contract';

export const clientControls: ClientControls = { Panel, Button, Input, Select, Textarea };
export const clientChoices: Choices = {
  productAreas: PRODUCT_AREAS.map(value => ({ value, label: value })),
  priorities: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
  severities: Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label })),
  otherArea: 'Other — add an area', maxAttachmentBytes: MAX_ATTACHMENT_BYTES,
};
export const clientApi: ClientApi = {
  listMyFeedback: () => feedback.listMyFeedback(),
  getFeedback: id => feedback.getFeedback(id),
  createFeedback: input => feedback.createFeedback({
    description: input.description, productArea: input.productArea, customArea: input.customArea,
    priority: input.priority as Priority, severity: input.severity as Severity,
    ...(input.attachmentKey ? { attachmentKey: input.attachmentKey, attachmentName: input.attachmentName,
      attachmentType: input.attachmentType, attachmentSize: input.attachmentSize } : {}),
  }),
  uploadAttachment: file => feedback.uploadAttachment(file),
  removeAttachment: key => feedback.removeAttachment(key),
  requestUpdate: async id => { await feedback.requestUpdate(id); },
  subscribeMyFeedback: (next, error) => feedback.subscribeMyFeedback(next, error),
};
