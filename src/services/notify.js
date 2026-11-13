import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';

/* Alerts for downloads, made on the phone itself (no Firebase, no server).
   They only appear while NexusHD is not on screen, and only when
   Notifications is switched on in Settings. On the web this does nothing. */

const native = Capacitor.isNativePlatform();
const CHANNEL = 'downloads';
let appActive = true;

export const notificationsEnabled = () => {
  try {
    return JSON.parse(window.localStorage.getItem('nexushd:notifications')) !== false;
  } catch {
    return true;
  }
};

if (native) {
  App.addListener('appStateChange', ({ isActive }) => {
    appActive = isActive;
  });

  LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Downloads',
    description: 'Finished and interrupted downloads',
    importance: 3,
    visibility: 1,
  }).catch(() => {});

  // Tapping an alert opens the screen it is about
  LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const route = event.notification?.extra?.route;
    if (route) window.location.hash = `#${route}`;
  });
}

/* Asks Android for permission when needed.
   Returns 'granted', 'denied' or 'unsupported' (web). */
export async function ensureNotificationPermission() {
  if (!native) return 'unsupported';
  try {
    let { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      ({ display } = await LocalNotifications.requestPermissions());
    }
    return display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

// alert ids must be whole numbers
const idFor = (key) => {
  let hash = 7;
  for (const ch of String(key)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 2147483000) + 1;
};

export async function notifyDownload({ key, title, body, route = '/downloads' }) {
  if (!native || !notificationsEnabled() || appActive) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [{ id: idFor(key), title, body, channelId: CHANNEL, extra: { route } }],
    });
  } catch {
    /* an alert that fails to show is not worth interrupting anything */
  }
}
