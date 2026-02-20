// content-script.js

let helperShown = false;

// Basic heuristics to detect a cookie-consent / "accept all" banner.
function looksLikeCookieBanner(el) {
  if (!el || !el.textContent) return false;
  const text = el.textContent.toLowerCase();

  const hasCookieWords =
    text.includes("cookies") ||
    text.includes("cookie policy") ||
    text.includes("cookie settings") ||
    text.includes("cookie preferences");

  const hasAcceptAll =
    text.includes("accept all cookies") ||
    text.includes("accept all") ||
    text.includes("allow all cookies");

  return hasCookieWords && hasAcceptAll;
}

// Scan current DOM for a likely cookie banner.
function findCookieBanner() {
  const candidates = Array.from(document.querySelectorAll("div, section, aside, dialog, footer"));

  for (const el of candidates) {
    if (el.offsetParent === null) continue; // skip invisible
    if (looksLikeCookieBanner(el)) {
      return el;
    }
  }
  return null;
}

// Create the Honey-style top bar.
function createHelperBar(cookies, pageUrl) {
  if (helperShown) return;
  helperShown = true;

  const bar = document.createElement("div");
  bar.id = "cookie-helper-bar";
  bar.style.position = "fixed";
  bar.style.top = "0";
  bar.style.left = "0";
  bar.style.right = "0";
  bar.style.zIndex = "2147483647";
  bar.style.background = "#111827";
  bar.style.color = "#f9fafb";
  bar.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  bar.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
  bar.style.padding = "10px 14px";
  bar.style.display = "flex";
  bar.style.flexDirection = "column";
  bar.style.gap = "8px";
  bar.style.maxHeight = "40vh";
  bar.style.overflow = "hidden";

  const headerRow = document.createElement("div");
  headerRow.style.display = "flex";
  headerRow.style.justifyContent = "space-between";
  headerRow.style.alignItems = "center";
  headerRow.style.gap = "8px";

  const title = document.createElement("div");
  title.textContent = "Cookie Helper: understand and control this site's cookies";
  title.style.fontWeight = "600";
  title.style.fontSize = "14px";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.border = "none";
  closeBtn.style.background = "transparent";
  closeBtn.style.color = "#9ca3af";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "14px";
  closeBtn.addEventListener("mouseover", () => (closeBtn.style.color = "#e5e7eb"));
  closeBtn.addEventListener("mouseout", () => (closeBtn.style.color = "#9ca3af"));
  closeBtn.addEventListener("click", () => {
    bar.remove();
  });

  headerRow.appendChild(title);
  headerRow.appendChild(closeBtn);

  const subtitle = document.createElement("div");
  subtitle.style.fontSize = "12px";
  subtitle.style.color = "#d1d5db";
  subtitle.textContent =
    "This appeared when the site asked you to 'accept all cookies'. Choose which categories you want to block. High‑risk cookies are usually for ads and tracking across sites.";

  const listContainer = document.createElement("div");
  listContainer.style.display = "flex";
  listContainer.style.flexDirection = "column";
  listContainer.style.gap = "4px";
  listContainer.style.overflowY = "auto";
  listContainer.style.maxHeight = "22vh";
  listContainer.style.marginTop = "4px";
  listContainer.style.paddingRight = "4px";

  if (!cookies || cookies.length === 0) {
    const empty = document.createElement("div");
    empty.style.fontSize = "12px";
    empty.style.color = "#e5e7eb";
    empty.textContent =
      "No cookies are visible yet. Some sites only set cookies after you click the banner or start using the page.";
    listContainer.appendChild(empty);
  } else {
    cookies.forEach((cookie) => {
      const row = document.createElement("label");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "auto 1fr auto";
      row.style.gap = "6px";
      row.style.alignItems = "flex-start";
      row.style.fontSize = "11px";
      row.style.background = "#111827";
      row.style.borderRadius = "4px";
      row.style.padding = "4px 6px";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.style.marginTop = "3px";

      // Default: pre-check "advertising" cookies to block, leave others off.
      if (cookie.category === "advertising") {
        checkbox.checked = true;
      }

      const main = document.createElement("div");
      const nameDom = document.createElement("div");
      nameDom.textContent = `${cookie.name}  ·  ${cookie.domain}`;
      nameDom.style.fontWeight = "500";

      const expl = document.createElement("div");
      expl.textContent = cookie.explanation;
      expl.style.color = "#d1d5db";

      main.appendChild(nameDom);
      main.appendChild(expl);

      const pill = document.createElement("div");
      pill.textContent = cookie.category;
      pill.style.fontSize = "10px";
      pill.style.padding = "2px 6px";
      pill.style.borderRadius = "999px";
      pill.style.textTransform = "uppercase";
      pill.style.letterSpacing = "0.04em";

      if (cookie.category === "necessary") {
        pill.style.background = "#065f46";
        pill.style.color = "#d1fae5";
      } else if (cookie.category === "analytics") {
        pill.style.background = "#1d4ed8";
        pill.style.color = "#dbeafe";
      } else if (cookie.category === "advertising") {
        pill.style.background = "#b91c1c";
        pill.style.color = "#fee2e2";
      } else {
        pill.style.background = "#4b5563";
        pill.style.color = "#e5e7eb";
      }

      // Attach meta so we know which cookies to block.
      checkbox.dataset.cookieName = cookie.name;

      row.appendChild(checkbox);
      row.appendChild(main);
      row.appendChild(pill);

      listContainer.appendChild(row);
    });
  }

  const bottomRow = document.createElement("div");
  bottomRow.style.display = "flex";
  bottomRow.style.justifyContent = "space-between";
  bottomRow.style.alignItems = "center";
  bottomRow.style.marginTop = "4px";
  bottomRow.style.gap = "8px";

  const info = document.createElement("div");
  info.style.fontSize = "11px";
  info.style.color = "#9ca3af";
  info.textContent =
    "Tip: uncheck only the high‑risk/advertising cookies if you want to keep basic site features working.";

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.gap = "6px";

  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply and block selected";
  applyBtn.style.fontSize = "11px";
  applyBtn.style.padding = "5px 10px";
  applyBtn.style.borderRadius = "999px";
  applyBtn.style.border = "none";
  applyBtn.style.cursor = "pointer";
  applyBtn.style.background = "#f97316";
  applyBtn.style.color = "#111827";
  applyBtn.style.fontWeight = "600";

  const skipBtn = document.createElement("button");
  skipBtn.textContent = "Ignore for now";
  skipBtn.style.fontSize = "11px";
  skipBtn.style.padding = "5px 10px";
  skipBtn.style.borderRadius = "999px";
  skipBtn.style.border = "1px solid #4b5563";
  skipBtn.style.background = "transparent";
  skipBtn.style.color = "#e5e7eb";
  skipBtn.style.cursor = "pointer";

  skipBtn.addEventListener("click", () => {
    bar.remove();
  });

  applyBtn.addEventListener("click", () => {
    const checkboxes = bar.querySelectorAll("input[type='checkbox'][data-cookie-name]");
    const toBlock = [];
    checkboxes.forEach((cb) => {
      if (cb.checked) {
        toBlock.push(cb.dataset.cookieName);
      }
    });

    if (toBlock.length === 0) {
      info.textContent = "You did not choose any cookies to block. Nothing was changed.";
      return;
    }

    applyBtn.disabled = true;
    applyBtn.textContent = "Blocking...";
    info.textContent = "Blocking selected cookies for this page…";

    chrome.runtime.sendMessage(
      {
        type: "BLOCK_SELECTED_COOKIES",
        url: pageUrl,
        cookieNames: toBlock
      },
      (response) => {
        applyBtn.disabled = false;

        if (!response) {
          info.textContent =
            "Could not confirm blocking (no response from extension). Check DevTools → Application → Cookies manually.";
          return;
        }

        const { removedCount, remainingCount } = response;

        info.textContent = `Removed ${removedCount} cookies. About ${remainingCount} cookies remain for this site. To verify, open DevTools → Application → Storage → Cookies and compare the list before and after.`;
        applyBtn.textContent = "Done";
        applyBtn.style.background = "#22c55e";
        applyBtn.style.color = "#052e16";
      }
    );
  });

  buttons.appendChild(applyBtn);
  buttons.appendChild(skipBtn);

  bottomRow.appendChild(info);
  bottomRow.appendChild(buttons);

  bar.appendChild(headerRow);
  bar.appendChild(subtitle);
  bar.appendChild(listContainer);
  bar.appendChild(bottomRow);

  // Push page content down a bit so bar doesn't cover critical UI.
  document.documentElement.style.scrollPaddingTop = "60px";

  document.body.appendChild(bar);
}

// Ask background for cookies and then render the UI.
function showHelperForPage() {
  chrome.runtime.sendMessage({ type: "GET_COOKIES_FOR_PAGE" }, (response) => {
    if (!response) return;
    createHelperBar(response.cookies || [], response.url);
  });
}

// Watch DOM for cookie banners and trigger helper once.
function setupBannerWatcher() {
  const initialBanner = findCookieBanner();
  if (initialBanner) {
    showHelperForPage();
    return;
  }

  const observer = new MutationObserver(() => {
    if (helperShown) return;
    const banner = findCookieBanner();
    if (banner) {
      showHelperForPage();
      observer.disconnect();
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
}

// Run when content script loads.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupBannerWatcher);
} else {
  setupBannerWatcher();
}
