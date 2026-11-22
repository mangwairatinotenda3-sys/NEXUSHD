import { Check, Gauge, History, RotateCcw, SkipForward, Subtitles } from 'lucide-react';
import usePlayerPrefs, {
  SKIPS,
  SPEEDS,
  SUB_BACKS,
  SUB_COLORS,
  SUB_SIZES,
  isDefault,
  resetPlayerPrefs,
  setPlayerPref,
  subtitleStyle,
} from '../services/playerPrefs.js';
import '../styles/playerprefs.css';

/* A sample of how subtitles will look, on a dark picture */
export function SubtitlePreview() {
  const prefs = usePlayerPrefs();
  return (
    <div className="pp-preview" aria-hidden="true">
      <span className="pp-sub" style={{ ...subtitleStyle(prefs), '--sub-base': '17px' }}>
        This is how your subtitles look.
      </span>
    </div>
  );
}

function Chips({ label, options, value, onPick, swatch = false }) {
  return (
    <div className="pp-group">
      <div className="pp-label">{label}</div>
      <div className="pp-chips" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id ?? o.value}
            type="button"
            role="radio"
            aria-checked={value === (o.id ?? o.value)}
            className={`pp-chip ${value === (o.id ?? o.value) ? 'on' : ''}`}
            onClick={() => onPick(o.id ?? o.value)}
          >
            {swatch && <span className="pp-dot" style={{ background: o.value }} />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Size, colour and background of the subtitles. Used in Settings and inside the player. */
export function SubtitleStyleControls() {
  const prefs = usePlayerPrefs();
  return (
    <>
      <Chips
        label="Size"
        options={SUB_SIZES}
        value={prefs.subSize}
        onPick={(v) => setPlayerPref('subSize', v)}
      />
      <Chips
        label="Colour"
        options={SUB_COLORS.map((c) => ({ ...c, value: c.value, id: c.id }))}
        value={prefs.subColor}
        onPick={(v) => setPlayerPref('subColor', v)}
        swatch
      />
      <Chips
        label="Background"
        options={SUB_BACKS}
        value={prefs.subBack}
        onPick={(v) => setPlayerPref('subBack', v)}
      />
    </>
  );
}

export function PlayerSettingsSheet({ onClose }) {
  const prefs = usePlayerPrefs();
  const unchanged = isDefault(prefs);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet pp-sheet"
        role="dialog"
        aria-label="Player settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pp-head">
          <h3>Player settings</h3>
          <button
            type="button"
            className="pp-reset"
            onClick={resetPlayerPrefs}
            disabled={unchanged}
          >
            <RotateCcw size={15} /> Reset
          </button>
        </div>

        <div className="pp-body">
          <div className="pp-section">
            <Gauge size={18} /> Playback
          </div>

          <div className="pp-group">
            <div className="pp-label">Normal speed</div>
            <div className="pp-chips" role="radiogroup" aria-label="Normal speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={prefs.speed === s}
                  className={`pp-chip ${prefs.speed === s ? 'on' : ''}`}
                  onClick={() => setPlayerPref('speed', s)}
                >
                  {s === 1 ? 'Normal' : `${s}×`}
                </button>
              ))}
            </div>
          </div>

          <div className="pp-group">
            <div className="pp-label">
              <SkipForward size={14} /> Skip buttons jump
            </div>
            <div className="pp-chips" role="radiogroup" aria-label="Skip length">
              {SKIPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={prefs.skip === s}
                  className={`pp-chip ${prefs.skip === s ? 'on' : ''}`}
                  onClick={() => setPlayerPref('skip', s)}
                >
                  {s} seconds
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="pp-switch-row"
            role="switch"
            aria-checked={prefs.remember}
            onClick={() => setPlayerPref('remember', !prefs.remember)}
          >
            <History size={22} />
            <span className="pp-switch-text">
              <b>Remember my position</b>
              <span>
                {prefs.remember
                  ? 'Films carry on where you stopped.'
                  : 'Films always start from the beginning.'}
              </span>
            </span>
            <span className={`switch ${prefs.remember ? 'on' : ''}`} />
          </button>

          <div className="pp-section">
            <Subtitles size={18} /> Subtitles
          </div>
          <SubtitlePreview />
          <SubtitleStyleControls />
        </div>

        <button type="button" className="btn-primary pp-done" onClick={onClose}>
          <Check size={18} /> Done
        </button>
      </div>
    </div>
  );
  }
