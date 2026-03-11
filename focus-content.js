/**
 * Jesty Focus Island — Content Script
 * Injects a floating island iframe on every page during an active focus session.
 * Also manages a blur overlay on all tabs (toggleable via eye button on island).
 * Communicates via chrome.storage.local + onChanged.
 */
(() => {
  const ISLAND_URL = chrome.runtime.getURL('focus-island.html');
  let iframe = null;
  let blurOverlay = null;

  function createIsland() {
    if (iframe) return;
    if (document.getElementById('jesty-focus-island')) return;
    if (!document.body) return;

    iframe = document.createElement('iframe');
    iframe.src = ISLAND_URL;
    iframe.id = 'jesty-focus-island';
    iframe.allow = 'transparency';
    iframe.style.cssText = [
      'position: fixed !important',
      'bottom: 0 !important',
      'left: 0 !important',
      'width: 320px !important',
      'height: 220px !important',
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

    setTimeout(() => {
      if (iframe) iframe.style.opacity = '1';
    }, 100);
  }

  function removeIsland() {
    const existing = document.getElementById('jesty-focus-island');
    if (!iframe && existing) {
      existing.style.opacity = '0';
      setTimeout(() => { try { existing.remove(); } catch (e) {} }, 300);
      return;
    }
    if (!iframe) return;
    iframe.style.opacity = '0';
    const el = iframe;
    iframe = null;
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 300);
  }

  /* ── Blur Overlay ── */

  function createBlurOverlay() {
    if (blurOverlay) return;
    if (document.getElementById('jesty-focus-blur')) return;
    if (!document.body) return;

    blurOverlay = document.createElement('div');
    blurOverlay.id = 'jesty-focus-blur';
    blurOverlay.style.cssText = [
      'position: fixed !important',
      'top: 0 !important',
      'left: 0 !important',
      'width: 100vw !important',
      'height: 100vh !important',
      'z-index: 2147483646 !important',
      'backdrop-filter: blur(8px) !important',
      '-webkit-backdrop-filter: blur(8px) !important',
      'background: rgba(255,255,255,0.15) !important',
      'pointer-events: auto !important',
      'cursor: default !important',
      'opacity: 0',
      'transition: opacity 0.4s ease'
    ].join('; ');

    // Dismiss button
    const dismiss = document.createElement('button');
    dismiss.textContent = 'Fine, unblur this one';
    dismiss.style.cssText = [
      'position: absolute !important',
      'top: 50% !important',
      'left: 50% !important',
      'transform: translate(-50%, -50%) !important',
      'padding: 10px 24px !important',
      'border-radius: 20px !important',
      'border: 1.5px solid rgba(0,0,0,0.15) !important',
      'background: rgba(255,255,255,0.9) !important',
      'color: #18181B !important',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important',
      'font-size: 13px !important',
      'font-weight: 600 !important',
      'cursor: pointer !important',
      'opacity: 0 !important',
      'transition: opacity 0.3s ease !important',
      'z-index: 1 !important',
      'box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important'
    ].join('; ');

    blurOverlay.addEventListener('mouseenter', () => {
      dismiss.style.opacity = '1';
    });
    blurOverlay.addEventListener('mouseleave', () => {
      dismiss.style.opacity = '0';
    });

    dismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBlurOverlay();
    });

    blurOverlay.appendChild(dismiss);
    document.body.appendChild(blurOverlay);

    setTimeout(() => {
      if (blurOverlay) blurOverlay.style.opacity = '1';
    }, 50);
  }

  function removeBlurOverlay() {
    const existing = document.getElementById('jesty-focus-blur');
    if (!blurOverlay && existing) {
      existing.style.opacity = '0';
      setTimeout(() => { try { existing.remove(); } catch (e) {} }, 400);
      return;
    }
    if (!blurOverlay) return;
    blurOverlay.style.opacity = '0';
    const el = blurOverlay;
    blurOverlay = null;
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 400);
  }

  /* ── Init ── */

  // Check on load
  chrome.storage.local.get(['focusSession', 'focusBlurEnabled'], (result) => {
    const active = result.focusSession && result.focusSession.active;
    if (active) {
      if (document.body) {
        createIsland();
        if (result.focusBlurEnabled) createBlurOverlay();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          createIsland();
          if (result.focusBlurEnabled) createBlurOverlay();
        });
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
        removeBlurOverlay();
      }
    }
    if (changes.focusBlurEnabled) {
      const enabled = changes.focusBlurEnabled.newValue;
      // Only apply if focus is active
      chrome.storage.local.get(['focusSession'], (result) => {
        if (!result.focusSession || !result.focusSession.active) return;
        if (enabled) {
          createBlurOverlay();
        } else {
          removeBlurOverlay();
        }
      });
    }
  });

  // Listen for direct messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'focus-island-show') {
      createIsland();
    } else if (msg.type === 'focus-island-hide') {
      removeIsland();
      removeBlurOverlay();
    } else if (msg.type === 'focus-blur-toggle') {
      if (blurOverlay) {
        removeBlurOverlay();
      } else {
        createBlurOverlay();
      }
    }
  });
})();
