import { useSyncExternalStore } from 'react';
import { Network } from '@capacitor/network';
import { getNetwork, subscribeNetwork } from './network.js';

/* Is the phone online right now, and the "No internet connection" prompt.

   Titles you saw before still show on screen without internet, and tapping
   one that needs the internet opens a small prompt that asks you to connect
   to Wi-Fi or mobile data. The moment the connection comes back, the
   prompt closes and the thing you tapped opens by itself.

   Use whenOnline(() => ...) around anything that needs the internet. */

export function isOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return getNetwork().connection !== 'none';
}

// prompt: null, or { action, tried } while the "No internet connection" prompt is open
let snapshot = { online: isOnline(), prompt: null };
const listeners = new Set();

const publish = (next) => {
  snapshot = next;
  listeners.forEach((l) => l());
};

/* Runs the thing that was waiting for a connection, after the screen has updated */
function runLater(action) {
  if (typeof action !== 'function') return;
  setTimeout(() => {
    try {
      action();
    } catch {
      /* the screen it belonged to is gone */
    }
  }, 180);
}

function recompute() {
  const online = isOnline();
  if (online === snapshot.online) return;
  if (online && snapshot.prompt) {
    const { action } = snapshot.prompt;
    publish({ online, prompt: null });
    runLater(action);
    return;
  }
  publish({ ...snapshot, online });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', recompute);
  window.addEventListener('offline', recompute);
  subscribeNetwork(recompute);
}

/* Runs action when there is a connection. Without one, opens the prompt and
   keeps the action: it runs when the connection comes back, or when the
   person taps "Try again" and it works. Returns true when it ran at once. */
export function whenOnline(action) {
  if (isOnline()) {
    action?.();
    return true;
  }
  publish({ online: false, prompt: { action, tried: 0 } });
  return false;
}

export function dismissNoInternet() {
  if (snapshot.prompt) publish({ ...snapshot, prompt: null });
}

/* "Try again": asks the phone for the real state of the connection */
export async function retryNoInternet() {
  const prompt = snapshot.prompt;
  if (!prompt) return false;
  let connected = isOnline();
  try {
    const status = await Network.getStatus();
    connected = status.connected !== false && navigator.onLine !== false;
  } catch {
    /* keep what the browser says */
  }
  if (connected) {
    publish({ online: true, prompt: null });
    runLater(prompt.action);
    return true;
  }
  if (snapshot.prompt) {
    publish({ ...snapshot, prompt: { ...snapshot.prompt, tried: snapshot.prompt.tried + 1 } });
  }
  return false;
}

/* For code outside React: called when the connection changes */
export function subscribeConnection(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const subscribe = (l) => subscribeConnection(l);
const getSnapshot = () => snapshot;

export default function useConnection() {
  return useSyncExternalStore(subscribe, getSnapshot);
                          }
