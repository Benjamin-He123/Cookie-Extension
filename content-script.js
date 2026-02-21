// content-script.js – ClearConsent v2

let helperShown = false;
let currentLang = "en";
let ttsEnabled  = false;
let currentCookies = [];
let pageUrl = "";

// ─── i18n strings ─────────────────────────────────────────────────────────────
const T = {
  en: {
    title:        "ClearConsent",
    subtitle:     (site) => `Cookies detected on ${site}. Review each one and block what you don't need.`,
    ttsBtn:       "🎙 Voice",
    ttsStop:      "⏹ Stop",
    applyBtn:     "Block selected",
    ignoreBtn:    "Ignore",
    applyingBtn:  "Blocking…",
    doneBtn:      "Done ✓",
    noCookies:    "No cookies visible yet. Some sites set cookies only after you interact with the page.",
    tip:          "Advertising & social cookies are pre-selected. Security, performance, and necessary cookies keep the site working — leave those unchecked.",
    blocking:     "Removing selected cookies…",
    noneSelected: "No cookies selected — nothing was changed.",
    removedMsg:   (r, rem) => `✓ Removed ${r} cookie${r !== 1 ? "s" : ""}. ${rem} remain.`,
    noApiKey:     "No API key set — showing heuristic descriptions. Add your Anthropic key in the popup.",
    loadingDesc:  "Asking AI for explanation…",
    expiresDays:  (d) => `Expires in ${d} day${d !== 1 ? "s" : ""}`,
    expiresSession: "Session cookie",
    httpOnly:     "HttpOnly",
    secure:       "Secure",
    tabSummary:   "🛡  Summary",
    tabCookies:   (n) => `🍪  Cookies (${n})`,
    usedFor:      "Used for",
    sharesData:   "Shares data with third parties",
    sharesYes:    "Yes",
    sharesNo:     "Unlikely",
    sharesSub:    "Data may reach ad networks or analytics providers.",
    sharesNoSub:  "No obvious third-party tracking detected.",
    storesFor:    "Stores cookies for",
    sessionOnly:  "Session only",
    sessionSub:   "Cookies expire when you close your browser.",
    persistSub:   "Cookies persist until expiry or you clear them.",
    selectAll:    "Select all",
  },
  fr: {
    title:        "ClearConsent",
    subtitle:     (site) => `Cookies détectés sur ${site}. Examinez chaque cookie et bloquez ce dont vous n'avez pas besoin.`,
    ttsBtn:       "🎙 Voix",
    ttsStop:      "⏹ Arrêter",
    applyBtn:     "Bloquer la sélection",
    ignoreBtn:    "Ignorer",
    applyingBtn:  "Blocage…",
    doneBtn:      "Terminé ✓",
    noCookies:    "Aucun cookie visible pour l'instant. Certains sites définissent des cookies après interaction.",
    tip:          "Les cookies publicitaires et sociaux sont présélectionnés. Sécurité, performance et nécessaires font fonctionner le site — laissez-les décochés.",
    blocking:     "Suppression des cookies sélectionnés…",
    noneSelected: "Aucun cookie sélectionné — rien n'a été modifié.",
    removedMsg:   (r, rem) => `✓ ${r} cookie${r !== 1 ? "s" : ""} supprimé${r !== 1 ? "s" : ""}. ${rem} restant${rem !== 1 ? "s" : ""}.`,
    noApiKey:     "Aucune clé API — descriptions heuristiques. Ajoutez votre clé Anthropic dans la fenêtre contextuelle.",
    loadingDesc:  "Demande d'explication à l'IA…",
    expiresDays:  (d) => `Expire dans ${d} jour${d !== 1 ? "s" : ""}`,
    expiresSession: "Cookie de session",
    httpOnly:     "HttpSeulement",
    secure:       "Sécurisé",
    tabSummary:   "🛡  Résumé",
    tabCookies:   (n) => `🍪  Cookies (${n})`,
    usedFor:      "Utilisé pour",
    sharesData:   "Partage avec des tiers",
    sharesYes:    "Oui",
    sharesNo:     "Peu probable",
    sharesSub:    "Des données peuvent être partagées avec des régies publicitaires ou d'analyse.",
    sharesNoSub:  "Aucun suivi tiers évident détecté.",
    storesFor:    "Durée de stockage",
    sessionOnly:  "Session seulement",
    sessionSub:   "Les cookies expirent à la fermeture du navigateur.",
    persistSub:   "Les cookies persistent jusqu'à leur expiration ou suppression.",
    selectAll:    "Tout sélectionner",
  }
};

function t(key, ...args) {
  const val = T[currentLang]?.[key] ?? T.en[key];
  return typeof val === "function" ? val(...args) : val;
}

// ─── Pill label maps ──────────────────────────────────────────────────────────
const PILL_LABELS = {
  en: {
    advertising:    "Advertising",
    behaviour:      "Session Recording",
    session_replay: "Session Recording",
    analytics:      "Analytics",
    ab_testing:     "A/B Testing",
    social:         "Social Media",
    social_media:   "Social Media",
    security:       "Security",
    necessary:      "Necessary",
    authentication: "Login / Auth",
    performance:    "Performance",
    personalisation:"Personalisation",
    preferences:    "Preferences",
    shopping:       "Shopping",
    live_chat:      "Live Chat",
    functional:     "Functional",
  },
  fr: {
    advertising:    "Publicité",
    behaviour:      "Enregistrement",
    session_replay: "Enregistrement",
    analytics:      "Analytique",
    ab_testing:     "Test A/B",
    social:         "Réseaux sociaux",
    social_media:   "Réseaux sociaux",
    security:       "Sécurité",
    necessary:      "Nécessaire",
    authentication: "Connexion",
    performance:    "Performance",
    personalisation:"Personnalisation",
    preferences:    "Préférences",
    shopping:       "Achats",
    live_chat:      "Chat en direct",
    functional:     "Fonctionnel",
  }
};

function pillLabel(cat) {
  return (PILL_LABELS[currentLang] || PILL_LABELS.en)[cat] || cat;
}

// ─── Colour scheme ────────────────────────────────────────────────────────────
const C = {
  bg:      "#0f1117",
  surface: "#181c26",
  border:  "#252a38",
  text:    "#e8eaf0",
  muted:   "#6b7280",
  accent:  "#6366f1",
  aGlow:   "rgba(99,102,241,0.15)",
};

