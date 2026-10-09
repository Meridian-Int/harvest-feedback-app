import { useEffect, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ClientControls } from './contract';
import { ScreenRecorderDialog } from './ScreenRecorderDialog';

// Capture belongs to the client workspace, not to a route's form component.
const files = new Map<string, File>();
const listeners = new Set<() => void>();
const mounts = new Map<string, number>();
let host: { scope: string; root: Root; element: HTMLDivElement } | null = null;
const notify = () => listeners.forEach(listener => listener());
export function setWorkspaceAttachment(scope: string, file: File | null) {
  if (file) files.set(scope, file); else files.delete(scope);
  notify();
}
function closeHost() {
  const previous = host;
  host = null;
  // A recorder callback can run during React's commit; unmount after it completes.
  if (previous) queueMicrotask(() => { previous.root.unmount(); previous.element.remove(); });
}
export function resetRecordingWorkspace() {
  closeHost(); files.clear(); notify();
}
export function openWorkspaceRecorder(scope: string, controls: ClientControls) {
  if (host?.scope === scope) return;
  closeHost();
  const element = document.createElement('div');
  element.className = 'harvest-client';
  element.dataset.clientRecorder = '';
  document.body.appendChild(element);
  const root = createRoot(element);
  host = { scope, root, element };
  root.render(<ScreenRecorderDialog controls={controls} replacing={files.has(scope)}
    onAttach={file => setWorkspaceAttachment(scope, file)} onClose={closeHost} />);
}
export function useRecordingWorkspace(scope?: string) {
  const file = useSyncExternalStore(listener => {
    listeners.add(listener); return () => { listeners.delete(listener); };
  }, () => scope ? files.get(scope) ?? null : null);
  useEffect(() => {
    if (!scope) return;
    mounts.set(scope, (mounts.get(scope) ?? 0) + 1);
    return () => {
      mounts.set(scope, Math.max(0, (mounts.get(scope) ?? 1) - 1));
      queueMicrotask(() => {
        // Route changes mount the next client screen before this runs. Leaving
        // the client workspace/signing out releases capture and in-memory files.
        if (!mounts.get(scope)) {
          if (host?.scope === scope) closeHost();
          files.delete(scope); notify();
        }
      });
    };
  }, [scope]);
  return file;
}
