// background.js –  KrumblED
// Handles cookie reading, blocking, and relays AI description requests to Claude.

// ─── Category definitions ────────────────────────────────────────────────────
// 8 specific categories replacing the useless "unknown" bucket.
//
// Category        Risk    What it means to the user
// necessary       1–2     Site breaks without it (login, cart, CSRF, language)
// analytics       4–6     Site owner counts visits/clicks — usually anonymised
// behaviour       5–7     Records what you click, scroll, hover — session replay
// advertising     8–9     Follows you across the web to serve targeted ads
// social          6–8     Social network knows you visited even if you didn't click
// personalisation 3–4     Remembers your preferences (theme, language, region)
// security        1–2     Detects bots, fraud, suspicious login attempts
// performance     2–3     CDN / load-balancing — purely technical, no profiling

const CATEGORY_RULES = [
  // ── Advertising / cross-site tracking ───────────────────────────────────
  {
    cat: "advertising",
    risk: [8, 9],
    patterns: [
      "fbp","_fbp","fbc","_fbc",               // Facebook Pixel
      "gclid","gclsrc","dclid","gbraid","wbraid", // Google Ads
      "ttclid","_tt_",                           // TikTok
      "doubleclick","__gads","__gpi","ide",      // Google DV360
      "criteo","cto_","crto",                    // Criteo
      "adroll","__ar_",                          // AdRoll
      "outbrain","obuid",                        // Outbrain
      "taboola","trc_cookie",                    // Taboola
      "anj","uuid2","sess","usersync",           // AppNexus/Xandr
      "lidc","bcookie","bscookie",               // LinkedIn Ads
      "pardot","visitor_id",                     // Salesforce Pardot
      "mautic","mtc_",                           // Mautic
      "rpb","rps","rpc","rubiconproject",        // Rubicon
      "ib_uid","ad_","ads_","adtech",
      "pixel","pxl","pxc",
      "track","trk","trkid",
      "aff_","affiliate",
      "impact_",                                 // Impact.com
      "__exponea","xp-",                         // Bloomreach
      "kwid","kw_id",                            // Kenshoo
      "msclkid",                                 // Microsoft Ads
      "sizmek",
    ]
  },
  // ── Behaviour / session replay ───────────────────────────────────────────
  {
    cat: "behaviour",
    risk: [5, 7],
    patterns: [
      "_hjid","_hjsessionuser","_hjfirstseen","_hjincludedinsessionre", // Hotjar
      "fullstory","fs_","__fs",                  // FullStory
      "lr_","logrocket",                          // LogRocket
      "QuantumMetricUserID","QuantumMetricSessionID","qm_", // Quantum Metric
      "mouseflow","mf_",                          // Mouseflow
      "smartlook","sl_",                          // Smartlook
      "clarity","_clck","_clsk",                  // Microsoft Clarity
      "inspectlet","wcsid",                       // Inspectlet
      "contentsquare","_cs_",                     // ContentSquare
    ]
  },
  // ── Analytics / traffic measurement ─────────────────────────────────────
  {
    cat: "analytics",
    risk: [4, 6],
    patterns: [
      "_ga","_gid","_gat","__ga",               // Google Analytics (UA + GA4)
      "amplitude","amp_","ampld",               // Amplitude
      "ajs_","segment",                          // Segment
      "heap","heapid",                           // Heap
      "mixpanel","mp_",                          // Mixpanel
      "optimizely","optimizelyid",               // Optimizely
      "vwo_","vis_opt",                          // VWO
      "ab_","abtasty",                           // AB Tasty
      "nmstat","nmt_",                           // NetMetrics
      "td_","__td","td_s_",                      // Treasure Data
      "sitecatalyst","s_vi","s_fid","s_cc",     // Adobe Analytics
      "chartbeat","__chartbeat",                  // Chartbeat
      "parsely","pxcm",                          // Parse.ly
      "piano","tp_",                             // Piano Analytics
      "matomo","pk_",                             // Matomo
      "countly","cly_",                          // Countly
      "woopra",                                  // Woopra
      "kissmetrics","km_",                       // Kissmetrics
    ]
  },
  // ── Social media widgets ─────────────────────────────────────────────────
  {
    cat: "social",
    risk: [6, 8],
    patterns: [
      "fr","datr","sb","xs","c_user",            // Facebook login/presence
      "twitter_sess","twid","ct0","guest_id",    // Twitter/X
      "li_at","li_gc","JSESSIONID","li_oatml",  // LinkedIn
      "sid","ssid","sapisid","apisid","hsid",    // Google/YouTube
      "pin_unauth","_pinterest_",                // Pinterest
      "snap_","sc_at",                           // Snapchat
      "ttwid","tt_chain_token",                  // TikTok social
      "reddit_session","reddit_",                // Reddit
    ]
  },
  // ── Security / anti-fraud / bot detection ────────────────────────────────
  {
    cat: "security",
    risk: [1, 2],
    patterns: [
      "csrf","csrftoken","xsrf","_xsrf",
      "__Host-","__Secure-",
      "recaptcha","rc_","g_csrf",
      "akamai","ak_bmsc","bm_sv","bm_sz",       // Akamai Bot Manager
      "incap_ses","visid_incap","nlbi_",         // Imperva Incapsula
      "distil_","d_id",                          // Distil Networks
      "datadome","dd_",                          // DataDome
      "perimeterx","px_",                        // PerimeterX
      "cf_clearance","__cf_bm","cf_ob_info",    // Cloudflare
      "f5_",                                     // F5 / Shape Security
      "ts_","ts01","tsrce",                      // ThreatMetrix
      "fraudscore","fs_token",
      "sec_cpt","x-ms-cpim",
    ]
  },
  // ── Personalisation / preferences ────────────────────────────────────────
  {
    cat: "personalisation",
    risk: [2, 4],
    patterns: [
      "pref","preference","prefs",
      "locale","lang","language","i18n",
      "region","country","currency","timezone",
      "theme","darkmode","colormode","color_scheme",
      "font_size","accessibility",
      "wishlist","recently_viewed","last_visit",
      "cookie_consent","cookieconsent","gdpr_",
      "banner_dismissed","notice_gdpr",
      "newsletter_","email_pref",
      "notifications_",
    ]
  },
  // ── Performance / CDN / load balancing ──────────────────────────────────
  {
    cat: "performance",
    risk: [1, 2],
    patterns: [
      "lb_","load_balancer","serverid","server_id",
      "awsalb","awselbcors","awselb",            // AWS ALB
      "bIPs","bcdn",                             // Bunny CDN
      "cloudfront","cf_use_ob",                 // CloudFront
      "stickysession","sticky_",
      "route","backend","upstream",
      "geoip","geo_","countrycode",
      "cdn_uid","cdn_",
    ]
  },
  // ── Necessary / functional ───────────────────────────────────────────────
  {
    cat: "necessary",
    risk: [1, 2],
    patterns: [
      "session","sess","sessionid","phpsessid","jsessionid",
      "auth","authenticated","login","logged_in","remember_me",
      "token","access_token","refresh_token","id_token",
      "cart","basket","bag","checkout","order",
      "essential","__utmz_required",
      "user_id","userid","uid",                  // own-site user identity
      "account","profile",
      "feature_flag","ff_",                      // own-site feature flags
      "a11y","aria_",                            // accessibility settings
      "cookie_policy","tc_",
    ]
  },
];

