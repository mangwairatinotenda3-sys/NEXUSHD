import { useSyncExternalStore } from 'react';
import { Network } from '@capacitor/network';

/* What kind of connection the phone has right now, and the "Download on Wi-Fi
   only" choice. Downloads read this to decide whether they may run.
   connection: 'wifi' | 'cellular' | 'none' | 'unknown' */

const KEY = 'nexushd:wifi-only';

const readWifiOnly = () => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY)) === true;
  } catch {
    return false;
  }
};

let snapshot = { connection: 'unknown', wifiOnly: readWifiOnly() };
const listeners = new Set();

const publish = (changes) => {
  snapshot = { ...snapshot, ...changes };
  listeners.forEach((l) => l());
};

const toConnection = (status) => {
  if (!status || status.connected === false) return 'none';
  const type = status.connectionType;
  if (type === 'wifi' || type === 'ethernet') return 'wifi';
  if (type === 'cellular') return 'cellular';
  return 'unknown';
};

async function refresh() {
  try {
    publish({ connection: toConnection(await Network.getStatus()) });
  } catch {
    /* the connection type is not known, downloads carry on as normal */
  }
}

/* Resolves once the first reading is in, so downloads that restart when the
   app opens do not begin on mobile data by mistake */
export const networkReady = (async () => {
  try {
    await Network.addListener('networkStatusChange', (status) => {
      publish({ connection: toConnection(status) });
    });
  } catch {
    /* no listener available */
  }
  await refresh();
})();

export const getNetwork = () => snapshot;

export const subscribeNetwork = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setWifiOnly(value) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Boolean(value)));
  } catch {
    /* storage unavailable */
  }
  publish({ wifiOnly: Boolean(value) });
}

/* true when the person asked for Wi-Fi only and the phone is on mobile data */
export const blockedByWifiOnly = () => snapshot.wifiOnly && snapshot.connection === 'cellular';

export default function useNetwork() {
  return useSyncExternalStore(subscribeNetwork, getNetwork);
}
