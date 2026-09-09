# Recall Garden — PWA and offline gameplay implementation plan

Prepared 9 September 2026, from the current Recall Garden codebase (`IMPLEMENTATION_PLAN.md`, `README.md`, `src/App.tsx`, `src/data/storage.ts`, `src/components/Play.tsx`, `vite.config.ts`, `.github/workflows/pages.yml`).

Same-day review is folded in (see §0.1). This file is the plan to implement, not a changelog of the first draft.

This is a **review-and-build plan for a developer**. It is not a protocol change. Scoring, sequence generation, timing, and IndexedDB schema stay as they are.

---

## 0. How hard is this?

**Easy, if you do not invent extra machinery.** About half a day of code, plus a real-device pass on the Pages URL.

The game is already the right shape for a PWA:

| Already true | Why it helps |
| --- | --- |
| Static Vite app, no backend | Nothing to proxy or queue while offline |
| No CDN fonts, images, analytics, or API calls | Precache is a handful of hashed files |
| IndexedDB + localStorage already persist sessions | Offline play does not need a new data layer |
| `theme-color` is already set in `index.html` | Manifest theming is a copy, not a redesign |
| GitHub Pages is HTTPS | Service workers and `crypto.randomUUID()` already have a secure context in production |
| README already states: a loaded round needs no network | “Offline gameplay” is mostly “survive reload / relaunch with no network” |

What is **missing** today (from `README.md`):

> Offline reloads are not guaranteed: this release does not install a service worker.

That is the whole product gap: **first visit still needs the network; every later open, including airplane mode and Add to Home Screen, should not.**

What is actually load-bearing (everything else is packaging):

1. Production lives at `https://doctoime.github.io/tag-me/`. vite-plugin-pwa defaults `start_url` / `scope` from Vite `base`. Today’s `base: "./"` is likely to become `start_url: "/"`, which would install the app against `https://doctoime.github.io/` and look “fine” on localhost.
2. Reloading the page to apply a new SW while a session is **running** (play, tutorial, **or break**) hits the existing recovery path in `App.tsx` and marks the session interrupted. Gating on `stage === "play"` is not enough; gate on the existing `ongoing` flag.
3. Installable PWAs need PNG icons. The app currently ships only `public/favicon.svg`.
4. Playwright’s current webServer is `npm run dev`. Service workers should be tested against **`npm run preview` of a production build**, at `/tag-me/`, not against Vite HMR and not against `base: "/"`.

Do **not** rewrite the engine, storage, or UI shell. Do **not** add accounts, sync, push, background fetch, a custom install prompt, or a PWA React context.

### 0.1 Same-day review — what changed from the first draft

The first draft was directionally right and too heavy in the wrong places. Implement **this** file, not the earlier one.

| First draft | After review | Why |
| --- | --- | --- |
| Gate SW reload on `stage === "play"` | Gate on `ongoing` (`stage !== null && stage !== "results"`) | Break and instructions still have `status: "running"` and the `recall-garden-active` key. Reload runs the recovery loop and **falsely interrupts** a live session. This was a real bug in the draft. |
| CI-only `VITE_BASE=/tag-me/`; PWA tests on `/` | **Every** `vite build` uses `base: "/tag-me/"`. Dev stays `./`. Preview and PWA tests use `http://127.0.0.1:4173/tag-me/` | A CI-only env invites local/CI drift. Testing the SW at `/` cannot catch the Pages scope bug. Relative `base: "./"` is what the site uses today, but the plugin’s `resolveBasePath("./")` tends to become `"/"`, which is wrong on a project Pages site. |
| Custom `beforeinstallprompt` button + `preventDefault()` | **Do not** `preventDefault()`. Static install copy in Settings. No UA sniffing | Hiding Chromium’s install UI and burying our own in Settings makes install *harder*. iPadOS sniffing is fragile. |
| `persist()` after `saveSession` resolves | Call `navigator.storage.persist()` from the **Start** click (user gesture). Ignore the result | Safari often requires a gesture and will no-op from a promise callback. Do not nag. |
| Update banner + Settings button + plugin FLAG for injectManifest | One update control, only when `!ongoing`. **LOCK** `generateSW` + `registerType: "prompt"`. No second SW stack | Indecision is not simplicity. |
| Inspect Cache Storage in Playwright; second project bolted onto the main config | Behavioural offline reload + start. Separate `playwright.pwa.config.ts` / `npm run test:pwa` | Cache Storage assertions are brittle. Do not disturb `tests/browser.spec.ts`. |
| Lighthouse installability as acceptance | Device airplane-mode cold start is the bar. Lighthouse is advisory | Pages can fail Lighthouse for unrelated reasons. |
| Four maskable/any PNGs + an icon script | Commit **192, 512, 512-maskable, 180 apple-touch**. No `sharp` in CI, no generate script in v1 | One-time rasterize from `favicon.svg`. |
| `navigateFallbackDenylist: [/^\/api\//]` | Omit | There is no API. |
| Hard-coded manifest `id: "/tag-me/"` in prose | Derive `start_url` / `scope` from Vite `base`. **Omit** `id` in v1 | A hardcoded `id` plus a local preview at a different path can create two installed-app identities. |
| FLAG: switch to `manifest.json` only if Pages MIME fails | **LOCK** `manifestFilename: "manifest.json"` | GitHub Pages cannot set MIME types; `.webmanifest` has historically been served as octet-stream and blocked Chromium install. `.json` is always `application/json`, which browsers accept. |