// Pill colour schemes keyed by category
const PILL_SCHEMES = {
  necessary:      { bg:"#052e16",  color:"#4ade80",  dot:"#22c55e"  },
  security:       { bg:"#052e16",  color:"#4ade80",  dot:"#22c55e"  },
  performance:    { bg:"#0f2027",  color:"#67e8f9",  dot:"#22d3ee"  },
  personalisation:{ bg:"#1e1b4b",  color:"#c4b5fd",  dot:"#a78bfa"  },
  preferences:    { bg:"#1e1b4b",  color:"#c4b5fd",  dot:"#a78bfa"  },
  analytics:      { bg:"#1e3a5f",  color:"#93c5fd",  dot:"#60a5fa"  },
  ab_testing:     { bg:"#1c3040",  color:"#7dd3fc",  dot:"#38bdf8"  },
  authentication: { bg:"#0f1f2e",  color:"#7dd3fc",  dot:"#38bdf8"  },
  behaviour:      { bg:"#3b1f00",  color:"#fdba74",  dot:"#fb923c"  },
  session_replay: { bg:"#431407",  color:"#fb923c",  dot:"#f97316"  },
  social:         { bg:"#4a1d4b",  color:"#f0abfc",  dot:"#e879f9"  },
  social_media:   { bg:"#4a1d4b",  color:"#f0abfc",  dot:"#e879f9"  },
  live_chat:      { bg:"#1a2e1a",  color:"#86efac",  dot:"#4ade80"  },
  shopping:       { bg:"#1c2433",  color:"#94a3b8",  dot:"#64748b"  },
  advertising:    { bg:"#450a0a",  color:"#fca5a5",  dot:"#f87171"  },
  functional:     { bg:"#1c2433",  color:"#94a3b8",  dot:"#64748b"  },
};

function makePill(cat) {
  const s = PILL_SCHEMES[cat] || { bg:"#1c1f2e", color:"#9ca3af", dot:"#6b7280" };
  const el = document.createElement("span");
  el.textContent = pillLabel(cat).toUpperCase();
  Object.assign(el.style, {
    display:"inline-flex", alignItems:"center", gap:"4px",
    fontSize:"9px", fontWeight:"700", letterSpacing:"0.08em",
    padding:"3px 8px", borderRadius:"999px",
    background:s.bg, color:s.color, flexShrink:"0",
  });
  const dot = document.createElement("span");
  Object.assign(dot.style, { width:"5px", height:"5px", borderRadius:"50%", background:s.dot, flexShrink:"0" });
  el.prepend(dot);
  return el;
}

