# Recall Garden — dark appearance implementation plan

**Plan version 1.1** — implement 1.1, not 1.0.

Prepared 10 September 2026 from the current Recall Garden codebase. Revised the same day after a self-review of 1.0 against `src/styles.css`, `src/App.tsx`, `src/components/Play.tsx` (ResizeObserver), `src/components/Results.tsx` (`deviceKey`), and `tests/browser.spec.ts`.

This is the **implementation contract** for a player-controlled light/dark appearance. It is not a second skin, not a protocol change, and not a redesign of the garden identity.

The existing light look in `IMPLEMENTATION_PLAN.md` §10 remains the default-resolved light theme. Dark is a **night garden**: the same moss, ivory type, and numbered mole, under a darker sky. It is not a generic near-black page with a single acid accent.

---

## 0. Why this is a display preference, not a protocol

`VERSIONS.art` is currently `"garden-2.0"` and is hashed into every `configHash` (`src/game/protocol.ts`). That fingerprint exists so progress charts and adaptation do not mix materially different **stimuli or layouts**.

Appearance does not change:

- sequence generation, timing, scoring, or input
- hole geometry, digit size, or mole shirt/digit paints
- which rounds are comparable

**Do not bump `VERSIONS.art`, `VERSIONS.engine`, or any other protocol version for this work.** Light and dark rounds of the same protocol remain one chart series. Progress “input or display changed” is `deviceKey` in `Results.tsx`: user agent, viewport, pixel ratio, and accepted input methods. It is not chrome theme.

If a later change alters stimulus contrast or playfield geometry, that is a new art version and a different plan.

---

## 0.1 What 1.0 got wrong (corrected here)

| 1.0 | 1.1 |
| --- | --- |
| Always set `data-theme` from JS, including Match device; forbid a CSS `prefers-color-scheme` fallback | **CSS-first for system.** No `data-theme` when appearance is `system` or unset. Dark tokens also live under `@media (prefers-color-scheme: dark)` on `:root:not([data-theme="light"])`. Explicit Light/Dark set `data-theme`. First visit needs no JS to paint correctly. |
| Mandatory boot script that duplicates `resolveTheme` on every load | Boot script runs only to **force** a stored `"light"` or `"dark"` before CSS. Missing/`"system"`: do nothing (leave `data-theme` absent). |
| `applyTheme` sets inline `html.style.colorScheme` | `color-scheme` is CSS only (`:root { color-scheme: light dark }` plus `[data-theme="…"] { color-scheme: … }`). Inline style is hard to revert when returning to Match device. |
| Phase B: tokenise every light hex before any dark palette | **Do not rewrite the light stylesheet as a token migration.** Keep today’s light hex. Add a short shared token list for colours that JS needs (chart) and that already exist (`--green`, `--muted`, `--border`, `--sage`). Dark is an override sheet. Light visual regression is then “did we touch light selectors?” rather than “did 80 substitutions drift?” |
| Locked ~40 dark hex values unseen on a screen | Lock the **night-garden direction** and six brand swatches. Remaining dark hexes are chosen against the running UI and recorded in VERIFICATION, not frozen here. |
| New Appearance **card** above Training preferences | First **setting-row** in the existing Training preferences card (same place as Sound). Sound is already not a protocol setting; appearance is not either. No second card, no sun/moon icons. |
| Optional `moon` icon in `Art.tsx` | Do not add icons. Segment labels only, like the tutorial N control. |
| Geometry risk described only as “keep the box identical” | Name the real interrupt path: `Play.tsx` ResizeObserver, **32 px** size / **24 px** position. `color-scheme` can add a ~15 px classic scrollbar. That is under the threshold, but a mid-round OS theme change must be tested so it does **not** call `interrupt`. Do not add `scrollbar-gutter: stable` (it would change light layout and the 13-viewport `scrollWidth === innerWidth` gate). |
| Verification step 5 implied Match device sets `data-theme === "dark"` | Match device **removes** `data-theme`. Assert computed background (or `matchMedia`) instead, with `emulateMedia`. Playwright does not set `colorScheme` today; never assume the CI OS. |
| iOS PWA status bar omitted | `apple-mobile-web-app-status-bar-style` is `default` and is not reliably runtime-switchable. Leave it. Known limit: installed iPhone chrome may stay light. |

---

## 1. Locked product decisions