// ─── Categorize cookie into one of 8 specific buckets ───────────────────────
function categorize(cookie) {
  const name = cookie.name.toLowerCase();
  const domain = (cookie.domain || "").toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(p => name.includes(p.toLowerCase()) || domain.includes(p.toLowerCase()))) {
      return rule.cat;
    }
  }

  // Last-resort inference from cookie properties instead of "unknown"
  if (cookie.httpOnly && cookie.secure) return "necessary";      // server-only secure cookies are usually functional
  if (!cookie.httpOnly && cookie.expirationDate) return "analytics"; // readable long-lived = likely tracking
  return "personalisation";                                       // catchall: user-specific but not clearly harmful
}

// ─── Risk scoring ─────────────────────────────────────────────────────────────
// Derives a 1–10 risk score using the same CATEGORY_RULES taxonomy so
// categorization and scoring are always consistent.
function scoreCookie(cookie) {
  const name   = cookie.name.toLowerCase();
  const domain = (cookie.domain || "").toLowerCase();
  const combined = name + " " + domain;

  // Find matching rule and pick a score from its [min, max] range
  let baseScore = 4; // default: treat as mildly uncertain
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(p => combined.includes(p.toLowerCase()))) {
      const [lo, hi] = rule.risk;
      baseScore = lo + Math.floor(Math.random() * (hi - lo + 1));
      break;
    }
  }

  // Modifiers
  const now = Date.now() / 1000;
  if (cookie.expirationDate && cookie.expirationDate - now > 60 * 60 * 24 * 365) {
    baseScore = Math.min(10, baseScore + 1); // long-lived = more risk
  }
  if (cookie.httpOnly) {
    baseScore = Math.max(1, baseScore - 1); // httpOnly = less JS-accessible = slightly safer
  }

  return Math.max(1, Math.min(10, baseScore));
}
// ─── Fetch and annotate cookies ───────────────────────────────────────────────
function getCookiesForTab(tab, sendResponse) {
  if (!tab || !tab.url || !tab.url.startsWith("http")) {
    sendResponse({ cookies: [], url: null });
    return;
  }

  chrome.cookies.getAll({ url: tab.url }, (cookies) => {
    const detailed = cookies.map((cookie) => {
      const risk = scoreCookie(cookie);
      const category = categorize(cookie);
      const now = Date.now() / 1000;
      const daysLeft = cookie.expirationDate
        ? Math.round((cookie.expirationDate - now) / 86400)
        : null;

      return {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expiresInDays: daysLeft,
        risk,
        category,
      };
    });

    // Sort by risk descending
    detailed.sort((a, b) => b.risk - a.risk);

    // Overall risk = weighted average leaning toward high-risk outliers
    const overallRisk = detailed.length
      ? Math.round(
          detailed.reduce((sum, c) => sum + c.risk * c.risk, 0) /
          detailed.reduce((sum, c) => sum + c.risk, 0)
        )
      : 1;

    sendResponse({ cookies: detailed, url: tab.url, overallRisk });
  });
}