// ─── Heuristic descriptions ───────────────────────────────────────────────────
function heuristicDescription(cookie) {
  const name   = cookie.name.toLowerCase();
  const domain = (cookie.domain || "").toLowerCase();
  const lang   = currentLang;

  // Named cookie lookup
  const known = {
    "_ga":       { en: `Google Analytics ID for ${domain}. Assigns you a random visitor number so Google can count unique visitors and pages viewed. Your browsing data is sent to Google's servers.`, fr: `Identifiant Google Analytics pour ${domain}. Attribue un numéro de visiteur aléatoire afin que Google puisse mesurer les pages vues. Vos données sont envoyées à Google.` },
    "_gid":      { en: `Google Analytics session ID. Tracks which pages you visit on ${domain} during the current 24-hour period before expiring.`, fr: `ID de session Google Analytics. Suit les pages visitées sur ${domain} pendant 24 heures.` },
    "_gat":      { en: `Google Analytics request-limiter. Briefly stored to prevent too many data requests being sent to Google at once — contains no personal browsing data itself.`, fr: `Limiteur de requêtes Google Analytics. Évite l'envoi de trop de données à Google en même temps.` },
    "_fbp":      { en: `Facebook Pixel tracking cookie. Records your behaviour on ${domain} and shares it with Facebook so the site can show you targeted ads on Facebook and Instagram, even after you leave.`, fr: `Cookie de suivi Facebook Pixel. Enregistre votre comportement sur ${domain} et le partage avec Facebook pour vous montrer des publicités ciblées.` },
    "_fbc":      { en: `Facebook Click ID. Created when you arrive at ${domain} by clicking a Facebook ad — links your visit here to your Facebook ad account for conversion reporting.`, fr: `Identifiant de clic Facebook. Créé quand vous arrivez sur ${domain} via une publicité Facebook — relie votre visite à votre compte publicitaire.` },
    "fbp":       { en: `Facebook Pixel tracking cookie. Records your behaviour on ${domain} and shares it with Facebook so the site can show you targeted ads on Facebook and Instagram.`, fr: `Cookie de suivi Facebook Pixel. Enregistre votre comportement sur ${domain} et le partage avec Facebook pour des publicités ciblées.` },
    "gclid":     { en: `Google Ads Click ID. Created when you click a Google ad before landing on ${domain}. Lets the site tell Google which ad led to your visit, purchase, or signup.`, fr: `Identifiant de clic Google Ads. Créé quand vous cliquez sur une annonce Google avant d'arriver sur ${domain}. Permet au site de dire à Google quelle annonce a conduit à votre visite.` },
    "msclkid":   { en: `Microsoft Ads Click ID. Same concept as Google's GCLID but for Bing/Microsoft advertising — tracks which ad brought you to ${domain}.`, fr: `Identifiant de clic Microsoft Ads. Équivalent du GCLID Google mais pour la publicité Bing — suit quelle annonce vous a amené sur ${domain}.` },
    "csrftoken": { en: `Security token that prevents cross-site request forgery attacks. Generated fresh for each session and never leaves this site — contains no information about you.`, fr: `Jeton de sécurité qui protège contre les attaques CSRF. Généré à chaque session, il ne contient aucune information personnelle.` },
    "xsrf":      { en: `Cross-site request forgery protection token. Required for forms and account actions to work safely — contains no personal data.`, fr: `Jeton de protection CSRF. Requis pour que les formulaires fonctionnent en toute sécurité — ne contient pas de données personnelles.` },
    "_hjid":     { en: `Hotjar visitor ID for ${domain}. Hotjar records mouse movements, clicks, and scrolling to create session replays that the site owner can watch. It can record sensitive on-screen content.`, fr: `Identifiant visiteur Hotjar pour ${domain}. Hotjar enregistre les mouvements de souris et les clics pour créer des replays de session que le site peut regarder.` },
    "_hjsessionuser": { en: `Hotjar session user token. Links your current browsing session to the Hotjar session replay recording for this visit on ${domain}.`, fr: `Jeton de session Hotjar. Relie votre navigation actuelle à l'enregistrement de session Hotjar sur ${domain}.` },
    "_clck":     { en: `Microsoft Clarity visitor ID. Clarity records your clicks, scrolls, and navigation on ${domain} as a video replay that the site owner can watch — including what you type in some fields.`, fr: `Identifiant visiteur Microsoft Clarity. Clarity enregistre vos clics et navigations sur ${domain} sous forme de replay vidéo.` },
    "_clsk":     { en: `Microsoft Clarity session key. Groups your page views on ${domain} into a single session replay recording.`, fr: `Clé de session Microsoft Clarity. Regroupe vos pages vues sur ${domain} en un seul enregistrement de session.` },
    "amp_":      { en: `Amplitude analytics cookie. Tracks which features you use and the sequence of actions you take on ${domain}, used to analyse product usage patterns.`, fr: `Cookie d'analyse Amplitude. Suit les fonctionnalités utilisées et la séquence de vos actions sur ${domain}.` },
    "__td":      { en: `Treasure Data analytics cookie. Tracks your session and behaviour on ${domain} for data warehouse analytics — your data may be shared with third-party data platforms.`, fr: `Cookie d'analyse Treasure Data. Suit votre session sur ${domain} — vos données peuvent être partagées avec des plateformes tierces.` },
    "nmstat":    { en: `NetMetrics visitor statistics cookie for ${domain}. Counts unique visitors and measures time spent on pages — data stays relatively contained to this site's analytics account.`, fr: `Cookie de statistiques NetMetrics pour ${domain}. Compte les visiteurs uniques et mesure le temps passé sur les pages.` },
    "__cf_bm":   { en: `Cloudflare Bot Management cookie. Identifies whether your browser is a human or a bot to protect ${domain} from automated attacks — contains no personal data.`, fr: `Cookie de gestion des bots Cloudflare. Détermine si votre navigateur est humain pour protéger ${domain} — ne contient pas de données personnelles.` },
    "cf_clearance": { en: `Cloudflare security clearance token. Proves you passed a Cloudflare CAPTCHA or browser challenge for ${domain} — expires quickly and holds no personal information.`, fr: `Jeton de sécurité Cloudflare. Prouve que vous avez passé un défi CAPTCHA pour ${domain} — expire rapidement.` },
    "lidc":      { en: `LinkedIn data centre routing cookie. Chooses which LinkedIn server handles your requests — purely technical and contains no user-identifying data.`, fr: `Cookie de routage de centre de données LinkedIn. Choisit quel serveur LinkedIn traite vos requêtes — purement technique.` },
    "bcookie":   { en: `LinkedIn browser ID cookie. Uniquely identifies your browser to LinkedIn for ad targeting and fraud prevention purposes, active across sites that use LinkedIn.`, fr: `Cookie d'identifiant de navigateur LinkedIn. Identifie votre navigateur pour le ciblage publicitaire LinkedIn et la prévention des fraudes.` },
    "cto_":      { en: `Criteo advertising ID. Criteo is a major retargeting company — this cookie tracks your browsing across many different websites to show you personalised ads based on products you've viewed.`, fr: `Identifiant publicitaire Criteo. Criteo est une grande société de reciblage — ce cookie suit votre navigation sur de nombreux sites pour vous montrer des publicités personnalisées.` },
    "awsalb":    { en: `AWS load balancer routing cookie for ${domain}. Keeps you connected to the same server during your visit for consistency — contains no personal data.`, fr: `Cookie de routage AWS pour ${domain}. Vous maintient connecté au même serveur pour la cohérence — ne contient pas de données personnelles.` },
    "s_vi":      { en: `Adobe Analytics visitor ID for ${domain}. Adobe's equivalent of Google's _ga cookie — assigns you a unique ID and tracks pages visited, links clicked, and time spent on the site.`, fr: `Identifiant visiteur Adobe Analytics pour ${domain}. Équivalent Adobe du cookie _ga de Google — suit les pages visitées et le temps passé.` },
    "s_cc":      { en: `Adobe Analytics cookie check. Simply records whether your browser accepts cookies so the analytics system knows whether tracking is possible.`, fr: `Vérification de cookies Adobe Analytics. Enregistre simplement si votre navigateur accepte les cookies.` },
  };

  for (const [key, val] of Object.entries(known)) {
    if (name.startsWith(key.toLowerCase()) || name === key.toLowerCase()) {
      return val[lang] || val.en;
    }
  }

  // Category-based fallback
  const cat = cookie.category || "functional";
  const expiry = cookie.expiresInDays != null
    ? (lang === "fr" ? `, valide ${cookie.expiresInDays} jours` : `, valid for ${cookie.expiresInDays} days`)
    : (lang === "fr" ? ", cookie de session" : ", session cookie");

  const catDescriptions = {
    advertising:    { en: `Advertising/tracking cookie "${cookie.name}" on ${domain}${expiry}. Likely used to build a profile of your browsing interests and serve you targeted ads on this and other websites.`, fr: `Cookie publicitaire "${cookie.name}" sur ${domain}${expiry}. Probablement utilisé pour construire un profil de vos intérêts et vous montrer des publicités ciblées sur ce site et d'autres.` },
    behaviour:      { en: `Session recording cookie "${cookie.name}" on ${domain}${expiry}. A behaviour analytics tool is recording your mouse movements, clicks, and scrolling. The site owner can replay a video of your visit.`, fr: `Cookie d'enregistrement de session "${cookie.name}" sur ${domain}${expiry}. Un outil d'analyse enregistre vos mouvements de souris et clics. Le propriétaire du site peut visionner votre visite.` },
    session_replay: { en: `Session replay cookie "${cookie.name}" on ${domain}${expiry}. Records your on-screen activity as a video. The site team can watch a playback of exactly what you did during this visit.`, fr: `Cookie de replay de session "${cookie.name}" sur ${domain}${expiry}. Enregistre votre activité sous forme de vidéo que l'équipe du site peut visionner.` },
    analytics:      { en: `Analytics cookie "${cookie.name}" on ${domain}${expiry}. Measures how visitors use this site — pages viewed, time spent, clicks — to help the site team understand usage patterns.`, fr: `Cookie d'analyse "${cookie.name}" sur ${domain}${expiry}. Mesure comment les visiteurs utilisent ce site — pages vues, temps passé, clics.` },
    ab_testing:     { en: `A/B test cookie "${cookie.name}" on ${domain}${expiry}. Places you into an experiment group so the site can compare different versions of pages and features.`, fr: `Cookie de test A/B "${cookie.name}" sur ${domain}${expiry}. Vous place dans un groupe d'expérience pour comparer différentes versions de pages.` },
    social:         { en: `Social media cookie "${cookie.name}" from ${domain}${expiry}. Set by a social platform embedded on this page. It can track whether you're logged in and link your activity to your social profile.`, fr: `Cookie de réseau social "${cookie.name}" depuis ${domain}${expiry}. Défini par une plateforme sociale intégrée. Peut relier votre activité ici à votre profil social.` },
    social_media:   { en: `Social media cookie "${cookie.name}" from ${domain}${expiry}. Originates from a social platform widget embedded on this page. May track your presence across sites using the same social network's tools.`, fr: `Cookie de réseau social "${cookie.name}" depuis ${domain}${expiry}. Provient d'un widget de réseau social intégré. Peut vous suivre sur différents sites.` },
    security:       { en: `Security cookie "${cookie.name}" on ${domain}${expiry}. Protects you and the site from automated attacks, fraud, or forged requests. Does not track your behaviour and contains no browsing history.`, fr: `Cookie de sécurité "${cookie.name}" sur ${domain}${expiry}. Protège contre les attaques automatisées et la fraude. Ne suit pas votre comportement.` },
    necessary:      { en: `Functional cookie "${cookie.name}" on ${domain}${expiry}. Required for a core feature of the site to work — such as keeping you logged in, maintaining your cart, or remembering a form step.`, fr: `Cookie fonctionnel "${cookie.name}" sur ${domain}${expiry}. Nécessaire pour une fonction principale du site — comme rester connecté ou maintenir votre panier.` },
    authentication: { en: `Login session cookie "${cookie.name}" on ${domain}${expiry}. Keeps you authenticated between page loads. Without it you would be signed out every time you navigate.`, fr: `Cookie de session de connexion "${cookie.name}" sur ${domain}${expiry}. Vous maintient authentifié entre les pages. Sans lui, vous seriez déconnecté à chaque navigation.` },
    performance:    { en: `Performance/CDN cookie "${cookie.name}" on ${domain}${expiry}. Used by the site's infrastructure to route your requests to the fastest or most appropriate server. Contains no personal data.`, fr: `Cookie de performance/CDN "${cookie.name}" sur ${domain}${expiry}. Utilisé pour router vos requêtes vers le serveur le plus rapide. Ne contient pas de données personnelles.` },
    personalisation:{ en: `Personalisation cookie "${cookie.name}" on ${domain}${expiry}. Remembers your choices or browsing patterns to tailor what you see — such as recently viewed items, language, or region.`, fr: `Cookie de personnalisation "${cookie.name}" sur ${domain}${expiry}. Mémorise vos préférences pour adapter ce que vous voyez — comme les articles récemment consultés.` },
    preferences:    { en: `Preferences cookie "${cookie.name}" on ${domain}${expiry}. Stores your personal settings for this site such as language, region, theme, or whether you've dismissed a notice.`, fr: `Cookie de préférences "${cookie.name}" sur ${domain}${expiry}. Stocke vos paramètres personnels comme la langue, la région ou le thème.` },
    shopping:       { en: `Shopping cookie "${cookie.name}" on ${domain}${expiry}. Keeps track of items in your cart or checkout progress so your selections aren't lost when you navigate between pages.`, fr: `Cookie d'achat "${cookie.name}" sur ${domain}${expiry}. Conserve les articles dans votre panier ou votre progression en caisse entre les pages.` },
    live_chat:      { en: `Live chat cookie "${cookie.name}" on ${domain}${expiry}. Set by the customer support chat widget. Maintains your conversation session so your chat history isn't lost if you reload.`, fr: `Cookie de chat en direct "${cookie.name}" sur ${domain}${expiry}. Défini par le widget de support client. Maintient votre session de conversation.` },
    functional:     { en: `Site cookie "${cookie.name}" on ${domain}${expiry}. Likely used by ${domain} for internal site functionality. Check the site's cookie policy for details.`, fr: `Cookie du site "${cookie.name}" sur ${domain}${expiry}. Probablement utilisé par ${domain} pour les fonctionnalités internes. Consultez la politique de cookies du site pour plus de détails.` },
  };

  const desc = catDescriptions[cat] || catDescriptions.functional;
  return desc[lang] || desc.en;
}

