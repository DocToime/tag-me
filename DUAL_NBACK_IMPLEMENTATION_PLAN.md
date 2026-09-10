# Recall Garden Dual — implementation plan

**Plan version 1.2** — implement 1.2, not 1.1. Baseline is `main` at `b6423a4` (unbounded N + PWA already merged).

Prepared 9 September 2026 from the dual n-back design notes and the current Recall Garden codebase. Revised after [DUAL_NBACK_IMPLEMENTATION_REVIEW.md](DUAL_NBACK_IMPLEMENTATION_REVIEW.md). **1.2 (10 September 2026)** records what unbounded-N landing changed; product rules D1–D12 are unchanged.

This is the **implementation contract**. It is not a protocol paper and it does not claim equivalence to Jaeggi dual n-back or published TAG-ME Again.

**Build venue:** implement in a **separate git worktree from current `main`**. See §0.

---

## 0. Build venue (worktree first)

Identity unbounded-N is **on `main`** (`da13187`, merge `b6423a4`). Do not re-implement it. Do not implement dual in the leftover `/home/ltoime/tag-ME-unbounded-n` worktree.

| Worktree | Branch | Role |
| --- | --- | --- |
| `/home/ltoime/tag-ME` | `main` | Primary checkout. Identity + PWA + plans. No dual application code here until merge. |
| `/home/ltoime/tag-ME-unbounded-n` | `unbounded-n` | **Done.** Same commit as `main`. Do not add dual here. |
| `/home/ltoime/tag-ME-dual` (create) | `dual-nback` | **This feature.** Branch from **`main`**. |

```sh
git fetch
git worktree add -b dual-nback ../tag-ME-dual main
```

Rules for the dual worktree:

- Application edits, tests, and dual verification run there.
- Keep identity 1–3 sequence hashes bit-identical (`seed` → `8eadaf0d` / `c898454e` / `5dc8c1bd`). Do not touch identity `generate()` loop body or `VERSIONS`.
- Reuse landed `isN`, `resourceOk`, `label()`, and `LevelPicker`. Do not fork them.
- Update this plan in the primary checkout if the contract changes.

### 0.3 Landed on main — what dual must not redo

These 1.1 Phase A items are **done**. Dual consumes them.

| Landed | Where | Dual implication |
| --- | --- | --- |
| `type N = number`, `isN()`, `resourceOk()` | `src/game/types.ts` | Import; do not duplicate. Dual `generateDual` must call `resourceOk(n, scoredTrials)` before allocating. |
| `label()` window `1 .. max(n+1, 4)` | `src/game/sequence.ts` | Call the same `label()` on digit and hole arrays. Do not copy a lags-`[1,2,3,4]` helper. |
| Identity generator still 1.0 | `VERSIONS.generator` | **Do not bump.** Hash payload still `{ config, versions, digits: "1-9", holes: 6 }`. |
| Adaptation 1.1, `to = n + 1`, floor 1 | `src/game/protocol.ts` | Identity `adapt()` stays as-is. Dual v1 still **does not** call it (D12). When `adaptDual` ships later, filter dual-training blocks only; never write dual N into `prefs.n`. |
| Stepper | `src/components/LevelPicker.tsx` | Reuse for dual N. Separate state: `prefs.n` remains **identity** level; add `dualN`. |
| Launch / tutorial resource preflight | `App.launch()`, `Tutorial.tsx` | Keep. Dual still needs **`prepareBlock`** (R06): `resourceOk` is not enough — `generateDual` can exhaust retry budgets after the guard. Identity still generates inside `GameEngine` constructor; dual must not rely on that for dual sequences. |
| Progress levels from saved blocks | `Results.tsx` | Add a **Task** filter. Do not restore a hard-coded `{1,2,3}` list. |
| PWA (`vite-plugin-pwa`, `src/pwa.ts`) | production `/tag-me/` | New dual modules must stay in the Vite graph so Workbox precaches them (`globPatterns` already `js,css,html,svg,png,json`). Do not reload the service worker during `ongoing` (play, tutorial, **or** dual break). Leave the manifest/install flow alone in dual v1. |
| Assessment battery 1→2→3 | `App.tsx` | Unchanged for identity. Dual assessment is a separate task choice, then battery vs one level. |

Product decisions D1–D12, two-button mapping, practice band 1–3, and scoring types are **unchanged**.

---

## 0.1 What 1.0 got right (kept)

- Dual is an opt-in second task. A single hit cannot carry two streams.
- Two always-visible controls; mole sprite is not a dual response.
- Options 2 (gestures) and 3 (OR/any-match) stay out of scope.
- Six stimulus holes; third playfield row is **response** mounds, not extra stimulus holes.
- Exposure independent of input; no hats, aimed hitting, or Quick-style vanish.
- Identity aimed mode and identity progress series stay separate from dual.

## 0.2 What 1.0 got wrong (corrected here)

The senior review’s P1/P2 findings are adopted. Evidence lives in the review and in `review/dual-plan-probes.mjs` / `review/dual-plan-probes.json`. This plan is the contract; the review is not a second spec.

