/**
 * ClearConsent – background.js (Service Worker)
 * Handles persistent consent preferences and badge updates.
 */

// Show badge when a cookie banner is detected
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.bannerDetected) {
    if (changes.bannerDetected.newValue === true) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#fb923c' });
      chrome.action.setBadgeTextColor({ color: '#fff' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});

// Clear badge when tab navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '' });
  }
});
