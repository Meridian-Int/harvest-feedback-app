import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn((query: string) => ({
  matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
  addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
})) });
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
Object.defineProperty(URL, 'createObjectURL', { writable: true, value: vi.fn(() => 'blob:mock-media') });
Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: vi.fn() });
Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
  getDisplayMedia: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'NotAllowedError')),
} });
class FakeMediaRecorder extends EventTarget {
  static isTypeSupported() { return true; }
  state: RecordingState = 'inactive';
  mimeType = 'video/webm';
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.dispatchEvent(new Event('stop')); }
}
Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: FakeMediaRecorder });
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.page;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