| Review | Adopted correction |
| --- | --- |
| R01 | Stream `summarize()` projection includes `response`, `rt`, `code`, and warmup. |
| R02 | Dual classification always calls `classify(..., "fixed")`. Never pass `"dual"` into the identity helper. |
| R03 | Dual blocks use a distinct display-summary type. Do not null identity `Summary` counts or reuse `summary.dPrime` as a mean. |
| R04 | Dual allows overlapping touch contacts; identity keeps primary-pointer rejection. |
| R05 | Generator retains a valid stream while rebuilding its partner. Documented budgets. N=1 seed `184` is a regression case. |
| R06 | Prepare/validate the sequence **before** mounting `Play` / starting countdown. Typed retry/exit on failure. |
| R07 | Practice dual-target band is **1–3**, not 1–4. |
| R08 | Identity `VERSIONS` / `configHash` payload stays frozen if identity behaviour is unchanged. Dual has its own immutable version record. |
| R09 | Task isolation across factories, prefs (`identityN` vs `dualN`), launch, and adaptation lists. Last two chronological dual-training blocks, then eligibility. |
| R10 | Conjunction scoring uses finalized non-warmup trials only. Pending presses are not outcomes. |
| R11 | Space is not a global dual shortcut; focused Location/Number still activate natively. Aimed-hole map is off; `A` is Location only. |
| R12 | Dual stimulus holes are noninteractive containers with a real pointer path for `wrong_control`. Separate `disposition` and `ignoreReason`. |
| R13 | IndexedDB store stays v1; newly emitted dual sessions use export/data schema 2; readers normalize legacy identity. |
| R14 | Historical familiarity skips the **tutorial**, never practice. “Practice waiver” wording is withdrawn. |
| R15 | Identity viewport-fit is the **current** baseline (`VERIFICATION.md`), not the historical `review/REVIEW.md` failure. Compact third row. All 13 viewports remain dual release gates. |
| R16 | Streams are **separately constructed with joint constraints**, not statistically independent. |
| R17 | Two stream sensitivity estimates, not “capacities.” Both-target hit rate with denominator. Exact silent-stream d′. |
| R18 | Tutorial includes a scored neither-match trial and a Check/Next action. |
| R19 | Verification matrix in §13. Dual solver observes hole+digit. Browser smoke gate in CI. |
| R20 | **No gameplay N ceiling for dual or identity.** Shared `isN`. Named 1→2→3 battery unchanged. |

---

## 1. Locked product decisions

**LOCK** means implement as written; bump the named protocol/generator version if you reopen it after release. Before the first dual merge, contradictions are resolved in this document, not by treating 1.0 as immutable.

| ID | Decision | Status |
| --- | --- | --- |
| D1 | Dual is an **opt-in task**. Session and block records carry `task: "identity" \| "dual"`. Missing `task` on old records means `"identity"`. An **unknown explicit** task is an error, not identity. Session task and every block task must agree. | LOCK |
| D2 | Stream A = hole index `{0…5}`. Stream B = digit `{1…9}`. Separately constructed, jointly constrained, scored as two judgements. | LOCK |
| D3 | Two always-visible match controls. `A` = location. `L` = number. Optional tested aliases `ArrowLeft` / `ArrowRight`. Both allowed. Neither = withhold on that stream. Hitting the mole is not a dual response. Overlapping touch contacts are allowed. | LOCK |
| D4 | Gestures-on-mole and OR/any-match are out of scope. No hidden settings. | LOCK |
| D5 | Stimulus field stays **six holes** in the existing 3×2 **coordinates**. Dual does not add stimulus mounds. Six holes use a smaller spatial alphabet than classic 8-cell dual n-back; relative difficulty is **not** validated. | LOCK |
| D6 | Third playfield row is two **response** mounds (Location, Number) plus empty turf. Compact row, not `1fr` equal to stimulus rows. Moles never occupy them. No “Both” control. | LOCK |
| D7 | Timing skeleton: assessment 2,000 ms exposure; training may use 1.5–4 s preference; ISI planned 750 ms; first N trials unscored. No adaptive vanish. Dual must not redesign the identity clock (actual blank can shorten after a late onset). | LOCK |
| D8 | No hats, go/no-go distractors, or aimed-hole hitting on dual. Factories force `input: "dual"`. | LOCK |
| D9 | A dual result is **two stream performance/sensitivity estimates** (position and number `Summary`) plus a **both-target hit rate** with count/denominator. Combined means are display-only, explicitly named, and never stored in identity `Summary` count fields. | LOCK |
| D10 | Dual never shares a `configHash` or chart series with identity. Identity 1–3 fingerprints stay unchanged if identity behaviour is unchanged (see §6.3). | LOCK |
| D11 | **N is any positive safe integer for both tasks.** No gameplay maximum. Floor 1. Teaching and first dual training default **N=1**. Single-level dual assessment defaults **N=2**. Named assessment battery remains **1→2→3**. Practice always uses the upcoming scored N. A default is not a maximum. | LOCK (overrides 1.0 ceiling) |
| D12 | **v1 dual training is fixed-N** (player-chosen, including N≥4) plus dual assessment. Dual N **adaptation is follow-on**, after isolation and the first end-to-end path are verified. When it ships, raise with `n+1`, floor 1, **no upper clamp**, rule version `dual-1.0`. | LOCK (was FLAG) |

