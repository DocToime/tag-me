# Implementation verification

Run date: 9 September 2026. This record covers the design and playability improvements following the [baseline review](review/REVIEW.md).

## Changes delivered

- Compact home setup with level, duration, and Start together; response style moved to Settings.
- Clearer copy, darker secondary text, larger labels, and consistent navigation names/selected states.
- A compact interactive example matching the selected level and input style. Returning players can skip the explanation, but every session still requires practice before scored rounds.
- A viewport-fitted six-hole board, 56 px match control, stable feedback space, and side controls in short landscape windows. In-session navigation is removed.
- Actual playfield geometry is observed; material changes require a fresh round.
- Continue precedes detailed practice statistics. Retry guidance distinguishes comprehension and device timing. Completed rounds precede collapsed interrupted attempts, and device metadata is collapsed.
- Larger chart interaction areas and an alternative list of rounds, with human-readable settings filters.
- Modal keyboard focus returns to the opener, and screen transitions focus an appropriate heading or play region.
- Display version `garden-2.0` separates new layout results from the original display in existing protocol fingerprints. Sequence generation, timing, scoring, stored history, and assessment settings are preserved.
- The Pages workflow now checks unit tests and source formatting before building and deploying.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 24 passed |
| `npm run build` | Passed: TypeScript and Vite production build |
| `npm run format:check` | Passed |
| `git diff --check` | Passed |
| Full browser regression suite | 40 passed in 9.4 minutes |
| Production build smoke tests | Passed in Chrome 153, Firefox 141, and WebKit 26 on Linux |

The 40 browser scenarios include the nine original workflows, updated for the concise interface, plus 31 usability regressions. Original workflows cover scored training, the 1/2/3 assessment battery, adaptation, saving/recovery, export, deletion, aimed responses, and real-clock keyboard behaviour. New checks cover 13 viewport sizes in both response modes, touch inputs, all six holes and the active digit within bounds, no scrolling across play phases, accessible navigation, focus restoration, geometry interruption, and returning-player practice gating.

An initial integration run caught leftover decorative grid children that could clip a hole. They were removed; the final run additionally checks each hole and digit rather than relying only on the board container's bounds.

Viewport matrix: 320×568, 360×640, 375×667, 390×844, 430×932, 667×375, 844×390, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, and 1920×1080. The default browser-test viewport is now 1366×768. Environment: Node 22.23.2, npm 11.4.2, Playwright 1.55.1.

## Production-build evidence

The [production-build observations](review/implemented/checks.json) record isolated browser sessions, viewport bounds, response acknowledgement, stop handling, and runtime errors. Screenshots include [small-phone play](review/implemented/Chrome-320x568-play.png), [landscape play](review/implemented/Chrome-844x390-play.png), [laptop play](review/implemented/Chrome-1280x720-play.png), and [mobile home](review/implemented/Chrome-390x844-home.png).

At 320×568, the full match control ends at y≈525; in the original it ended at y≈612. At 1280×720, it ends at y≈677; previously it ended at y≈832. The 390×844 homepage no longer requires scrolling. The smallest homepage may scroll to secondary/footer content, while setup and Start are visible together.

## Boundaries and reproduction

- Browser contexts contain synthetic sessions and do not alter the user's browser history or stored game data.
- Long flows use Playwright's controlled clock; one regression exercises the real clock. Automation reaction times do not measure physical display/input latency.
- Touch is generated through Playwright. Actual iOS/Android hardware, browser toolbars, and screen readers still need a device usability pass. Linux WebKit is not a claim of full Safari certification.
- The production smoke script uses installed Chrome and this machine's cached Firefox/WebKit executable paths. Adjust those paths on another machine.
- Original review screenshots and scripts are historical evidence for baseline `800413f`; current layout assertions are in `tests/usability.spec.ts`.
- Six empty Git objects were recovered from a verified GitHub mirror; `git fsck --full` passed after recovery. Working files were preserved.

```sh
npm test
npm run build
npm run format:check
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
# In another terminal: npm run preview -- --host 127.0.0.1 --port 4183 --strictPort
node review/implementation-audit.mjs
```

Deployment target: [Recall Garden on GitHub Pages](https://doctoime.github.io/tag-me/). Pushing to `main` runs `.github/workflows/pages.yml`; only `dist/` is deployed.

## Appearance (10 September 2026)

Night-garden chrome with Light / Dark / Match device in Settings. Mole shirt and digit paints are unchanged. `VERSIONS.art` stays `garden-2.0`.

| Check | Result |
| --- | --- |
| `npm test` | 30 passed (includes parse/resolve appearance) |
| `npm run build` | Passed |
| `npm run format:check` | Passed |
| Dashboard / prefs browser test | Passed (Dark persists, Light overrides a dark OS, Match device follows `emulateMedia`) |
| Settings at 320×568 | Three appearance segments fit; no horizontal overflow |
| Playfield Light vs Dark at 390×844 and 1280×720 | Box within 2 px; digit ≥ 20 px; OS theme flip during a visible trial did not interrupt |
| Manual pass | Settings, home, and practice countdown read as a night garden; brand mark remains distinct; mole unchanged |

Playwright on this machine reused other projects on :5173/:5174. Targeted browser checks used `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5176`. The full 13-viewport usability matrix was not re-run for this change.