Difficulty stays “easy,” not “one calendar day of PWA ceremony,” if those cuts hold.

---

## 1. Locked product decisions

Each item is **LOCK** (do not reopen without a written reason) or **FLAG** (reviewer may override before coding).

| ID | Decision | Status |
| --- | --- | --- |
| P1 | Ship an **installable PWA** with a web app manifest and a production-only service worker. Dev server (`npm run dev`) does **not** register a SW. | LOCK |
| P2 | Offline goal: after **one successful online load** of the current app version, the player can **open, play, save, review history, and export** with the network off. First-ever visit still requires the network. | LOCK |
| P3 | Game protocol, fingerprints, scoring, and IndexedDB schema (`recall-garden-v1`) are **unchanged**. This work is packaging, not a new task. | LOCK |
| P4 | Cache strategy is **precache the built app shell**. No runtime caching of third-party origins. No NetworkFirst for JS/CSS. | LOCK |
| P5 | **Never reload to apply a SW update while `ongoing` is true.** That includes play, instructions, and break. Dashboard and completed/interrupted **results** may show **Update**. Do not auto-reload. | LOCK |
| P6 | `vite build` and `vite preview` use `base: "/tag-me/"` (`command === "build"` or `mode === "production"`). Dev and Vitest keep `./`. No `VITE_BASE` env var. | LOCK — see §3 |
| P7 | `display: "standalone"`. Do **not** use `fullscreen`. Do **not** lock `orientation`. | LOCK |
| P8 | Install UX is **static copy** in Settings plus the browser’s own affordance. Do not call `preventDefault()` on `beforeinstallprompt`. No fake Install button on iPhone. | LOCK |
| P9 | Request **persistent storage** from the Start-training / Begin-assessment click. Ignore the boolean. Do not prompt the user. | LOCK |
| P10 | No push, periodic background sync, share target, file handlers, or app shortcuts. | LOCK |
| P11 | Update copy is honest: applying reloads. In-flight unsaved trial events can still be lost, same as today. | LOCK |
| P12 | Implementation vehicle is **vite-plugin-pwa `generateSW`**, `registerType: "prompt"`, `skipWaiting: false`, `clientsClaim: false`. Do not hand-write a SW. Do not use `autoUpdate`. | LOCK |
| P13 | No React context for PWA state. A small `src/pwa.ts` plus a few fields in `App.tsx` is enough. | LOCK |
| P14 | Emit **`manifest.json`**, not `manifest.webmanifest`. Set `manifestFilename: "manifest.json"`. | LOCK |

### 1.1 What “offline gameplay” does and does not mean

**In scope**

- Cold start with no network after the app is cached.
- Full training / practice / assessment rounds.
- History, progress chart, settings, tutorial.
- IndexedDB reads/writes and localStorage preferences.
- Optional Web Audio beeps (already generated in-memory in `Play.tsx`; no sound files).
- JSON/CSV export via Blob download (works offline on desktop; see §12.1 for iOS standalone).

**Out of scope**

