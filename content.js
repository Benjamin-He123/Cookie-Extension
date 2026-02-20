/**
 * ClearConsent – content.js
 * Detects cookie consent banners on the page and communicates
 * cookie data back to the popup via chrome.storage.
 */

(function () {
  'use strict';

  // ── Common cookie banner selectors ──────────────────────────
  const BANNER_SELECTORS = [
    '[id*="cookie"]',
    '[id*="consent"]',
    '[id*="gdpr"]',
    '[class*="cookie"]',
    '[class*="consent"]',
    '[class*="gdpr"]',
    '[aria-label*="cookie" i]',
    '[aria-label*="consent" i]',
    '[data-testid*="cookie"]',
  ];

  // ── Detect if a cookie banner exists ────────────────────────
  function detectCookieBanner() {
    for (const selector of BANNER_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return true;
    }
    return false;
  }

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      el.offsetWidth > 0 &&
      el.offsetHeight > 0
    );
  }

  // ── Store detection result ───────────────────────────────────
  const bannerFound = detectCookieBanner();
  chrome.storage.local.set({
    bannerDetected: bannerFound,
    pageUrl: window.location.href,
    pageHostname: window.location.hostname,
  });

  // ── Listen for messages from popup ──────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_COOKIE_INFO') {
      sendResponse({
        bannerDetected: bannerFound,
        hostname: window.location.hostname,
      });
    }

    if (message.type === 'APPLY_CONSENT') {
      // Future: interact with the actual banner based on consent choices
      console.log('[ClearConsent] Consent applied:', message.choices);
      sendResponse({ ok: true });
    }
  });
})();
