import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/* Native touches for the Android app. On the web this does nothing. */

if (Capacitor.isNativePlatform()) {
  // Status bar follows the app theme
  const applyTheme = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: light ? '#f6f3fd' : '#07040f' }).catch(() => {});
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // The Back button closes an open player or sheet first, then goes back a page,
  // and leaves the app from the home screen.
  const closeOverlay = () => {
    const closePlayer = document.querySelector('.player .player-top .icon-btn');
    if (closePlayer) {
      closePlayer.click();
      return true;
    }
    const layer = document.querySelector('.trailer-modal, .sheet-backdrop');
    if (layer) {
      layer.click();
      return true;
    }
    return false;
  };

  App.addListener('backButton', () => {
    if (closeOverlay()) return;
    const route = window.location.hash.replace(/^#/, '');
    if (route === '' || route === '/') App.exitApp();
    else window.history.back();
  });

  // A light tap on tabs, chips and icon buttons
  document.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('.nav-item, .chip, .lib-chip, .icon-btn, .segmented button')) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    },
    true
  );
  }
