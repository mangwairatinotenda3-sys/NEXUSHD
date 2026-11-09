/* Hide the bottom bar on full-focus screens such as Search */
body.hide-nav .bottom-nav {
  display: none;
}

body.hide-nav .app-content {
  padding-bottom: calc(var(--safe-bottom) + 24px);
}

.btn-primary:disabled {
  opacity: 0.45;
  pointer-events: none;
  box-shadow: none;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 50px;
  padding: 0 18px;
  border-radius: 14px;
  border: 1px solid var(--card-border);
  background: var(--primary-soft);
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  transition: transform 0.15s, background 0.2s;
}

.btn-secondary:active {
  transform: scale(0.96);
}

.btn-secondary.on {
  background: var(--primary);
  border-color: transparent;
  color: #fff;
}

.btn-icon {
  width: 50px;
  padding: 0;
  flex-shrink: 0;
}

/* ---------- Movie details ---------- */
.d-hero {
  position: relative;
  height: 320px;
  background: var(--skeleton-a);
  overflow: hidden;
}

.d-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.d-hero-sk {
  position: absolute;
  inset: 0;
  border-radius: 0;
}

.d-hero-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4), transparent 38%, var(--bg) 100%);
}

.d-back {
  position: absolute;
  top: calc(var(--safe-top) + 12px);
  left: 16px;
  z-index: 2;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  backdrop-filter: blur(8px);
}

.d-play {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: rgba(109, 28, 240, 0.88);
  color: #fff;
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 30px rgba(109, 28, 240, 0.55);
  transition: transform 0.15s;
}

.d-play svg {
  margin-left: 3px;
}

.d-play:active {
  transform: translate(-50%, -50%) scale(0.92);
}

.d-main {
  position: relative;
  margin-top: -84px;
  padding: 0 20px;
}

.d-head {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.d-poster {
  flex: 0 0 110px;
  aspect-ratio: 2 / 3;
  border-radius: 14px;
  overflow: hidden;
  background: var(--skeleton-a);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
}

.d-poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.d-title-block {
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
}

.d-title-block h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.12;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.d-tagline {
  margin: 6px 0 0;
  font-size: 13px;
  font-style: italic;
  color: var(--text-muted);
}

.d-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted);
}

.d-facts span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.d-facts .star {
  color: #fbbf24;
}

.d-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.d-genre {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary-bright);
  font-size: 12px;
  font-weight: 600;
}

.d-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.d-actions .btn-primary {
  flex: 1;
}

.d-section {
  margin-top: 26px;
}

.d-section h2 {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 700;
}

.d-overview {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-muted);
}

.d-overview.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.d-more {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-bright);
}

.cast-rail {
  display: flex;
  gap: 14px;
  margin: 0 -20px;
  padding: 0 20px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.cast-rail::-webkit-scrollbar {
  display: none;
}

.cast {
  flex: 0 0 76px;
  text-align: center;
}

.cast-photo {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin: 0 auto 8px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--skeleton-a);
  border: 1px solid var(--card-border);
  color: var(--text-muted);
}

.cast-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cast-name {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cast-role {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- Trailer ---------- */
.trailer-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: rgba(0, 0, 0, 0.94);
  animation: fade 0.2s ease both;
}

.trailer-close {
  position: absolute;
  top: calc(var(--safe-top) + 12px);
  right: 16px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.trailer-frame {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: #000;
}

.trailer-frame iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

/* ---------- Toast ---------- */
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-height) + var(--safe-bottom) + 20px);
  transform: translateX(-50%);
  z-index: 95;
  padding: 11px 18px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  animation: toast-in 0.25s ease both;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
}

/* ---------- Search ---------- */
.search-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: calc(var(--safe-top) + 10px) 16px 10px 8px;
  background: linear-gradient(var(--bg) 75%, transparent);
}

.search-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 12px 0 14px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--card-border);
  color: var(--text-muted);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-field:focus-within {
  border-color: var(--primary-bright);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.search-field input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 16px;
  user-select: text;
  -webkit-user-select: text;
}

.search-field input::placeholder {
  color: var(--text-muted);
}

.search-field button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--text);
}

.search-section {
  padding: 0 20px;
}

.search-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 10px;
}

.search-section-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.link-btn {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-bright);
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.recent-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 14px;
  border-radius: 999px;
  background: var(--card);
  border: 1px solid var(--card-border);
  font-size: 14px;
}

.recent-chip .x {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--text-muted);
}

.result-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 8px 0;
  text-align: left;
}

.result-row + .result-row {
  border-top: 1px solid var(--card-border);
}

.result-rank {
  width: 22px;
  text-align: center;
  font-size: 15px;
  font-weight: 800;
  color: var(--primary-bright);
}

.result-thumb {
  flex: 0 0 52px;
  height: 76px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--skeleton-a);
}

.result-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 12px;
  padding: 8px 20px 0;
}

.grid .movie-card {
  flex: none;
}

.sentinel {
  height: 1px;
}