- Playing before the first successful fetch of *this* version.
- Cross-device sync while offline (there is no sync).
- Surviving a mid-round OS kill any better than today (recovery marker already exists; in-flight events can still be lost).
- Making Chrome/Safari promise never to evict site data (persistence is best-effort; export remains the portable backup).
- Offline access to GitHub, this repo, or `review/` screenshots.
- Changing interruption policy in standalone (app-switch still ends a timed round). Watch it on the device pass; do not “fix” it in v1.

### 1.2 Difficulty by slice

| Slice | Effort | Risk |
| --- | --- | --- |
| PNG icons + HTML meta | 30–60 min | Low |
| vite-plugin-pwa + `base: "/tag-me/"` on build | 1–2 hours | Medium — wrong `start_url` = install against the user site |
| Update control gated on `ongoing` | 30–60 min | Medium if gated on play only |
| Settings copy + `persist()` on Start | 30 min | Low |
| `tests/pwa.spec.ts` on preview at `/tag-me/` | 1–2 hours | Medium — must not reuse `:5173` |
| Real iPhone + Android install pass | 1–2 hours | Medium — iOS is the usual surprise |

---

## 2. Current architecture (do not fight it)

```text
index.html                 shell, already has theme-color + description
src/main.tsx               React mount, no router, no fetch
src/App.tsx                screens, session orchestration, IndexedDB load
src/components/Play.tsx    timed engine + input; interrupts on hide/blur/resize
src/data/storage.ts        IndexedDB sessions, localStorage prefs/recovery
src/styles.css             bundled; Inter is a local fallback list, not a CDN
public/favicon.svg         only shipped icon
vite.config.ts             base: "./"
.github/workflows/pages.yml  npm ci, test, format, build, upload dist/
```

Runtime network usage in `src/` today: **none**. `Play.tsx` uses `AudioContext` oscillators. `storage.ts` uses IndexedDB / localStorage / Blob downloads. `engine.ts` uses `performance.now()` and `requestAnimationFrame`.

Implication: the service worker’s job is **app-shell caching**, not request virtualization of APIs.

### 2.1 Interruptions and recovery (read this before wiring updates)

From `Play.tsx`: hiding the tab, window blur, material playfield resize, and engine frame gaps already end the **round**.

From `App.tsx` on every boot:

```ts
if (s.status === "running" || s.id === recovery) {
  s.status = "interrupted";
  s.recoveryNote = "The page closed or reloaded during this session. …";
}
```

`start()` writes `localStorage[RECOVERY]`. `end()` (Finish for now, or last round complete) clears it and sets `completed` / `interrupted`. Between rounds, status is still `"running"` and `ongoing` is true.

A SW-driven `location.reload()` is therefore:

| Screen | `ongoing` | Reload effect |
| --- | --- | --- |
| Dashboard, no session | false | Fine |
| Play | true | Aborts the round **and** recovery-interrupts the session |
| Instructions / tutorial in-session | true | Recovery-interrupts the session |
| Break | true | **Looks idle; recovery-interrupts the session** |
| Results after `end()` | false | Fine — session already completed or interrupted |

Standalone display can also fire `blur` when the OS shows a control center. That is existing behaviour. Do not special-case it in v1. Do note it on the iPhone pass: using it as a home-screen app makes app-switch more likely, so timed rounds will abort more often. That is protocol-correct, not a PWA defect.

---

## 3. GitHub Pages, base path, and service worker scope

This is the load-bearing deploy decision.

| Context | URL | SW file | SW scope |
| --- | --- | --- | --- |
| Production | `https://doctoime.github.io/tag-me/` | `/tag-me/sw.js` | `/tag-me/` |
| Local preview / PWA tests | `http://127.0.0.1:4173/tag-me/` | `/tag-me/sw.js` | `/tag-me/` |
| Local dev | `http://localhost:5173/` | **none** | n/a |

### 3.1 Why production `base` must become `/tag-me/`

Today `base: "./"` is correct for a **static** Pages deploy: hashed assets are relative, so `npm run build` needs no repo name. Keep that property for **dev**.

A service worker and a manifest are not just more static files. vite-plugin-pwa sets `start_url` and `scope` from `resolveBasePath(base)`. Relative `"./"` is commonly normalised to `"/"`. Then:

- Manifest `start_url: "/"` → installed icon opens `https://doctoime.github.io/` (the user Pages index), not Recall Garden.
- SW registered at `/sw.js` → 404 on a project site (the worker is at `/tag-me/sw.js`), or would be out of scope.

