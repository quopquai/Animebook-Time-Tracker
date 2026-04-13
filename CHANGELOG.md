# Animebook Time Tracker — Changelog

---

## v3.3 — Animebook Watchtime Tracker (baseline)
The version at the start of development. Tracking worked only on Animebook (animebook.github.io and local files).

- Basic watchtime tracking for Animebook videos
- Popup with Today / This Week / This Month / All Time stats
- Daily goal bar with editable target and presets
- Weekly, Monthly, Yearly, All Time, and Custom chart tabs
- Level progression bar with configurable settings
- Days Immersed and Videos Watched counters
- Full History page (basic light-theme list)
- Export and Import (overwrite) as JSON

---

## v3.4 — YouTube integration + NihongoTube conflict resolution

- Added YouTube tracking via injected content scripts (`youtube.js` + `youtube-bridge.js`)
- YouTube overlay button ("AT" badge) injected into the player — toggles tracking on/off with live timer
- Resolved crash conflict with NihongoTube extension:
  - Root cause: NihongoTube's `storage.onChanged` listener triggered a page reload on any `chrome.storage.local` write
  - Fix: YouTube saves are buffered in `chrome.storage.session` (invisible to NihongoTube), then flushed to `chrome.storage.local` after a 5-second idle period
  - 1-minute alarm safety net ensures data is never lost during long sessions
- YouTube tracking therefore has a ~5 second display lag in the popup (intentional — avoids triggering NihongoTube)

---

## v3.5 — Renamed + asbplayer support

- Extension renamed from "Animebook Watchtime Tracker" to **"Animebook Time Tracker"**
- Added tracking support for **asbplayer** (`app.asbplayer.dev` and `killergerbah.github.io/asbplayer`):
  - asbplayer renders its video inside a same-origin iframe — script searches iframes to find the video element
  - Video title read from `h6.MuiTypography-noWrap` element in the top-level DOM
  - Direct `chrome.storage.local` writes (no NihongoTube conflict on this domain)
  - 1-second interval save, same pattern as Animebook

---

## v3.6 — cijapanese.com support + bug fixes

### New tracking source
- Added tracking support for **cijapanese.com** (`/watch` pages):
  - Auto-tracks all videos — no button required, since all content on the site is Japanese immersion material
  - Smart filtering: ignores muted or short (under 60 seconds) preview/thumbnail clips
  - Strips " | Comprehensible Japanese" suffix from page titles for cleaner history entries

### Bug fixes
- Fixed asbplayer entries logging as "asbplayer" instead of the actual filename
- Fixed cijapanese preview clips being logged as separate entries (muted/short video filter)
- Fixed Animebook video titles including the `.mp4` extension, causing duplicates when the same file was also opened in asbplayer

---

## v3.7 — source badges + history redesign + bug fixes

### Source tagging
- All content scripts now tag saves with a `source` field: `animebook`, `youtube`, `asbplayer`, or `cijapanese`
- Storage schema updated from plain number values to `{ seconds, source }` objects — fully backwards compatible with existing data

### History page redesign
- Dark theme matching the popup (SF Mono font, `#0f1117` background, purple accents)
- Full written-out dates ("Thursday, 26 March 2026") instead of raw YYYY-MM-DD
- Proportional source colour bar on each day block showing time split at a glance:
  - Purple = Animebook, Red = YouTube, Amber = asbplayer, Green = cijapanese
- Coloured pill badges before each video title indicating source
- Source guessing for old entries with no source tag (e.g. `.mp4` extension → Animebook)
- Title clean-up: strips `| Animebook` suffix and leading numeric prefixes
- Updated time format: `Xh Xm Xs` to match popup display

### Edit and delete in history
- Global **Edit** button (top right) enters selection mode
- Checkboxes appear on every row and every day header
- Day header checkbox selects/deselects all entries in that day
- "Delete day" button appears per day in edit mode
- "Delete selected" button with count indicator in toolbar
- Confirmation dialog required before any deletion — no accidental deletes
- CSS-drawn tick marks in checkboxes (avoids font rendering issues with `✓`)
- Stats recalculate immediately after deletion

### Bug fixes
- Fixed CSS checkmark rendering in history edit mode (replaced `✓` character with pure CSS shape)

---

## v3.8 — Merge (cijapanese import) + Import safety warning + bug fixes

### Import safety
- Import button now shows a confirmation dialog warning that it will overwrite all existing data, including any merged cijapanese history

