# Recall Garden — implementation plan

Prepared 8 September 2026, from `TAG-ME-Again-Game-Specification.md` and `TAG-ME-Again-Review.md`.

## 1. Product decision and scope

Build a complete, browser-based working-memory training app. The user's hypothesis that repeated training is beneficial is the product premise. The interface should encourage a sustainable practice habit, explain the task clearly, and make progress inspectable. It will not repeatedly debate that premise.

Use an original identity, **Recall Garden**, and original code-native mole artwork. The six-hole numbered-mole mechanic comes from the supplied specification. Number identity, never hole position, determines an N-back match.

The first delivery is a runnable local-first single-user application, with no account, server, external analytics, subscription, or network requirement during play. It includes both adaptive training and fixed assessment. Source documents are preserved. Product defaults below are our own versioned implementation decisions.

### Deliverables

1. This detailed decision, implementation, and verification plan.
2. React/TypeScript browser app with responsive desktop and mobile layouts.
3. Deterministic sequence generator, independent classifier, scoring, and timed engine.
4. Guided examples, comprehension practice, adaptive training, and a three-level assessment.
5. Local persistence, session inspection, progress filters, raw JSON and summary CSV export, and deletion controls.
6. Meaningful automated engine tests and browser interaction checks.
7. README with setup, controls, architecture, defaults, storage behaviour, and remaining limits.

## 2. Review resolution matrix

| Supplied issue | Implementation decision | Verification |
| --- | --- | --- |
| Early responses can shorten exposure | Frame-driven scheduling; input only records an event | Compare schedules with a 300 ms press and silence |
| Approximate target rate | Exactly 18 of 60 scored trials are targets | Recompute labels over many seeds and all N values |
| Warmup ambiguity | N fill trials followed by explicitly configured scored trials | Count exclusion tests |
| Lure insertion creates accidental lures | Generate exact non-target lure quota, excluding unintended adjacent-lag matches | Independently recompute lag labels |
| Long identical runs | Reject target schedules that create four identical consecutive digits | Multi-seed generator checks |
| Practice can pass on silence | Six targets and six non-targets; require >=5 hits and <=1 FA | Silent and always-press tests |
| Timing/input ambiguity | Half-open response window; first eligible new press wins; all other presses logged | Deadline, duplicate, repeat, gap tests |
| Hidden tabs and pauses | Abort current block, preserve attempt, restart fresh | Engine and browser interruption checks |
| Wrong-hole ambiguity | Default fixed match control; optional aimed control uses wrong-hole-as-miss on targets and FA on non-targets | Classifier tests |
| Inappropriate composite metrics | Show component rates, balanced accuracy, d-prime, criterion and hit RT | Golden scoring tests |
| Feedback leaks assessment correctness | Identical neutral acknowledgement on any eligible response; no correctness feedback in assessment | Browser/UI inspection |
| Mixed longitudinal conditions | Filter progress by mode, N and protocol hash; show input/device context | History inspection |
| Missing metrics displayed as zero | Use null and render an em dash | Empty and zero-hit tests |
| Improvement discussion distracts from purpose | Focus product language on practice, challenge and recorded performance | Copy review |

## 3. User journeys

### 3.1 First visit

- Arrive on a calm, polished training dashboard with an original garden illustration.
- See a short explanation: remember the number from N turns ago; respond only when it matches.
- Choose an initial difficulty (1-, 2-, or 3-back), a session length, and input style.
- Default to 1-back, three training blocks, 2,000 ms exposure, 750 ms blank, and a fixed match button/Space.
- Open the guided tutorial from a prominent entry point. Training and assessment require practice for each new N within the session.
- Explain that the first N appearances fill memory and are unscored.
- Work through an interactive example, with the relevant earlier number highlighted. The player controls advancement so there is no reading deadline.
- Complete 12 scored practice trials plus N fill trials. Show correctness in practice and a clear result with target/non-target counts.
- On failure, offer a fresh practice attempt and tutorial. Do not silently advance or classify failure as inability.

### 3.2 Training