Product name: **Recall Garden Dual** (research shorthand: visual–visual dual n-back). Do not use TAG-ME Dual in the UI. Location is the UI label; `position` is the stored stream identifier.

---

## 2. Shared N contract (both tasks)

This is the same final N rule identity already implements on `main`. Dual must not reintroduce `{1,2,3}` in generator, stepper, tutorial, prefs parser, progress filter, or (when shipped) adaptation. **Do not re-land `isN` / `resourceOk` / identity `label()`.** Import them.

```ts
import { isN, resourceOk, type N } from "./types";
import { label } from "./sequence";
```

| Concern | Identity | Dual |
| --- | --- | --- |
| Valid difficulty | `isN` | `isN` |
| Automatic increase | Identity rule, `n+1`, no clamp | Follow-on dual rule, `n+1`, no clamp |
| Automatic decrease | Floor 1 | Floor 1 |
| Starting level / tutorial | N≥1, including ≥4 | N≥1, including ≥4 |
| Single-level assessment | Selected N, including ≥4 | Selected N, including ≥4 |
| Named battery | 1→2→3 | 1→2→3 |
| Remembered level | `identityN` (legacy `prefs.n`) | `dualN` |

Resource guards are **not** difficulty caps. Before allocating arrays or rendering tutorial history:

1. Throw if `!isN(n)`.
2. Throw if `n + scoredTrials > 100_000` (same allocation guard as unbounded identity).
3. Throw if estimated label work `max(n + 1, 4) * (n + scoredTrials) > 10_000_000` (work budget). Explain preparation failure; never silently substitute another N.

`label()` for both streams **calls the existing** `label()` in `sequence.ts` (window `1 .. max(n + 1, 4)`). Hole sequences use alphabet `{0…5}` but the same lag rules. Do not reimplement the window. Preserve existing 1–3 identity `lagMatches` arrays and hashes by not editing identity `generate()`.

A five-round qualifying identity (or later dual) climb with the two-round same-N rule is **1, 1, 2, 2, 3**, not 1, 2, 3, 4, 5.

---

## 3. What a trial is

Mole pops from hole `h_i ∈ {0…5}` wearing digit `d_i ∈ {1…9}`.

```
position_match = (i >= N) and (h_i == h_{i-N})
number_match   = (i >= N) and (d_i == d_{i-N})
```

Four **scored** trial types (warmup excluded):

| Position | Number | Type | Correct action |
| --- | --- | --- | --- |
| no | no | nontarget | press neither |
| yes | no | position target | Location only |
| no | yes | number target | Number only |
| yes | yes | dual / both-target | Location **and** Number |

Golden **label** fixture (N=2) — keep these five rows for unit labels:

| Trial | Hole | Number | Pos match | Num match |
| --- | --- | --- | --- | --- |
| 0 | 2 | 7 | warmup | warmup |
| 1 | 5 | 3 | warmup | warmup |
| 2 | 2 | 1 | yes | no |
| 3 | 4 | 3 | no | yes |
| 4 | 2 | 1 | yes | yes |

Tutorial **coverage** fixture — same five plus a scored neither-match:

| Trial | Hole | Digit | Correct action |
| --- | --- | --- | --- |
| 5 | 0 | 9 | Neither; finalize with Check/Next, not a game withhold timer |

Hole coordinates (never reorder via responsive CSS):

```
[0] [1] [2]
[3] [4] [5]
```

Position match is **index equality**.

Every appearance updates memory, including warmup, targets, and mistakes. Compare N **appearances** ago, not the last N successful responses.

---

## 4. Response contract

Identity: one press decides the trial. Dual: two independent first-press latches in `[onset, deadline)`.

### 4.1 Acceptance

- First eligible Location press → `positionResponse` / `positionRt`. Later Location → `duplicate`.
- First eligible Number press → `numberResponse` / `numberRt`. Later Number → `duplicate`.
- Streams do not block each other. Order does not matter.
- RT = accepted event time − onset, per stream.
- Deadline and handler-time rules copy identity. A press at `deadline` or with `handlerTime >= deadline` is `outside_window`.
- Countdown/blank: `outside_window`.
- Repeated keydown: `ignored` / `repeat`.
- Mole / stimulus-hole pointer: `ignored` / `wrong_control`. Never credit a stream.
- Precedence: explicit ignore/wrong-control → time window → stream duplicate → accept.

Keyboard:

| Control | Keys |
| --- | --- |
| Location | `KeyA`; alias `ArrowLeft` |
| Number | `KeyL`; alias `ArrowRight` |
| Stop | unchanged |

Aliases share that stream’s latch. Held A while pressing L still accepts L. Ignore `repeat`, `isComposing`, modifiers (Ctrl/Meta/Alt/Shift+A, Alt+Left), and events from `input, select, textarea, a, [contenteditable]`, nested buttons/links, and Stop.

**Space** is not a global dual match. Space/Enter on a **focused** Location or Number button activate that stream through native button activation. Space/Enter on Stop operate Stop. Test each focus context.

Aimed-hole mapping is **inactive**. `A` is Location only. `Q W E S D` have no dual game action.

