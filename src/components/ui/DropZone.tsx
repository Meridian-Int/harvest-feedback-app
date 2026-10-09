import { useEffect, useId, useState, type DragEvent } from 'react';
import { ATTACHMENT_ACCEPT } from '../../lib/options';
import { formatFileSize } from '../../lib/format';
import { Icon } from '../icons';
import { IconButton } from './IconButton';

export function DropZone({ file, onFileChange, disabled = false }: {
  file: File | null; onFileChange: (file: File | null) => void; disabled?: boolean;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!disabled && event.dataTransfer.files[0]) onFileChange(event.dataTransfer.files[0]);
  }
  return <div className={`drop ${dragging ? 'drag' : ''}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <label className="file-label" htmlFor={id}>
      <input id={id} type="file" accept={ATTACHMENT_ACCEPT} disabled={disabled} onChange={event => { if (event.target.files?.[0]) onFileChange(event.target.files[0]); event.target.value = ''; }} />
      <Icon name="upload" /><div><b>Choose a file</b> or drag it here</div><div className="helper">PNG, JPG, WebP, MP4, WebM or MOV · up to 50 MB</div>
    </label>
    {file && <div className="attachment">
      {url && (file.type.startsWith('image/') ? <img src={url} alt="Attachment preview" /> : file.type.startsWith('video/') ? <video src={url} controls aria-label="Attachment preview" /> : <Icon name="video" />)}
      <span>{file.name}<small className="helper block">{formatFileSize(file.size)}</small></span>
      <IconButton label="Remove attachment" disabled={disabled} onClick={() => onFileChange(null)}><Icon name="close" /></IconButton>
    </div>}
  </div>;
}
