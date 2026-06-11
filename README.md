# GMGN X-Sentiment Popup

Chrome extension (Option 1 from `docs/x-sentiment-sidebar.md`): click the
toolbar icon on a GMGN coin page and a narrow popup window opens on the X
(Twitter) "Latest" search for `$TICKER OR <CA>`, auto-reloading every 45s.

> Option 2 (header-strip + side panel iframe) was built and tested first —
> it's dead on Chrome 149: the DNR rule matches in `testMatchOutcome` but
> Chrome doesn't apply `modifyHeaders` to sub_frames inside extension pages,
> so x.com stays blocked. Details in the design doc.

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** → select this `x-sentiment-sidebar` folder.
   (If upgrading from the side-panel version, hit ⟳ on the card instead.)
4. Pin the extension to the toolbar.

## Use

1. Open a coin page on GMGN (`gmgn.ai/sol/token/...`). If the tab was already
   open before installing, reload it once.
2. Click the toolbar icon → popup opens with the live X search. Snap it next
   to your browser window.
3. Behavior:
   - **Auto-reload every 45s** (popup-wide, so it follows you if you click
     into a tweet — closing and reopening gets you back to the search).
   - **Coin-follow**: navigating between coins in the GMGN tab that spawned
     the popup swaps the search automatically.
   - **Click the icon again** to refocus the existing popup / retarget it to
     the current coin.
   - **Red `!` badge** on the icon = not on a coin page, or the GMGN tab needs
     one reload so the content script can inject.
4. Query includes `min_faves:5 -filter:replies` to cut bot dust. Edit the
   search inside the popup if you want the raw firehose — reloads keep your
   edited URL until the coin changes.

## Signal-quality reminder

- **CA hits = high signal** — nobody pastes a contract address by accident.
- **$ticker hits = noisy** — tickers collide constantly.
- **Volume ≠ sentiment** — 50 bot copypasta tweets look like 50 organic ones.

## Cautions

- **Rate limits**: 45s reload on one coin is safe; don't run popups for many
  coins at once or X may temp-limit your account's search.
- **Login**: the popup is first-party x.com, so your normal X session applies.
