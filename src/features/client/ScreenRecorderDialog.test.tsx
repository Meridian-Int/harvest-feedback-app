import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ScreenRecorderDialog } from './ScreenRecorderDialog';
import { controls } from './testing/support';
import { StrictMode } from 'react';

function browser() {
  const stop = vi.fn(), ended = new EventTarget();
  const track = { stop, addEventListener: ended.addEventListener.bind(ended) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const getDisplayMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia } });
  class Recorder {
    static latest: Recorder;
    static isTypeSupported = vi.fn(() => true);
    state = 'inactive'; mimeType = 'video/webm';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    onerror?: () => void;
    constructor() { Recorder.latest = this; }
    start() { this.state = 'recording'; }
    stop() { if (this.state === 'inactive') return; this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['recorded'], { type: this.mimeType }) }); this.onstop?.(); }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  return { stop, ended, getDisplayMedia, Recorder };
}
function mount(replacing = false) {
  const onAttach = vi.fn(), onClose = vi.fn();
  const view = render(<ScreenRecorderDialog controls={controls} replacing={replacing} onAttach={onAttach} onClose={onClose} />);
  return { ...view, onAttach, onClose, user: userEvent.setup() };
}
it('reports unavailable API and unavailable MIME', async () => {
  const { user, unmount } = mount(); await user.click(screen.getByRole('button', { name: 'Start recording' })); expect(screen.getByRole('alert')).toHaveTextContent('not supported');
  unmount(); const { Recorder } = browser(); Recorder.isTypeSupported.mockReturnValue(false);
  const next = mount(); await next.user.click(screen.getByRole('button', { name: 'Start recording' })); expect(screen.getByRole('alert')).toHaveTextContent('cannot encode');
});
it('reports permission denial without attaching', async () => {
  const { getDisplayMedia } = browser(); getDisplayMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
  const { user, onAttach } = mount(); await user.click(screen.getByRole('button', { name: 'Start recording' })); expect(await screen.findByRole('alert')).toHaveTextContent('permission was not granted'); expect(onAttach).not.toHaveBeenCalled();
});
it('requests no microphone, stops tracks and attaches only after replacement confirmation', async () => {
  const { getDisplayMedia, stop } = browser(); const { user, onAttach } = mount(true);
  await user.click(screen.getByRole('button', { name: 'Start recording' })); expect(getDisplayMedia).toHaveBeenCalledWith({ video: { frameRate: 15 }, audio: false });
  await user.click(screen.getByRole('button', { name: 'Stop recording' })); expect(stop).toHaveBeenCalled(); expect(onAttach).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Attach recording' })); expect(onAttach).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Replace attachment' })); expect(onAttach).toHaveBeenCalledWith(expect.objectContaining({ type: 'video/webm' }));
});
it('stops at 180 seconds and on track ending', async () => {
  const { Recorder, ended } = browser(); mount(); vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' })); await act(async () => { await Promise.resolve(); });
  act(() => vi.advanceTimersByTime(180000)); expect(Recorder.latest.state).toBe('inactive'); expect(screen.getByRole('button', { name: 'Attach recording' })).toBeInTheDocument();
  vi.useRealTimers();
  // A completed capture cannot restart itself when the browser ends its track.
  act(() => ended.dispatchEvent(new Event('ended'))); expect(Recorder.latest.state).toBe('inactive');
});
it('stops on collected size and refuses an oversize final result', async () => {
  const { Recorder, stop } = browser(); const { user } = mount(); await user.click(screen.getByRole('button', { name: 'Start recording' }));
  act(() => Recorder.latest.ondataavailable?.({ data: new Blob([new Uint8Array(50 * 1024 * 1024 + 1)]) }));
  expect(stop).toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('empty or too large'); expect(screen.queryByRole('button', { name: 'Attach recording' })).not.toBeInTheDocument();
});
it('cleans up on Escape, discard, unmount and revokes preview URLs', async () => {
  const { stop } = browser(); const { user, onAttach, onClose, unmount } = mount();
  await user.click(screen.getByRole('button', { name: 'Start recording' })); await user.click(screen.getByRole('button', { name: 'Stop recording' }));
  await user.click(screen.getByRole('button', { name: 'Discard' })); expect(onAttach).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true })); expect(onClose).toHaveBeenCalledTimes(2);
  unmount(); expect(stop).toHaveBeenCalled(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
});
it('stops capture that resolves after the dialog unmounts', async () => {
  const { getDisplayMedia, stop } = browser(); let resolve!: (value: unknown) => void;
  getDisplayMedia.mockReturnValue(new Promise(done => { resolve = done; }));
  const { user, unmount, onAttach } = mount(); await user.click(screen.getByRole('button', { name: 'Start recording' })); unmount();
  await act(async () => resolve({ getTracks: () => [{ stop }] })); expect(stop).toHaveBeenCalled(); expect(onAttach).not.toHaveBeenCalled();
});
it('ends an active recording when its browser track ends', async () => {
  const { ended, Recorder } = browser(); const { user } = mount(); await user.click(screen.getByRole('button', { name: 'Start recording' }));
  act(() => ended.dispatchEvent(new Event('ended'))); expect(Recorder.latest.state).toBe('inactive'); expect(screen.getByRole('button', { name: 'Attach recording' })).toBeInTheDocument();
});
it('attaches without replacement and closes active recording without attaching', async () => {
  browser(); const first = mount(); await first.user.click(screen.getByRole('button', { name: 'Start recording' })); await first.user.click(screen.getByRole('button', { name: 'Stop recording' }));
  await first.user.click(screen.getByRole('button', { name: 'Attach recording' })); expect(first.onAttach).toHaveBeenCalledTimes(1); first.unmount();
  const { stop } = browser(); const next = mount(); await next.user.click(screen.getByRole('button', { name: 'Start recording' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await next.user.click(screen.getByRole('button', { name: 'Discard recording' })); expect(stop).toHaveBeenCalled(); expect(next.onAttach).not.toHaveBeenCalled(); expect(next.onClose).toHaveBeenCalled();
});
it('stops and reports recorder errors; pagehide cleans up', async () => {
  const { Recorder, stop } = browser(); const { user, onAttach } = mount(); await user.click(screen.getByRole('button', { name: 'Start recording' }));
  act(() => Recorder.latest.onerror?.()); expect(stop).toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('Recording failed'); expect(onAttach).not.toHaveBeenCalled();
  fireEvent(window, new Event('pagehide')); expect(Recorder.latest.state).toBe('inactive');
});
it('works when StrictMode replays effect cleanup', async () => {
  browser(); const onAttach = vi.fn();
  render(<StrictMode><ScreenRecorderDialog controls={controls} replacing={false} onAttach={onAttach} onClose={vi.fn()} /></StrictMode>);
  const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Start recording' }));
  await user.click(screen.getByRole('button', { name: 'Stop recording' })); await user.click(screen.getByRole('button', { name: 'Attach recording' })); expect(onAttach).toHaveBeenCalledTimes(1);
});

it('releases the modal while capturing and reopens preview after Stop', async () => {
  const { Recorder, stop } = browser();
  const { user, onClose, onAttach } = mount();
  await user.click(screen.getByRole('button', { name: 'Start recording' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Screen recording controls')).toBeInTheDocument();
  expect(Recorder.latest.state).toBe('recording');
  expect(stop).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Stop recording' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Attach recording' })).toBeInTheDocument();
  expect(onAttach).not.toHaveBeenCalled();
});
