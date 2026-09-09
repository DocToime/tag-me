# Recall Garden

A complete, local-first browser memory game built from the specification and review in this folder. Train with numbered moles in a six-hole garden, matching the number from N turns ago. There is no maximum training level.

The detailed design, review decisions, protocol contracts, architecture, and acceptance checklist are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). The original source documents are preserved alongside it.

## Run locally

Requires Node.js 22 or later and npm.

```bash
npm ci
npm run dev
```

Open **http://localhost:5173**. The development server also exposes a LAN address. For use on other devices, serve the production build over HTTPS; browser features such as `crypto.randomUUID()` require a secure context (localhost is supported).

```bash
npm run build
npm run preview
```

The production app is a static site in `dist/`. It needs no backend, API key, database server, or environment variables. Deploy that directory to a static host. There are no external runtime fonts, assets, analytics, or API calls. Once loaded, a round requires no network connection. Offline reloads are not guaranteed: this release does not install a service worker.

## What is included

- Compact setup with the level, duration, and Start button together.
- Viewport-fitted play with original mole artwork and a landscape control panel.
- Interactive worked examples for any N (golden 1-, 2-, and 3-back sequences), using the selected response style.
- Mandatory comprehension practice at each new level in a session.
- Adaptive training with one, three, or five rounds; 1.5–4 second exposure options.
- Fixed single-level assessment at the selected N, or a complete 1/2/3-back battery.
- Fixed match control and a separately tagged aimed-response training variant.
- Deliberate breaks, stop/restart, interruption detection, and reload recovery.
- Per-round counts, component rates, balanced accuracy, sensitivity, response criterion, hit reaction time, rate intervals, and quality observations.
- Local session history with separate progress filters by mode, level, and protocol. Chart points open their sessions; changes of input or display are marked.
- JSON export with raw telemetry, CSV summaries, and confirmed local-data deletion.
- Optional sound, reduced-motion support, focus indicators, keyboard controls, and modal focus management.

## How to play

Remember the **number**, not the hole. If the current number equals the number **N turns ago**, respond. If it differs, wait.

For 3-back, `2, 5, 8, 2` ends with a match: the final `2` matches the number three turns earlier. The first N appearances only fill memory and are never scored.

| Response style | Controls |
| --- | --- |
| Fixed (default; all assessments) | Click/tap **Match**, or press **Space** |
| Aimed (optional training) | Click/tap the active mole; **Q W E** for top holes and **A S D** for bottom holes |
| No match | Do nothing |
| Stop | Select **Stop round**; keyboard focus and activation also work |

A response does **not** hide the number or make the next trial start sooner. The first eligible press determines the result. Extra presses cannot repair an initial mistake. In aimed mode, a wrong-hole press is a miss on a target and a false alarm on a non-target.

## Protocol defaults

| Parameter | Training | Assessment | Practice |
| --- | --- | --- | --- |
| Memory level | Any integer ≥ 1, adaptive at round boundaries, no maximum | Selected N or 1 → 2 → 3 | Upcoming round’s N |
| Scored trials | 60 | 60 | 12 |
| Additional fill trials | N | N | N |
| Targets | Exactly 18 | Exactly 18 | Exactly 6 |
| Non-target adjacent-lag lures | Exactly 5 | Exactly 5 | Exactly 1 |
| Number exposure | 2,000 ms default; configurable | 2,000 ms fixed | At least 2,000 ms |
| Blank interval | 750 ms | 750 ms | 750 ms |
| Correctness feedback | During blank interval | None | During blank interval |
| Controls | Fixed or aimed | Fixed | Same as upcoming round |

Practice requires at least **5 hits out of 6 targets** and **at most 1 false alarm**, with no observed long frames. Failed practice can be repeated with fresh numbers or reviewed in the tutorial. It is saved but excluded from training scores.

The example can be explored without completing a compulsory walkthrough. Players who have previously passed practice at the selected level and response style go directly to practice next time. Every new session still requires a fresh practice pass before scored play. Response style, number exposure, sound, and data exports are in **Settings & data**.

The September 2026 layout uses the `garden-2.0` display version. Scoring, sequence generation, and timing are unchanged. This version participates in the existing configuration fingerprint so progress charts and adaptation do not combine rounds from the old and new displays.

Training moves up one N after two consecutive comparable rounds with hit rate ≥85% and false-alarm rate ≤15%. It moves down after two rounds with hit rate <60% or false-alarm rate >30%. It otherwise holds steady. The floor is 1-back; there is no maximum level. Qualifying rounds can span sessions. Different settings, interrupted rounds, and quality-failed rounds break the qualifying sequence. The suggested starting level is saved for next time; you can choose another on the dashboard.

Three standard rounds take roughly nine minutes of scored play. Practice and breaks are additional. Assessment settings are fixed independently of training preferences.

## Timing and reproducibility

The engine is independent of React navigation and uses an injected scheduler. Production uses `performance.now()` and `requestAnimationFrame`; the playfield updates synchronously on phase changes. The digit is stationary and fully present at its recorded onset estimate.