`KeyboardEvent.code` is physical-key based; displayed hints must match the selected mapping. Do not claim every keyboard layout prints A/L on those keys.

Touch / mouse:

- Identity unchanged: `ignored: !e.isPrimary \|\| e.button !== 0`.
- Dual response mounds: **touch contacts are not required to be primary.** Mouse still requires button 0. Pen: same as mouse unless separately specified; do not claim every OS multi-pen combination works.
- Acceptance must include two **overlapping** touch contacts, both orders. Sequential `tap()` is not enough.
- `pointerdown` plus zero-detail `click` must not accept twice.
- Log `pointerId` and `pointerType` on dual presses.

Stimulus (dual): noninteractive containers (`div` with `data-hole`), not disabled buttons. Pointerdown on the container or a capture layer logs `wrong_control`. Response controls are enabled native buttons.

Hitboxes: dual response events record the **Location/Number** control rectangle. Do not copy identity’s “active stimulus hole” hitbox onto dual stream presses.

### 4.2 Classify with fixed-input semantics

`classify()` treats a target press as a hit only if `input === "fixed"` or `press.hole === stimulus.hole`. Dual presses normally have no `hole`. Passing `config.input === "dual"` would mark valid hits as misses.

At hide only:

```ts
function finalizeDualTrial(t: DualTrial): void {
  t.positionCode = classify(
    { ...t.stimulus, target: t.stimulus.positionTarget },
    t.positionResponse,
    "fixed",
  );
  t.numberCode = classify(t.stimulus, t.numberResponse, "fixed");
}
```

Leave the identity engine call unchanged. Optional later extract of `classifyMatch(warmup, target, responded)` is not required for v1.

### 4.3 Engine trial slots

Keep identity `Trial.response` as today.

Dual trials initialize on visible onset: both responses/RTs null, both codes `"pending"`. Identity `response`/`rt`/`code` on a dual trial are unused for scoring (`response: null`, `code: "pending"`). Finalization is `offset !== null` plus both stream codes not pending.

Malformed `press.stream` (anything other than `"position"` / `"number"`) is ignored. Never treat “any other string” as number.

---

## 5. Protocol contract

`dualProtocol(n, mode, requestedWindowMs)` is the only dual factory. Identity keeps `protocol()`. Every dual route (home, assessment, guide, retry, battery, continuation) uses the factory.

| Parameter | Dual training | Dual assessment | Dual practice |
| --- | --- | --- | --- |
| N | `isN`; player-chosen in v1 | Selected N or 1→2→3 battery | Upcoming scored N |
| Scored trials | 60 | 60 | 12 |
| Memory-fill | N | N | N |
| Position targets | exactly 18 | 18 | exactly 6 |
| Number targets | exactly 18 (`config.targets`) | 18 | exactly 6 |
| Position lures | exactly 5 of 42 | 5 | exactly 1 of 6 |
| Number lures | exactly 5 (`config.lures`) | 5 | exactly 1 |
| Dual-target count D | **4–8** of 60 | 4–8 | **1–3** of 12 |
| Alignment cap | D ≤ 50% of each stream’s targets (implied by 4–8 of 18, and by 1–3 of 6) | same | same |
| Conflict trials | **≥2 total** (one stream target and the other lure). Not required to be one per direction in v1. | ≥2 | 0 required |
| Alphabets | digits 1–9, holes 0–5 | same | same |
| Exposure | 1500/2000/3000/4000 | **2000** | ≥2000 |
| Blank (planned) | 750 | 750 | 750 |
| Input | `"dual"` | `"dual"` | `"dual"` |
| Correctness feedback | blank, both streams | off | blank, both streams |
| Adaptive vanish / hats / aimed | never | never | never |

For 60 scored trials, 18 targets/stream, D both-targets:

| Cell | Count |
| --- | --- |
| Both targets | D |
| Location only | 18 − D |
| Number only | 18 − D |
| Neither | 24 + D |

Unconstrained reference E[D] ≈ 5.4 is **context**, not a generator promise. Accepted sequences are jointly constrained.

For 12 practice trials, 6 targets/stream, band 1–3: all four actions appear; at least three location-only and three number-only. D=4 is **unreachable** under the 50% alignment cap — that is why the band is 1–3.

Before generation, require

`max(0, P + Num − S) ≤ D_min ≤ D_max ≤ min(P, Num)`

intersected with the alignment cap. Empty intersection fails immediately.

Practice pass:

```
completed, no frames, both stream summaries:
  scored === 12, targets === 6, nonTargets === 6,
  hits >= 5, fa <= 1, flags.length === 0
```

Silence, always-both, and single-stream strategies fail. Identity practice at the same N does not pass dual, and vice versa.

---

## 6. Sequence generator

Identity `generate()` in `sequence.ts` is **finished** for unbounded N. Dual lives in `src/game/dualSequence.ts` as `generateDual(config, seed)`. Relabel from finished arrays with the shared `label()`; never trust intended categories. Do not change identity PRNG call order.

### 6.1 Construction (retain valid partner)

