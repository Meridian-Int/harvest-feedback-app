import { useRef, useState } from 'react';
import { recordingClock } from './logic/recorder';

export function RecordingPreview({ src, recordedSeconds = 0 }: { src: string; recordedSeconds?: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(recordedSeconds);
  const [error, setError] = useState('');
  const [pipAvailable, setPipAvailable] = useState(false);
  function updateDuration() {
    const value = video.current?.duration ?? 0;
    setDuration(Number.isFinite(value) && value > 0 ? value : recordedSeconds);
    setPipAvailable(Boolean(document.pictureInPictureEnabled && video.current?.requestPictureInPicture));
  }
  async function toggle() {
    if (!video.current) return;
    if (playing) video.current.pause();
    else try { await video.current.play(); setError(''); }
    catch { setError('Could not play the recording. Try again.'); }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else {
        const player = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        if (!player?.webkitEnterFullscreen) throw new Error('Unavailable');
        player.webkitEnterFullscreen();
      }
      setError('');
    } catch { setError('Fullscreen is unavailable in this browser.'); }
  }
  async function pictureInPicture() {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.current?.requestPictureInPicture();
      setError('');
    } catch { setError('Picture-in-picture is unavailable in this browser.'); }
  }
  const playIcon = <path d="M8 5v14l11-7z" fill="currentColor" />;
  return <div className="client-recording-preview">
    <div ref={stage} className="client-video-stage">
      <video ref={video} src={src} muted playsInline aria-label="Recording preview" onClick={toggle}
        onLoadedMetadata={updateDuration} onDurationChange={updateDuration}
        onTimeUpdate={() => setTime(video.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      {!playing && <button type="button" className="client-video-play" aria-label="Play recording" onClick={toggle}><svg viewBox="0 0 24 24" aria-hidden="true">{playIcon}</svg></button>}
      <div className="client-playback-controls">
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause recording' : 'Play recording from controls'}><svg viewBox="0 0 24 24" aria-hidden="true">{playing ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor" /> : playIcon}</svg></button>
        <input type="range" aria-label="Seek recording" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 1)} disabled={!duration}
          onChange={event => { const next = Number(event.target.value); if (video.current) video.current.currentTime = next; setTime(next); }} />
        <span>{recordingClock(Math.floor(time))} / {recordingClock(Math.floor(duration))}</span>
        {pipAvailable && <button type="button" aria-label="Picture-in-picture" title="Picture-in-picture" onClick={pictureInPicture}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="12" y="11" width="7" height="6" fill="currentColor" /></svg></button>}
        <button type="button" aria-label="Toggle fullscreen" title="Fullscreen" onClick={fullscreen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg></button>
      </div>
    </div>
    {error && <p className="client-error" role="alert">{error}</p>}
  </div>;
}