### Merge (cijapanese import)
- New **Merge** button in popup footer (green, separated from Export/Import)
- Accepts cijapanese JSON export files
- Confirmation dialog shows a breakdown before merging: video entries and custom activities counted separately
- Video entries (entries with a `title` field) → merged into the videos section tagged as cijapanese
- Custom activities (entries without a `title`) → merged into the custom activities section using `userNotes` as the description
- Merge is always safe in any order — it only adds to existing data, never overwrites

### Bug fixes
- Custom activities section no longer has a separate border box — merged cleanly into the same day block as videos

---

## v3.9 — TVer support

### New tracking source
- Added tracking support for **tver.jp** (`/episodes/*` pages):
  - Auto-tracks all videos — no button required, since all content on the site is Japanese
  - Ad filtering: ignores any video element under 60 seconds duration, catching pre-roll ads silently
  - Blue TVer badge added to history page (dark navy background, light blue text)
  - Blue segment added to the proportional source colour bar on each history day block

### Title construction
- Series name and episode title read directly from DOM elements on the episode page:
  - `h2.EpisodeDescription_seriesTitle__Z2k3j` → series name
  - `h1.EpisodeDescription_title__ZuCXz` → episode title
  - Combined as `Series Name — Episode Title` (e.g. `ミステリと言う勿れ — 第2話 奇妙なバスジャック！`)
  - Falls back to page title if DOM elements are not found

### SPA navigation support
- TVer is a React single-page application — URLs change via `pushState` without full page reloads, so standard content script injection doesn't work
- Fixed by using `chrome.webNavigation.onHistoryStateUpdated` in `background.js` to detect in-page navigation and programmatically inject `tver.js` on each new episode URL
- Tracks last injected URL per tab to prevent double-injection when revisiting the same episode
- Teardown pattern used instead of a guard flag — each new injection cleanly stops the previous instance before starting fresh, allowing correct behaviour across episode-to-episode navigation

### Manifest changes
- Added `webNavigation` permission
- Added `https://tver.jp/*` to `host_permissions`
- TVer injection handled entirely by `background.js` (not via `content_scripts` in manifest) to give full control over when injection fires

---

## v4.0 — Disney+ integration + badge colour updates (Bluey, here we come!)

### New tracking source
- Added tracking support for **Disney+** (`disneyplus.com/play/*` pages):
  - Manual **Track** button injected into the player, positioned alongside asbplayer's controls at the top of the screen
  - Button toggles tracking on/off with a live timer display, same pattern as YouTube
  - No ads on Disney+, so no ad filtering needed

### Title capture
- Series name and episode title captured by intercepting `JSON.parse` in the MAIN world — reads `data.playerExperience.title` and `data.playerExperience.subtitle` from Disney+'s own API responses
- Combined as `Series Name — Episode Title` (e.g. `Bluey — S1:E2 Hospital`)
- Falls back to page title (series name only) if the API response hasn't arrived yet

### Technical notes
- Runs as two scripts: `disneyplus.js` (MAIN world, for `JSON.parse` interception and overlay injection) + `disneyplus-bridge.js` (ISOLATED world, for direct `chrome.storage.local` writes)
- Saves directly to `chrome.storage.local` every second — popup updates live while tracking
- Shadow DOM video detection: Disney+ renders two `<video>` elements, one hidden dummy and one real — the script skips the hidden one
- Language-prefixed URLs supported — `/play/`, `/ja-jp/play/`, `/en-gb/play/` etc. all work correctly
- Added `https://www.disneyplus.com/*` to `host_permissions`

### Badge colour updates
- **cijapanese** badge changed from green to pink
- **Disney+** badge added — teal (`#2dd4bf` on dark `#0a3d3d` background)

---

## v4.1 — Amazon Prime Video integration (Atashin'chi, here we come!)

### New tracking source
- Added tracking support for **Amazon Prime Video** (`/gp/video/detail/` pages) across all Amazon domains (`amazon.com`, `amazon.co.jp`, `amazon.co.uk`, `amazon.de`, `amazon.fr`, `amazon.it`, `amazon.es`, `amazon.ca`, `amazon.com.au`, and more)
- Manual **Track** button injected into the player, positioned alongside asbplayer's controls at the top of the screen — same pattern as Disney+
- Button toggles tracking on/off with a live timer display

### Title capture
- Series name read from `atvwebplayersdk-title-text` — Amazon's own player SDK element, stable across all regions
- Episode info read from `atvwebplayersdk-episode-info` — combined as `Series — S1 E1 Episode Title`
- Title is **locked** the first moment both elements are present (only while playing) to prevent duplicate history entries from the title being unavailable during paused state
- Falls back to page title if SDK elements are not yet available

