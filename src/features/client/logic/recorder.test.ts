import { expect, it } from 'vitest';
import { chooseRecordingMime, RECORDING_BYTES, RECORDING_MAX_BYTES, recordingClock, shouldStopRecording, validRecordingSize } from './recorder';
it('selects the best supported format, or reports unsupported', () => {
  expect(chooseRecordingMime(type => type === 'video/mp4')).toBe('video/mp4');
  expect(chooseRecordingMime(() => false)).toBeUndefined();
});
it('stops at time/size boundaries and validates the final blob', () => {
  expect(shouldStopRecording(179, RECORDING_BYTES - 1)).toBe(false);
  expect(shouldStopRecording(180, 0)).toBe(true);
  expect(shouldStopRecording(0, RECORDING_BYTES)).toBe(true);
  expect(validRecordingSize(0)).toBe(false);
  expect(validRecordingSize(RECORDING_MAX_BYTES)).toBe(true);
  expect(validRecordingSize(RECORDING_MAX_BYTES + 1)).toBe(false);
  expect(recordingClock(61)).toBe('1:01');
});
