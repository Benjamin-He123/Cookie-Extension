// background.js

// Simple heuristic to classify cookies and generate explanations.
function classifyCookie(cookie) {
  const name = cookie.name.toLowerCase();
  const domain = cookie.domain.toLowerCase();

  let category = "unknown";
  let explanation = "This cookie does not match a known pattern; treat it as 'unknown' until you learn more.";

  // Necessary / functional
  if (
    name.includes("session") ||
    name.includes("csrftoken") ||
    name.includes("xsrf") ||
    name.includes("auth") ||
    name.includes("secure") ||
    name.includes("essential")
  ) {
    category = "necessary";
    explanation =
      "Likely needed for core site features such as staying logged in, keeping items in your cart, or preventing fraud.";
  }
  // Analytics / low risk-ish
  else if (
    name.includes("ga") ||
    name.includes("_gid") ||
    name.includes("analytics") ||
    name.includes("amplitude") ||
    name.includes("segment")
  ) {
    category = "analytics";
    explanation =
      "Used for analytics and measuring traffic. It tracks how you move around the site, which can impact your privacy but is often used in aggregate.";
  }
  // Advertising / high risk
  else if (
    name.includes("ad") ||
    name.includes("ads") ||
    name.includes("pixel") ||
    name.includes("track") ||
    name.includes("gclid") ||
    name.includes("fbp") ||
    name.includes("fbc") ||
    name.includes("doubleclick")
  ) {
    category = "advertising";
    explanation =
      "Likely used for advertising or cross-site tracking, which can follow you across different sites to build a profile for targeted ads.";
  }

  // Very long-lived cookies are more privacy-sensitive.
  const now = Date.now() / 1000;
  if (cookie.expirationDate && cookie.expirationDate - now > 60 * 60 * 24 * 365) {
    explanation += " It is long-lived, so it can track you for a long time unless you clear it.";
  }

  return { category, explanation };
}

// Fetch cookies for the current tab URL and annotate them.
function getCookiesForTab(tab, sendResponse) {
  if (!tab || !tab.url || !tab.url.startsWith("http")) {
    sendResponse({ cookies: [], url: null });
    return;
  }

  const url = tab.url;

  chrome.cookies.getAll({ url }, (cookies) => {
    const detailed = cookies.map((cookie) => {
      const { category, explanation } = classifyCookie(cookie);
      return {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        category,
        explanation
      };
    });

    sendResponse({
      cookies: detailed,
      url
    });
  });
}

// Remove selected cookies by name for a given URL, then report counts.
function blockCookiesForUrl(url, cookieNames, sendResponse) {
  if (!url || !url.startsWith("http") || !cookieNames || cookieNames.length === 0) {
    sendResponse({ removedCount: 0, remainingCount: 0 });
    return;
  }

  chrome.cookies.getAll({ url }, (allCookies) => {
    const targets = allCookies.filter((c) => cookieNames.includes(c.name));

    if (targets.length === 0) {
      chrome.cookies.getAll({ url }, (remaining) => {
        sendResponse({
          removedCount: 0,
          remainingCount: remaining.length
        });
      });
      return;
    }

    let removedCount = 0;
    let pending = targets.length;

    const doneOne = () => {
      pending -= 1;
      if (pending === 0) {
        chrome.cookies.getAll({ url }, (remaining) => {
          sendResponse({
            removedCount,
            remainingCount: remaining.length
          });
        });
      }
    };

    targets.forEach((cookie) => {
      chrome.cookies.remove(
        {
          url,
          name: cookie.name,
          storeId: cookie.storeId
        },
        (details) => {
          if (details) {
            removedCount += 1;
          }
          doneOne();
        }
      );
    });
  });
}

// Message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_COOKIES_FOR_PAGE") {
    chrome.tabs.get(sender.tab.id, (tab) => {
      getCookiesForTab(tab, sendResponse);
    });
    return true; // async
  }

  if (message.type === "BLOCK_SELECTED_COOKIES") {
    const { url, cookieNames } = message;
    blockCookiesForUrl(url, cookieNames, sendResponse);
    return true; // async
  }

  return false;
});
