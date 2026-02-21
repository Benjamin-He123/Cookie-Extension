// popup.js – ClearConsent v2

const apiKeyInput  = document.getElementById("apiKeyInput");
const saveKeyBtn   = document.getElementById("saveKeyBtn");
const keyDot       = document.getElementById("keyDot");
const keyStatusText= document.getElementById("keyStatusText");
const saveStatus   = document.getElementById("save-status");
const btnEn        = document.getElementById("btnEn");
const btnFr        = document.getElementById("btnFr");

// ─── Load saved state ─────────────────────────────────────────────────────────
chrome.storage.sync.get(["claudeApiKey", "ccLang"], ({ claudeApiKey, ccLang }) => {
  if (claudeApiKey) {
    keyDot.classList.add("ok");
    keyStatusText.textContent = "API key saved ✓ (ends in …" + claudeApiKey.slice(-4) + ")";
    apiKeyInput.placeholder = "sk-ant-••••••••" + claudeApiKey.slice(-4);
  }

  const lang = ccLang || "en";
  setActiveLang(lang);
});

// ─── Save API key ─────────────────────────────────────────────────────────────
saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus("Enter a key first.", "err");
    return;
  }
  if (!key.startsWith("sk-ant-")) {
    showStatus("Key should start with sk-ant-", "err");
    return;
  }

  showStatus("Verifying…", "");
  saveKeyBtn.disabled = true;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }]
      })
    });

    if (res.ok || res.status === 529 || res.status === 529) {
      chrome.storage.sync.set({ claudeApiKey: key });
      keyDot.classList.add("ok");
      keyDot.classList.remove("err");
      keyStatusText.textContent = "API key saved ✓ (ends in …" + key.slice(-4) + ")";
      apiKeyInput.value = "";
      apiKeyInput.placeholder = "sk-ant-••••••••" + key.slice(-4);
      showStatus("✓ Key saved and verified!", "ok");
    } else if (res.status === 401) {
      keyDot.classList.add("err");
      showStatus("✗ Invalid key — double-check and retry.", "err");
    } else {
      chrome.storage.sync.set({ claudeApiKey: key });
      showStatus("✓ Saved (verification inconclusive — network issue).", "ok");
    }
  } catch {
    // Offline — save anyway
    chrome.storage.sync.set({ claudeApiKey: key });
    keyDot.classList.add("ok");
    apiKeyInput.value = "";
    showStatus("✓ Key saved (offline, not verified).", "ok");
  }

  saveKeyBtn.disabled = false;
});

// ─── Language toggle ──────────────────────────────────────────────────────────
btnEn.addEventListener("click", () => saveLang("en"));
btnFr.addEventListener("click", () => saveLang("fr"));

function saveLang(lang) {
  chrome.storage.sync.set({ ccLang: lang });
  setActiveLang(lang);
}

function setActiveLang(lang) {
  btnEn.classList.toggle("active", lang === "en");
  btnFr.classList.toggle("active", lang === "fr");
}

// ─── Status helper ────────────────────────────────────────────────────────────
function showStatus(msg, cls) {
  saveStatus.textContent = msg;
  saveStatus.className = cls;
}
