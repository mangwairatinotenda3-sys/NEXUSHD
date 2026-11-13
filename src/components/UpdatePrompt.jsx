import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Smartphone } from 'lucide-react';
import {
  checkForUpdate,
  dismissBuild,
  dismissedBuild,
  updatesSupported,
} from '../services/update.js';
import { formatBytes } from '../utils/format.js';
import '../styles/update.css';

/* The sheet that offers the new build. Also used from Settings. */
export function UpdateSheet({ info, onLater }) {
  const start = () => {
    window.open(info.url, '_blank');
    onLater();
  };

  return (
    <div className="sheet-backdrop" onClick={onLater}>
      <div className="sheet update-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="update-icon">
          <Smartphone size={28} />
        </div>
        <h3>Update available</h3>
        <p>
          Build {info.build} of NexusHD is ready{info.size ? ` (${formatBytes(info.size)})` : ''}.
          Tap Update, then open the downloaded file to install it over this version. Your account,
          list and downloads stay.
        </p>
        <div className="sheet-actions">
          <button onClick={onLater}>Later</button>
          <button className="primary" onClick={start}>
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

/* Checks for a new build a few seconds after the app opens, and again each
   time you come back to it (at most every six hours). Shows nothing when you
   are up to date, offline, or already said "Later" for that build. */
export default function UpdatePrompt() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!updatesSupported()) return undefined;
    let cancelled = false;

    const run = async () => {
      try {
        const result = await checkForUpdate();
        if (!cancelled && result.available && dismissedBuild() !== result.build) setInfo(result);
      } catch {
        /* offline or GitHub unreachable: try again next time */
      }
    };

    const timer = setTimeout(run, 4000);
    const handle = Capacitor.isNativePlatform() ? App.addListener('resume', run) : null;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      handle?.then((h) => h.remove());
    };
  }, []);

  if (!info) return null;

  return (
    <UpdateSheet
      info={info}
      onLater={() => {
        dismissBuild(info.build);
        setInfo(null);
      }}
    />
  );
      }