**LOCK** in `vite.config.ts`:

```ts
export default defineConfig(({ command, mode }) => ({
  base: command === "build" || mode === "production" ? "/tag-me/" : "./",
  // plugins, test, …
}));
```

`vite preview` uses `command: "serve"` and `mode: "production"`. Gating only on `command === "build"` makes preview serve hashed assets at `/assets/` while `index.html` asks for `/tag-me/assets/`, so the app is a blank page. Dev (`vite`, mode development) and Vitest (mode test) keep `base: "./"`.

`.github/workflows/pages.yml` stays `npm run build`. No new env var.

Consequences to document in README:

- `npm run preview` after a build is **`http://localhost:4173/tag-me/`**, not `/`.
- Existing Playwright on the Vite **dev** server is unchanged.
- The repo name is now coupled to the production base. If the GitHub repo is renamed, this one string changes.

### 3.2 Manifest `start_url` and `scope`

Do not hard-code these in a JSON blob in source. Let the plugin copy Vite `base`:

- Production: `start_url` and `scope` are `/tag-me/`.
- Omit `id` in v1 so Chrome does not treat preview and Pages as two apps with a mismatched id.

`start_url` must stay inside `scope`. Use a trailing slash. Do not use `./index.html` as `start_url`.

Post-build check (cheap, belongs in `tests/pwa.spec.ts` setup or a tiny node assert): `dist/manifest.json` (not `.webmanifest`) has `"start_url": "/tag-me/"` and `"scope": "/tag-me/"`; `dist/index.html` does not register `/sw.js` at origin root; `dist/sw.js` exists at the dist root (not under `assets/`).

### 3.3 Headers and navigation

GitHub Pages does not let this repo set `Service-Worker-Allowed`. The SW file **must** be at `/tag-me/sw.js`. vite-plugin-pwa does this by default.

Do not add a `404.html` SPA hack; this app has no client router. `navigateFallback` should be the plugin default (`index.html` under `base`), not a denylist for APIs that do not exist.

**LOCK:** emit `manifest.json`, not `manifest.webmanifest`. GitHub Pages MIME types come from mime-db and cannot be set per-repo. Current mime-db maps `.webmanifest` to `application/manifest+json`, so Pages *might* be fine today, but historically unknown extensions were served as `application/octet-stream` / `text/plain`, which Chromium treats as not a manifest and blocks install. Browsers accept `application/json` for `<link rel="manifest">`. Set vite-plugin-pwa `manifestFilename: "manifest.json"`.

### 3.4 `index.html` asset URLs

Today:

```html
<link rel="icon" href="/favicon.svg" />
```

With a production `base` of `/tag-me/`, Vite should rewrite this to `/tag-me/favicon.svg`. Prefer `%BASE_URL%favicon.svg` (and the same for `apple-touch-icon`) so it cannot silently point at `https://doctoime.github.io/favicon.svg`.

---

## 4. Web app manifest

Configure via vite-plugin-pwa `manifest` (emitted into `dist/`). Let the plugin inject the `<link rel="manifest">` tag. Do not duplicate it by hand unless the plugin is configured not to inject.

### 4.1 Fields

| Field | Value |
| --- | --- |
| `name` | `Recall Garden` |
| `short_name` | `Recall Garden` |
| `description` | Match the existing `index.html` meta description |
| `display` | `standalone` |
| `background_color` | `#fafbf7` (page ivory from `src/styles.css`) |
| `theme_color` | `#244d3c` (already in `index.html`) |
| `lang` | `en` |
| `orientation` | `any` |
| `icons` | see §5 |
| `categories` | `["games", "education"]` |

Omit `dir`, `prefer_related_applications`, `screenshots`, `shortcuts`, and `id`.

### 4.2 HTML extras (`index.html`)

Keep existing theme-color and description.

