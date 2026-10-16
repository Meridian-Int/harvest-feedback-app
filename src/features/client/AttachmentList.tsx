import { useEffect, useState, type ComponentType, type ButtonHTMLAttributes } from 'react';

function FileItem({ file, onRemove, Button }: { file: File; onRemove: () => void; Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement>> }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const preview = URL.createObjectURL(file); setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  const kind = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name) ? 'video' : 'image';
  return <li className="client-attachment">
    <span className="client-attachment-thumb" data-kind={kind}>{url && (kind === 'image' ? <img src={url} alt="" /> : <video src={url} muted playsInline aria-hidden="true" />)}</span>
    <span className="client-attachment-info"><span title={file.name}>{file.name}</span><small>{kind === 'video' ? 'Recording' : 'Image'} · {(file.size / 1048576).toFixed(1)} MB</small></span>
    <Button type="button" className="client-attachment-remove" aria-label={`Remove ${file.name}`} onClick={onRemove}>×</Button>
  </li>;
}

/** HARVEST-style file list: one row per file with a thumbnail, its size and a remove button. */
export function AttachmentList({ files, limit, onRemove, Button }: { files: readonly File[]; limit: number; onRemove: (index: number) => void; Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement>> }) {
  if (!files.length) return null;
  return <div className="client-attachments">
    <div className="client-attachments-head"><span>Attached files</span><span className="client-helper" aria-live="polite">{files.length} of {limit}</span></div>
    <ul aria-label="Attached files">{files.map((file, index) => <FileItem key={`${file.name}-${file.size}-${file.lastModified}-${index}`} file={file} onRemove={() => onRemove(index)} Button={Button} />)}</ul>
  </div>;
}
