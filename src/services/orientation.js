import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';

/* Turning the screen for the video player. In the Android app this uses the
   phone's own screen lock. In a browser it uses fullscreen, which is the only
   way a website is allowed to turn the screen. */

const native = () => Capacitor.isNativePlatform();
const ignore = () => {};

export const isLandscape = () =>
  typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches;

export async function lockLandscape() {
  if (native()) {
    await ScreenOrientation.lock({ orientation: 'landscape' }).catch(ignore);
    StatusBar.hide().catch(ignore);
    return;
  }
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    await window.screen.orientation?.lock?.('landscape');
  } catch {
    /* the browser refused */
  }
}

export async function lockPortrait() {
  if (native()) {
    await ScreenOrientation.lock({ orientation: 'portrait' }).catch(ignore);
    StatusBar.show().catch(ignore);
    return;
  }
  try {
    await window.screen.orientation?.lock?.('portrait');
  } catch {
    /* the browser refused */
  }
}

/* Gives the screen back to the phone (auto-rotate) when the player closes */
export async function releaseOrientation() {
  if (native()) {
    await ScreenOrientation.unlock().catch(ignore);
    StatusBar.show().catch(ignore);
    return;
  }
  try {
    window.screen.orientation?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* nothing to undo */
  }
  }