| ID | Decision | Status |
| --- | --- | --- |
| A1 | Preference is `appearance: "light" \| "dark" \| "system"`. Default **`"system"`**. Missing/invalid stored values mean `"system"`. | LOCK |
| A2 | Resolved theme is only `"light"` or `"dark"`. `system` follows `prefers-color-scheme: dark`; if the media query is unavailable, resolve **light**. | LOCK |
| A3 | Control is the **first row** of the existing Training preferences card on Settings & data. Widget: existing `.segmented` pattern (Light / Dark / Match device), not a binary switch and not a new card. A two-state switch cannot keep following the OS after the first tap. | LOCK |
| A4 | No appearance control on the play page, countdown, or session chrome. Sidebar stays hidden in `.is-session`. Players change appearance between rounds, or via the device setting when Match device is selected. Glare during a scored round is an accepted limit. | LOCK |
| A5 | Explicit themes set `<html data-theme="light" \| "dark">`. Match device **removes** the attribute. `color-scheme` comes from CSS, not inline style. | LOCK |
| A6 | Persist in the existing `recall-garden-preferences` JSON object (`PREFS`). Do not add a second localStorage key. IndexedDB session records do not store appearance. The existing prefs `useEffect` will write `appearance: "system"` on first load after deploy; that is intended. | LOCK |
| A7 | First visit / Match device: **CSS media query paints dark**. Inline boot script in `index.html` `<head>` only applies when stored appearance is `"light"` or `"dark"`. React must add/remove `data-theme` the same way. | LOCK |
| A8 | Mole artwork is a **stimulus**. Keep shirt, fur, and digit fills as they are today (`#efe9d6` shirt, `#244d3c` digit). Do not invert, recolour, or CSS-filter the mole. Dark theme changes turf, rims, chrome, and cards around it. | LOCK |
| A9 | Dark chrome is a night garden, not OLED black + neon. Starting swatches (adjust if contrast fails in the browser): page `#121a16`, card `#1a2420`, text `#e6eedc`, muted `#a3b39a`, border `#2c3a30`, primary fill stays moss with light label text. Warning/danger stay amber/terracotta, lightened just enough to read on dark cards. Brand mark (`--green` on `--bg`) must remain a distinct square, not a hole in the sidebar. | LOCK |
| A10 | Live-apply on preference change and on `prefers-color-scheme` changes when appearance is `system`. Do **not** interrupt the engine. Playfield **box, padding, radius, and grid** must be identical across themes. A theme change must not move the playfield by more than the existing interrupt thresholds (32 / 24 px). | LOCK |
| A11 | `clearData()` already removes `PREFS`. After deletion, appearance returns to `"system"` with the other defaults. Copy on the delete dialog does not need to mention theme separately. | LOCK |
| A12 | Update the single document `theme-color` meta at runtime to the **resolved** chrome: light `#244d3c` (current), dark `#1a2420`. Leave the PWA manifest `theme_color` / `background_color` as the light garden. Leave `apple-mobile-web-app-status-bar-style` as `default`. | LOCK |
| A13 | Unused `Garden()` / `Sprig()` / `sun` icon stay unused. Do not add a `moon` icon. | LOCK |

Product copy (sentence case, Settings voice):

- Row title: **Appearance**
- Segment labels: **Light**, **Dark**, **Match device**
- Help: **Night garden, daytime garden, or follow this device.**
- Keep **Sound cues** as the sound switch name.

---

## 2. Current baseline (do not regress)

| Surface | Today | Dark requirement |
| --- | --- | --- |
| `:root` tokens | `--green`, `--muted`, `--border`, `--sage`; most colours are raw hex | Light hex stays. Dark overrides those selectors. Chart (JS) and any new shared tokens only where a variable already helps |
| `index.html` | `theme-color #244d3c`; no `color-scheme` | CSS `color-scheme: light dark`; boot script only for explicit stored theme; runtime `theme-color` |
| Settings | Sound uses `.toggle` / `role="switch"` | Appearance uses `.segmented` in the same card; sound switch unchanged |
| Prefs parse | `n`, `blocks`, `windowMs`, `input`, `sound` | Plus `appearance` with the A1 whitelist |
| Browser test | `getByRole("switch")` assumes **one** switch | Must target `{ name: "Sound cues" }` |
| Playfield | Light turf gradient, brown hole, cream mole | Darker turf/rims; **same mole paints**; digit still ≥ 20 CSS px |
| Play interrupt | ResizeObserver vs first `getBoundingClientRect`, 32 / 24 px | Theme must not trip it |
| Progress chart | Hardcoded `#dde3d8`, `#52634b`, `#356149`, `#9a632c` | Variables or `currentColor` |
| Reduced motion | Global `transition: none` | No theme crossfade |
| Protocol | `art: "garden-2.0"` in hash | Unchanged |
| Playwright | No `colorScheme` in `playwright.config.ts` | Tests that care about resolved theme call `emulateMedia` |

