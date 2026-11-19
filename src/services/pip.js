import { Capacitor, registerPlugin } from '@capacitor/core';

/* Picture-in-picture: the film keeps playing in a small window while the
   person uses other apps. In the Android app this uses a small native plugin
   ("Pip"). In a desktop browser it uses the browser's own mini player. */

const Pip = Capacitor.isNativePlatform() ? registerPlugin('Pip') : null;
const AUTO_KEY = 'nexushd:auto-pip';
export const PIP_EVENT = 'nexushd:pip';

let supported = null;

export function pipAvailable() {
  if (!supported) {
    supported = Pip
      ? Pip.isSupported()
          .then((result) => Boolean(result?.supported))
          .catch(() => false)
      : Promise.resolve(typeof document !== 'undefined' && Boolean(document.pictureInPictureEnabled));
  }
  return supported;
}

/* "Open the small window when I leave the app while a film plays" (on by default) */
export function autoPipEnabled() {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setAutoPip(value) {
  try {
    window.localStorage.setItem(AUTO_KEY, value ? 'true' : 'false');
  } catch {
    /* storage unavailable */
  }
}

/* While armed, pressing Home opens the small window by itself */
export function armPip(armed) {
  if (Pip) Pip.setArmed({ armed: Boolean(armed) }).catch(() => {});
}

export async function enterPip(video) {
  if (Pip) {
    try {
      const result = await Pip.enter();
      return Boolean(result?.entered);
    } catch {
      return false;
    }
  }
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (video?.requestPictureInPicture) await video.requestPictureInPicture();
    else return false;
    return true;
  } catch {
    return false;
  }
}

/* Called with true when the small window opens and false when it closes */
export function onPipChange(listener) {
  const handler = (event) => listener(Boolean(event.detail));
  window.addEventListener(PIP_EVENT, handler);
  return () => window.removeEventListener(PIP_EVENT, handler);
      }
