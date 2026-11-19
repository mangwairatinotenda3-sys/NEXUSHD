import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';

/* Turning the screen. In the Android app this uses the phone's own screen lock.
   In a browser it uses fullscreen, which is the only way a website is allowed
   to turn the screen.

   The whole app stays in portrait on phones. The video player turns to
   landscape while a film plays and gives the screen back to portrait when it
   closes. Tablets and big screens are left free to rotate. */

const native = () => Capacitor.isNativePlatform();
const ignore = () => {};

export const isLandscape = () =>
  typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches;

/* A phone has a short side under 600 dp, a tablet has more */
export const isPhone = () => {
  if (typeof window === 'undefined') return true;
  const side = Math.min(window.screen?.width || 0, window.screen?.height || 0);
  return side > 0 ? side < 600 : true;
};

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

/* The orientation the app itself uses: portrait on phones, free on tablets */
export async function lockAppOrientation() {
  if (!native()) return;
  if (isPhone()) await ScreenOrientation.lock({ orientation: 'portrait' }).catch(ignore);
  else await ScreenOrientation.unlock().catch(ignore);
}

/* Gives the screen back to the app when the player closes */
export async function releaseOrientation() {
  if (native()) {
    await lockAppOrientation();
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