---

## 3. Resolution algorithm

Put this in `src/theme.ts` (new). Keep it out of `protocol.ts`.

```ts
export type Appearance = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function parseAppearance(value: unknown): Appearance {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function systemPrefersDark(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(
  appearance: Appearance,
  prefersDark = systemPrefersDark(),
): ResolvedTheme {
  if (appearance === "dark") return "dark";
  if (appearance === "light") return "light";
  return prefersDark ? "dark" : "light";
}

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#244d3c",
  dark: "#1a2420",
};

export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  if (appearance === "light" || appearance === "dark") {
    root.dataset.theme = appearance;
  } else {
    delete root.dataset.theme;
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolveTheme(appearance)]);
}
```

Unit-test `parseAppearance` and `resolveTheme` in `tests/theme.test.ts` (pure; no DOM). Cases: unknown strings, `true`, `null`, empty prefs object, each explicit value, system + both media results.

Do not set `root.style.colorScheme`.

### 3.1 Inline boot script (`index.html`)

Immediately after the existing `theme-color` meta. **Only forces an explicit stored choice.**

```html
<script>
  (function () {
    try {
      var a = JSON.parse(localStorage.getItem("recall-garden-preferences") || "{}")
        .appearance;
      if (a !== "light" && a !== "dark") return;
      document.documentElement.setAttribute("data-theme", a);
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", a === "dark" ? "#1a2420" : "#244d3c");
    } catch (e) {}
  })();
</script>
```

Rules:

- No module import, no React.
- Swallow storage and parse errors.
- Key string `recall-garden-preferences` identical to `PREFS`.
- `"system"`, missing, or garbage: **return without touching the DOM**, so CSS `@media (prefers-color-scheme: dark)` can paint.
- Prettier formats `index.html`; keep the script valid after `format`.

### 3.2 CSS `color-scheme` and dark overrides

```css
:root {
  color-scheme: light dark;
}
[data-theme="light"] {
  color-scheme: light;
}
[data-theme="dark"] {
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* same dark variable/selector overrides as [data-theme="dark"] */
  }
}
[data-theme="dark"] {
  /* dark overrides */
}
```

Do not duplicate the dark palette by hand in two long blocks. Put dark custom properties (or a comma-joined selector list) in **one** place, for example:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121a16;
    /* …shared tokens… */
  }
}
[data-theme="dark"] {
  --bg: #121a16;
  /* …same tokens… */
}
```

If a token is not used, override the concrete selector once with a grouped selector:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .card,
  [data-theme="dark"] .card {
    background: #1a2420;
  }
}
```

Pick **one** of: (1) a small token set plus `var()` at the existing call sites that already use variables, plus grouped selector overrides for the rest; or (2) introduce tokens only for the new dark values and assign them on both the media query and `[data-theme="dark"]`. Do not also rewrite every light hex to `var()`.

`html` and `body` both paint the page background so overscroll matches. Today that colour is on `:root`; keep that, and add `body { background: inherit; color: inherit }` only if overscroll still mismatches.

### 3.3 React wiring (`App.tsx`)

- Extend `Preferences` with `appearance: Appearance`.
- `defaults.appearance = "system"`.
- `getPreferences()` uses `parseAppearance(p.appearance)`.
- Existing `useEffect` that writes `PREFS` already persists the whole object.
- New effect: `applyAppearance(prefs.appearance)`.
- When `prefs.appearance === "system"`, subscribe to `matchMedia("(prefers-color-scheme: dark)")` **only to update `theme-color`**. Painting is CSS. Unsubscribe on cleanup or when appearance is no longer `system`.
- Segmented `aria-pressed` uses `prefs.appearance`, not the resolved theme.

---

## 4. CSS contract

