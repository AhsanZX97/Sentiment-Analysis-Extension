// Runs on gmgn.ai. Extracts the contract address from the URL and the ticker
// from the page, and keeps the side panel informed across GMGN's SPA navigation.

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function extractCa() {
  // Token pages look like /sol/token/<CA> — sometimes the last segment is
  // "<slug>_<CA>", so take whatever follows the last underscore.
  const m = location.pathname.match(/^\/([^/]+)\/token\/([^/?#]+)/);
  if (!m) return null;
  const parts = m[2].split('_');
  const candidate = parts[parts.length - 1];
  return BASE58_RE.test(candidate) ? { chain: m[1], ca: candidate } : null;
}

function looksLikeTicker(s) {
  return typeof s === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(s) && s.toUpperCase() !== 'GMGN';
}

function extractTicker() {
  // GMGN's class names are obfuscated, so use stable sources: the document
  // title and og:title both start with the ticker on token pages.
  const sources = [];
  const og = document.querySelector('meta[property="og:title"]');
  if (og?.content) sources.push(og.content);
  if (document.title) sources.push(document.title);

  for (const text of sources) {
    const first = text.trim().split(/[\s|,/]+/)[0].replace(/^\$/, '');
    if (looksLikeTicker(first)) return first.toUpperCase();
  }
  return null;
}

function currentCoin() {
  const loc = extractCa();
  if (!loc) return null;
  return { chain: loc.chain, ca: loc.ca, ticker: extractTicker() };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_COIN') {
    sendResponse({ coin: currentCoin() });
  }
});

// GMGN is an SPA — the URL changes without a page load. Poll for changes and
// push updates so the panel follows as you click between coins. The ticker is
// re-read for a few seconds after navigation because the title updates late.
let lastKey = '';
setInterval(() => {
  const coin = currentCoin();
  const key = coin ? `${coin.ca}|${coin.ticker ?? ''}` : '';
  if (key !== lastKey) {
    lastKey = key;
    chrome.runtime.sendMessage({ type: 'COIN_CHANGED', coin }).catch(() => {
      // Side panel not open — nothing to notify.
    });
  }
}, 1000);