1. Validate N, counts, alphabets (no duplicates/empties), band feasibility, lure feasibility, `n + scoredTrials` and label-work budgets.
2. Four named PRNG streams, **continuous state** (do not reseed each attempt to the initial hash):
   - `seed + ":digits:cats"`
   - `seed + ":digits:pick"`
   - `seed + ":holes:cats"`
   - `seed + ":holes:pick"`
3. `constructStream(alphabet, n, scored, targets, lures, rngs)` copies identity category-shuffle rules: fill N; exact target/lure/ordinary multiset; copy at lag N; lure from available N±1 excluding N-back (at N=1, lure lags are `{2}` only; lag 0 excluded); ordinary excludes N and available adjacent; reject four consecutive identical symbols; target precedence over incidental adjacent-lag matches.
4. **Retry policy:**
   - Each stream has an inner budget `B_stream = 4000` construction attempts.
   - Build digits until valid or digit budget exhausted.
   - **Retain** that digit sequence. Build holes until valid **and** joint checks pass, continuing the hole RNGs (`B_partner = 4000`).
   - If holes cannot satisfy joint checks, discard digits, continue digit RNGs, and rebuild the pair. Outer pair budget `B_pair = 50`.
   - Total work is bounded by those three numbers, not an implicit 8000³ nest.
   - Count rejection reasons: stream construction, overlap band, conflict, lock cap, four-run, other.
5. Joint checks on the zipped pair:
   - exact per-stream target and lure counts after independent `label()`
   - D inside the band
   - conflict count ≥ `minConflict`
   - `digit === hole + 1` on **≤ 25% of all trials including warmup**
   - among number targets, fraction that are also position targets ≤ 0.50 (symmetric)
6. Do **not** fall back to identity’s balanced hole bag or silently relax quotas. Dual holes carry n-back structure.
7. The `digit === hole + 1` cap is one numeric mapping, not a general independence proof. Record diagnostics (6×9 pair table, D, directional conflicts, hole frequencies). New rejection rules get a generator version bump after a feasibility bank.
8. N=1 is the hard case (immediate targets vs four-in-a-row; only lag-2 lures). Include training seed **`184`** in the regression bank. Probe outputs for that seed are not production fixtures; the chosen algorithm’s output is.
9. If generation is slow on a representative device, run `prepareBlock` asynchronously **before** countdown (worker or loading stage). Countdown starts only after validation and playfield readiness. Stale async results are dropped via an operation token.

Throw a typed preparation error when budgets exhaust. Do not invent a block.

### 6.2 Stimulus fields

One canonical number-target field: keep identity’s `target` / `lure` / `lagMatches` / `intended` as the **number** stream. Dual adds required:

`positionTarget`, `positionLure`, `positionLagMatches`, `positionIntended`

Do not store a conflicting duplicate `numberTarget`.

### 6.3 Versions and identity fingerprint freeze

Global `VERSIONS` in `protocol.ts` is included in every current identity hash. Do **not** bump `VERSIONS.engine` for dual, and do **not** add `task: "identity"` to the identity hash payload.

- Identity: keep hashing `{ config, versions: existing VERSIONS object, digits: "1-9", holes: 6 }` with the **same field order**. Preserve PRNG call order inside identity `generate()`.
- Dual: separate immutable record, e.g. `{ generator: "dual-1.0", scoringAdapter: "dual-1.0", display: "garden-dual-1.0" }`, hashed with a canonical payload: task, N, mode, counts, both lure quotas, overlap band, `minConflict`, alphabets, timing, input `"dual"`, those versions.
- Application/build version may be stored separately; it is not the protocol fingerprint.
- Task filters are required in addition to hashes (8-hex FNV is a convenience, not a proof).

Identity goldens **already asserted on `main`** (`tests/game.test.ts`). Dual must keep them green:

| Seed | N | Sequence hash |
| --- | --- | --- |
| `"seed"` training | 1 | `8eadaf0d` |
| `"seed"` training | 2 | `c898454e` |
| `"seed"` training | 3 | `5dc8c1bd` |

Optional extra freeze (from the dual review probes; not a `main` test today):

| Seed | N | Config hash | Sequence hash |
| --- | --- | --- | --- |
| `"review-golden"` training | 1 | `cde18653` | `d4dc7121` |
| `"review-golden"` training | 2 | `7a28b8f0` | `99aff584` |
| `"review-golden"` training | 3 | `03e96915` | `aa16f486` |

If identity `label()`/`generate()` changes for high N, 1–3 of these must still match. Dual hashes are new.

---

## 7. Scoring

### 7.1 Project the response object

`summarize()` uses `t.response` for the no-scored-response flag. Mapping only code and RT flags a perfect stream.

```ts
function projectStream(t: DualTrial, stream: Stream): Trial {
  if (stream === "position") {
    return {
      ...t,
      stimulus: {
        ...t.stimulus,
        target: t.stimulus.positionTarget,
        lure: t.stimulus.positionLure,
        lagMatches: t.stimulus.positionLagMatches,
        intended: t.stimulus.positionIntended,
      },
      response: t.positionResponse,
      rt: t.positionRt,
      code: t.positionCode,
    };
  }
  return {
    ...t,
    response: t.numberResponse,
    rt: t.numberRt,
    code: t.numberCode,
  };
}
```

Initialize both stream slots on trial creation. Do not “fix” flags by suppressing them globally.

