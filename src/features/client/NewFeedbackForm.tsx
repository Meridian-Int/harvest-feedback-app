import { useEffect, useRef, useState } from 'react';
import type { ClientProps, Draft, Feedback } from './contract';
import { emptyDraft, validateDraft } from './logic/form';
import { clearDraft, readDraft, saveDraft } from './logic/draft';
import { ACCEPT, checkFile } from './logic/file';
import { findDuplicates } from './logic/duplicates';
import { displayId } from './logic/reports';
import { submitFeedback } from './logic/submit';
import { ScreenRecorderDialog } from './ScreenRecorderDialog';
import './client.css';

export function NewFeedbackForm({ api, choices, controls, draftScope, onSubmitted, onOpenReport }: ClientProps & { onSubmitted: (report: Feedback) => void; onOpenReport: (id: string) => void }) {
  const [draft, setDraft] = useState(() => { try { return readDraft(localStorage, draftScope, choices); } catch { return emptyDraft(); } });
  const [draftStatus, setDraftStatus] = useState(draft.description ? 'Saved draft restored' : 'Draft saves automatically');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
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
  useEffect(() => {
    if (!file) { setUrl(''); return; }
    const preview = URL.createObjectURL(file); setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  const edit = (key: keyof Draft, value: string) => {
    const next = { ...draft, [key]: value }; setDraft(next);
    try { setDraftStatus(saveDraft(localStorage, draftScope, next) ? 'Draft saved on this device' : 'Draft saving unavailable'); }
    catch { setDraftStatus('Draft saving unavailable'); }
    setErrors({}); setError('');
  };
  const selectFile = (selected?: File) => {
    if (!selected || locked.current) return;
    const failure = checkFile(selected, choices.maxAttachmentBytes);
    if (failure) { setError(failure); return; }
    setFile(selected); setError('');
  };
  const area = draft.productArea === choices.otherArea ? draft.customArea.trim() : draft.productArea;
  const duplicates = findDuplicates(draft.description, area, reports);
  async function submit() {
    if (locked.current) return;
    const result = validateDraft(draft, choices); setErrors(result.errors); setError(result.message);
    if (result.first) { form.current?.querySelector<HTMLElement>(`[name="${result.first}"]`)?.focus(); return; }
    locked.current = true; setSaving(true);
    try {
      const report = await submitFeedback(api, choices, draft, file);
      let cleared = false;
      try { cleared = clearDraft(localStorage, draftScope); } catch { /* unavailable browser storage */ }
      setDraft(emptyDraft()); setFile(null); setDraftStatus(cleared ? 'Draft saves automatically' : 'Draft saving unavailable');
      setMessage(cleared ? 'Feedback submitted. You can track it in My reports.' : 'Feedback submitted. The saved draft could not be cleared on this device.');
      onSubmitted(report);
    } catch { setError('Could not submit feedback. Your draft is preserved. Try again or remove the file.'); }
    finally { locked.current = false; setSaving(false); }
  }
  const { Panel, Button, Input, Select, Textarea } = controls;
  const described = (key: keyof Draft) => errors[key] ? { 'aria-invalid': true as const, 'aria-describedby': `${key}-error` } : {};
  const priorityHelp: Record<string, string> = { BLOCKER: 'Blocker: you cannot continue.', BUG: 'Bug: something works incorrectly.', IMPROVEMENT: 'Improvement: an idea to make it better.' };
  const fieldError = (key: keyof Draft) => errors[key] && <span className="client-error" id={`${key}-error`}>Please {errors[key]}.</span>;
  return <section className="harvest-client client-new">
    <header className="client-pagehead"><span className="client-helper">Client workspace</span><h1>Share your feedback</h1><p>Report an issue or suggest an improvement to Harvest.</p></header>
    <Panel className="client-panel"><header className="client-panel-head"><h2>New feedback</h2><span className="client-helper" role="status">{draftStatus}</span></header>
      <form ref={form} className="client-form" noValidate onSubmit={event => { event.preventDefault(); void submit(); }} onPaste={event => { const pasted = event.clipboardData.files[0]; if (pasted) { event.preventDefault(); selectFile(pasted); } }}>
        <fieldset disabled={saving}>
          <div className="client-field"><label htmlFor="productArea">Product area *</label><Select id="productArea" name="productArea" value={draft.productArea} onChange={event => edit('productArea', event.target.value)} {...described('productArea')}><option value="">Choose a product area</option>{choices.productAreas.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>{fieldError('productArea')}</div>
          {draft.productArea === choices.otherArea && <div className="client-field"><label htmlFor="customArea">Name the area *</label><Input id="customArea" name="customArea" maxLength={80} placeholder="e.g. Notifications or account settings" value={draft.customArea} onChange={event => edit('customArea', event.target.value)} {...described('customArea')} />{fieldError('customArea')}</div>}
          <div className="client-two">{(['priority', 'severity'] as const).map(key => <div className="client-field" key={key}><label htmlFor={key}>{key === 'priority' ? 'Priority' : 'Severity'} *</label><Select name={key} id={key} value={draft[key]} onChange={event => edit(key, event.target.value)} {...described(key)} aria-describedby={[key === 'priority' ? 'client-priority-help' : '', errors[key] ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined}><option value="">{key === 'priority' ? 'Choose a priority' : 'Choose severity'}</option>{choices[key === 'priority' ? 'priorities' : 'severities'].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>{fieldError(key)}</div>)}</div>
          <p id="client-priority-help" className="client-helper client-priority-help" aria-live="polite">{priorityHelp[draft.priority] || 'Select a priority to see its description.'}</p>
          {!!duplicates.length && <aside className="client-duplicates" aria-live="polite"><h3>Similar reports already exist</h3><p className="client-helper">Check these before submitting, or continue with a new report.</p>{duplicates.map(report => <Button type="button" key={report.id} onClick={() => onOpenReport(report.id)}>{displayId(report.id)} · {report.title}</Button>)}</aside>}
          {duplicateError && <p className="client-helper">Similar reports could not be checked. You can still submit feedback.</p>}
          <div className="client-field"><label htmlFor="description">Description *</label><Textarea name="description" id="description" maxLength={3000} placeholder="Describe the bug or the improvement you have in mind." value={draft.description} onChange={event => edit('description', event.target.value)} {...described('description')} /><div className="client-field-foot"><span className="client-helper">Keep it brief and specific.</span><span className="client-helper" aria-live="polite">{draft.description.length} / 3000</span></div>{fieldError('description')}</div>
          <div className="client-field"><label htmlFor="attachment">Screenshot or recording <span className="client-helper">Optional</span></label>
            <div className="client-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files.length > 1) setMessage('One attachment per report. Using the first file.'); selectFile(event.dataTransfer.files[0]); }}>
              <label htmlFor="attachment"><svg className="client-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" /></svg><br /><b>Choose a file</b> or drag it here<span className="client-helper">PNG, JPG, WebP, MP4, WebM or MOV · up to 50 MB</span></label>
              <input id="attachment" type="file" accept={ACCEPT} onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
              {file && <div className="client-attachment">{file.type.startsWith('image/') ? <img src={url} alt="Attachment preview" /> : file.type.startsWith('video/') ? <video src={url} controls aria-label="Attachment preview" /> : null}<span>{file.name}<small>{file.type || 'File'} · {(file.size / 1048576).toFixed(1)} MB</small></span><Button type="button" aria-label="Remove attachment" onClick={() => setFile(null)}>×</Button></div>}
            </div>
            {draftStatus === 'Saved draft restored' && !file && <span className="client-helper">Files are not saved with drafts. Attach your file again.</span>}
            <div className="client-capture-controls"><Button type="button" onClick={() => setRecording(true)}>Record screen now</Button><span className="client-helper">Up to 3 minutes · screen only, no microphone</span></div>
          </div>
          {error && <p className="client-error" role="alert">{error}</p>}
          <footer className="client-form-footer"><Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit feedback'}</Button></footer>
        </fieldset>
      </form>
    </Panel>
    {message && <p className="client-toast" role="status">{message}</p>}
    {recording && <ScreenRecorderDialog controls={controls} replacing={!!file} onAttach={selectFile} onClose={() => setRecording(false)} />}
  </section>;
}
