import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import { intentLink, isAllowedRoute } from '../services/links.js';

const KEY = 'nexushd:open-in-app-hidden';

const hidden = () => {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/* On the web version, in Chrome on Android: a small bar on a shared title that
   opens the NexusHD app (or the download page when it is not installed) */
export default function OpenInApp() {
  const { pathname, search } = useLocation();
  const [gone, setGone] = useState(hidden);
  const route = `${pathname}${search}`;

  const show =
    !gone &&
    !Capacitor.isNativePlatform() &&
    typeof navigator !== 'undefined' &&
    /Android/i.test(navigator.userAgent) &&
    isAllowedRoute(route) &&
    route !== '/soon';
  if (!show) return null;

  const close = () => {
    setGone(true);
    try {
      window.sessionStorage.setItem(KEY, '1');
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="oia" role="region" aria-label="Open in the app">
      <BrandMark size={34} />
      <div className="oia-text">
        <b>NexusHD app</b>
        <span>Open this in the app</span>
      </div>
      <a className="oia-btn" href={intentLink(route)}>
        Open
      </a>
      <button className="oia-x" onClick={close} aria-label="Hide">
        <X size={18} />
      </button>
    </div>
  );
        }