### Technical notes
- `amazonprime.js` runs in MAIN world; `amazonprime-bridge.js` runs in ISOLATED world and writes directly to `chrome.storage.local` every second — popup updates live while tracking
- Player detection uses a sticky `playerHasOpened` flag — once the SDK title elements are seen (only while video is playing), the Track button stays visible even when paused
- `MutationObserver` on `document.body` watches for Amazon removing the AT button and immediately re-injects it, keeping it visible through Amazon's control show/hide cycles
- Video detection finds the real player by looking for a `blob:` src, skipping Amazon's dummy video elements
- All Amazon domains added to `host_permissions` in manifest

### Ads
- Ad time may be included if tracking is active during ad breaks — this is intentional and acceptable given the manual tracking model
- Users can pause tracking manually during ads if desired
- Reliable programmatic ad detection on Amazon Prime is not feasible due to frequent player updates

### Badge
- Yellow Amazon Prime badge added to history page (`#f5c518` on dark `#3d2e00` background), labelled **PRIME**

---

## v4.2 — Source donut chart + global tracking toggle

### Source donut chart (history page)
- New **Sources** sidebar card on the history page showing an all-time breakdown of watchtime by source
- Donut chart built with SVG `stroke-dasharray` technique — no external libraries, no canvas DPR issues
- Hover tooltips show source name, total time, and percentage (e.g. `cijapanese - 58h 23m (58%)`)
- Legend below the chart lists each source with its colour dot and percentage
- **Custom activities** included as a grey segment so the donut total matches the popup's all-time figure exactly
- Activities always sorted to the bottom of the legend
- Sidebar is `position: sticky` — stays visible as you scroll through history
- Chart updates every time the history page is opened