// ─── Banner detection ─────────────────────────────────────────────────────────
function looksLikeCookieBanner(el) {
  if (!el?.textContent) return false;
  const text = el.textContent.toLowerCase();
  return (
    (text.includes("cookie") || text.includes("gdpr") || text.includes("privacy")) &&
    (text.includes("accept") || text.includes("agree") || text.includes("consent") || text.includes("allow"))
  );
}

function findCookieBanner() {
  const candidates = document.querySelectorAll(
    "div, section, aside, dialog, footer, [role='dialog'], [role='alertdialog']"
  );
  for (const el of candidates) {
    if (el.offsetParent === null) continue;
    if (looksLikeCookieBanner(el)) return el;
  }
  return null;
}

// ─── Summary data builder ─────────────────────────────────────────────────────
const THIRD_PARTY_SIGNALS = [
  "fbp","fbc","fbq","gclid","doubleclick","pixel","criteo",
  "taboola","outbrain","_ga","segment","amplitude","hotjar",
  "_hjid","_clck","msclkid","lidc","bcookie","cto_",
];

function buildSummary(cookies) {
  const cats = new Set(cookies.map(c => c.category || "functional"));

  const purposeMap = [
    { cats: ["analytics","ab_testing"],        label: currentLang === "fr" ? "Analyse"          : "Analytics"         },
    { cats: ["advertising"],                    label: currentLang === "fr" ? "Publicité"         : "Advertising"       },
    { cats: ["behaviour","session_replay"],     label: currentLang === "fr" ? "Enregistrement"    : "Session Recording" },
    { cats: ["social","social_media"],          label: currentLang === "fr" ? "Réseaux sociaux"   : "Social Media"      },
    { cats: ["personalisation","preferences"],  label: currentLang === "fr" ? "Personnalisation"  : "Personalisation"   },
    { cats: ["authentication","necessary"],     label: currentLang === "fr" ? "Fonctionnement"    : "Core Functionality" },
    { cats: ["performance"],                    label: currentLang === "fr" ? "Performance"       : "Performance"       },
    { cats: ["security"],                       label: currentLang === "fr" ? "Sécurité"          : "Security"          },
    { cats: ["shopping"],                       label: currentLang === "fr" ? "Achats"            : "Shopping"          },
    { cats: ["live_chat"],                      label: currentLang === "fr" ? "Chat"              : "Live Chat"         },
  ];
  const purposes = purposeMap
    .filter(p => p.cats.some(c => cats.has(c)))
    .map(p => p.label);
  if (purposes.length === 0) purposes.push(currentLang === "fr" ? "Fonctionnement" : "Core Functionality");

  const names = cookies.map(c => c.name.toLowerCase());
  const sharesData = names.some(n => THIRD_PARTY_SIGNALS.some(sig => n.includes(sig)));

  let maxDays = 0;
  cookies.forEach(c => { if (c.expiresInDays != null && c.expiresInDays > maxDays) maxDays = c.expiresInDays; });
  const maxMonths = maxDays / 30;
  let lifetimeStr = t("sessionOnly");
  if (maxMonths > 23)     lifetimeStr = currentLang === "fr" ? `${Math.round(maxMonths / 12)} ans`  : `${Math.round(maxMonths / 12)} years`;
  else if (maxMonths > 1) lifetimeStr = currentLang === "fr" ? `${Math.round(maxMonths)} mois`      : `${Math.round(maxMonths)} months`;
  else if (maxMonths > 0) lifetimeStr = currentLang === "fr" ? "Moins d'un mois"                    : "Less than a month";

  return { purposes, sharesData, lifetimeStr };
}

