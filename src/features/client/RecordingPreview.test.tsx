import { fireEvent, render, screen } from '@testing-library/react';
import { RecordingPreview } from './RecordingPreview';

it('plays, pauses and seeks without native sound controls, and offers fullscreen', () => {
  render(<RecordingPreview src="blob:recording" recordedSeconds={8} />);
  const video = screen.getByLabelText('Recording preview') as HTMLVideoElement;
  expect(video.controls).toBe(false);
  expect(video.muted).toBe(true);
  const play = vi.spyOn(video, 'play').mockResolvedValue();
  fireEvent.click(screen.getByRole('button', { name: /^Play recording$/ }));
  expect(play).toHaveBeenCalledOnce();
  fireEvent.play(video);
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
  fireEvent.click(video);
  expect(pause).toHaveBeenCalledOnce();
  fireEvent.pause(video);
  fireEvent.change(screen.getByRole('slider', { name: 'Seek recording' }), { target: { value: '4' } });
  expect(video.currentTime).toBe(4);
  expect(screen.getByText('0:04 / 0:08')).toBeInTheDocument();
  const fullscreen = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(video.parentElement, 'requestFullscreen', { value: fullscreen });
  fireEvent.click(screen.getByRole('button', { name: 'Toggle fullscreen' }));
  expect(fullscreen).toHaveBeenCalledOnce();
});

it('retains seeking when WebM metadata does not expose a finite duration', () => {
  render(<RecordingPreview src="blob:recording" recordedSeconds={8} />);
  Object.defineProperty(screen.getByLabelText('Recording preview'), 'duration', { value: Infinity });
  fireEvent.loadedMetadata(screen.getByLabelText('Recording preview'));
  expect(screen.getByRole('slider', { name: 'Seek recording' })).toBeEnabled();
});