### Global tracking toggle
- On/off toggle switch added to the popup header, to the left of the version number (for when the user isn't actively immersing, and the "Track" button becomes distracting)
- **OFF state**: paused banner appears, stats dim, toolbar icon shows a red `off` badge
- **OFF state**: Track buttons on YouTube, Disney+, and Amazon Prime are hidden (not just disabled)
- **OFF state**: auto-tracking on cijapanese, TVer, and asbplayer silently skips all saves
- **ON state**: everything resumes immediately — no page reload required
- Toggle state persists across browser restarts
- Buttons start hidden by default on page load and only become visible once the bridge confirms tracking is enabled — prevents any visible flash on load when AT is off
- Implementation uses `chrome.storage.onChanged` in the ISOLATED world bridge scripts to fire `animebook-tracking-state` DOM events to the MAIN world scripts — clean separation of concerns

### Badge colour update
- **asbplayer** badge changed from amber to deep pink (`#e91e8c` on `#4a0a2a` background) to distinguish it clearly from Amazon Prime's yellow in the donut chart

---

## v4.3 — Source filter + custom activity deletes + light/dark mode

### Source filter (history page)
- Coloured pill buttons in the sidebar below the donut chart — one per source, only sources present in history are shown
- Toggle pills on/off to filter the history list; inactive pills dim to 35%, active pills show a coloured border
- Day blocks with no matching entries are hidden entirely when a filter is active
- Custom activities are filterable as a separate "Activities" pill
- "Show all" link appears when any filter is active and resets to unfiltered view
- Filter reapplied automatically after delete and edit operations
- All pills start active (unfiltered) by default

### Custom activity delete support
- Custom activity rows in edit mode now have checkboxes, matching the behaviour of video entries
- Activities can be selected individually or via the day header checkbox (which selects all entries in a day — videos and activities together)
- Deleting activities subtracts their time from the day total and cleans up empty days
- Activity keys use a `date::activity::index` format; indices are removed high-to-low to avoid array shifting

### Light/dark mode toggle
- Sun/moon icon button added to the popup header (between the tracking toggle and version number) and to the history page header (next to the Edit button)
- Dark mode is the default; clicking the icon switches to light mode and back
- Theme stored in `chrome.storage.local` as `{ theme: "light" | "dark" }` — persists across browser restarts
- Switching theme in either the popup or the history page updates both simultaneously via `chrome.storage.onChanged`
- Light mode uses CSS custom properties (`--bg`, `--text`, `--border` etc.) defined on `:root` with `body.light` overrides — no colour hunting needed
- Light mode covers: popup stats, modals (goal, level settings, import, merge, custom activity), history day blocks, source badges, filter pills, edit toolbar, confirm dialog, donut chart sidebar
- Source badges in light mode use soft tinted backgrounds (e.g. light purple for Animebook, light pink for cijapanese) with darkened source colours as text for readability
- Donut chart sidebar, filter pills, and legend all adapt correctly to both themes

---

## v4.4 — Draggable Track button + auto-hide option + Hotfix: Track button not appearing on first launch

### Draggable Track button
- The Track button can now be dragged to any position on screen by grabbing the purple **AT** badge
- Clicking the Track/Stop button still works as normal — dragging and clicking are separate actions (a `didDrag` flag suppresses the click event after a drag)
- Position is saved **per site** to `chrome.storage.local` under `overlayPos_youtube`, `overlayPos_disneyplus`, and `overlayPos_amazonprime`
- Position persists across page reloads and browser restarts
- Button cannot be dragged off screen — clamped to viewport/player boundaries
- Position is loaded via the bridge event pattern (`animebook-load-pos` / `animebook-overlay-pos` / `animebook-save-pos`) since MAIN world scripts cannot access `chrome.storage` directly

### Auto-hide Track button
- New **Settings** modal accessible via a ⚙️ button in the popup footer (between Merge and the version)
- Settings modal contains an **Auto-hide Track button** toggle — off by default
- When enabled: button fades out after **5 seconds** of no mouse movement
- Button reappears when the mouse moves anywhere over the video, or when the video is paused
- Auto-hide state saved to `chrome.storage.local` as `{ autoHideTrackBtn: true/false }` and persists across restarts
- State communicated to MAIN world via `animebook-autohide-state` DOM event from the bridge
- On page load, `animebook-request-state` fires immediately after button injection — bridge responds with both tracking state and auto-hide state simultaneously, fixing a race condition where the button would disappear on reload

### UI change
- Level settings button changed from ⚙️ to ✏️ (pencil) to match the Daily Goal edit button style, freeing the cogwheel icon for the footer settings

### Architecture notes
- All bridge event handlers (tracking state, auto-hide state, position, request-state) consolidated inside the `if (!window.__animebookBridgeLoaded)` guard block — previously appended handlers were falling outside the guard and losing access to scoped functions
- `animebook-request-state` now fires from inside `injectOverlay()` rather than from the poll loop, ensuring state is applied at the exact moment the button enters the DOM

### Bug fix
- Fixed an issue where the Track button on YouTube, Disney+, and Amazon Prime would not appear on first Chrome launch when AT was already switched on
- **Root cause**: the MAIN world script defaulted `globalTrackingEnabled` to `false`, and the bridge's initial `animebook-tracking-state` event fired before the button was injected — so it had nothing to show. When the poll then injected the button, it used the stale `false` value and kept the button hidden
- **Fix**: after injecting the button, the MAIN world now fires an `animebook-request-state` event. The ISOLATED bridge listens for this and immediately re-sends the correct state from storage, ensuring the button visibility is always set based on the real current value

---

## v4.5 — Activity heatmap + sticky header

### Activity heatmap (history page)
- Full-width heatmap spanning the entire page above the sidebar/history split, showing all 365 days of a given year (Jan → Dec)
- Purple intensity scale — 5 levels from empty (`#1a1c2a`) to brightest (`#9d8fff`) in dark mode, inverted light purple ramp in light mode
- Intensity is relative to the most active day of the year, so the scale always makes good use of the colour range
- Both video time and custom activity time are included in daily totals
- **Year navigation** — PREV and NEXT buttons to browse previous and future years; defaults to the current year on load
- **Tooltips on every cell** — hovering any cell shows a friendly formatted date and time, e.g. `April 2nd - 15m` or `April 2nd - No activity`; the year is omitted since it's already shown as the heatmap title
- Ordinal suffixes handled correctly for all dates (1st, 2nd, 3rd, 4th, 11th, 12th, 21st etc.)
- Theme switching recolours cells instantly in sync with the body class change — no rebuild, no flash; cells have `transition: background 0s` for an immediate swap
- Each cell stores its intensity level in `data-intensity` so the theme handler can recolour without re-querying storage
- Legend (Less → More) sits at the bottom right of the heatmap card; legend cells also recolour on theme switch

### Sticky header (history page)
- The "Animebook Tracker History" header now sticks to the top of the viewport as you scroll, keeping the Edit button and theme toggle always accessible
- Implemented as a `position:sticky` outer wrapper that is a direct child of `body` with `min-height:100vh` — the pattern that works correctly in Chrome extension page contexts
- Header border sits on the sticky wrapper so it travels with the header
- Sidebar `top` offset updated to `76px` so it sticks just below the header rather than behind it

---

## v4.6 *(planned)*
- Jellyfin support

---

## v4.7 *(planned)*
- U-Next support

---

## v4.8 *(planned)*
- Hulu support

---

## v4.9 *(planned)*
- Netflix support

---

*Built with Claude — Anthropic, 2026*