- Show a brief rule reminder and countdown before a new block.
- Present one numbered mole at a time in a two-by-three field.
- Keep recent digits and comparison answers absent during actual trials.
- Record a match with Space or the large match control. In the aimed variant, tap the mole or use Q/W/E/A/S/D for the six holes.
- Keep digit exposure identical whether the player responds or waits.
- Show succinct, non-punitive outcome feedback only during the blank interval; a neutral acknowledgement may appear on response.
- Show block number, N, and progress, but no running score that encourages speed-only play.
- Between blocks, show performance and the next difficulty. Allow a break of any length before continuing, using a fresh buffer.
- After two consecutive qualifying blocks, adapt N by one, bounded to 1–3.
- If N changes, require fresh instruction/practice for the new N.
- Finish with per-block results and an invitation to return, without penalties for missed days.

### 3.3 Assessment

- Select a single N or the full 1/2/3 battery.
- Freeze exposure (2,000 ms), blank (750 ms), digits (1–9), fixed match control, 60 scored trials and 18 targets per N.
- Require comprehension practice at each N, with an explicit reminder before the block.
- No adaptive changes or correctness feedback within scored blocks.
- Allow breaks between levels; an interruption ends the current attempt.
- Report each level separately. Do not pool sensitivity across N.

### 3.4 History and data ownership

- Show actual completed sessions and an honest empty state before first use.
- Track completed training blocks, practice days, recent training level, and session dates.
- Provide a chart of balanced accuracy for comparable completed blocks; mode, N and material protocol are filters.
- Open a past session to inspect counts, rates, RT sample size, uncertainty, quality flags, and aborted attempts.
- Export all local records as JSON, including configuration, actual sequences and raw inputs.
- Export one CSV row per block with identifiers, status, mode, N, protocol, component counts and metrics.
- Explain local-only storage and allow deliberate deletion through a confirmation dialog.
- If persistent storage fails, keep the current record in memory and show an export action; do not claim a save succeeded.

## 4. Protocol contract

| Parameter | Training | Assessment | Practice |
| --- | --- | --- | --- |
| N | 1–3; changes between blocks | Selected N or 1,2,3 | Upcoming block's N |
| Scored trials | 60 | 60 | 12 |
| Memory-fill trials | N | N | N |
| Target count | 18 | 18 | 6 |
| Adjacent-lag non-target lures | 5 / 42 non-targets | 5 / 42 | 1 / 6 |
| Digit alphabet | 1–9 | 1–9 | 1–9 |
| Exposure | 1,500 / 2,000 / 3,000 / 4,000 ms | 2,000 ms | At least 2,000 ms |
| Blank interval | 750 ms | 750 ms | 750 ms |
| Input | Fixed or aimed | Fixed | Matches upcoming input |
| Correctness feedback | Blank interval | Off | Blank interval |
| Adaptive | N only, between blocks | Never | Never |

Three default training blocks take about 8.5 minutes plus practice and breaks. Offer one, three, or five blocks. Session-duration labels are estimates of scored play, with practice/breaks explicitly additional.

### Adaptation version 1

- Inspect the last two consecutive completed, quality-eligible training blocks with the same N and protocol.
- Raise N if both have hit rate >=0.85 and false-alarm rate <=0.15.
- Lower N if both have hit rate <0.60 or false-alarm rate >0.30.
- Otherwise maintain N. Clamp to [1,3].
- Interrupted or quality-failed blocks break the qualifying streak. Practice never contributes.
- Save previous N, next N, rule version and source block IDs with the decision.
- At N=1 after persistent difficulty, suggest revisiting practice or choosing a longer exposure next session.

## 5. Sequence generator

1. Validate N, counts, digit alphabet and quota feasibility before generation.
2. Derive deterministic independent PRNG streams from a string seed for categories/digits and hole locations.
3. Shuffle an exact multiset of target, lure and ordinary non-target categories after N fill positions.
4. For a target, copy the digit at i-N.
5. For a lure, choose a available digit at lag N-1 (only if >0) or N+1, while excluding the N-back digit.
6. For an ordinary non-target, exclude both the N-back digit and available adjacent-lag digits.
7. Exclude any choice producing four consecutive identical numbers. If constraints conflict, retry the entire construction with a bounded attempt count.
8. Use a shuffled balanced hole bag: each hole occurs floor(total/6) or ceil(total/6) times. Location RNG is independent of digit RNG.
9. Recompute target, warmup and lag-match labels from finished digits; never trust intended categories alone.
10. Validate exact target/lure counts and no repeat run before accepting.
11. Store the actual sequence, seed, generator version and a stable non-cryptographic content hash.