### 4.1 Do not tokenise light first

1.0’s Phase B was a large no-op refactor with a high chance of silent light drift. 1.1 skips it.

Touch a light selector only when that selector also needs a dark value, or when it already uses a custom property.

Shared tokens to add or reuse (names not sacred beyond the four that already exist):

| Token | Light (current) | Dark starting point |
| --- | --- | --- |
| `--green` | `#2d5742` | keep moss; lighten label if needed, do not go neon |
| `--muted` | `#52634b` | `#a3b39a` |
| `--border` | `#dce3d4` | `#2c3a30` |
| `--sage` | `#edf1e7` | `#1c261f` |
| `--bg` | `#fafbf7` | `#121a16` |
| `--text` | `#293e33` | `#e6eedc` |
| `--card` | `#ffffff` | `#1a2420` |
| `--focus` | `#a66a21` | `#e0b15a` |
| `--chart-grid` | `#dde3d8` | `#2c3a30` |
| `--chart-ink` | `#52634b` | `#a3b39a` |
| `--chart-line` | `#356149` | `#8fb56e` |
| `--chart-flag` | `#9a632c` | `#e0b15a` |

Everything else (playfield gradient, holes, notices, toggles, Match, selects, example digits, brand mark, `.secondary { background: white }`, `.toggle.on`, `.match-button.acknowledged`) is implemented by inspecting the running light UI and adding the matching dark override. Record the final hexes in VERIFICATION, not as a second contract table.

**Layout properties stay outside theme rules.** Padding, grid, radii, min-heights, and the 13-viewport playfield rules do not differ by theme.

### 4.2 What must not be retinted

- Mole SVG fills in `Art.tsx` (A8).
- Favicon / apple-touch / maskable PNG assets.
- Protocol or test fixtures.

### 4.3 Chart (`Results.tsx`)

Replace hardcoded chart strokes/fills with `var(--chart-grid)`, `var(--chart-ink)`, `var(--chart-line)`, `var(--chart-flag)`. SVG presentation attributes accept CSS variables when the SVG is inline (it is).

Do not introduce a chart library.

### 4.4 Motion

Do not add a theme-crossfade. The existing reduced-motion rule already kills transitions. A background fade can look like playfield motion.

### 4.5 Forced colours

Out of scope. Do not add a `forced-colors` stylesheet in this delivery.

### 4.6 Implementation checklist (not locked hex)

Selectors known to use raw colour that dark will miss if forgotten:

- `.secondary` white fill and hover `#edf3e5`
- `.toggle` / `.toggle.on`
- `.match-button` and `.match-button.acknowledged`
- `.playfield` gradient, `.hole-shadow`, `.hole-rim`, hole `kbd`
- `.countdown`
- `.notice`, `.status-tag.warning`, `.danger-button`, `.save-error`
- `select`, `.level-options`, `.assessment-choices`, `.segmented`
- `.example-digit` current/compare
- `button:focus-visible` outline `#a66a21`
- `.brand-mark`
- `.modal-backdrop`

---

## 5. Settings UI

First row of the existing Training preferences card:

```text
Appearance
[ Light ] [ Dark ] [ Match device ]
Night garden, daytime garden, or follow this device.
```

On a narrow setting-row this wraps like the selects (`flex-wrap`). Allow `.segmented` to wrap; keep 44 px min height on each segment.

- `role="group"` + `aria-labelledby`, same pattern as Starting level.
- Each segment: `aria-pressed={prefs.appearance === id}`.
- Settings remains unreachable during a session (`disabled={ongoing}`, sidebar hidden in play).

Sound stays a `.toggle`. After this ships there is still exactly one `role="switch"`.

---

## 6. Playfield, stimulus, and interruption

Dark playfield: darker turf and rims only.

Acceptance for both themes:

- Six holes, 3×2, same CSS grid as today.
- Occupied digit bounding box height ≥ 20 CSS px.
- Shirt/digit contrast unchanged because paints are unchanged.
- Countdown overlay still hides the board.
- Match stays a filled moss control; acknowledged is one step lighter/darker moss, not a new hue.
- Aimed `kbd` hints remain readable.

`Play.tsx` interrupt path (do not change thresholds for this feature):

```text
|Δwidth| > 32 || |Δheight| > 32 || |Δx| > 24 || |Δy| > 24
→ "Playfield size changed"
```