Add:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Recall Garden" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />
```

`apple-mobile-web-app-capable` is the tag iOS still honours for standalone. Skip `mobile-web-app-capable` unless a device pass shows it is needed.

Do not add `viewport-fit=cover` in v1. If the iPhone notch clips the playfield in standalone, that is a small CSS follow-on, not a SW change.

---

## 5. Icons

Browsers still want **PNG** for install. SVG favicon remains for browser tabs.

### 5.1 Files (all derived from `public/favicon.svg`)

| File | Size | Purpose |
| --- | --- | --- |
| `public/favicon.svg` | vector | unchanged tab icon |
| `public/icons/icon-192.png` | 192×192 | manifest `any` |
| `public/icons/icon-512.png` | 512×512 | manifest `any` |
| `public/icons/icon-512-maskable.png` | 512×512 | `purpose: "maskable"`, sprout in the inner ~80% |
| `public/apple-touch-icon.png` | 180×180 | iOS home screen |

Do not invent a new brand. Rasterize once and **commit the PNGs**. No `sharp` dependency, no `npm run icons` in v1.

Do not point the manifest at SVG only. Do not use a third-party icon CDN. Do not combine `purpose: "any maskable"` on one file.

### 5.2 Manifest icon entries

Icon `src` values must be **relative** (`icons/icon-192.png`, not `/icons/...`). The plugin prefixes `base`.

---

## 6. Service worker

### 6.1 Plugin wiring

Add `vite-plugin-pwa`, pinned, compatible with Vite 6.4.x.

```ts
VitePWA({
  registerType: "prompt",
  injectRegister: false,
  manifestFilename: "manifest.json",
  includeAssets: [
    "favicon.svg",
    "apple-touch-icon.png",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-512-maskable.png",
  ],
  manifest: { /* §4; do not set start_url/scope/id unless the plugin fails to copy base */ },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,json}"],
    cleanupOutdatedCaches: true,
    clientsClaim: false,
    skipWaiting: false,
  },
  devOptions: { enabled: false },
})
```

Leave `navigateFallback` at the plugin default. Do not add `autoUpdate`.

### 6.2 Registration

`src/pwa.ts`, imported from `src/main.tsx`. Use the plugin’s `virtual:pwa-register`:

```ts
registerSW({
  immediate: true,
  onNeedRefresh() { /* set a module listener */ },
  onOfflineReady() { /* optional: Settings copy */ },
})
```

The plugin must no-op (or not be imported) in a way that `npm run dev` still starts. If the virtual module is unavailable when the plugin is disabled in serve, gate the import with `import.meta.env.PROD`.

Expose two booleans and one function via a module-level listener (not context):

- `needRefresh`
- `offlineReady` (optional; Settings can live without it)
- `update()` → `skipWaiting` then `location.reload()` **only after** `App` has confirmed `!ongoing`

`update()` itself should not have to know about sessions; `App` simply does not call it while `ongoing`.

### 6.3 Applying an update

```text
new SW waiting
    → needRefresh = true
    → if ongoing: no banner on the playfield; Settings may say
      “A new version will apply when you finish this session.”
    → if !ongoing: footer or Settings control “Update now”
player chooses Update
    → skipWaiting → controllerchange → location.reload()
