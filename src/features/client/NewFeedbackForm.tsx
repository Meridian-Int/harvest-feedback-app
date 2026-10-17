import { useEffect, useRef, useState } from 'react';
import type { ClientProps, Draft, Feedback } from './contract';
import { emptyDraft, TITLE_LIMIT, validateDraft } from './logic/form';
import { clearDraft, readDraft, saveDraft } from './logic/draft';
import { ACCEPT, checkFile } from './logic/file';
import { findDuplicates } from './logic/duplicates';
import { displayId } from './logic/reports';
import { submitFeedback } from './logic/submit';
import { openWorkspaceRecorder, setWorkspaceAttachments, useRecordingWorkspace } from './recordingWorkspace';
import { AttachmentList } from './AttachmentList';
import { Icon } from '../../components/icons';
import './client.css';

export function NewFeedbackForm({ api, choices, controls, draftScope, onSubmitted, onOpenReport }: ClientProps & { onSubmitted: (report: Feedback) => void; onOpenReport: (id: string) => void }) {
  const [draft, setDraft] = useState(() => { try { return readDraft(localStorage, draftScope, choices); } catch { return emptyDraft(); } });
  const [draftStatus, setDraftStatus] = useState(draft.title || draft.description ? 'Saved draft restored' : 'Draft saves automatically');
  const files = useRecordingWorkspace(draftScope);
  const setFiles = (next: readonly File[]) => setWorkspaceAttachments(draftScope, next);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState<Feedback[]>([]);
  const [duplicateError, setDuplicateError] = useState(false);
  const [message, setMessage] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    api.listMyFeedback().then(result => { if (active) setReports(result); }).catch(() => { if (active) setDuplicateError(true); });
    return () => { active = false; };
  }, [api]);
  const edit = (key: keyof Draft, value: string) => {
    const next = { ...draft, [key]: value }; setDraft(next);
    try { setDraftStatus(saveDraft(localStorage, draftScope, next) ? 'Draft saved on this device' : 'Draft saving unavailable'); }
    catch { setDraftStatus('Draft saving unavailable'); }
    setErrors({}); setError('');
  };
  const selectFiles = (selected: readonly File[]) => {
    if (!selected.length || locked.current) return;
    const failure = selected.map(item => checkFile(item, choices.maxAttachmentBytes)).find(Boolean);
    const valid = selected.filter(item => !checkFile(item, choices.maxAttachmentBytes));
    const room = Math.max(0, choices.maxAttachments - files.length);
    if (valid.length) setFiles([...files, ...valid.slice(0, room)]);
    setError(failure ?? (valid.length > room ? `You can attach up to ${choices.maxAttachments} files. Remove one to add another.` : ''));
  };
  const area = draft.productArea === choices.otherArea ? draft.customArea.trim() : draft.productArea;
  const duplicates = findDuplicates(draft.description, area, reports);
  async function submit() {
    if (locked.current) return;
    const result = validateDraft(draft, choices); setErrors(result.errors); setError(result.message);
    if (result.first) { form.current?.querySelector<HTMLElement>(`[name="${result.first}"]`)?.focus(); return; }
    locked.current = true; setSaving(true);
    try {
      const report = await submitFeedback(api, choices, draft, files);
      let cleared = false;
      try { cleared = clearDraft(localStorage, draftScope); } catch { /* unavailable browser storage */ }
      setDraft(emptyDraft()); setFiles([]); setDraftStatus(cleared ? 'Draft saves automatically' : 'Draft saving unavailable');
      setMessage(cleared ? 'Feedback submitted. You can track it in My reports.' : 'Feedback submitted. The saved draft could not be cleared on this device.');
      onSubmitted(report);
    } catch { setError('Could not submit feedback. Your draft is preserved. Try again or remove a file.'); }
    finally { locked.current = false; setSaving(false); }
  }
  const { Panel, Button, Input, Select, Textarea } = controls;
  const described = (key: keyof Draft) => errors[key] ? { 'aria-invalid': true as const, 'aria-describedby': `${key}-error` } : {};
  const priorityHelp: Record<string, string> = { BLOCKER: 'Blocker: you cannot continue.', BUG: 'Bug: something works incorrectly.', IMPROVEMENT: 'Improvement: an idea to make it better.' };
  const fieldError = (key: keyof Draft) => errors[key] && <span className="client-error" id={`${key}-error`}>Please {errors[key]}.</span>;
  return <section className="harvest-client client-new">
    <header className="client-pagehead"><span className="client-page-mark" aria-hidden="true"><Icon name="feedback" /></span><div><span className="client-eyebrow">Client workspace</span><h1>Share your feedback</h1><p>Report an issue or suggest an improvement to Harvest.</p></div></header>
    <Panel className="client-panel"><header className="client-panel-head"><h2>New feedback</h2><span className="client-helper" role="status">{draftStatus}</span></header>
      <form ref={form} className="client-form" noValidate onSubmit={event => { event.preventDefault(); void submit(); }} onPaste={event => { const pasted = Array.from(event.clipboardData.files); if (pasted.length) { event.preventDefault(); selectFiles(pasted); } }}>
        <fieldset disabled={saving}>
          <div className="client-field"><label htmlFor="productArea">Category *</label><Select id="productArea" name="productArea" value={draft.productArea} onChange={event => edit('productArea', event.target.value)} {...described('productArea')}><option value="">Choose a category</option>{choices.productAreas.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>{fieldError('productArea')}</div>
          {draft.productArea === choices.otherArea && <div className="client-field"><label htmlFor="customArea">Name the category *</label><Input id="customArea" name="customArea" maxLength={80} placeholder="e.g. Notifications or account settings" value={draft.customArea} onChange={event => edit('customArea', event.target.value)} {...described('customArea')} />{fieldError('customArea')}</div>}
          <div className="client-field"><label htmlFor="priority">Priority *</label><Select name="priority" id="priority" value={draft.priority} onChange={event => edit('priority', event.target.value)} {...described('priority')} aria-describedby={['client-priority-help', errors.priority ? 'priority-error' : ''].filter(Boolean).join(' ')}><option value="">Choose a priority</option>{choices.priorities.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>{fieldError('priority')}</div>
          <p id="client-priority-help" className="client-helper client-priority-help" aria-live="polite">{priorityHelp[draft.priority] || 'Select a priority to see its description.'}</p>
          {!!duplicates.length && <aside className="client-duplicates" aria-live="polite"><h3>Similar reports already exist</h3><p className="client-helper">Check these before submitting, or continue with a new report.</p>{duplicates.map(report => <Button type="button" key={report.id} onClick={() => onOpenReport(report.id)}>{displayId(report.id)} · {report.title}</Button>)}</aside>}
          {duplicateError && <p className="client-helper">Similar reports could not be checked. You can still submit feedback.</p>}
          <div className="client-field"><label htmlFor="title">Title *</label><Input id="title" name="title" maxLength={TITLE_LIMIT} placeholder="e.g. Export button does nothing on the data room page" value={draft.title} onChange={event => edit('title', event.target.value)} {...described('title')} /><div className="client-field-foot"><span className="client-helper">Name the issue in a few words.</span><span className="client-helper" aria-live="polite">{draft.title.length} / {TITLE_LIMIT}</span></div>{fieldError('title')}</div>
          <div className="client-field"><label htmlFor="description">Description *</label><Textarea name="description" id="description" maxLength={3000} placeholder="Describe the bug or the improvement you have in mind." value={draft.description} onChange={event => edit('description', event.target.value)} {...described('description')} /><div className="client-field-foot"><span className="client-helper">Keep it brief and specific.</span><span className="client-helper" aria-live="polite">{draft.description.length} / 3000</span></div>{fieldError('description')}</div>
          <div className="client-field"><label htmlFor="attachment">Screenshots or recordings <span className="client-helper">Optional</span></label>
            <div className="client-drop" data-attached={files.length > 0} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFiles(Array.from(event.dataTransfer.files)); }}>
              <label htmlFor="attachment" className="client-upload-prompt"><Icon name="upload" className="client-icon" /><span className="client-upload-title">Drag files here, or choose them</span><span className="client-helper">Up to {choices.maxAttachments} files · PNG, JPG, WebP, MP4, WebM or MOV · up to 50 MB each</span><span className="client-upload-button">Choose files</span></label>
              <input id="attachment" type="file" multiple accept={ACCEPT} disabled={files.length >= choices.maxAttachments} onChange={event => { selectFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
            </div>
            <AttachmentList files={files} limit={choices.maxAttachments} onRemove={index => setFiles(files.filter((_, position) => position !== index))} Button={Button} />
            {draftStatus === 'Saved draft restored' && !files.length && <span className="client-helper">Files are not saved with drafts. Attach your files again.</span>}
            <div className="client-capture-controls"><Button type="button" disabled={files.length >= choices.maxAttachments} onClick={() => openWorkspaceRecorder(draftScope, controls, choices.maxAttachments)}>Record screen now</Button><span className="client-helper">Up to 3 minutes · screen only, no microphone</span></div>
          </div>
          {error && <p className="client-error" role="alert">{error}</p>}
          <footer className="client-form-footer"><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit feedback'}</Button></footer>
        </fieldset>
      </form>
    </Panel>
    {message && <p className="client-toast" role="status">{message}</p>}
  </section>;
}