Verify a Match-device OS theme flip **during** countdown or a visible trial does not interrupt (clock paused is fine; `emulateMedia` then wait one frame). If it does, the cause is almost certainly scrollbar/`color-scheme` layout, not the turf gradient. Fix colours/overflow, not the engine.

Do not add a night mole, glowing eyes, or turf sparkle.

---

## 7. Persistence, deletion, and PWA

| Event | Behaviour |
| --- | --- |
| First visit, empty storage | No `data-theme`; CSS follows OS; React prefs default `system` |
| Change Light or Dark | Set `data-theme`; write `PREFS`; update `theme-color` |
| Change Match device | **Remove** `data-theme`; CSS takes over; update `theme-color` from `matchMedia` |
| Reload with stored Dark/Light | Boot script sets `data-theme` before paint |
| Reload with stored system | Boot script no-ops; CSS media query paints |
| `prefers-color-scheme` change, `system` | CSS repaints; JS only updates `theme-color` |
| `prefers-color-scheme` change, Light or Dark | Ignore |
| Storage write failure | Existing “Preferences could not be saved”; in-memory appearance still applies |
| Delete local data | Prefs gone; `setPrefs(defaults)` → system → remove `data-theme` |
| Standalone PWA | Same `PREFS` key; meta `theme-color` updates; manifest splash stays ivory; iOS status-bar-style stays `default` |
| `color-scheme` | CSS; native `<select>` popups and scrollbars follow |

Do not write appearance into export JSON/CSV. It is not session telemetry.

---

## 8. Files

| File | Work |
| --- | --- |
| `DARK_MODE_IMPLEMENTATION_PLAN.md` | This contract |
| `index.html` | Small boot script (explicit themes only) |
| `src/theme.ts` | **new** — parse, resolve, `applyAppearance`, theme-color map |
| `src/App.tsx` | Prefs field, setting-row, apply + media listener for `theme-color` |
| `src/styles.css` | `color-scheme`; dark media + `[data-theme="dark"]` overrides; no light token migration |
| `src/components/Results.tsx` | Chart colours from tokens |
| `src/components/Art.tsx` | **no change** |
| `tests/theme.test.ts` | **new** — parse/resolve |
| `tests/browser.spec.ts` | Named sound switch; appearance persist/reload; `data-theme` presence/absence; `emulateMedia` |
| `tests/usability.spec.ts` | Dark geometry on two viewports; optional mid-round `emulateMedia` non-interrupt |
| `README.md` | One sentence under Settings |
| `VERIFICATION.md` | Actual commands, screenshots, final dark hex notes |
| `src/game/protocol.ts` | **no change** |
| `vite.config.ts` manifest colours | **no change** this delivery |
| `src/components/Play.tsx` | **no change** unless a colour-only CSS bug trips resize (then CSS, not the observer) |

---

## 9. Phases (exit before the next)

| Phase | Deliverable | Exit |
| --- | --- | --- |
| 0 | This 1.1 contract | No application code yet |
| A | `theme.ts` + boot script + `applyAppearance` from `App` (UI can wait) | Unit tests green; stored `"dark"` sets `data-theme` before React; stored `"system"` leaves it absent |
| B | Dark CSS overrides + chart vars + night turf (light selectors unchanged except where a variable is introduced for JS) | Manual: Match device with OS dark; Light override on a dark OS; Dark override on a light OS; light dashboard still matches current screenshots |
| C | Settings row | Keyboard: all three segments reachable; `aria-pressed` matches stored value |
| D | Tests in §10, README sentence, format/build | `npm test`, `npm run build`, targeted Playwright |
| E | Record evidence in `VERIFICATION.md` | Actual pass/fail, not claimed |

There is no “rewrite all light colours as tokens” phase.

---

## 10. Verification

### 10.1 Unit

- `parseAppearance`: `"light"`, `"dark"`, `"system"`, `undefined`, `"yes"`, `0`, `{}` → only the first three stay; else `"system"`.
- `resolveTheme`: matrix of three appearances × `{ prefersDark: true, false }`.

### 10.2 Browser (extend existing files)

Existing `dashboard, responsive layout, tutorial and preferences`:

