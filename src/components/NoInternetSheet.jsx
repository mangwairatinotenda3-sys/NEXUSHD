import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import useConnection, { dismissNoInternet, retryNoInternet } from '../services/connection.js';

/* The prompt that opens when something needs the internet and there is none.
   It closes by itself, and opens what was tapped, when the connection is back. */
export default function NoInternetSheet() {
  const { prompt } = useConnection();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!prompt) return null;

  const tryAgain = async () => {
    if (busy) return;
    setBusy(true);
    await retryNoInternet();
    setBusy(false);
  };

  const goDownloads = () => {
    dismissNoInternet();
    navigate('/downloads');
  };

  return (
    <div className="sheet-backdrop net-backdrop" onClick={dismissNoInternet}>
      <div
        className="sheet net-sheet"
        role="alertdialog"
        aria-labelledby="net-title"
        aria-describedby="net-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="net-art" aria-hidden="true">
          <span className="net-ring r1" />
          <span className="net-ring r2" />
          <span className="net-ico">
            <WifiOff size={34} strokeWidth={2} />
          </span>
        </div>

        <h3 id="net-title">No internet connection</h3>
        <p id="net-text">Connect to Wi-Fi or mobile data, then try again.</p>

        {prompt.tried > 0 && (
          <div className="net-still" key={prompt.tried} role="status">
            Still can't connect. Check Wi-Fi or mobile data.
          </div>
        )}

        <div className="net-actions">
          <button type="button" className="btn-primary" onClick={tryAgain} disabled={busy}>
            <RefreshCw size={18} className={busy ? 'net-spin' : ''} />
            {busy ? 'Checking…' : 'Try again'}
          </button>
          {pathname !== '/downloads' && (
            <button type="button" className="btn-secondary" onClick={goDownloads}>
              <Download size={18} /> Go to Downloads
            </button>
          )}
          <button type="button" className="net-close" onClick={dismissNoInternet}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
