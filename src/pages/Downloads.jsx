import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, X } from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingState from '../components/LoadingState.jsx';
import useDownloads from '../hooks/useDownloads.js';
import { formatBytes } from '../utils/format.js';

export default function Downloads() {
  const navigate = useNavigate();
  const { items, loading, remove, clear } = useDownloads();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="page">
      <Header
        title="Downloads"
        right={
          <button
            className="icon-btn"
            onClick={() => setConfirm(true)}
            disabled={loading || items.length === 0}
            aria-label="Clear all downloads"
          >
            <Trash2 size={24} />
          </button>
        }
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Download}
          title="No Downloads Yet"
          text="Download your favourite movies and watch offline."
          actionLabel="Browse Movies"
          onAction={() => navigate('/')}
        />
      ) : (
        <div className="card">
          {items.map((d) => (
            <div className="dl-item" key={d.id}>
              <div className="dl-info">
                <div className="dl-title">{d.title}</div>
                <div className="dl-meta">
                  {d.progress >= 100 ? 'Ready to watch' : `${Math.round(d.progress || 0)}%`} ·{' '}
                  {formatBytes(d.size)}
                </div>
                {d.progress < 100 && (
                  <div className="progress">
                    <div style={{ width: `${d.progress || 0}%` }} />
                  </div>
                )}
              </div>
              <button className="icon-btn" onClick={() => remove(d.id)} aria-label={`Remove ${d.title}`}>
                <X size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className="sheet-backdrop" onClick={() => setConfirm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Clear all downloads?</h3>
            <p>This removes every download from this device.</p>
            <div className="sheet-actions">
              <button onClick={() => setConfirm(false)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  clear();
                  setConfirm(false);
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