Do not disclose remaining target counts during a block. Hashes are reproducibility fingerprints, not security primitives.

## 6. Timing and input engine

Implement a small engine separate from React. Inject a clock/scheduler interface for deterministic tests. Production uses performance.now() and requestAnimationFrame. React owns navigation; the playfield is synchronously updated at engine phase transitions so onset does not wait for an arbitrary React render.

States: countdown -> visible -> blank -> visible ... -> completed. Any active phase may transition to interrupted. An interrupted engine is terminal and cannot resume its old buffer.

At each visible onset, record planned onset, frame-aligned onset estimate, deadline and trial ID. Reveal the stationary digit in that frame. Deadline = onset estimate + exposure. Hide at the first frame reaching deadline and record offset. Schedule the next onset from the prior planned onset plus exposure + blank, rather than from input time.

Small frame quantisation is recorded. A frame gap or schedule delay over 250 ms terminates the block as a timing interruption. Gaps over 50 ms are logged and flagged. No catch-up burst of invisible trials is permitted.

The response window is [onset, deadline). A response at the deadline is late and cannot change the trial. RT is event timestamp minus onset; store handler timestamp and dispatch delay separately. Browser event timestamps with incompatible origins fall back to handler time with an explicit flag. These are software onset estimates, with no claimed hardware latency calibration.

Record input method, key/pointer type, client coordinates, selected hole and active hitbox where relevant. Only primary left-pointer actions and declared game controls are eligible. Ignore mouse secondary buttons, repeated keydown, or additional fingers for scoring, while preserving diagnostics. Maintain pressed-key state until keyup. Use pointerdown plus a keyboard-only click fallback to avoid touch/click double responses.

The first eligible press decides classification, even if it is a wrong-hole press. Repeated responses never repair or spoil that decision. Presses in countdown/blank are logged outside-window events. Navigation clicks never enter the response stream.

Interrupt on visibility loss, window blur, material viewport resize/orientation change, excessive timing gap, and explicit stop. Store partial trials without turning the unfinished current trial into a miss. Preserve a reload recovery marker so a previously running session is recorded as interrupted on next load. Only restart with a new block/seed and N new fill trials.

## 7. Scoring contract

Classification: fill -> warmup; target + correct control -> hit; target + no response/wrong hole -> miss; non-target + any eligible game response -> false alarm; non-target + no response -> correct rejection. An incomplete trial is pending and excluded.

Persist hits, misses, false alarms, correct rejections, target/non-target denominators, completed scored trials, response count and valid hit RT count. Exclude warmup and pending trials from aggregates.

- Hit rate = hits / targets.
- False-alarm rate = false alarms / non-targets.
- Raw accuracy = (hits + correct rejections) / scored trials.
- Balanced accuracy = (hit rate + 1 - false-alarm rate) / 2.
- Log-linear correction: H=(hits+0.5)/(targets+1), F=(FA+0.5)/(nonTargets+1).
- d-prime = inverseNormal(H) - inverseNormal(F).
- Criterion = -0.5 * (inverseNormal(H) + inverseNormal(F)).
- Hit latency: median, mean and sample SD using only valid hit RTs.
- Wilson 95% intervals for hit and false-alarm rates; label as rate intervals.
- Return null for unavailable denominators or RTs. No IES, LISAS, throughput or brain score.

Quality observations include no scored responses, interruption and long frames. Low scores are preserved. No-response blocks remain inspectable but cannot drive adaptation. Label aborted attempts separately from completed performance.

## 8. Data and persistence

Use browser IndexedDB for full session records; use localStorage only for small preferences and an active-session recovery marker. Save a session at creation and after each practice/block attempt. Perform no synchronous whole-history serialization in the timed loop.

Session fields: schema/app versions; random UUID; pseudonymous local participant ID; creation/completion timestamps; mode; selected configuration; client user agent, viewport, device pixel ratio and time origin; blocks; practice attempts; adaptation decisions; completion status.

Block fields: ID; mode; N; status; protocol/scoring/engine/generator/art versions; seed; sequence/config hashes; actual generated stimuli and labels; planned and observed timings; raw responses; frame anomalies; interruption reason; summary.

Storage writes use session ID as the key, so retry is idempotent. A write queue preserves ordering and prevents stale overwrites. Errors are surfaced. Reload recovery marks the saved session interrupted; completed blocks survive. In-flight trial events may be lost on a hard close, and the recovery record explicitly identifies that partial-data boundary.

