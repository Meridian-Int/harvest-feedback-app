import { useEffect, useState } from 'react';
import { Icon } from '../../components/icons';
import { Button, Dialog, Pill, ProgressTrack, Select } from '../../components/ui';
import { adminUpdate, getAttachmentUrl } from '../../lib/feedback';
import { displayId, formatDateTime } from '../../lib/format';
import { ASSIGNEES, STATUS_LABELS, STATUS_ORDER } from '../../lib/options';
import type { Feedback, Status } from '../../lib/types';

function AttachmentPreview({ report }: { report: Feedback }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'none' | 'loading' | 'ready' | 'unavailable'>('none');
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!report.attachmentKey) {
      setState(report.attachmentName ? 'unavailable' : 'none');
      return;
    }
    setState('loading');
    getAttachmentUrl(report.attachmentKey).then(value => {
      if (active) { setUrl(value); setState('ready'); }
    }).catch(() => { if (active) setState('unavailable'); });
    return () => { active = false; };
  }, [report.attachmentKey, report.attachmentName]);

  return <section className="admin-attachment"><h3>Attachments</h3>
    {state === 'none' && <p className="helper">No attachments on this report.</p>}
    {state === 'loading' && <p className="helper">Loading attachment…</p>}
    {state === 'unavailable' && <p className="helper">Attachment is unavailable.</p>}
    {state === 'ready' && url && <div className="admin-attachment-media">
      {report.attachmentType?.startsWith('image/') ? <img src={url} alt="Attached screenshot" /> :
        report.attachmentType?.startsWith('video/') ? <video src={url} controls preload="metadata" aria-label="Attached recording" /> : <p className="helper">Preview is unavailable.</p>}
      <a className="btn btn-quiet" href={url} download={report.attachmentName || 'attachment'}><Icon name="download" />Download attachment</a>
    </div>}
    {report.attachmentName && <p className="helper admin-attachment-name">{report.attachmentName}</p>}
  </section>;
}

export function ReviewDetail({ report, onClose, onSaved }: { report: Feedback; onClose: () => void; onSaved: (report: Feedback) => void }) {
  const [status, setStatus] = useState<Status>(report.status);
  const [assignee, setAssignee] = useState(report.assignee ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setStatus(report.status); setAssignee(report.assignee ?? ''); setError(null); }, [report.id, report.status, report.assignee]);

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
    <label className="admin-detail-control">Owner<Select aria-label="Report owner" value={assignee} onChange={event => setAssignee(event.target.value)}>{ASSIGNEES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
    <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
  </>}>
    <div className="admin-detail-content"><h2>{report.title}</h2><div className="admin-detail-badges"><Pill value={report.priority} /><Pill value={report.severity} /></div>
      <ProgressTrack status={report.status} />
      <span className="admin-detail-label">Description</span><p className="admin-detail-copy">{report.description}</p>
      <AttachmentPreview report={report} />
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  </Dialog>;
}
