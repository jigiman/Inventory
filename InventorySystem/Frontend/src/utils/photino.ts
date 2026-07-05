/**
 * Photino native message bridge.
 *
 * Photino provides `window.external.sendMessage` (JS → C#)
 * and `window.external.receiveMessage` (registers a C# → JS handler).
 *
 * Because only ONE receiveMessage handler can be active at a time,
 * this module installs a single global router and multiplexes by requestId.
 */

type PendingRequest = (msg: PhotinoResponse) => void;

interface PhotinoResponse {
  type: string;
  requestId: string;
  path?: string | null;
}

// Accessing window.external in a way that avoids conflict with built-in External type
const photinoExternal = (window as any).external as {
  sendMessage: (msg: string) => void;
  receiveMessage: (handler: (msg: string) => void) => void;
} | undefined;

const pending = new Map<string, PendingRequest>();

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Install the global router once.
function ensureRouter() {
  if (photinoExternal?.receiveMessage) {
    photinoExternal.receiveMessage((raw: string) => {
      try {
        const msg: PhotinoResponse = JSON.parse(raw);
        const resolve = pending.get(msg.requestId);
        if (resolve) {
          pending.delete(msg.requestId);
          resolve(msg);
        }
      } catch {
        // ignore non-JSON messages
      }
    });
  }
}

ensureRouter();

/** Returns true when running inside the Photino desktop shell. */
export function isPhotino(): boolean {
  return typeof photinoExternal?.sendMessage === 'function';
}

/**
 * Opens the native OS "Open File" dialog filtered to .db files.
 * Returns the selected path, or null if cancelled.
 * Falls back to null immediately if not running inside Photino.
 */
export function pickOpenFile(): Promise<string | null> {
  if (!isPhotino()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const requestId = genId();
    pending.set(requestId, (msg) => resolve(msg.path ?? null));
    photinoExternal!.sendMessage(
      JSON.stringify({ type: 'pick-file', mode: 'open', requestId })
    );
  });
}

/**
 * Opens the native OS "Save File" dialog filtered to .db files.
 * Returns the chosen path (with .db appended if needed), or null if cancelled.
 * Falls back to null immediately if not running inside Photino.
 */
export function pickSaveFile(): Promise<string | null> {
  if (!isPhotino()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const requestId = genId();
    pending.set(requestId, (msg) => resolve(msg.path ?? null));
    photinoExternal!.sendMessage(
      JSON.stringify({ type: 'pick-file', mode: 'save', requestId })
    );
  });
}
