// Option 1 architecture: toolbar click opens (or refocuses) a narrow popup
// window on x.com search for the coin in the current GMGN tab. First-party
// context, so the existing X login just works — no header stripping needed.
// An alarm reloads the popup every REFRESH_SECONDS to keep the Latest tab live.

const REFRESH_SECONDS = 45; // keep 30–60s — faster risks X search rate limits
const ALARM = 'reload-x';
const TOKEN_PAGE_RE = /^https:\/\/gmgn\.ai\/[^/]+\/token\//;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TICKER_RE = /^[A-Za-z0-9_]{1,15}$/;

// Validate coin objects received via message passing before building URLs.
// Content scripts run in page context, so a malicious site could craft messages.
function isValidCoin(coin) {
  return coin != null &&
    typeof coin.ca === 'string' && BASE58_RE.test(coin.ca) &&
    (coin.ticker == null || TICKER_RE.test(coin.ticker));
}

function buildSearchUrl(coin) {
  // CA is the high-signal half; ticker is noisy but kept per design notes.
  const terms = [];
  if (coin.ticker) terms.push(`$${coin.ticker}`);
  terms.push(coin.ca);
  const q = `${terms.join(' OR ')} min_faves:5 -filter:replies`;
  return `https://x.com/search?q=${encodeURIComponent(q)}&f=live&src=typed_query`;
}

// Popup/tab ids live in session storage so they survive service worker sleeps.
async function getState() {
  const { popup } = await chrome.storage.session.get('popup');
  return popup ?? {};
}

function setState(popup) {
  return chrome.storage.session.set({ popup });
}

function flashBadge(text, title) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#f4524d' });
  chrome.action.setTitle({ title });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Open X sentiment for this coin' });
  }, 2500);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !TOKEN_PAGE_RE.test(tab.url)) {
    flashBadge('!', 'Open a GMGN coin page first');
    return;
  }

  let coin = null;
  try {
    coin = (await chrome.tabs.sendMessage(tab.id, { type: 'GET_COIN' }))?.coin;
  } catch {
    flashBadge('!', 'Reload the GMGN tab once, then click again');
    return;
  }
  if (!isValidCoin(coin)) {
    flashBadge('!', 'No contract address found in this URL');
    return;
  }

  const url = buildSearchUrl(coin);
  const state = await getState();

  // Reuse the existing popup if it's still open.
  if (state.popupTabId != null) {
    try {
      await chrome.tabs.update(state.popupTabId, { url });
      await chrome.windows.update(state.popupWindowId, { focused: true });
      await setState({ ...state, sourceTabId: tab.id });
      return;
    } catch {
      // Popup was closed — fall through and create a new one.
    }
  }

  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: 480,
    height: 1024,
  });
  await setState({
    popupWindowId: win.id,
    popupTabId: win.tabs[0].id,
    sourceTabId: tab.id,
  });
  chrome.alarms.create(ALARM, { periodInMinutes: REFRESH_SECONDS / 60 });
});

// Auto-reload keeps &f=live fresh. tabs.reload (not update) deliberately
// preserves wherever the user navigated inside the popup.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const state = await getState();
  if (state.popupTabId == null) {
    chrome.alarms.clear(ALARM);
    return;
  }
  try {
    await chrome.tabs.reload(state.popupTabId);
  } catch {
    chrome.alarms.clear(ALARM);
    await setState({});
  }
});

// Follow SPA navigation in the GMGN tab that spawned the popup: clicking to a
// different coin swaps the popup's search automatically.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'COIN_CHANGED' || !isValidCoin(msg.coin)) return;
  (async () => {
    const state = await getState();
    if (state.popupTabId != null && sender.tab?.id === state.sourceTabId) {
      try {
        await chrome.tabs.update(state.popupTabId, { url: buildSearchUrl(msg.coin) });
      } catch {
        // Popup gone; the alarm handler will clean up on its next tick.
      }
    }
  })();
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const state = await getState();
  if (windowId === state.popupWindowId) {
    chrome.alarms.clear(ALARM);
    await setState({});
  }
});