Warmup-only or pending-only responses do not clear a no-scored-response flag.

Silent number stream with log-linear correction (18 targets / 42 nontargets): `balancedAccuracy === 0.5`, `dPrime ≈ +0.331274283`, flag `"No scored responses"`. Always-press: `dPrime ≈ −0.331274283`, balanced accuracy 0.5. Test those exact values; do not change the shared formula to force zero.

### 7.2 Dual result type

`Summary` stays a single-stream type with numeric counts.

```ts
interface DualDisplaySummary {
  scoredTrials: number; // finalized non-warmup trials, not sum of stream decisions
  meanBalancedAccuracy: number | null; // null if either stream metric is null
  meanDPrime: number | null; // null if either d′ is null; 0 is a valid d′
  flags: string[]; // aggregated, e.g. "Location: …", "Number: …", "Long frames observed"
}
```

`DualBlock` has `summary: DualDisplaySummary`, required `positionSummary` and `numberSummary`, and conjunction fields. Consumers branch on `task`. Do not put dual means into `hits` / `dPrime` of `Summary`.

If a combined hit-RT count is shown, call it `hitResponseCount` (one dual-target trial can contribute two RTs), never “trials.”

Long-frame quality: aggregate at finalization for both `complete()` and `interrupt()` from `block.frames`. Prefix stream flags so a silent number stream cannot look like a clean block.

### 7.3 Conjunction (both-target hit rate)

Derive **only** from finalized, non-warmup `block.trials` (`offset !== null`, both codes not `pending`). Do not use `block.sequence` (includes unpresented trials). Do not use raw accepted presses on a still-pending trial.

Always-both controls yield 100% both-target hit rate and 42 FAs per stream. This metric is **not** the headline score. UI: “Both-target trials: 4 of 5” plus Wilson interval. At D=4, one trial is 25 points.

Invariants: both stream summaries have equal `scored`; `dualHits + dualPartial + dualMiss === dualTargets`; `dualTargets <= scoredTrials`. Interrupted pending dual-target with one or both presses: `dualTargets` contribution **0**.

---

## 8. Preparation, engine states, interruption

`App.launch()` currently only builds a config. `generate()` runs in `new GameEngine()` inside a `Play` effect — **outside** that try/catch.

Required: `prepareBlock` / `prepareAndLaunch` generates and validates **before** `stage === "play"`. Failure → `preparation-error` with Retry (new seed, same protocol, record failed seed in diagnostics) and Finish. No fabricated completed block. No countdown until ready. Cancel stale async work.

| Event | Behaviour |
| --- | --- |
| Preparation | No response window |
| Countdown | Response inputs outside-window; overlay is visual, not an input filter |
| Visible onset | Create dual trial, both pending |
| First valid stream input | Latch that stream; acknowledge that mound only |
| Hide | Offset; classify both once; blank feedback |
| Blank | No accept; schedule input-independent |
| Interrupt visible | Keep raw slots; codes stay pending; no new outcomes |
| Interrupt blank | Keep already finalized current trial |
| Complete | Summaries from trials; finish once |

Same SOA rules as identity. Zero, one, or two accepted responses must not move offset or next planned onset.

---

## 9. Task isolation, practice, preferences

```ts
interface PreferencesV2 {
  n: N;                  // landed identity level; do not rename (saved prefs)
  dualN: N;              // independent dual default
  lastTask: "identity" | "dual";
  identityInput: "fixed" | "aimed"; // landed field is still `input`
  blocks: number;
  windowMs: number;
  sound: boolean;
}
```

Keep serialising `n` and `input` so existing localStorage prefs load. Add `dualN` (default 1) and `lastTask`. Do not let dual adaptation or dual stepper write `prefs.n`.

Assessment: identity forces `"fixed"`; dual forces `"dual"`. Launch carries immutable session `task` into every block. Play routes dual **before** identity fixed/aimed. Progress labels dual “Location + Number controls,” never “Tap mole.”

Practice:

- Historical pass at task+N+input may skip the **tutorial**.
- Every new session still requires **practice** before scored play.
- In-session `verified` is safe only because session task/input are immutable.
- Identity familiarity never skips dual tutorial or dual practice.

Guide N, dual training N, identity N, and assessment selection are separate. Changing the guide must not rewrite the other task’s preference.

Adaptation **when follow-on ships**: filter chronological dual **training** blocks, take `.slice(-2)`, **then** test completed, same N, same hash, no disqualifying flags, both streams responded. Do not prefilter to eligible/same-N (that bridges failures and protocol changes). Qualifying dual streaks may span sessions, like identity.

Step-down (follow-on): same stream weak on **both** consecutive blocks:

```ts
const lower =
  recent.every((b) => weak(b.positionSummary)) ||
  recent.every((b) => weak(b.numberSummary));
```

Not `every(b => weak(position) || weak(number))` (that lowers when the weak stream alternates). Raise: both streams on both blocks have hit rate ≥ 0.85 and FA ≤ 0.15 (≥16 hits, ≤6 FAs at 18/42). Weak: hit < 0.60 or FA > 0.30 (≤10 hits or ≥13 FAs). Test 16/15 hits, 6/7 FAs, 10/11 hits, 12/13 FAs. Floor 1, no upper clamp. Identity `adapt()` ignores dual blocks.

