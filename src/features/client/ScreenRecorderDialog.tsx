import { useEffect, useRef, useState } from 'react';
import type { ClientControls } from './contract';
import { ClientDialog } from './ClientDialog';
import { chooseRecordingMime, recordingClock, shouldStopRecording, validRecordingSize } from './logic/recorder';

export function ScreenRecorderDialog({ controls, replacing, onAttach, onClose }: { controls: ClientControls; replacing: boolean; onAttach: (file: File) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'choosing' | 'recording' | 'preview' | 'error'>('ready');
  const [message, setMessage] = useState('Choose a tab, window or screen in your browser’s sharing picker.');
  const [url, setUrl] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const session = useRef({ cancelled: false, stream: null as MediaStream | null, recorder: null as MediaRecorder | null, timer: undefined as ReturnType<typeof setInterval> | undefined, url: '', file: null as File | null });
  const busy = useRef(false);
  const stop = () => {
    const current = session.current;
    clearInterval(current.timer);
    if (current.recorder && current.recorder.state !== 'inactive') current.recorder.stop();
    current.stream?.getTracks().forEach(track => track.stop());
    current.stream = null;
  };
  const discard = () => { session.current.cancelled = true; stop(); onClose(); };
  useEffect(() => {
    const current = session.current;
    // React StrictMode replays effect setup/cleanup in development.
    current.cancelled = false;
    const leave = () => { current.cancelled = true; stop(); };
    window.addEventListener('pagehide', leave);
    return () => { leave(); if (current.url) URL.revokeObjectURL(current.url); window.removeEventListener('pagehide', leave); };
  }, []);
  async function start() {
    if (busy.current) return;
    const current = session.current;
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setPhase('error'); setMessage('Screen recording is not supported here. Use a browser that supports screen sharing, or upload an existing recording.'); return;
    }
    const mime = chooseRecordingMime(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { setPhase('error'); setMessage('This browser cannot encode a supported recording. Upload an existing recording instead.'); return; }
    busy.current = true; setPhase('choosing');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      if (current.cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
      current.recorder = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (shouldStopRecording(0, bytes)) stop(); } };
      recorder.onerror = () => { current.cancelled = true; stop(); setPhase('error'); setMessage('Recording failed. Close this window and try again.'); };
      recorder.onstop = () => {
        clearInterval(current.timer);
        current.stream?.getTracks().forEach(track => track.stop()); current.stream = null;
        if (current.cancelled) return;
        const type = (recorder.mimeType || mime).split(';')[0];
        const blob = new Blob(chunks, { type });
        if (!validRecordingSize(blob.size)) { setPhase('error'); setMessage('The recording is empty or too large. Close this window and try a shorter recording.'); return; }
        current.file = new File([blob], `harvest-recording-${Date.now()}.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
        current.url = URL.createObjectURL(blob); setUrl(current.url); setPhase('preview');
        setMessage(`Review your recording (${(blob.size / 1048576).toFixed(1)} MB), then attach it.`);
      };
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', stop, { once: true }));
      const started = Date.now();
      recorder.start(1000); setPhase('recording'); setMessage('Recording · 0:00');
      current.timer = setInterval(() => {
        const seconds = Math.floor((Date.now() - started) / 1000);
        setMessage(`Recording · ${recordingClock(seconds)}`);
        if (shouldStopRecording(seconds, bytes)) stop();
      }, 1000);
    } catch (error) {
      stop();
      if (!current.cancelled) {
        const denied = !!error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError';
        setPhase('error'); setMessage(denied ? 'Screen sharing was cancelled or permission was not granted. You can try again or upload a file.' : 'Could not start screen recording in this browser. You can upload an existing recording instead.');
      }
    } finally { busy.current = false; }
  }
  function attach() {
    if (!session.current.file) return;
    if (replacing && !confirmReplace) { setConfirmReplace(true); return; }
    onAttach(session.current.file); discard();
  }
  const { Button } = controls;
  // Release the native modal while capturing so the shared screen stays interactive.
  // The recorder component remains mounted until Stop/Discard or page exit.
  if (phase === 'recording') return <aside className="client-recording-bar" aria-label="Screen recording controls">
    <span role="status">{message}</span>
    <Button onClick={stop}>Stop recording</Button>
    <Button onClick={discard}>Discard recording</Button>
  </aside>;
  return <ClientDialog title="Screen recording" onClose={discard}>
    <div className="client-detail-body">
      <p role={phase === 'error' ? 'alert' : 'status'}>{message}</p>
      {url && <video src={url} controls playsInline aria-label="Recording preview" />}
      {confirmReplace && <p role="alert">Replace the current attachment with this recording?</p>}
      <div className="client-capture-controls">
        {phase === 'ready' && <Button onClick={start}>Start recording</Button>}
        {phase === 'preview' && <Button onClick={attach}>{confirmReplace ? 'Replace attachment' : 'Attach recording'}</Button>}
        <Button onClick={discard}>{phase === 'preview' ? 'Discard' : 'Cancel'}</Button>
      </div>
      <p className="client-helper">Your browser asks which screen to share. Review the recording before attaching it. Nothing is uploaded.</p>
    </div>
  </ClientDialog>;
}