No server sync, imports or data donation in this delivery. Export is the portable backup. Deletion clears only this application's database/preferences/recovery keys, not unrelated origin data.

## 9. Architecture and files

```text
src/
  main.tsx                 entry point
  App.tsx                  screens, session orchestration and tutorial
  styles.css               responsive design and original garden styling
  components/              icons, mole/scene, playfield, results/progress
  game/
    types.ts               protocol and telemetry contracts
    sequence.ts            deterministic constrained generator
    scoring.ts             independent classification and summaries
    engine.ts              frame scheduler and response windows
    protocol.ts            defaults, fingerprints and adaptation
  data/
    storage.ts             IndexedDB, recovery and export
tests/
  game.test.ts             mechanics, generator, scoring, adaptation
  engine.test.ts           fake-clock schedule and interruption tests
  browser.spec.ts          real-browser workflows and responsive checks
README.md
IMPLEMENTATION_PLAN.md
```

Use React and TypeScript, Vite for the dev server and production bundle, Vitest for deterministic unit tests, and Playwright for browser checks where the environment permits installation. Pin dependencies and commit the lockfile artifact to the workspace. No external runtime font/image/CDN dependency.

## 10. Visual and accessibility direction

- Warm ivory background, deep forest text, moss-green actions, pale sage cards, restrained coral accents.
- Original vector garden scene and a friendly mole wearing a high-contrast numbered shirt.
- Comfortable whitespace, generous typography, a persistent simple navigation rail on desktop and compact navigation on mobile.
- Dashboard mixes a strong start-training card with an illustrated garden, a concise session setup and real progress.
- Playing surface remains uncluttered; decorative details never resemble a second stimulus.
- Six holes remain a 3x2 grid, scaled for portrait devices without requiring orientation lock.
- Interactive controls have visible focus, semantic names and at least 44 px practical touch areas.
- Support reduced motion, optional sound off by default, and adequate number contrast.
- Instructions and results are readable with assistive technology; the visual timed stimulus task itself is explicitly a visual experience, not silently replaced with an auditory protocol.
- Do not announce a changing digit through a live region. Announce phase/rule information and result summaries politely.
- Never show a hidden answer buffer during scored play.

## 11. Implementation sequence

### Phase A — decisions and foundation

Write this plan before code. Scaffold build scripts, strict TypeScript, local assets and source directories. Establish the palette, responsive shell and typed protocol contracts.

### Phase B — deterministic mechanics

Implement seeded generation and independent labels; classifier and statistics; immutable versioned configs and adaptation. Test quotas, reproducibility, lure edge cases, silent/always-press behaviour, nulls and adaptation boundaries.

### Phase C — timed runtime

Implement injected scheduler, stationary onset rendering, response logging, terminal interruption, neutral acknowledgement and blank-phase feedback. Test exact deadline semantics, wrong holes, duplicates and response-independent scheduling.

### Phase D — complete product flows

Build dashboard, session controls, N-specific worked examples, mandatory comprehension practice, block breaks, restart/stop, assessment battery, results and saved history. Use one original skin throughout the initial release.

### Phase E — persistence and ownership

Integrate IndexedDB, ordered saves, visible failure status, reload recovery, progress filters, detail views, export and deletion. Verify history after reload and inspect exported telemetry.

### Phase F — verification and handoff

Run strict compilation and production build, core unit suite, browser navigation, tutorial and gameplay checks, a full session using a controlled clock if practical, and desktop/mobile screenshots. Fix discovered issues and document actual outcomes rather than claiming unrun checks.

## 12. Acceptance checklist

- [ ] App starts with documented commands and production build succeeds.
- [ ] Dashboard has meaningful first-use and populated states.
- [ ] Tutorials explain the exact 1/2/3-back comparison, including memory fill.
- [ ] Silent or indiscriminate responding cannot pass practice.
- [ ] All scored sequences meet exact target and lure quotas across a multi-seed test bank.
- [ ] Six holes, one stimulus, independent hole/number streams and no visible memory aid during play.
- [ ] Input never shortens exposure or changes intended next onset.
- [ ] First press, boundary timestamps, repeats, aimed errors and blanks follow the contract.
- [ ] Assessment is fixed and has no correctness feedback.
- [ ] Training adapts only at boundaries after two qualifying blocks.
- [ ] Aborted and no-response blocks cannot trigger progression.
- [ ] Hidden-tab/stop/reload paths retain completed data and restart fresh.
- [ ] Scores expose raw counts, sample sizes, nulls and separate N levels.
- [ ] History and exports persist actual data; no fabricated sample scores.
- [ ] Storage failures are visible; deletion affects this app only.
- [ ] Keyboard, pointer and responsive layouts are exercised in a browser.
- [ ] README records implementation choices and any verification limits.