// ─── Block selected cookies ───────────────────────────────────────────────────
function blockCookiesForUrl(url, cookieNames, sendResponse) {
  if (!url || !cookieNames?.length) {
    sendResponse({ removedCount: 0, remainingCount: 0 });
    return;
  }

  chrome.cookies.getAll({ url }, (allCookies) => {
    const targets = allCookies.filter(c => cookieNames.includes(c.name));
    if (!targets.length) {
      sendResponse({ removedCount: 0, remainingCount: allCookies.length });
      return;
    }

    let removedCount = 0;
    let pending = targets.length;

    const done = () => {
      pending--;
      if (pending === 0) {
        chrome.cookies.getAll({ url }, remaining => {
          sendResponse({ removedCount, remainingCount: remaining.length });
        });
      }
    };

    targets.forEach(cookie => {
      chrome.cookies.remove({ url, name: cookie.name, storeId: cookie.storeId }, (details) => {
        if (details) removedCount++;
        done();
      });
    });
  });
}

// ─── Claude AI description relay ─────────────────────────────────────────────
// Content scripts can't call api.anthropic.com directly (CORS), so we relay here.
async function generateCookieDescription(cookies, url, lang, apiKey) {
  const cookieList = cookies.map(c =>
    `- name: "${c.name}", domain: "${c.domain}", httpOnly: ${c.httpOnly}, secure: ${c.secure}, category: "${c.category}", expiresInDays: ${c.expiresInDays ?? "session"}`
  ).join("\n");

  const langInstruction = lang === "fr"
    ? "Respond entirely in French."
    : "Respond entirely in English.";

  const prompt = `You are a privacy expert explaining browser cookies to everyday users on the website: ${url}

${langInstruction}

Here are the cookies found on the page:
${cookieList}

For EACH cookie, write a plain-language explanation (1–2 sentences) of what it likely does based on its name, domain, and attributes. Be specific to that cookie — do not give generic answers. Focus on the actual privacy impact for the user. Do not use jargon.

Respond ONLY with a JSON array in this exact format, no markdown, no extra text:
[
  { "name": "cookie_name", "description": "your plain-language explanation here" },
  ...
]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API ${res.status}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text?.trim() || "[]";

  // Strip markdown fences if present
  const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

// ─── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_COOKIES_FOR_PAGE") {
    chrome.tabs.get(sender.tab.id, tab => getCookiesForTab(tab, sendResponse));
    return true;
  }

  if (message.type === "GET_COOKIES_FOR_TAB") {
    // Called from popup (no sender.tab)
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      getCookiesForTab(tabs[0], sendResponse);
    });
    return true;
  }

  if (message.type === "BLOCK_SELECTED_COOKIES") {
    blockCookiesForUrl(message.url, message.cookieNames, sendResponse);
    return true;
  }

  if (message.type === "GENERATE_AI_DESCRIPTIONS") {
    const { cookies, url, lang, apiKey } = message;
    generateCookieDescription(cookies, url, lang, apiKey)
      .then(result => sendResponse({ success: true, descriptions: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  return false;
});