// ─── Build the bar UI ─────────────────────────────────────────────────────────
function buildBar(cookies, url) {
  const bar = document.createElement("div");
  bar.id = "cc-bar";
  Object.assign(bar.style, {
    position:"fixed", top:"0", left:"0", right:"0",
    zIndex:"2147483647",
    background:C.bg, color:C.text,
    fontFamily:"'SF Pro Display','Segoe UI',system-ui,sans-serif",
    fontSize:"13px", lineHeight:"1.5",
    boxShadow:"0 1px 0 "+C.border+", 0 4px 24px rgba(0,0,0,0.5)",
    borderBottom:"1px solid "+C.border,
  });

  const summary = buildSummary(cookies);

  const wrap = document.createElement("div");
  Object.assign(wrap.style, { maxWidth:"900px", margin:"0 auto", padding:"0 16px" });

  // ── Tab row ───────────────────────────────────────────────────────────────
  let activeTab = "summary";

  const tabRow = document.createElement("div");
  Object.assign(tabRow.style, {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    borderBottom:"1px solid "+C.border, paddingTop:"10px",
  });

  const tabsLeft = document.createElement("div");
  tabsLeft.style.display = "flex";

  function makeTabBtn(label, id) {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
      border:"none", background:"transparent",
      color: id === activeTab ? C.text : C.muted,
      fontSize:"12px", fontWeight:"600",
      padding:"6px 14px 8px", cursor:"pointer",
      borderBottom: id === activeTab ? "2px solid "+C.accent : "2px solid transparent",
      transition:"color .15s, border-color .15s", letterSpacing:"0.02em",
    });
    return btn;
  }

  const tabSummaryBtn = makeTabBtn(t("tabSummary"), "summary");
  const tabCookiesBtn = makeTabBtn(t("tabCookies", cookies.length), "cookies");

  // Right side controls: Voice + Language + Close
  const tabRight = document.createElement("div");
  Object.assign(tabRight.style, { display:"flex", alignItems:"center", gap:"6px", paddingBottom:"6px" });

  const ttsBtn = document.createElement("button");
  ttsBtn.id = "cc-tts-btn";
  ttsBtn.textContent = t("ttsBtn");
  Object.assign(ttsBtn.style, {
    border:"1px solid "+C.border, background:C.surface, color:C.muted,
    borderRadius:"6px", fontSize:"11px", fontWeight:"600",
    padding:"4px 10px", cursor:"pointer", transition:"background .15s, color .15s",
  });
  ttsBtn.addEventListener("mouseover", () => { if (!ttsEnabled) ttsBtn.style.color = C.text; });
  ttsBtn.addEventListener("mouseout",  () => { if (!ttsEnabled) ttsBtn.style.color = C.muted; });
  ttsBtn.addEventListener("click", () => toggleTTS(cookies));

  const langSelect = document.createElement("select");
  Object.assign(langSelect.style, {
    background:C.surface, border:"1px solid "+C.border, color:C.muted,
    borderRadius:"6px", fontSize:"11px", padding:"4px 6px", cursor:"pointer",
  });
  langSelect.innerHTML = `<option value="en">🌐 EN</option><option value="fr">🌐 FR</option>`;
  langSelect.value = currentLang;
  langSelect.addEventListener("change", (e) => {
    currentLang = e.target.value;
    chrome.storage.sync.set({ ccLang: currentLang });
    rebuildBar();
  });

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&#x2715;";
  Object.assign(closeBtn.style, {
    border:"none", background:"transparent", color:C.muted,
    cursor:"pointer", fontSize:"14px", padding:"4px 6px", lineHeight:"1",
  });
  closeBtn.addEventListener("mouseover", () => closeBtn.style.color = C.text);
  closeBtn.addEventListener("mouseout",  () => closeBtn.style.color = C.muted);
  closeBtn.addEventListener("click", () => { stopTTS(); bar.remove(); });

  tabRight.append(ttsBtn, langSelect, closeBtn);
  tabsLeft.append(tabSummaryBtn, tabCookiesBtn);
  tabRow.append(tabsLeft, tabRight);

  // ── Summary Panel ─────────────────────────────────────────────────────────
  const summaryPanel = document.createElement("div");
  Object.assign(summaryPanel.style, {
    padding:"14px 0 12px",
    display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px",
  });

  function card(icon, title) {
    const c = document.createElement("div");
    Object.assign(c.style, {
      background:C.surface, borderRadius:"10px",
      border:"1px solid "+C.border, padding:"12px 14px",
    });
    const head = document.createElement("div");
    Object.assign(head.style, { display:"flex", alignItems:"center", gap:"6px", marginBottom:"8px" });
    head.innerHTML = `<span style="font-size:14px">${icon}</span>
      <span style="font-size:10px;font-weight:700;letter-spacing:.08em;color:${C.muted};text-transform:uppercase">${title}</span>`;
    c.appendChild(head);
    return c;
  }

  // Card 1: Purposes
  const purposeCard = card("📊", t("usedFor"));
  const purposeList = document.createElement("div");
  Object.assign(purposeList.style, { display:"flex", flexWrap:"wrap", gap:"5px" });
  summary.purposes.forEach(p => {
    const tag = document.createElement("span");
    tag.textContent = p;
    Object.assign(tag.style, {
      fontSize:"11px", fontWeight:"500", padding:"3px 8px", borderRadius:"6px",
      background:C.aGlow, color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.25)",
    });
    purposeList.appendChild(tag);
  });
  purposeCard.appendChild(purposeList);

  // Card 2: Third-party sharing
  const tpCard = card("🌐", t("sharesData"));
  const tpVal = document.createElement("div");
  tpVal.textContent = summary.sharesData ? t("sharesYes") : t("sharesNo");
  Object.assign(tpVal.style, {
    fontSize:"14px", fontWeight:"600",
    color: summary.sharesData ? "#f87171" : "#4ade80",
  });
  const tpSub = document.createElement("div");
  tpSub.textContent = summary.sharesData ? t("sharesSub") : t("sharesNoSub");
  Object.assign(tpSub.style, { fontSize:"11px", color:C.muted, marginTop:"2px" });
  tpCard.append(tpVal, tpSub);

  // Card 3: Cookie lifetime
  const ltCard = card("🕐", t("storesFor"));
  const ltVal = document.createElement("div");
  ltVal.textContent = summary.lifetimeStr;
  Object.assign(ltVal.style, { fontSize:"14px", fontWeight:"600", color:C.text });
  const ltSub = document.createElement("div");
  ltSub.textContent = summary.lifetimeStr === t("sessionOnly") ? t("sessionSub") : t("persistSub");
  Object.assign(ltSub.style, { fontSize:"11px", color:C.muted, marginTop:"2px" });
  ltCard.append(ltVal, ltSub);

  summaryPanel.append(purposeCard, tpCard, ltCard);

  // ── Cookies Panel — grouped by category with collapsible sections ─────────
  const cookiesPanel = document.createElement("div");
  cookiesPanel.id = "cc-cookies-panel";
  Object.assign(cookiesPanel.style, {
    display:"none", flexDirection:"column",
    padding:"8px 0 4px", maxHeight:"40vh", overflowY:"auto",
  });

  // Scrollbar + details/summary reset styles
  const scrollStyle = document.createElement("style");
  scrollStyle.textContent = `
    #cc-cookies-panel::-webkit-scrollbar{width:4px}
    #cc-cookies-panel::-webkit-scrollbar-track{background:transparent}
    #cc-cookies-panel::-webkit-scrollbar-thumb{background:#2d3148;border-radius:2px}
    #cc-cookies-panel details>summary{list-style:none}
    #cc-cookies-panel details>summary::-webkit-details-marker{display:none}
  `;
  document.head.appendChild(scrollStyle);

  if (!cookies.length) {
    const empty = document.createElement("div");
    Object.assign(empty.style, { fontSize:"12px", color:C.muted, padding:"12px 0" });
    empty.textContent = t("noCookies");
    cookiesPanel.appendChild(empty);
  } else {
    const AUTO_BLOCK_CATS = new Set(["advertising","social","social_media","behaviour","session_replay"]);
    const CAT_ORDER = ["advertising","behaviour","session_replay","social","social_media","analytics","ab_testing","personalisation","preferences","shopping","live_chat","performance","authentication","necessary","security","functional"];

    const groups = new Map();
    cookies.forEach(c => {
      const cat = c.category || "functional";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(c);
    });

    const sortedCats = [...groups.keys()].sort((a, b) => {
      const ai = CAT_ORDER.indexOf(a), bi = CAT_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });

    sortedCats.forEach(cat => {
      const catCookies = groups.get(cat);
      const isOpen = AUTO_BLOCK_CATS.has(cat);

      const details = document.createElement("details");
      if (isOpen) details.open = true;
      Object.assign(details.style, { borderBottom:"1px solid "+C.border });

      // Group header
      const summaryEl = document.createElement("summary");
      Object.assign(summaryEl.style, {
        display:"flex", alignItems:"center", gap:"8px",
        padding:"8px 4px", cursor:"pointer", borderRadius:"6px",
        userSelect:"none", transition:"background .1s",
      });
      summaryEl.addEventListener("mouseover", () => summaryEl.style.background = C.surface);
      summaryEl.addEventListener("mouseout",  () => summaryEl.style.background = "transparent");

      // Select-all checkbox for this category
      const selectAll = document.createElement("input");
      selectAll.type = "checkbox";
      const initChecked = catCookies.filter(c => AUTO_BLOCK_CATS.has(c.category)).length;
      selectAll.checked = initChecked > 0 && initChecked === catCookies.length;
      selectAll.indeterminate = initChecked > 0 && initChecked < catCookies.length;
      Object.assign(selectAll.style, { accentColor:C.accent, cursor:"pointer", flexShrink:"0" });
      selectAll.title = t("selectAll");
      selectAll.addEventListener("click", (e) => {
        e.stopPropagation();
        const state = selectAll.checked;
        details.querySelectorAll("input[data-cookie-name]").forEach(cb => cb.checked = state);
        selectAll.indeterminate = false;
      });

      const catPill = makePill(cat);

      const catCount = document.createElement("span");
      catCount.textContent = catCookies.length;
      Object.assign(catCount.style, {
        fontSize:"10px", fontWeight:"700",
        background:C.border, color:C.muted,
        borderRadius:"999px", padding:"1px 7px",
        minWidth:"20px", textAlign:"center",
      });

      const chevron = document.createElement("span");
      chevron.textContent = "▾";
      Object.assign(chevron.style, { marginLeft:"auto", fontSize:"11px", color:C.muted, transition:"transform .2s ease" });

      details.addEventListener("toggle", () => {
        chevron.style.transform = details.open ? "rotate(180deg)" : "";
      });

      // Keep select-all in sync when individual checkboxes change
      details.addEventListener("change", (e) => {
        if (!e.target.dataset.cookieName) return;
        const allCbs = [...details.querySelectorAll("input[data-cookie-name]")];
        const checked = allCbs.filter(c => c.checked).length;
        selectAll.checked = checked === allCbs.length;
        selectAll.indeterminate = checked > 0 && checked < allCbs.length;
      });

      summaryEl.append(selectAll, catPill, catCount, chevron);
      details.appendChild(summaryEl);

      // Cookie rows inside group
      const body = document.createElement("div");
      Object.assign(body.style, { padding:"0 0 8px 8px", display:"flex", flexDirection:"column", gap:"4px" });

      catCookies.forEach(cookie => {
        const row = document.createElement("label");
        Object.assign(row.style, {
          display:"grid", gridTemplateColumns:"18px 1fr",
          gap:"10px", alignItems:"flex-start",
          background:C.surface, borderRadius:"8px",
          border:"1px solid "+C.border, padding:"8px 10px",
          cursor:"pointer", transition:"border-color .15s",
        });
        row.addEventListener("mouseover", () => row.style.borderColor = C.accent);
        row.addEventListener("mouseout",  () => row.style.borderColor = C.border);

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.dataset.cookieName = cookie.name;
        cb.checked = AUTO_BLOCK_CATS.has(cookie.category);
        cb.style.accentColor = C.accent;
        cb.style.marginTop = "3px";

        const info = document.createElement("div");

        const nameEl = document.createElement("div");
        nameEl.textContent = cookie.name + "  ·  " + cookie.domain;
        Object.assign(nameEl.style, {
          fontSize:"12px", fontWeight:"600", color:C.text,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        });

        const metaEl = document.createElement("div");
        const expireStr = cookie.expiresInDays != null ? t("expiresDays", cookie.expiresInDays) : t("expiresSession");
        const flags = [expireStr];
        if (cookie.httpOnly) flags.push(t("httpOnly"));
        if (cookie.secure)   flags.push(t("secure"));
        metaEl.textContent = flags.join(" · ");
        Object.assign(metaEl.style, { fontSize:"10px", color:C.muted, marginTop:"1px", marginBottom:"3px" });

        const descEl = document.createElement("div");
        descEl.id = `cc-desc-${cookie.name.replace(/[^a-z0-9]/gi, "_")}`;
        descEl.textContent = t("loadingDesc");
        Object.assign(descEl.style, { fontSize:"11px", color:"#4b5563", fontStyle:"italic" });

        info.append(nameEl, metaEl, descEl);
        row.append(cb, info);
        body.appendChild(row);
      });

      details.appendChild(body);
      cookiesPanel.appendChild(details);
    });
  }

  // ── Bottom action bar ──────────────────────────────────────────────────────
  const bottomBar = document.createElement("div");
  Object.assign(bottomBar.style, {
    display:"none", alignItems:"center", justifyContent:"space-between",
    padding:"8px 0 10px", borderTop:"1px solid "+C.border, gap:"10px",
  });

  const statusMsg = document.createElement("div");
  Object.assign(statusMsg.style, { fontSize:"11px", color:C.muted, flex:"1" });
  statusMsg.textContent = t("tip");

  const btnGroup = document.createElement("div");
  Object.assign(btnGroup.style, { display:"flex", gap:"6px", flexShrink:"0" });

  function makeActionBtn(label, primary) {
    const b = document.createElement("button");
    b.textContent = label;
    Object.assign(b.style, {
      fontSize:"11px", fontWeight:"600", padding:"6px 14px", borderRadius:"8px",
      border: primary ? "none" : "1px solid "+C.border,
      background: primary ? C.accent : "transparent",
      color: primary ? "#fff" : C.muted, cursor:"pointer",
    });
    b.addEventListener("mouseover", () => b.style.opacity = "0.85");
    b.addEventListener("mouseout",  () => b.style.opacity = "1");
    return b;
  }

  const applyBtn = makeActionBtn(t("applyBtn"), true);
  const skipBtn  = makeActionBtn(t("ignoreBtn"), false);

  skipBtn.addEventListener("click", () => { stopTTS(); bar.remove(); });

  applyBtn.addEventListener("click", () => {
    const toBlock = [];
    bar.querySelectorAll("input[type='checkbox'][data-cookie-name]:checked").forEach(cb => {
      toBlock.push(cb.dataset.cookieName);
    });
    if (!toBlock.length) { statusMsg.textContent = t("noneSelected"); return; }
    applyBtn.disabled = true;
    applyBtn.textContent = t("applyingBtn");
    statusMsg.textContent = t("blocking");
    chrome.runtime.sendMessage({ type:"BLOCK_SELECTED_COOKIES", url, cookieNames:toBlock }, (res) => {
      applyBtn.disabled = false;
      if (!res) {
        statusMsg.textContent = "No response — check DevTools → Application → Cookies.";
        applyBtn.textContent = t("applyBtn");
        return;
      }
      statusMsg.textContent = t("removedMsg", res.removedCount, res.remainingCount);
      applyBtn.textContent = t("doneBtn");
      applyBtn.style.background = "#16a34a";
    });
  });

  btnGroup.append(applyBtn, skipBtn);
  bottomBar.append(statusMsg, btnGroup);

  // ── Tab switching ──────────────────────────────────────────────────────────
  function setTab(id) {
    activeTab = id;
    summaryPanel.style.display = id === "summary" ? "grid" : "none";
    cookiesPanel.style.display = id === "cookies" ? "flex" : "none";
    bottomBar.style.display    = id === "cookies" ? "flex" : "none";
    [[tabSummaryBtn, "summary"], [tabCookiesBtn, "cookies"]].forEach(([btn, tid]) => {
      btn.style.color        = activeTab === tid ? C.text  : C.muted;
      btn.style.borderBottom = activeTab === tid ? "2px solid "+C.accent : "2px solid transparent";
    });
  }

  tabSummaryBtn.addEventListener("click", () => setTab("summary"));
  tabCookiesBtn.addEventListener("click", () => setTab("cookies"));

  // ── Assemble ───────────────────────────────────────────────────────────────
  wrap.append(tabRow, summaryPanel, cookiesPanel, bottomBar);
  bar.appendChild(wrap);
  document.documentElement.style.scrollPaddingTop = "60px";
  document.body.prepend(bar);
  setTab("summary");

  // Load descriptions asynchronously
  loadDescriptions(cookies, url);
}