v1 ships **without** calling `adaptDual`. Fixed-N still accepts N≥4.

---

## 10. UI

### 10.1 Playfield

```
[Hole 0] [Hole 1] [Hole 2]
[Hole 3] [Hole 4] [Hole 5]
[Location] [ turf ] [Number]
     A                     L
```

CSS starting point (must still pass the viewport matrix):

```css
.playfield[data-task="dual"] {
  grid-template-rows: repeat(2, minmax(0, 1fr)) minmax(56px, auto);
}
```

Explicit grid placement for the two controls. Empty turf must not create hole index 6 or 7. Selectors distinguish `.hole` (six stimulus) from `.dual-response`. Digit ≥ **20 CSS px**. Response controls target **56 px** height (product target, not a WCAG claim). Identity playfield stays 2×3 + Match.

Preserve the repaired identity layout (`VERIFICATION.md`). Dual must not regress it. Short-landscape still stacks title/feedback in a side column — inspect combined dual rule + two-line feedback so they do not collide with the board.

All **13** baseline viewports are v1 release gates. Do not document “unsupported size” as an implementation shortcut. Test zoom/text enlargement separately; do not shrink labels without limit.

Fixed-height dual feedback (practice two lines / 44 px grid; assessment reserved silence). Feedback must not change board geometry.

Persistent dual rule: Location if hole matches N ago; Number if shirt matches N ago; both allowed; else wait.

Practice feedback always names both streams. Assessment: neutral “Response recorded” per accepted stream press; no correctness in text/colour/audio.

Sound (practice/training): success beep iff **both** stream codes are hit or CR; else error. Assessment silent.

### 10.2 Tutorial

Prefer `TutorialDual.tsx`. Player-paced. Separate **Check answer / Next example** — withholding is not inferred from time. First Location/Number click must not advance (player may still need the other control). Next is tutorial navigation, never a scored control.

N=1, N=2 (extended fixture), N=3, and synthesized N≥4 must each include all four scored actions. High-N history: compared appearance + current appearance; intervening items in a bounded/scrollable strip; omitted appearances labelled. Do not render unbounded N cells. Reset responses when N or task changes.

How-to-play task switcher: Number memory | Dual memory. Guide practice starts the matching task.

### 10.3 Dashboard / results

Two start paths. Assessment modal: task first, then battery vs one level. Dual assessment copy: two buttons, not Space-as-match.

Results: Location card, Number card, then both-target count/denominator. History: `Dual training` / `Dual assessment`. Progress: Task filter; never plot dual means on an identity series.

---

## 11. Persistence and export

Keep IndexedDB `recall-garden-v1` / store `sessions`. New dual (and mixed) **export envelope** `schemaVersion: 2`. Identity-only records may remain per-session schema 1. Readers:

- missing task → identity
- unknown explicit task → error / uninterpretable record with export/recovery, not silent identity
- dual missing stream summaries → malformed
- do not recompute historical hashes with current algorithms on load

CSV: **all legacy single-stream performance columns blank on dual rows.** Add named dual columns including denominators, balanced accuracy, raw accuracy, criterion, RT counts, intervals, flags, conjunction counts. JSON keeps sequences, intended categories, raw events.

Test mixed v1 identity + v2 dual: save, reload, interrupted dual, malformed task, storage failure with in-memory export, deletion.

---

## 12. Types (contract sketch)

Discriminate at block level with `task` matching `config.task`. Central constructors enforce it.

- `IdentityConfig`: `task: "identity"`, `input: "fixed" | "aimed"`, `n: N`
- `DualConfig`: `task: "dual"`, `input: "dual"`, plus `positionTargets`, `positionLures`, `dualTargetBand`, `minConflict`
- `DualStimulus` / `DualTrial` / `DualBlock` / `GameBlock` as in the review §4.1 (required dual fields; `summary` is `DualDisplaySummary`)

`Press` additions: `stream?`, `control: "position" | "number" | "stimulus"`, `disposition`, `ignoreReason`, `pointerId?`, `pointerType?`.

---

## 13. Files, phases, verification

### 13.1 Files

| File | Work |
| --- | --- |
| `src/game/types.ts` | **Additive:** task unions, dual summaries, press metadata. Keep landed `N` / `isN` / `resourceOk`. |
| `src/game/protocol.ts` | **Additive:** `dualProtocol`, dual version record, `passedDualPractice`. Do not change identity `configHash` payload, `VERSIONS`, or `adapt()`. |
| `src/game/sequence.ts` | **Do not change** identity `generate()` / `label()` unless a proven dual-only export is needed. Dual imports `label` and `hash`. |
| `src/game/dualSequence.ts` | **new** — construction, joint checks, diagnostics; calls `resourceOk` + `label` |
| `src/game/scoring.ts` or `dualScoring.ts` | Projection + conjunction; do not change identity formulas |
| `src/game/engine.ts` | Task dispatch; two latches; unchanged schedule; dual sequences come from `prepareBlock`, not a second `generate()` in the constructor |
| `src/components/Play.tsx` | Dual routing, multi-touch, hitboxes, two acks, preparation errors |
| `src/components/LevelPicker.tsx` | Reuse as-is for dual N |
| `TutorialDual.tsx` | Four-action examples, Check/Next; `resourceOk` before allocating; reuse `LevelPicker` |
| `src/components/Results.tsx` | Task rendering + task filter on top of the landed dynamic N list |
| `src/App.tsx` | Task on every route; prefs v2 (`n` = identity, add `dualN`); `prepareBlock` for dual; keep PWA `ongoing` update gate |
| `src/data/storage.ts` | Readers; schema 2 export; dual CSV |
| `src/styles.css` | Compact dual row; feedback; short-landscape |
| `src/pwa.ts` / PWA plugin | No dual-specific protocol. New dual chunks must remain import-reachable from `App` so they are precached. |
| tests + `pages.yml` or PR workflow | Dual suites; identity hash tests stay green; browser smoke gate; format/unit/build remain |
| `README.md`, `VERIFICATION.md` | Append Dual section with **actual** commands/results |