1. Change `getByRole("switch")` to `getByRole("switch", { name: "Sound cues" })`.
2. After Settings opens on a clean profile, **Match device** is pressed. Do **not** assert `data-theme` here (it depends on the runner OS).
3. Click **Dark**, reload, Settings: Dark pressed; `document.documentElement` has `data-theme="dark"`.
4. Click **Light**, `emulateMedia({ colorScheme: "dark" })`, reload: still `data-theme="light"`.
5. Click **Match device**: `data-theme` is **absent**. `emulateMedia({ colorScheme: "dark" })` → computed page background is the dark page colour; `colorScheme: "light"` → light page colour. No reload required for the media change.
6. Keep the sound-toggle persistence assertions.

Pin `colorScheme: "light"` on tests that screenshot the default dashboard so CI does not follow a dark host OS.

New or extended usability checks (keep the 13-viewport **light** matrix as the layout gate; do not double it to 26):

- One **explicit Dark** pass at **390×844** and **1280×720** fixed-input play: board and Match still fit; digit ≥ 20 px; playfield bounding box equals the light box at the same viewport (toggle appearance **before** start).
- During a paused visible trial on Match device, `emulateMedia` dark↔light: heading is not “Round stopped”.
- Settings at 320×568: all three segments visible without horizontal overflow.
- Screenshots: `test-results/dashboard-dark.png`, `test-results/settings-dark.png`, `test-results/gameplay-dark-390x844.png`.

Contrast (manual, record in VERIFICATION): body text, primary and secondary buttons, notice, danger, Match, brand mark, chart. Stimulus digit is exempt from retinting; confirm it still reads on the shirt against dark turf.

FOUC: with stored Dark, at `domcontentloaded`, `html[data-theme="dark"]` is present. With empty storage and `emulateMedia` dark, `data-theme` is absent and the page is already dark from CSS. If `domcontentloaded` is flaky under Vite, rely on reload assertions.

### 10.3 Must not break

- Sound switch persistence.
- Delete local data still clears prefs (appearance returns to system; `data-theme` removed).
- Assessment still freezes **training** settings only; appearance remains a chrome pref.
- `configHash` goldens / sequence tests: zero changes.
- 13-viewport light play containment: still the release gate.

---

## 11. Risks

| Risk | Handling |
| --- | --- |
| Missed raw-hex selector in dark | Checklist in §4.6; visual pass of home, guide, play, break, results, settings, both modals |
| Dark playfield looks like a second stimulus | Mole paints frozen; only turf/rims change; no extra motion |
| OS theme change mid-round interrupts | Colour-only rules; 32/24 px thresholds; explicit `emulateMedia` test; no `scrollbar-gutter` |
| Two switches break Playwright | Appearance is segmented; sound query becomes named |
| Boot script vs React drift | Script only understands `"light"` / `"dark"`; React `applyAppearance` matches |
| Native `<select>` unreadable | CSS `color-scheme`; dark override on `select` |
| Brand mark vanishes on dark sidebar | Check mark vs `--bg` while picking swatches |
| iOS installed status bar stays light | Documented limit; do not retune `apple-mobile-web-app-status-bar-style` |
| Over-claiming accessibility | Record contrast notes; no WCAG certification claim |
| Dual-n-back worktree | If `../tag-ME-dual` exists, rebase after this lands; do not implement appearance twice |

---

## 12. Non-goals (this delivery)

- Per-session or exported appearance field
- Separate dark favicon, apple-touch icon, or maskable splash
- Changing PWA `manifest.theme_color` / `background_color`
- Changing `apple-mobile-web-app-status-bar-style`
- High-contrast / `forced-colors` theme
- Scheduling theme changes until a blank interval
- Recolouring unused `Garden()` artwork or adding sun/moon icons
- A play-page or sidebar quick toggle
- Bumping `garden-2.0`
- Independent “dark mole” art
- Rewriting the light stylesheet into a full design-token system

---

## 13. First implementation milestone

**Settings can choose Light, Dark, or Match device; Light/Dark survive reload via `data-theme`; Match device leaves `data-theme` off and follows the OS; the mole digit is the same paint as today; `configHash` is unchanged.**

Then dark screenshots, the two-viewport geometry check, the mid-round non-interrupt check, and the README/VERIFICATION notes.

---

*Plan version 1.1 — optional night-garden appearance for Recall Garden. Identity reconstruction remains TAG-ME-Again-Game-Specification.md. Protocol and scoring remain IMPLEMENTATION_PLAN.md.*