```

Do not `skipWaiting` from the SW `install` handler. Do not reload from `onNeedRefresh` automatically.

Players may keep an old cached shell until they accept Update. That is acceptable. Do not run two JS bundles in one tab.

### 6.4 Cache contents

Precache Vite’s `dist/` output: `index.html`, hashed JS/CSS, icons, favicon, manifest.

There are **no** font files (`Inter` in CSS is a family name). Do not add Google Fonts.

Do not bump `configHash` / `VERSIONS` for this work.

### 6.5 Unregister

No UI in v1. `clearData()` must **not** unregister the SW (that would strand the next offline open). Cache Storage holds the app; IndexedDB holds scores.

---

## 7. Application UI

Surgical changes only. No new pages. No install state machine.

### 7.1 Settings — extend “Saved data”, do not add a “This device” card

Add three short sentences under the existing local-only paragraph:

- After this visit, this browser can open Recall Garden without a network.
- Phone: browser menu → Install app. iPhone: Share → Add to Home Screen.
- Scores stay on this device; export if you want a copy.

If `needRefresh && !ongoing`: a secondary **Update** button in that card.

If `needRefresh && ongoing`: the same sentence, no button (“Finish this session first”).

If `"serviceWorker" in navigator` is false: “This browser cannot keep the app files cached. Play still works while the page stays open.”

Do not toast `offlineReady` on every launch. Do not sniff UA except what CSS `display-mode` already gives you if you want “Opened as an app” — optional one line, skip unless it is trivial.

### 7.2 Update control placement

Prefer the Settings row. A footer sibling of `.save-footer` is allowed **only when `!ongoing`**. Never cover the match control. Do not put a banner on the break screen that reloads.

### 7.3 Display-mode CSS

None in v1 unless the iPhone pass shows a real layout bug.

### 7.4 `persist()` 

In `start()`, in the same tick as the user click, before the async work:

```ts
void navigator.storage?.persist?.();
```

Do not await it. Do not show the result. Do not call it on every page load.

---

## 8. Persistence and data eviction

IndexedDB is independent of the SW cache. Offline play can still lose history if the browser evicts site data. Export remains the portable backup. README already says that; keep it.

`navigator.storage.estimate()` is out of v1.

---

## 9. Files to add or touch

```text
package.json                         vite-plugin-pwa; script test:pwa
package-lock.json
vite.config.ts                       command-based base + plugin
index.html                           apple metas; %BASE_URL% icons
src/main.tsx                         import ./pwa in PROD
src/pwa.ts                           NEW: registerSW + listeners
src/App.tsx                          persist() in start(); Update when !ongoing; Settings copy
src/styles.css                       only if the Update row needs it
public/icons/icon-192.png            NEW
public/icons/icon-512.png            NEW
public/icons/icon-512-maskable.png   NEW
public/apple-touch-icon.png          NEW
playwright.pwa.config.ts             NEW: preview at /tag-me/
tests/pwa.spec.ts                    NEW
README.md                            preview URL, install, offline, limits
PWA_OFFLINE_IMPLEMENTATION_PLAN.md   this file
```

Do **not** change `.github/workflows/pages.yml` except if `format:check` needs a glob (it already covers `src` and `tests`). Do not change `src/game/*` or IndexedDB schema.

---

## 10. Verification

### 10.1 Automated (must land with the code)

**Unit / build**

- `npm test` unchanged and green.
- `npm run build` (now `/tag-me/`): `dist/index.html` references `/tag-me/assets/…`; `dist/sw.js` exists; manifest `start_url` and `scope` are `/tag-me/`.
- `npm run format:check` green.

**Playwright — `playwright.pwa.config.ts` + `npm run test:pwa`**

- `webServer`: `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`
- `baseURL`: `http://127.0.0.1:4173/tag-me/`
- `reuseExistingServer: false`
- Do **not** edit the default Playwright webServer on `:5173`.

Cases (behavioural, not Cache Storage archaeology):

1. Online load: home heading visible; `navigator.serviceWorker.ready` resolves.
2. Then `context.setOffline(true)`, `page.reload()`, dashboard still renders, Start training enables after IndexedDB load.
3. Offline, click Start training, reach countdown/playfield (do not run 60 trials).
4. Optional: `needRefresh` path is **not** required in v1 automation (hard to fake a second build in-process). Cover it on the device/manual list.

If `setOffline` + SW is flaky in this Playwright version, document the failure and keep a manual check; do not disable the SW to make the test pass.

### 10.2 Manual (required before calling Pages done)

Run against **`https://doctoime.github.io/tag-me/`** after deploy:

| Check | Android Chrome | iPhone Safari | Desktop Chromium |
| --- | --- | --- | --- |
| Application panel: manifest `start_url` `/tag-me/`, SW scope `/tag-me/` | yes | yes | yes |
| Install / Add to Home Screen | yes | yes | optional |
| Airplane mode, cold start installed app, practice round, save | yes | yes | yes |
| History after airplane cold start | yes | yes | yes |
| While on **break**, a waiting SW must not reload the session into “interrupted” | Chromium | if practical | yes |
| Update from dashboard after finishing, new version loads | yes | yes | yes |
| Export JSON from standalone | yes | **watch** | yes |

iPhone notes:

- No `beforeinstallprompt`.
- First Add to Home Screen may happen before the SW finishes; open once online, then verify airplane mode.
- Standalone Blob downloads have historically failed or opened Safari. If export is broken, keep browser-tab export; do not redesign download in v1.

### 10.3 Acceptance checklist

- [ ] `vite build` emits SW, manifest, and assets under `/tag-me/`.
- [ ] GitHub Pages deploy is that `dist/` (workflow already uploads it).
- [ ] Dev server does not register a SW; existing Playwright suite still targets Vite at `/`.
- [ ] `npm run preview` documented as `/tag-me/`.
- [ ] After one online visit, airplane-mode cold start reaches the dashboard and can start a round.
- [ ] Sessions still save to IndexedDB and appear in history offline.
- [ ] SW update cannot reload while `ongoing`.
- [ ] Settings has install/offline copy; no `preventDefault` on install prompt.
- [ ] `clearData` does not unregister the SW.
- [ ] Protocol hashes / unit tests unchanged.
- [ ] README documents install, offline, first-visit network need, iOS path, and preview URL.

---

## 11. Implementation sequence

### Phase A — icons and HTML

Rasterize PNGs. Apple meta + `%BASE_URL%` icon links.

### Phase B — base + plugin

`base: command === "build" ? "/tag-me/" : "./"`. Add vite-plugin-pwa. Confirm `preview` at `/tag-me/`: SW activated, scope `/tag-me/`, Cache Storage has the shell.

### Phase C — App chrome

`src/pwa.ts`. Settings copy. Update button when `!ongoing`. `persist()` in `start()`.

### Phase D — tests and docs

`tests/pwa.spec.ts` + README. Workflow unchanged aside from the new build output.

### Phase E — device pass on Pages

Airplane-mode cold start on one Android and one iPhone if available. Fix MIME / safe-area / export only if observed.

Do not interleave dual n-back work (`DUAL_NBACK_IMPLEMENTATION_PLAN.md`) with this.

---

## 12. Risks and non-goals

### 12.1 Risks

| Risk | Mitigation |
| --- | --- |
| Manifest `start_url` is `/` | Build base `/tag-me/`; assert it in dist |
| Reload on break marks session interrupted | Gate on `ongoing`, not play |
| `autoUpdate` serves new cache to old JS | `prompt` only |
| iOS storage eviction | `persist()` on Start, export copy, honest README |
| Playwright tests `:5173` and “pass” without a SW | Separate preview config at `/tag-me/` |
| GitHub Pages MIME for `.webmanifest` | **LOCK** `manifestFilename: "manifest.json"` |
| iOS standalone `download` attribute | Device pass; fall back to tab |
| Standalone app-switch fires `blur` / `hidden` | Existing engine rules; do not change in v1 |

### 12.2 Explicit non-goals (v1)

- Accounts, cloud backup, import.
- Push (“time to train”).
- Offline *before* first visit.
- Custom install prompt / `beforeinstallprompt` state.
- Changing interruption policy for standalone.
- `display: fullscreen`, orientation lock, splash art.
- Serving from `file://`.
- Icon generation pipeline.
- Unregister / “reset cache” UI.

### 12.3 Follow-on (not this plan)

- `viewport-fit=cover` + safe-area if the notch clips play.
- App shortcuts once a real URL means “start training.”
- Softening `blur` interrupts in standalone (protocol discussion, not packaging).
- Badge / streak notifications.

---

## 13. README additions (draft copy)

Replace the sentence that offline reloads are not guaranteed:

```text
## Install and offline use

Recall Garden is a progressive web app. After you open it once on
https://doctoime.github.io/tag-me/ the browser keeps the game files.

- Phone: browser menu → Install app, or on iPhone Share → Add to Home Screen.
- Then airplane mode should still open the garden, run rounds, and save
  history on this device.
- The first visit, and each new version until you choose Update, needs a
  network connection.
- Scores stay in this browser. Export JSON if you want a copy. Clearing
  site data removes both scores and the cached app.

Production previews: `npm run build && npm run preview`, then open
http://localhost:4173/tag-me/ (not the site root).
```

Keep the existing note that `crypto.randomUUID()` needs a secure context.

---

## 14. Reviewer one-pager

| Question | Answer |
| --- | --- |
| Is this hard? | No, if you do not add an install prompt, an icon toolchain, or a CI-only base. |
| Does gameplay code change? | No, except Settings copy, an Update control, and `persist()` on Start. |
| Can we play fully offline? | Yes, after one online load of that version. |
| Can we install it? | Chromium/Android via the browser; iOS via Add to Home Screen. |
| What are the traps? | Manifest `start_url: "/"` on Pages; reloading a **running** session (including break). |
| Plugin? | vite-plugin-pwa `generateSW`, `registerType: "prompt"`, no SW in `npm run dev`. |
| Protocol bump? | No. |