Do not edit `TAG-ME-Again-Game-Specification.md`. [UNBOUNDED_N_IMPLEMENTATION_PLAN.md](UNBOUNDED_N_IMPLEMENTATION_PLAN.md) is **delivered** on `main`; do not re-run it.

### 13.2 Phases (exit before the next)

| Phase | Deliverable | Exit |
| --- | --- | --- |
| 0 | This 1.2 contract; worktree from **`main`** | Plan agreed; `../tag-ME-dual` exists on `dual-nback` |
| A | `generateDual` only (reuse `isN` / `resourceOk` / `label`) | Dual seed banks; identity `seed` hashes still `8eadaf0d` / `c898454e` / `5dc8c1bd` |
| B | Dual types, `"fixed"` classify, projection, conjunction, readers | Strategy/pending/legacy fixtures |
| C | Engine latches + `prepareBlock` (dual generation, not only `resourceOk`) | Fake clock; forced generation failure UX |
| D | **First milestone:** one fixed-N dual practice → scored block → results → save/export | Reload + parsed CSV/JSON; two real stream summaries |
| E | UI, tutorial, 13 viewports, touch/keyboard | Browser + targeted real-device multi-touch |
| F | Dashboard, assessment/battery, progress, isolation. Adaptation only if explicitly reopened | Isolation matrix |
| G | Full suites, format, build, CI browser smoke, README/VERIFICATION append | Recorded results and device limits |

Prefer small shared controls over a generic multi-stream framework.

### 13.3 Verification matrix (release)

Use [DUAL_NBACK_IMPLEMENTATION_REVIEW.md](DUAL_NBACK_IMPLEMENTATION_REVIEW.md) §6 as the authoritative checklist. In particular:

- Independent equality oracle on raw arrays for N=1,2,3,4,5,8,12 and N greater than scored length.
- Quotas, D band, ≥2 conflicts, seed `184` at N=1, 200 training seeds at N=1–5, 30 at 8/12, 30 practice at those N.
- Overlapping touch both orders; native Space on focused button vs global Space; A/L vs inert Q/W/E/S/D.
- Projection flags; pending conjunction; preparation exhaustion journey.
- Location-only fixture: number `dPrime` ≈ 0.331274283, flag present, location unflagged.
- Dual solver in Playwright reads **visible hole index and digit**, not internal target flags.
- Identity regression: scoring, fixed/aimed, 1–3 `seed` hashes, named battery, unbounded identity stepper/adapt 1.1, PWA still registers in production.

`tsconfig` `include: ["src"]` does not typecheck tests. Add a test typecheck config if fixtures are complex.

CI: Pages today runs unit/format/build only. Add a **small deterministic browser gate** on PR or before deploy. Full 13-viewport matrix can stay separate.

---

## 14. Risks and non-goals

| Risk | Handling |
| --- | --- |
| Mole-tap identity habit | Noninteractive holes; `wrong_control`; no credit |
| OR / AND strategy collapse | D band, conflicts, two summaries, no Both button |
| N=1 generator cost | Retain-partner algorithm; budgets; async prepare |
| Layout | Compact row; 13-viewport gate; 20 px digit |
| Protocol mix | `task` on hash, charts, prefs, practice |
| PWA update mid-session | Keep the existing `ongoing` gate (play, tutorial, break). Dual break is `ongoing` too. |
| Over-claim | Visual–visual dual n-back; not Jaeggi auditory; not TAG-ME Again |

**v1 non-goals:** 8/9-cell spatial grid; auditory stream; mole gestures; any-match; hats; Quick vanish; dual N adaptation (follow-on); clinical norms; mixing dual with identity scores.

---

## 15. First implementation milestone

A **fixed-N dual practice and scored block that saves and exports two correct stream summaries**, with identity goldens unchanged, running in worktree `../tag-ME-dual` branched from **current `main`**. Then tutorial, navigation, assessment, viewports, and only later dual adaptation if still wanted.

---

*Plan version 1.2 — optional dual n-back for Recall Garden. Baseline `main` @ `b6423a4` (unbounded N + PWA landed). Identity reconstruction remains TAG-ME-Again-Game-Specification.md. Unbounded-N plan is delivered; do not re-implement it on the dual branch.*
