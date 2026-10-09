export const RECORDING_SECONDS = 180;
export const RECORDING_BYTES = 48 * 1024 * 1024;
export const RECORDING_MAX_BYTES = 50 * 1024 * 1024;
export const RECORDING_MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'] as const;
export const chooseRecordingMime = (supports: (mime: string) => boolean) => RECORDING_MIMES.find(supports);
export const shouldStopRecording = (seconds: number, bytes: number) => seconds >= RECORDING_SECONDS || bytes >= RECORDING_BYTES;
export const validRecordingSize = (bytes: number) => bytes > 0 && bytes <= RECORDING_MAX_BYTES;
export const recordingClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
