import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { ClientRoutes } from './ClientRoutes';
import { choices, controls, makeApi } from './testing/support';

it('keeps capture alive across client routes and tab visibility changes, then attaches to the original draft', async () => {
  const stopTrack = vi.fn();
  const track = { stop: stopTrack, addEventListener: vi.fn() };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getDisplayMedia: vi.fn().mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] }),
  } });
  class Recorder {
    static latest: Recorder;
    static isTypeSupported() { return true; }
    state = 'inactive'; mimeType = 'video/webm';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    constructor() { Recorder.latest = this; }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['recording'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  const { unmount } = render(<MemoryRouter initialEntries={['/feedback/new']}>
    <Link to="/feedback/new">Form</Link><Link to="/feedback/mine">Reports</Link>
    <Routes><Route path="/feedback/*" element={<ClientRoutes api={makeApi()} choices={choices} controls={controls} draftScope="recording-client" />} /></Routes>
  </MemoryRouter>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Record screen now' }));
  await user.click(await screen.findByRole('button', { name: 'Start recording' }));
  await screen.findByLabelText('Screen recording controls');
  await user.click(screen.getByRole('link', { name: 'Reports' }));
  await screen.findByRole('heading', { name: 'My reports' });
  act(() => { fireEvent(document, new Event('visibilitychange')); fireEvent(window, new Event('blur')); });
  expect(Recorder.latest.state).toBe('recording');
  expect(stopTrack).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Stop recording' }));
  await user.click(await screen.findByRole('button', { name: 'Attach recording' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('link', { name: 'Form' }));
  expect(await screen.findByText(/harvest-recording-.*webm/)).toBeInTheDocument();
  unmount();
});
