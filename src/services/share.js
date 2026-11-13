import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/* Opens the phone's share sheet. Returns 'shared', 'copied' (link put on the
   clipboard when sharing is not available), 'cancelled' or 'failed'. */
export async function shareLink({ title, text, url }) {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, url, dialogTitle: 'Share' });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (err) {
    const message = String(err?.message || err?.name || '').toLowerCase();
    if (message.includes('cancel') || message.includes('abort')) return 'cancelled';
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
