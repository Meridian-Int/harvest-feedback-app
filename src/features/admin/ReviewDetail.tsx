import { useEffect, useState } from 'react';
import { Icon } from '../../components/icons';
import { Button, Dialog, Pill, ProgressTrack, Select } from '../../components/ui';
import { adminUpdate, getAttachmentUrl } from '../../lib/feedback';
import { displayId, formatDateTime, formatFileSize } from '../../lib/format';
import { reportAttachments } from '../../lib/attachments';
import { STATUS_LABELS, STATUS_ORDER } from '../../lib/options';
import { useAssignees } from './useAssignees';
import type { Attachment, Feedback, Status } from '../../lib/types';
import { isUpdatePending } from '../../lib/status';
import { initialReviewAssignee } from './logic/review';

function AttachmentPreview({ attachment, single }: { attachment: Attachment; single: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  useEffect(() => {
    let active = true;
    let resolvedUrl: string | null = null;
    setUrl(null);
    if (!attachment.attachmentKey) { setState('unavailable'); return; }
    setState('loading');
    getAttachmentUrl(attachment.attachmentKey).then(value => {
      resolvedUrl = value;
      if (active) { setUrl(value); setState('ready'); }
      else if (value.startsWith('blob:')) URL.revokeObjectURL(value);
    }).catch(() => { if (active) setState('unavailable'); });
    return () => { active = false; if (resolvedUrl?.startsWith('blob:')) URL.revokeObjectURL(resolvedUrl); };
  }, [attachment.attachmentKey]);

  return <li className="admin-attachment-item">
    {state === 'loading' && <p className="helper">Loading attachment…</p>}
    {state === 'unavailable' && <p className="helper">Attachment is unavailable.</p>}
    {state === 'ready' && url && <div className="admin-attachment-media">
      {attachment.attachmentType?.startsWith('image/') ? <img src={url} alt={single ? 'Attached screenshot' : `Attached screenshot ${attachment.attachmentName}`} /> :
        attachment.attachmentType?.startsWith('video/') ? <video src={url} controls preload="metadata" aria-label={single ? 'Attached recording' : `Attached recording ${attachment.attachmentName}`} /> : <p className="helper">Preview is unavailable.</p>}
    </div>}
    <div className="admin-attachment-meta">
      <span className="admin-attachment-name">{attachment.attachmentName}{attachment.attachmentSize > 0 && <small className="helper"> · {formatFileSize(attachment.attachmentSize)}</small>}</span>
      {state === 'ready' && url && <a className="btn btn-quiet" href={url} download={attachment.attachmentName || 'attachment'} aria-label={single ? undefined : `Download ${attachment.attachmentName}`}><Icon name="download" />Download attachment</a>}
    </div>
  </li>;
}

function AttachmentGallery({ report }: { report: Feedback }) {
  const attachments = reportAttachments(report);
  return <section className="admin-attachment"><h3>Attachments{attachments.length > 1 && <span className="helper"> · {attachments.length} files</span>}</h3>
    {!attachments.length && <p className="helper">No attachments on this report.</p>}
    {!!attachments.length && <ul className="admin-attachment-list" data-count={attachments.length}>{attachments.map((attachment, index) => <AttachmentPreview key={attachment.attachmentKey || index} attachment={attachment} single={attachments.length === 1} />)}</ul>}
  </section>;
}

export function ReviewDetail({ report, onClose, onSaved }: { report: Feedback; onClose: () => void; onSaved: (report: Feedback) => void }) {
  const owners = useAssignees();
  const [status, setStatus] = useState<Status>(report.status);
  const [assignee, setAssignee] = useState(initialReviewAssignee(report));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setStatus(report.status); setAssignee(initialReviewAssignee(report)); setError(null); }, [report.id, report.status, report.assignee, report.adminActivityAt]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await adminUpdate(report.id, { status, assignee }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the report.');
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open onClose={onClose} title={<span className="admin-detail-id">{displayId(report.id)} · {formatDateTime(report.createdAt)}</span>} footer={<>
    <label className="admin-detail-control">Status<Select aria-label="Report status" value={status} onChange={event => setStatus(event.target.value as Status)}>{STATUS_ORDER.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</Select></label>
    <label className="admin-detail-control">Owner<Select aria-label="Report owner" value={assignee} onChange={event => setAssignee(event.target.value)}>{assignee && !owners.options.some(item => item.value === assignee) && <option value={assignee}>Previous owner</option>}{owners.options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
    <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : isUpdatePending(report) ? 'Send update' : 'Save'}</Button>
  </>}>
    <div className="admin-detail-content"><h2>{report.title}</h2><div className="admin-detail-badges"><Pill value={report.priority} />{report.priority === 'BLOCKER' && <Pill value="CRITICAL" />}</div>
      <ProgressTrack status={report.status} />
      <span className="admin-detail-label">Description</span><p className="admin-detail-copy">{report.description}</p>
      <AttachmentGallery report={report} />
      {error && <p className="error" role="alert">{error}</p>}
      {owners.error && <p className="error" role="alert">{owners.error}</p>}
    </div>
  </Dialog>;
}