// ─── Load AI or fallback descriptions ────────────────────────────────────────
function loadDescriptions(cookies, url) {
  chrome.storage.sync.get("claudeApiKey", ({ claudeApiKey }) => {
    if (claudeApiKey) {
      chrome.runtime.sendMessage(
        { type:"GENERATE_AI_DESCRIPTIONS", cookies, url, lang: currentLang, apiKey: claudeApiKey },
        (res) => {
          if (res?.success && Array.isArray(res.descriptions)) {
            res.descriptions.forEach(({ name, description }) => {
              const el = document.getElementById(`cc-desc-${name.replace(/[^a-z0-9]/gi, "_")}`);
              if (el) { el.textContent = description; el.style.fontStyle = "normal"; el.style.color = C.muted; }
            });
          } else {
            setHeuristicDescriptions(cookies);
          }
        }
      );
    } else {
      setHeuristicDescriptions(cookies);
    }
  });
}

function setHeuristicDescriptions(cookies) {
  cookies.forEach(cookie => {
    const el = document.getElementById(`cc-desc-${cookie.name.replace(/[^a-z0-9]/gi, "_")}`);
    if (el) { el.textContent = heuristicDescription(cookie); el.style.fontStyle = "normal"; el.style.color = C.muted; }
  });
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
let ttsUtterance = null;

function buildTTSScript(cookies) {
  const lang = currentLang === "fr" ? "fr-FR" : "en-US";
  const site = (() => { try { return new URL(pageUrl).hostname; } catch { return pageUrl; } })();
  const cats = [...new Set(cookies.map(c => pillLabel(c.category || "functional")))];

  let script;
  if (currentLang === "fr") {
    script  = `Résumé de confidentialité pour ${site}. `;
    script += `${cookies.length} cookie${cookies.length !== 1 ? "s" : ""} détecté${cookies.length !== 1 ? "s" : ""}. `;
    script += `Catégories présentes : ${cats.join(", ")}. `;
    cookies.slice(0, 5).forEach(c => {
      const desc = document.getElementById(`cc-desc-${c.name.replace(/[^a-z0-9]/gi, "_")}`)?.textContent || "";
      script += `Cookie ${c.name} — ${pillLabel(c.category || "functional")}. ${desc} `;
    });
    if (cookies.length > 5) script += `Et ${cookies.length - 5} cookies supplémentaires non lus.`;
  } else {
    script  = `Privacy summary for ${site}. `;
    script += `${cookies.length} cookie${cookies.length !== 1 ? "s" : ""} detected. `;
    script += `Categories present: ${cats.join(", ")}. `;
    cookies.slice(0, 5).forEach(c => {
      const desc = document.getElementById(`cc-desc-${c.name.replace(/[^a-z0-9]/gi, "_")}`)?.textContent || "";
      script += `Cookie ${c.name} — ${pillLabel(c.category || "functional")}. ${desc} `;
    });
    if (cookies.length > 5) script += `And ${cookies.length - 5} more cookies not read aloud.`;
  }

  return { script, lang };
}

function toggleTTS(cookies) {
  const btn = document.getElementById("cc-tts-btn");
  if (ttsEnabled) { stopTTS(); return; }

  ttsEnabled = true;
  if (btn) { btn.textContent = t("ttsStop"); btn.style.color = C.text; btn.style.background = "#1e2a5e"; }

  const { script, lang } = buildTTSScript(cookies);
  ttsUtterance = new SpeechSynthesisUtterance(script);
  ttsUtterance.lang = lang;
  ttsUtterance.rate = 0.95;
  ttsUtterance.onend = () => {
    ttsEnabled = false;
    if (btn) { btn.textContent = t("ttsBtn"); btn.style.color = C.muted; btn.style.background = C.surface; }
  };
  window.speechSynthesis.speak(ttsUtterance);
}

function stopTTS() {
  window.speechSynthesis.cancel();
  ttsEnabled = false;
  ttsUtterance = null;
  const btn = document.getElementById("cc-tts-btn");
  if (btn) { btn.textContent = t("ttsBtn"); btn.style.color = C.muted; btn.style.background = C.surface; }
}

// ─── Rebuild on language change ───────────────────────────────────────────────
function rebuildBar() {
  stopTTS();
  const bar = document.getElementById("cc-bar");
  if (bar) bar.remove();
  helperShown = false;
  if (currentCookies.length || pageUrl) {
    chrome.runtime.sendMessage({ type:"GET_COOKIES_FOR_PAGE" }, (res) => {
      if (!res) return;
      currentCookies = res.cookies || [];
      pageUrl = res.url || "";
      helperShown = true;
      buildBar(currentCookies, pageUrl);
    });
  }
}

// ─── Entry ────────────────────────────────────────────────────────────────────
function showHelperForPage() {
  chrome.storage.sync.get("ccLang", ({ ccLang }) => {
    if (ccLang) currentLang = ccLang;
    chrome.runtime.sendMessage({ type:"GET_COOKIES_FOR_PAGE" }, (res) => {
      if (!res) return;
      currentCookies = res.cookies || [];
      pageUrl = res.url || "";
      helperShown = true;
      buildBar(currentCookies, pageUrl);
    });
  });
}

function setupBannerWatcher() {
  if (findCookieBanner()) { showHelperForPage(); return; }
  const observer = new MutationObserver(() => {
    if (helperShown) return;
    if (findCookieBanner()) { showHelperForPage(); observer.disconnect(); }
  });
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupBannerWatcher);
} else {
  setupBannerWatcher();
}
