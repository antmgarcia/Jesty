/**
 * Jesty Focus Island — Content Script
 * Injects a floating island iframe on every page during an active focus session.
 * Communicates via chrome.storage.local + onChanged.
 */
(() => {
  const ISLAND_URL = chrome.runtime.getURL('focus-island.html');
  let iframe = null;

  function createIsland() {
    if (iframe) return;
    if (!document.body) return;

    iframe = document.createElement('iframe');
    iframe.src = ISLAND_URL;
    iframe.id = 'jesty-focus-island';
    iframe.allow = 'transparency';
    iframe.style.cssText = [
      'position: fixed !important',
      'bottom: 20px !important',
      'left: 20px !important',
      'width: 76px !important',
      'height: 82px !important',
      'border: none !important',
      'z-index: 2147483647 !important',
      'background: transparent !important',
      'background-color: transparent !important',
      'pointer-events: auto !important',
      'overflow: visible !important',
      'color-scheme: only light',
      'opacity: 0',
      'transition: opacity 0.3s ease'
    ].join('; ');

    document.body.appendChild(iframe);

    // Fade in after a short delay to let iframe render
    setTimeout(() => {
      if (iframe) iframe.style.opacity = '1';
    }, 100);
  }

  function removeIsland() {
    if (!iframe) return;
    iframe.style.opacity = '0';
    const el = iframe;
    iframe = null;
    setTimeout(() => { try { el.remove(); } catch (e) { /* already gone */ } }, 300);
  }

  // Check on load
  chrome.storage.local.get(['focusSession'], ({ focusSession }) => {
    if (focusSession && focusSession.active) {
      if (document.body) {
        createIsland();
      } else {
        document.addEventListener('DOMContentLoaded', () => createIsland());
      }
    }
  });

  // Listen for session changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusSession) {
      const session = changes.focusSession.newValue;
      if (session && session.active) {
        createIsland();
      } else {
        removeIsland();
      }
    }
  });
})();