## 13. Deliberate follow-on scope

An independently designed outcome task battery, authenticated cloud backup, cross-device sync, researcher administration, alternative skins, and physical display/input latency measurements are subsequent projects. They are not required to deliver the requested playable training product. Independent outcome tasks need their own rules and scoring plan rather than an improvised metric attached to this game. No clinical normative comparisons or proprietary source/assets are included.


## 14. Delivery notes and resolved implementation details

The implementation follows the phases above. The original source documents remain unchanged. The delivered app and tests use the actual files named in §9; browser configuration lives in `playwright.config.ts`, and strict compilation is part of the build command.

### Decisions refined during implementation

- **Cross-session progression:** qualifying training rounds can span saved sessions. The current session is removed from historical inputs before its current block list is appended, preventing duplicate counting. A proposed next level is recorded after each completed training block and becomes the next session’s default; the player can override it.
- **Input timestamp closure:** both the event timestamp and handler time must precede the deadline. Events dispatched after closure remain diagnostic events, even if their original timestamp precedes the deadline. This avoids rewriting a result after the visible response window has closed.
- **Trial identity:** each trial receives a stable ID composed of its block UUID and sequence index. Raw presses also identify the active trial index, with null for pre-trial countdown events.
- **Viewport context:** each attempt stores its actual viewport and pixel ratio, in addition to the session’s initial client context. Progress marks changes in browser, viewport or accepted input methods between displayed points. Protocol filters remain independent of this contextual marker.
- **Keyboard navigation:** global game keys do not consume Space on a focused navigation control. The fixed-control playfield does not take button focus, so clicking a non-interactive hole cannot disable subsequent Space responses. Aimed holes retain their own keyboard activation.
- **Standalone tutorial:** finishing the How to Play example opens practice directly rather than forcing the same example a second time.
- **Optional audio:** tones use a local Web Audio oscillator only in practice/training blank phases. There are no downloaded sound files, and assessment remains silent regardless of the sound preference.
- **Modal interaction:** assessment and deletion dialogs keep keyboard focus within the dialog, support Escape, and make the surrounding interface inert while open.
- **Automation:** long browser scenarios explicitly pause the test clock and advance it in frame-sized steps through Playwright. Assertions and automation round-trips must not accidentally advance simulated trial time. A separate normal-clock smoke test covers actual browser scheduling and response acknowledgement.
- **Reproducibility boundaries:** the saved record is enough to inspect and recompute software classifications and summaries. It does not include hardware calibration, and a hard close can lose the currently running attempt’s unsaved events; the recovery note makes that boundary explicit.

### Artifact and verification map

| Deliverable | Location | Evidence |
| --- | --- | --- |
| Runnable source | `src/`, `package.json`, `package-lock.json` | Strict TypeScript and production build |
| Static distributable | `dist/` after `npm run build` | Vite bundle generation |
| Deterministic sequence and scores | `src/game/sequence.ts`, `src/game/scoring.ts` | `tests/game.test.ts` |
| Timing and response semantics | `src/game/engine.ts` | `tests/engine.test.ts` |
| Complete user journeys | `src/App.tsx`, `src/components/` | `tests/browser.spec.ts` |
| Data ownership and recovery | `src/data/storage.ts` | Persistence, export, deletion and failure browser checks |
| Desktop/mobile presentation | `src/styles.css`, `src/components/Art.tsx` | Screenshots in `test-results/` |
| Setup and operating details | `README.md` | Commands, controls, storage boundaries and source map |
| Final run evidence | `VERIFICATION.md` | Actual completed checks and environment limits |

### Continuing development

A future protocol change should increment the relevant version and produce a new configuration fingerprint when task demands change. Add a golden sequence or scoring fixture when changing a rule, and a browser regression when changing an input/navigation boundary. Do not silently mix old and new protocol data in the progress view. Existing raw records should remain readable and exported with their original versions.
