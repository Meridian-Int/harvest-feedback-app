import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('MediaRecorder', undefined);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) } });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });
