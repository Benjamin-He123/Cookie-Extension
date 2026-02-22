// popup.js – Obben Obstruct Privacy

const btnEn = document.getElementById("btnEn");
const btnFr = document.getElementById("btnFr");

// ─── Load saved language preference ──────────────────────────────────────────
chrome.storage.sync.get("ccLang", ({ ccLang }) => {
  setActiveLang(ccLang || "en");
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