- Response window: `[onset, onset + exposure)`.
- A press must occur and reach the handler before the deadline. A delayed dispatch that arrives after closure is logged outside the window; it never retroactively changes a trial.
- Subsequent onsets follow the planned schedule, regardless of whether a response occurred.
- Frames over 50 ms are recorded; gaps or onset delays over 250 ms interrupt the round.
- Hiding the tab, losing window focus, materially resizing the playfield, or stopping interrupts the current round. Restarting always uses a fresh seed and new fill trials.
- Interrupted, incomplete trials remain `pending`; the engine does not invent misses for unseen or unfinished trials.
- Raw input logs include first/repeated/outside-window events, event and handler timestamps, pointer/key information, and active hole geometry.

Number sequences use separate seeded streams for digits and balanced hole assignments. The generator enforces exact target/lure quotas and rejects four-number identical runs. Finished sequences are independently relabelled. Each block stores its seed, actual sequence, version tags, content fingerprint, trial IDs, and material configuration fingerprint. Fingerprints are reproducibility checks, not cryptographic signatures.

These are browser software timestamps. Physical display/input latency is not calibrated. Mobile touch hardware and browsers beyond the recorded browser checks should receive a real-device usability pass before a larger rollout.

## Scores

Balanced accuracy averages match detection and correct withholding, so never responding scores 50%, even though it scores 70% raw accuracy under the standard target ratio. Both rates and all underlying counts remain visible.

Sensitivity (d′) and response criterion use a versioned log-linear correction: `(count + 0.5) / (denominator + 1)`. Reaction-time summaries use correct matches only. Missing metrics are null in exports and an em dash in the interface. Rate intervals use the Wilson method. No speed/accuracy composite is hidden inside the results.

No-response rounds retain their behavioural scores and receive an observation flag. They do not trigger adaptation. Interrupted attempts are displayed separately. Assessment and training never share a chart series, and different N values and material protocols remain separate.

## Local data and recovery

Full session records live in IndexedDB (`recall-garden-v1`). Small preferences, a random local participant ID, and an active-session marker use keys beginning `recall-garden-` in localStorage. There are no uploads or accounts. History is scoped to the site address: switching hosts or ports opens a separate local garden.

Writes are queued and keyed by session ID. Each practice/scored attempt is saved when it ends. If storage fails, the current results stay in memory and an export action remains available. The UI displays the failure rather than claiming success.

A hard close or reload can lose the **in-flight round’s raw events**. On reopening, the session is marked interrupted, with an explicit recovery note; previously saved attempts remain available. There is no automatic resumption of an old memory buffer. Export JSON for a portable backup. Clearing site/browser data removes local records.

Data deletion clears only this app’s records and preference keys. It does not clear other applications’ origin data. There is no import or cloud synchronization in this release.

## Development and verification

```bash
npm test                   # deterministic mechanics, scoring and scheduling
npm run build              # strict TypeScript and production bundle
npm run format:check       # consistent source formatting
npx playwright install chromium
npm run test:browser       # real browser workflows, virtual timing for long rounds
```

If Google Chrome is already installed, avoid a browser download:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Playwright starts a local Vite server if one is not running. Long rounds use Playwright’s controlled clock so scoring and session flows can be checked without human reaction variability. This does not simulate physical latency. Screenshots are written to `test-results/`.

The implementation has unit tests for 600 sequence seeds across all N values, quotas, lures, deterministic replay, scoring extremes, nulls, practice gating, adaptation, independent timing, exact deadlines, duplicates, aimed errors, and interruption. Browser coverage includes the dashboard, preferences, mobile layout, complete training, practice failure, history, export, deletion, storage failure, aimed controls, progression, and the full assessment battery. See [VERIFICATION.md](VERIFICATION.md) for the final run record.

## Source layout

```text
src/App.tsx                Screens and session orchestration
src/components/Art.tsx     Original SVG icons, mole, and garden
src/components/Play.tsx    Rendering and browser input adapter
src/components/Tutorial.tsx Compact interactive examples and practice entry
src/components/Results.tsx Results, history, and progress chart
src/game/sequence.ts       Seeded constrained generator and independent labels
src/game/scoring.ts        Classifier and statistical summaries
src/game/engine.ts         Frame scheduling, input windows, interruption
src/game/protocol.ts       Frozen defaults, fingerprints, adaptation
src/game/types.ts          Typed protocol and telemetry records
src/data/storage.ts       IndexedDB, export, recovery keys, deletion
src/styles.css            Responsive layout and visual system
```

The product intentionally uses one original skin. Cloud accounts, independent outcome-task batteries, researcher administration, and additional skins are future extensions described in the plan, not prerequisites for playing or tracking training.

## Deployment

The app is published at [Recall Garden](https://doctoime.github.io/tag-me/). A push to `main` runs the GitHub Pages workflow: dependency install, unit tests, formatting check, production build, and deployment of `dist/`. The full browser suite is run locally before release.

The [design review](review/REVIEW.md) preserves the original findings and screenshots. Current regressions live in `tests/usability.spec.ts`, including 13 screen sizes in both input modes, touch responses, viewport containment throughout play, keyboard focus, responsive navigation, and returning-player practice gating.
