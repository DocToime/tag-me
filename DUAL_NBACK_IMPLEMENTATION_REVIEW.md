# Detailed review: Recall Garden Dual implementation plan

**Review date:** 9 September 2026  
**Plan reviewed:** [DUAL_NBACK_IMPLEMENTATION_PLAN.md](DUAL_NBACK_IMPLEMENTATION_PLAN.md), version 1.0  
**Code baseline:** `177a1ed` — `Simplify training screens and fit gameplay to the viewport`  
**Scope update:** Both identity and dual support N beyond 3, without a gameplay ceiling, following the user's clarification.  
**Verdict:** Support the product direction; revise the implementation contract before building it.

The plan correctly identifies the essential change: location and number need separate responses and separate scoring. It also makes sensible choices about preserving identity n-back, keeping exposure independent of responses, and describing the new task as visual–visual dual n-back.

However, this is not yet a sufficiently precise implementation specification. Following several passages literally would produce incorrect quality flags, missed valid responses, incompatible summary types, and potentially unreliable sequence generation. Session integration, fingerprint compatibility, and interrupted-trial scoring also need more explicit contracts.

This report contains prioritized findings, proposed corrections, implementation sketches, a revised delivery sequence, and a verification matrix. **It reviews a proposed feature; it does not claim these dual-task defects already exist in the shipped identity game.** No application source or original plan was changed for this review.

## 1. Scope, evidence, and how to use this report

Reviewed the entire dual plan and the relevant implementation in `src/game`, `src/components`, `src/data/storage.ts`, `src/App.tsx`, and `src/styles.css`, together with the unit/browser tests, deployment workflow, and existing verification evidence. Source references below identify the file, symbol, and baseline line numbers. Line numbers will move during implementation.

The introductory “dual n-back design notes” mentioned by the plan were not supplied as a separate identifiable document. This review assesses the written plan and repository, without assuming additional requirements from those notes.

The subsequent [UNBOUNDED_N_IMPLEMENTATION_PLAN.md](UNBOUNDED_N_IMPLEMENTATION_PLAN.md), version 1.1, was also read for integration dependencies. **The user's later clarification overrides both that document's exclusion of unbounded dual and the dual plan's D11 ceiling.** References to unchanged identity behavior below mean preservation of existing scoring, timing, and 1–3 replay data while incorporating the intended unbounded-N changes; they do not require retaining the old identity adaptation ceiling.

Evidence is separated into three categories:

- **Demonstrated:** a contradiction in the text, an inspected source dependency, or an executed probe/check.
- **Implementation risk:** a plausible failure the current plan does not prevent; not a claim about code that has not been written.
- **Recommendation:** a proposed product or engineering decision, requiring incorporation into the revised plan if adopted.

Severity definitions:

- **P1:** resolve before implementing the affected subsystem; likely to corrupt semantics, break a supported interaction, or require broad rework.
- **P2:** resolve before release; affects clarity, reliability, comparability, or completeness of verification.
- **P3:** refinement or optional extension; not a reason to expand v1 automatically.

### 1.1 Checks executed for this review

| Check | Observed result | What it establishes |
| --- | --- | --- |
| `npm test` | **24/24 passed** | Current identity unit baseline is healthy. |
| `npm run build` | **Passed** | Current TypeScript and Vite production build succeed. |
| `npm run format:check` | **Passed** | Current source passes the repository's formatting check. |
| Existing Playwright tests: `844x390 fixed` and `1280x720 fixed` | **2/2 passed**, Chrome, 7.4 seconds | These current identity layouts fit through countdown, visible, acknowledged, and blank phases. |
| Scoring projection probe | **Reproduced incorrect no-response flag** when `response` was not projected | The omission in plan §6.1 has a real consequence. |
| Existing classifier called with runtime input `"dual"` | **Returned `miss`** for an accepted target response without a hole | Dual must explicitly use fixed-response classification semantics. |
| Experimental generator, retry whole pair | **1 failure among 600 training seeds**, at N=1, seed `184`; 90 practice seeds completed | A plausible literal interpretation of the retry instructions is unreliable at the proposed cap. |
| Experimental generator, retain valid stream while retrying its partner | **600 training + 90 practice seeds completed**, with deterministic replay | A more specific construction strategy is promising, but is not production validation. |
| Six core TypeScript sketches compiled together against existing types/helpers | **Passed** with strict TypeScript checking | The proposed types, projection, classification, conjunction summary, protocol factory, and practice/quality helpers are mutually type-consistent; UI/integration sketches remain illustrative. |

The first browser invocation could not start the local server in the restricted environment; the rerun with permission to start the local server and browser passed. No automatic approval rejection remained unresolved.

The full 40-scenario identity browser suite was **not** rerun here. Its earlier passing result is documented in [VERIFICATION.md](VERIFICATION.md); it must not be presented as a fresh result from this review. There is no implemented dual UI to certify, and no physical phone/tablet testing was performed.

Reproducible review artifacts:

- [Probe script](review/dual-plan-probes.mjs): loads existing game helpers into temporary modules and exercises the identified scoring issues plus two experimental generator strategies.
- [Recorded probe results](review/dual-plan-probes.json): seed failures, attempt counts, overlap distributions, statistical examples, and baseline identity fingerprints.

```sh
npm test
npm run build
npm run format:check
PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/usability.spec.ts \
  --grep '1280x720 fixed|844x390 fixed'
node review/dual-plan-probes.mjs
```

The probe script writes temporary compiled modules under the operating system's temporary directory and removes them afterward. Its generator is deliberately an experiment, not an application module. Recorded timings are local Node measurements, not mobile-browser performance claims.

### 1.2 Updated N requirement and relationship between the two plans

The target contract is now:

| Concern | Identity | Dual |
| --- | --- | --- |
| Valid difficulty | Positive safe integer N; no gameplay ceiling | Positive safe integer N; no gameplay ceiling |
| Automatic increase | N + 1 after the identity qualification rule | N + 1 after the dual qualification rule; no upper clamp |
| Automatic decrease | Floor at 1 | Floor at 1 |
| Starting level and tutorial | Must support N beyond 3 | Must support N beyond 3 |
| Single-level assessment | Selected N, including N ≥ 4 | Selected N, including N ≥ 4 |
| Named three-level assessment battery | May remain 1→2→3 | May remain 1→2→3 as currently planned |
| Level preference, practice familiarity, progress | Task-specific | Task-specific |

The unchanged named assessment battery is a finite assessment selection, **not** a training or single-level-assessment ceiling. Defaults of N=1 for teaching/training and N=2 for single-level dual assessment can remain; a default is not a maximum.

Amend the dual plan's D11 and any 1–3 clamps/allow-lists, and amend the unbounded plan's scope paragraph, U17, and “dual still caps at 3” statements. Its proposed one-line erratum preserving a dual cap is no longer sufficient. The implementation branches may still be separate, but they must share this final N contract.

The existing executed generator probes and browser checks remain **baseline evidence only**. Their N=1–3 coverage is not evidence that high-N identity or dual generation already works. R20 and the updated verification matrix specify the additional work.

## 2. Findings at a glance

| ID | Priority | Finding | Main plan sections |
| --- | --- | --- | --- |
| R01 | P1 | Per-stream summary projection omits `response`, falsely flagging valid performance | §6.1 |
| R02 | P1 | Reusing `classify()` with `input: "dual"` applies aimed-hole semantics | §3.2, §6, §10 |
| R03 | P1 | Proposed dual summary is incompatible with `Summary` and leaks ambiguous combined metrics into consumers | §6.2, §10 |
| R04 | P1 | Rejecting non-primary pointers prevents natural two-finger responses | §3.1 |
| R05 | P1 | Generator retry structure is underspecified and a literal strategy fails the requested seed bank | §5.1, §12 |
| R06 | P1 | Generator errors occur outside the existing application `try/catch` | §5.1, §11–12 |
| R07 | P1 | Practice's dual-target band contradicts its alignment cap | §4, §5.1, §5.3 |
| R08 | P1 | Version/hash changes need an explicit identity-compatibility policy | §1 D10, §6.3, §10 |
| R09 | P1 | Task isolation is incomplete unless adaptation, preferences, and all protocol factories change together | §8, §9.5, §10 |
| R10 | P1 | Conjunction scoring must explicitly exclude unfinished and unpresented trials | §6.2, §7 |
| R11 | P2 | Space, native button activation, and the `A` aimed-key overlap need one coherent keyboard contract | §3.1, §13 |
| R12 | P2 | Disabled stimulus buttons do not provide a reliable wrong-control logging contract | §3.1, §9.1 |
| R13 | P2 | Additive storage still requires normalized readers and a versioned export schema | §10 |
| R14 | P2 | Historical tutorial familiarity is confused with permission to skip practice | §9.4, §10, §11 |
| R15 | P2 | Layout rationale cites an obsolete baseline; third-row sizing and release limits are underspecified | §1.1, §9.2 |
| R16 | P2 | Generator “independence” and lock checks are overstated; validation/version details are missing | §1 D2, §4, §5 |
| R17 | P2 | Statistical terminology, conjunction precision, and a proposed d′ test need correction | §1 D9, §6, Phase B |
| R18 | P2 | Tutorial fixture omits the neither-match case and lacks a player-paced response contract | §2, §9.4 |
| R19 | P2 | Acceptance tests miss important boundaries, integration paths, and an ongoing browser gate | §12–13 |
| R20 | P1 | Both tasks must support unbounded N; shared labels, adaptation, UI, and resource handling must be reconciled across the plans | Dual D11, §5/§8/§9; Unbounded U1–U20 |

## 3. Detailed findings and recommended corrections

### R01 — Project the response object as well as code and RT

**Priority: P1. Demonstrated.**

Plan §6.1, line 300, proposes mapping each stream's code and RT into `summarize()`. But [scoring.ts](src/game/scoring.ts), `summarize()`, lines 102–107, also inspects `t.response` to decide whether any scored responses occurred. Plan §3.2 deliberately leaves the identity `response` unused for dual trials.

If a developer maps only `numberCode → code` and `numberRt → rt`, a perfect number stream still receives `"No scored responses"`. The probe obtained **18 hits and that incorrect flag simultaneously**. Mapping `numberResponse → response` removed it. The same problem applies to location.

Because §6.1 says either no-response flag blocks adaptation, the omission can prevent adaptation after otherwise perfect dual performance. It also misleads the results page and exported quality data.

**Required correction:** specify all three fields in the projection, preserve the original stimulus's warmup state, and initialize both stream states on trial creation. Do not repair this by suppressing response flags globally.

```ts
// Assumes the required DualTrial fields defined in §4 of this report.
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

const positionSummary = summarize(trials.map((t) => projectStream(t, "position")));
const numberSummary = summarize(trials.map((t) => projectStream(t, "number")));
```

`summarize()` currently only needs the projected code, RT, response, and warmup flag. Projecting the complete stream stimulus makes the adapter safe for future lure-specific summaries too.

**Verification:** perfect streams have no response flag; a silent number stream flags number only; warmup-only responses do not remove a no-scored-response flag; responses on a pending trial do not remove it either.

### R02 — Call the identity classifier with explicit fixed-input semantics

**Priority: P1. Demonstrated integration hazard.**

[scoring.ts](src/game/scoring.ts), lines 2–11, treats a target press as a hit only if `input === "fixed"` or the pressed hole matches the stimulus hole. There is no general “all non-aimed inputs are fixed” branch.

Adding `"dual"` to `InputMode` and passing `config.input` through the current call at [engine.ts](src/game/engine.ts), line 82, would make an otherwise valid dual target response a miss. Dual control presses normally do not have `press.hole`.

The plan correctly says not to use aimed geometry, but must show how that requirement interacts with this exact helper:

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

Call this only from the visible-to-blank transition, after setting `offset`. Leave the identity path's call unchanged. A dedicated `classifyMatch(warmup, target, responded)` could eventually clarify the shared primitive, but extracting it is optional; the explicit `"fixed"` adapter is sufficient for v1.

**Verification:** position-only, number-only, both, and neither fixtures produce the complete two-stream truth table. In particular, accepted presses with no hole are hits on their target streams.

### R03 — Define a real dual result type; do not make `Summary` ambiguous

**Priority: P1. Demonstrated type conflict and consumer risk.**

Plan §6.2, lines 323–329, recommends putting null counts into `Block.summary` and repurposing `balancedAccuracy` and `dPrime` as stream averages. Current [types.ts](src/game/types.ts), lines 57–78, requires numeric counts. `Block.summary` is a `Summary` at line 94.

This proposal does not compile without a type change. Globally widening identity counts to `number | null` would weaken many existing assumptions. Using a type assertion merely conceals the mismatch.

There is also a semantic problem independent of TypeScript:

- [Results.tsx](src/components/Results.tsx), lines 44–126, assumes one set of hit/FA counts and one RT distribution.
- Its progress chart, lines 189–210 and 308–367, reads `b.summary.balancedAccuracy` directly.
- [storage.ts](src/data/storage.ts), lines 120–132, exports `summary.dPrime`, `balancedAccuracy`, and `rtCount` under existing identity column names.
- [App.tsx](src/App.tsx), line 405, formats practice feedback directly from the identity counts.

Leaving only old `hits` blank, as §10 recommends, does not prevent an exported average d′ from being mistaken for the existing single-stream d′. Nor is summed hit-RT count a count of distinct successful trials: one dual-target trial can contribute two RT samples.

**Required correction:** retain `Summary` for one stream. Give dual display aggregates a separate type with explicit names, and route each consumer by task. A typed union or a required dual result payload is appropriate. See §4 for one concrete shape.

Recommended output contract:

- `positionSummary` and `numberSummary`: ordinary `Summary`, complete and nonoptional on dual blocks.
- `summary.meanDPrime` and `summary.meanBalancedAccuracy`: optional display aggregates with explicit names.
- `summary.scoredTrials`: number of finalized non-warmup trials, not sum of stream decisions.
- Conjunction counts: separate fields with an explicit scored denominator.
- Combined hit-RT count, if retained: call it `hitResponseCount`; do not label it “trials.”

For dual CSV rows, leave **all legacy single-stream performance columns** blank and add explicitly named dual columns. Preserve common metadata and common block quality fields. This is stricter and clearer than blanking only `hits`.

### R04 — Permit concurrent touch contacts on different response controls

**Priority: P1. Demonstrated conflict with the intended interaction.**

Plan §3.1, line 115, preserves rejection of non-primary pointers. Current [Play.tsx](src/components/Play.tsx), lines 159–169, sets `ignored: !e.isPrimary || e.button !== 0`.

For a multi-touch interaction, only one touch pointer is primary. Consequently, placing a finger on Location and then touching Number while the first finger remains down rejects the second response. The browser's primary-pointer concept does not mean “the main button on each control.” See the [W3C Pointer Events definition](https://www.w3.org/TR/pointerevents3/#the-primary-pointer).

Sequential fully released taps can work, but silently requiring that gesture is a poor fit for “you may press both.” It also gives touch and keyboard different motor requirements.

**Required correction:** retain identity's policy; for dual, permit distinct touch contacts and use the engine's per-stream first-response latch to suppress duplicates.

```ts
function ignoredDualPointer(e: React.PointerEvent): boolean {
  if (e.pointerType === "touch") return false;
  return e.button !== 0 || !e.isPrimary;
}

// In the dual control's pointerdown handler:
send({
  eventTime: e.timeStamp,
  handlerTime: performance.now(),
  method: e.pointerType,
  stream,
  pointerId: e.pointerId,       // proposed Press metadata
  pointerType: e.pointerType,  // proposed Press metadata
  x: e.clientX,
  y: e.clientY,
  ignored: ignoredDualPointer(e),
});
```

Define pen behavior separately if needed; do not claim this permits every simultaneous pen/touch hardware combination. The operating system can suppress contacts.

Acceptance must include two **overlapping** touch contacts, in both orders. Two `touchscreen.tap()` calls only verify sequential contacts. Synthetic DOM pointer events can verify handler logic but do not establish native multi-touch behavior. Add a browser-native multi-touch check where supported and a real-device check.

### R05 — Specify generator retry semantics and measure the difficult N=1 case

**Priority: P1. Demonstrated prototype failure; production implementation not yet present.**

Plan §5.1 specifies four PRNG streams and up to 8,000 retries of the whole construction. It does not say whether one valid stream is retained while its partner fails, whether each stream has an inner retry loop, or how those retry budgets compose.

These choices change both feasibility in practice and deterministic outputs. A developer can reasonably interpret the text as constructing one digit candidate and one hole candidate per outer attempt, discarding both if either fails. That implementation was prototyped in [dual-plan-probes.mjs](review/dual-plan-probes.mjs), using the existing category/choice rules and all stated joint constraints.

| Strategy | Bank | Failures | Maximum attempts | 95th-percentile attempts |
| --- | --- | --- | --- | --- |
| Retry whole pair | N=1 training, 200 seeds | **Seed `184` exhausted 8,000** | 8,000 | 4,730 |
| Retry whole pair | N=2 training, 200 seeds | 0 | 19 | 8 |
| Retry whole pair | N=3 training, 200 seeds | 0 | 7 | 4 |
| Retain valid stream | N=1 training, 200 seeds | 0 | 366 | 171 |
| Retain valid stream | N=2 training, 200 seeds | 0 | 8 | 6 |
| Retain valid stream | N=3 training, 200 seeds | 0 | 7 | 4 |

Both strategies were also checked over 30 practice seeds at each N; all those seeds completed. The recorded output includes overlap histograms and local timings. N=1 whole-pair generation reached about **168 ms** in this run, before considering a slower browser/device.

This does **not** prove the specification infeasible, or that every interpretation fails. It demonstrates that “8,000 retries” is not an adequate algorithm specification. At N=1, immediate targets interact with the four-in-a-row prohibition, and the available lure lag is 2; this deserves explicit testing rather than blaming the six-hole alphabet alone.

**Required correction:**

1. Give each stream an explicit bounded candidate-construction procedure.
2. Retain a successful stream while constructing the other; when a completed pair fails joint validation, discard/rebuild the pair according to a documented deterministic rule.
3. Specify whether PRNG state advances continuously or derives from attempt indices. Do not accidentally reseed each attempt to the same state.
4. Define a total work budget, not an ambiguous product of nested 8,000-iteration loops.
5. Count rejection reasons during development: stream construction failure, overlap, conflict, lock cap, and other invariants.
6. Include N=1 seed `184` in the regression bank for the final chosen algorithm, while acknowledging that its outputs will change with a different construction strategy.
7. Benchmark on a representative slow device. If generation is perceptibly blocking, prepare it asynchronously before countdown, using a worker or an explicit loading phase.

Do not increase the cap as the sole fix. Do not fall back to identity's balanced hole bag or quietly relax quotas. Failed generation must be recoverable, as R06 explains.

### R06 — Handle sequence preparation failures where they actually occur

**Priority: P1. Demonstrated source integration gap.**

Plan §5.1 says to throw an explicit error when generation fails. [App.tsx](src/App.tsx), `launch()`, lines 219–228, has a `try/catch`, but it only constructs the protocol and schedules a React render. Actual generation happens in `new GameEngine(...)`, invoked later in [Play.tsx](src/components/Play.tsx), lines 49–70, inside an effect. The engine constructor calls `generate()` at [engine.ts](src/game/engine.ts), line 37.

An exception in that effect is not caught by `launch()`'s `try/catch`. A dual generator with more rejection paths makes this existing boundary materially relevant.

**Required correction:** introduce a sequence-preparation boundary with an explicit failure path. Either prepare and validate the sequence before mounting `Play`, or catch constructor/preparation errors in `Play` and report them through a typed `onPreparationError` callback.

```ts
// Sketch of a pre-play preparation boundary; helper names are proposed.
async function prepareAndLaunch(request: StartBlockRequest) {
  setStage("preparing");
  try {
    const prepared = await prepareBlock(request);
    // prepareBlock returns the validated config, seed, sequence and versions.
    setPreparedBlock(prepared);
    setStage("play");
  } catch (error) {
    setPreparationError(describePreparationFailure(error));
    setStage("preparation-error");
  }
}
```

Define Retry and Finish actions. Retry may use a new seed while preserving the requested protocol, and should record the failed seed/error in development diagnostics. Do not insert a fabricated completed block or scoring misses. Preserve the session and existing export/recovery behavior.

Countdown must begin only after preparation, validation, and playfield readiness. If async work can outlive a navigation/retry, reject stale results using an operation token or cancellation mechanism.

**Verification:** force generation to reject a request and to exhaust its budget; assert a usable retry/exit state, no uncaught browser error, no scored block, and no stuck running engine.

### R07 — Resolve the practice overlap contradiction

**Priority: P1. Demonstrated mathematical inconsistency.**

Plan §4, line 189, and §5.3 specify **1–4** dual targets in 12 practice trials. Both streams have six targets. But §5.1, line 243, requires no more than half of either stream's targets to also be targets on the other stream:

```text
D / 6 <= 0.50  =>  D <= 3
```

Thus D=4 can never be accepted. Tests checking only `1 <= D <= 4` will pass without detecting that the fourth permitted category is unreachable.

**Recommendation:** use a practice band of **1–3**, retaining the stated alignment cap. This is the smallest change that preserves the current anti-shortcut intent. Alternatively, keep 1–4 and explicitly exempt practice from the 0.50 cap; that is a different protocol choice. Make the same choice in the table, generator, tests, validation, and fingerprint payload.

For 12 scored practice trials with six targets per stream:

| Cell | Count |
| --- | --- |
| Both targets | D |
| Location only | 6 − D |
| Number only | 6 − D |
| Neither | D |

A 1–3 band guarantees examples of all four actions, with at least three location-only and three number-only trials. The current pass rule rejects always-both, silence, and responding to just one stream. Those useful properties should be retained and asserted directly.

For general validation, require `max(0, positionTargets + numberTargets - scoredTrials) <= D <= min(positionTargets, numberTargets)` and intersect that feasible range with any alignment limit. Do not wait until 8,000 attempts to detect an empty intersection.

### R08 — Separate protocol version selection from global implementation version changes

**Priority: P1. Demonstrated compatibility risk.**

Plan §6.3 proposes task-specific generator versions and a global engine bump to `1.1`. Current [protocol.ts](src/game/protocol.ts), lines 3–8 and 31–32, has one global `VERSIONS` object included in every config hash. [engine.ts](src/game/engine.ts), lines 43–44, also stores that same object.

Consequences if changed mechanically:

- All newly generated identity hashes change when the global engine version changes.
- Adding `task: "identity"` to the object hashed by `configHash()` also changes its JSON representation.
- Progress groups by exact hash; old and new identity rounds split into separate settings sets even if behavior is identical.
- A shared mutable versions object cannot safely mean generator `1.0` for one task and `dual-1.0` for another.

A new identity fingerprint is not intrinsically wrong, but the plan must explicitly choose it rather than promise unchanged identity continuity and accidentally change it.

**Recommended policy:** select immutable version records by task. Preserve the established identity protocol fingerprint if identity behavior is actually unchanged; record an application build/version separately if the common code implementation needs its own release identifier. If identity timing or response semantics do change, intentionally version and separate those results instead.

For legacy-compatible identity hashing, preserve the exact prior payload, including field order, since [sequence.ts](src/game/sequence.ts), `hash()`, hashes `JSON.stringify(value)`. Simply deleting `task` from arbitrary objects does not guarantee canonical ordering.

Baseline evidence for `protocol(n, "training")` and seed `"review-golden"`:

| N | Identity config hash | Identity sequence hash |
| --- | --- | --- |
| 1 | `cde18653` | `d4dc7121` |
| 2 | `7a28b8f0` | `99aff584` |
| 3 | `03e96915` | `aa16f486` |

These are useful golden fixtures. Existing tests prove repeatability within one implementation, but not unchanged replay across a refactor. Preserve the identity PRNG call order; extracting generic stream helpers can inadvertently change identity sequences even when quotas still pass.

For dual, hash a canonical payload containing all behavior-defining choices: task, N, mode, counts, both lure quotas, overlap band, conflict policy, alphabets, timing, response mapping/policy, generator version, dual scoring wrapper version, and display version. A parameter may be represented by a versioned protocol definition rather than duplicated inline, but the stored definition must be resolvable.

The current eight-hex-digit FNV-style hash is a convenience fingerprint, not proof that two protocols are identical. Do not rely on the hash alone for task separation. Use explicit task filters too. A stronger/canonical dual fingerprint can be considered without changing existing identity IDs.

### R09 — Make task isolation concrete across factories, adaptation, and preferences

**Priority: P1. Demonstrated call-site coverage gap.**

The plan's isolation principle is right, but adding `task` fields and an `adaptDual()` helper is insufficient. Several current branches use a two-option world:

| Existing path | Baseline reference | Required dual decision |
| --- | --- | --- |
| Assessment protocol forces `input: "fixed"` | [protocol.ts](src/game/protocol.ts), line 28 | Force `"dual"` for dual assessment, `"fixed"` for identity assessment. |
| Session start chooses fixed/aimed and copies a shared N | [App.tsx](src/App.tsx), lines 160–184 | Accept task explicitly and choose its N/input defaults. |
| Launch uses session window/input only | [App.tsx](src/App.tsx), line 223 | Carry immutable session task into every block. |
| Adaptation collects blocks from all sessions | [App.tsx](src/App.tsx), lines 243–248 | Dispatch by task and select the correct chronological candidate list. |
| Completed training writes `prefs.n` | [App.tsx](src/App.tsx), lines 254–257 | Update the appropriate task's preferred level. |
| Continuation recomputes adaptation | [App.tsx](src/App.tsx), lines 285–293 | Use the same task-specific rule/decision as results. |
| Non-fixed play branches imply aimed | [Play.tsx](src/components/Play.tsx), lines 79–80, 290–312 | Route dual explicitly before identity fixed/aimed. |
| Non-fixed progress input label implies “Tap mole” | [Results.tsx](src/components/Results.tsx), line 269 | Label dual “Location + Number controls.” |

The shared `prefs.n` is easy to miss. With it unchanged, dual adaptation changes the next identity default and vice versa. Use separate preferred levels, preserving existing `prefs.n` as the legacy identity value on load.

```ts
interface PreferencesV2 {
  identityN: N;             // legacy prefs.n maps here
  dualN: N;                 // explicit default, independent of identity
  lastTask: "identity" | "dual";
  identityInput: "fixed" | "aimed";
  blocks: number;
  windowMs: number;
  sound: boolean;
}
```

**Adaptation ordering is another critical detail.** §8 says both “last two ... quality-eligible” and “flagged blocks break the streak.” Filtering out flagged/interrupted blocks before taking the last two bridges across failures. Instead, select the last two blocks of the relevant task and training mode, **then** test status, N, config, responses, and quality.

```ts
const recent = allBlocks
  .filter((b) => taskOf(b.config) === "dual" && b.config.mode === "training")
  .slice(-2); // allBlocks must already be chronological

if (recent.length !== 2 || !recent.every(isEligibleDualTrainingBlock)) {
  return holdDecision(n, recent);
}
if (recent.some((b) => b.config.n !== n) ||
    recent[0].configHash !== recent[1].configHash) {
  return holdDecision(n, recent);
}
```

Do not prefilter to matching N/hash either; that would bridge over intervening protocol changes. Identity blocks can be ignored in the dual list and vice versa, consistently with the separate-task streak policy. Document whether streaks persist across sessions; current identity adaptation does.

Resolve the step-down parentheses explicitly. The wording about persistent failure on either stream most naturally means:

```ts
const lower = recent.every((b) => weak(b.positionSummary)) ||
              recent.every((b) => weak(b.numberSummary));
```

This differs from `recent.every(b => weak(position) || weak(number))`, which also lowers when the weak stream alternates between rounds. The report recommends the former because it matches “persistent” failure of the same stream. Add an alternating-weakness fixture.

At the proposed 18 targets/42 non-targets, the thresholds translate to: raise with at least **16 hits** and at most **6 FAs** on every stream/block; weak means at most **10 hits** or at least **13 FAs**. Test those exact boundaries.

**D12 recommendation:** v1 can include fixed-N dual training plus fixed assessment, with adaptation deferred. The plan alternates between “assessment-only” and “training with no auto change” as the fallback; select one. If adaptation ships, all the isolation and streak tests above are release requirements.

**N-range amendment:** Whether a block starts at a chosen level or follows an adaptive decision, dual N is no longer restricted to 1–3. If adaptation is included, raise with `n + 1`, retain only the floor on decreases, and record the revised dual rule version. A fixed-N first milestone must also accept levels beyond 3; it is not permission to restore a ceiling.

### R10 — Define conjunction scoring over finalized trials only

**Priority: P1. Implementation risk not fully prevented by the plan.**

Plan §7 correctly says interrupted current trials stay pending. §6.2 says dual success is based on accepted actions, but does not explicitly connect its denominator to finalized stream codes.

Consider stopping a dual-target trial after Location has been accepted but before hide. The engine preserves that press, and both codes should remain pending. Counting accepted responses directly would record a `dualPartial`, even though the trial never reached its scoring boundary. Stopping after both responses could similarly create a premature `dualHit`.

Another mistake would be computing D from `block.sequence`, which includes planned dual targets that were never presented.

**Required correction:** derive every conjunction count from finalized, non-warmup entries in `block.trials`. Use stream codes or an explicit finalized marker. The same helper must run on completed and interrupted blocks.

```ts
function summarizeConjunction(trials: DualTrial[]) {
  const scored = trials.filter((t) =>
    !t.stimulus.warmup &&
    t.offset !== null &&
    t.positionCode !== "pending" &&
    t.numberCode !== "pending"
  );
  const targets = scored.filter((t) =>
    t.stimulus.positionTarget && t.stimulus.target
  );
  const dualHits = targets.filter((t) =>
    t.positionCode === "hit" && t.numberCode === "hit"
  ).length;
  const dualPartial = targets.filter((t) =>
    (t.positionCode === "hit") !== (t.numberCode === "hit")
  ).length;
  const dualTargets = targets.length;
  return {
    dualTargets,
    dualHits,
    dualPartial,
    dualMiss: dualTargets - dualHits - dualPartial,
    dualAccuracy: dualTargets ? dualHits / dualTargets : null,
    dualInterval: wilson(dualHits, dualTargets),
  };
}
```

Required invariants: both stream summaries have equal scored-trial counts; `dualHits + dualPartial + dualMiss === dualTargets`; `dualTargets <= scoredTrials`. Preserve raw accepted presses on interrupted pending trials without counting them in any summary outcome.

Also apply common timing flags consistently. The current engine appends `"Long frames observed"` in `complete()` but not `interrupt()`; both paths still expose `frames`. For dual, establish a shared block-quality representation or deliberately aggregate timing flags at finalization instead of updating only one stream summary.

### R11 — Resolve native activation, Space, keyboard scope, and the `A` overlap

**Priority: P2. Demonstrated specification contradictions.**

Three contracts currently conflict:

1. §3.1 permits native buttons with a zero-detail `click` fallback.
2. §3.1 says Space must not be bound to an either/both response.
3. §13 says “Space does not register a dual match,” without a focus exception.

A focused native button normally activates with Space or Enter; [W3C's button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) explicitly includes both. Suppressing that behavior would undermine the stated accessible-button fallback.

**Recommended wording:** “Space is not a global dual-response shortcut. Space/Enter on a focused Location or Number button activate that button's stream through native activation. Space/Enter on Stop operate Stop.” Test each focus context separately.

The checklist also says Q/W/E/A/S/D hole keys do not score dual, while A is the primary Location key. Replace that with: “The aimed-hole mapping is inactive in dual. A maps only to Location; L maps only to Number; Q/W/E/S/D have no game action.”

Global letter shortcuts should be scoped to the active game context, respect editable content and modifier/composition events, and avoid handling input intended for other controls. Include `contenteditable`, nested link/button targets, and `event.isComposing`, not just the four tag names currently listed.

For accessibility, provide a way to disable or remap character shortcuts, or make them active only in the relevant focused component. Merely ignoring text fields is not the full requirement described by [WCAG's character-key-shortcut guidance](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html). This review does not certify overall WCAG conformance.

Additional keyboard details to specify:

- Maintain held-key suppression per physical key; holding A while pressing L must still accept L.
- Aliases for one stream share the stream's first-response latch.
- Guard modifier shortcuts such as Ctrl+A, Meta+A, and Alt+Left.
- If using `KeyboardEvent.code`, acknowledge that the physical key may not carry the printed A/L legend on every layout. Arrow aliases or user remapping help; keep displayed hints consistent with the selected mapping.
- Ensure native key activation does not leak a held/late release into a subsequent trial without a documented timestamp policy.

### R12 — Give wrong-control events a reliable source and unambiguous data fields

**Priority: P2. Implementation ambiguity.**

§9.1 says stimulus holes are “not buttons (`disabled`, `tabIndex=-1`)”; those attributes still describe disabled buttons. §3.1 simultaneously requires logging mole taps as ignored with reason `wrong_control`.

Current [Play.tsx](src/components/Play.tsx), lines 233–255, only calls `pointer()` for aimed input. Copying fixed-mode markup does not log dual mole taps. Depending on disabled-element event behavior is also a poor basis for cross-browser diagnostics.

**Recommendation:** use noninteractive stimulus containers for dual, keep six distinct `data-hole` indices, and collect pointerdown on those containers or a dedicated capture layer. Keep identity markup intact. Response controls remain native enabled buttons.

Avoid overloading `disposition` to mean both general status and reason:

```ts
type Disposition = "accepted" | "duplicate" | "outside_window" | "ignored";
type IgnoreReason = "wrong_control" | "repeat" | "non_primary_button";

interface DualPressMetadata {
  stream?: Stream;
  control: "position" | "number" | "stimulus";
  disposition?: Disposition;
  ignoreReason?: IgnoreReason;
  pointerId?: number;
  pointerType?: string;
}
```

Define precedence. A sensible policy is: explicit ignored input/wrong control first; then the time window; then the stream duplicate check; then acceptance. Thus a repeated key is always ignored, and a normal response-button press during blank is outside-window.

The countdown overlay is visual, not an input validator. Keyboard events can still arrive. If the plan requires logging every early response-control tap, define how pointer targets underneath the overlay are identified; otherwise narrow the logging promise to events actually received from response controls.

Finally, [Play.tsx](src/components/Play.tsx), lines 145–156, records the **active stimulus hole** as every press's `hitbox`. Dual responses should record the actual Location/Number control rectangle, with a separate stimulus rectangle if needed. Otherwise exported motor/geometry metadata becomes misleading.

### R13 — Keep the database, but normalize legacy records and version new exports

**Priority: P2. Demonstrated reader/export gap.**

Using the existing IndexedDB database and store is reasonable. Its object values can gain fields without a database migration. But “no migration job” must not mean “no compatibility code.”

[storage.ts](src/data/storage.ts), lines 36–48, casts `getAll()` results directly to `Session[]`. Both [App.tsx](src/App.tsx), line 175, and the JSON envelope at [storage.ts](src/data/storage.ts), line 77, currently use `schemaVersion: 1`.

Required compatibility decisions:

- Missing task on legacy session/block configs means identity.
- An **unknown explicit task** must not silently mean identity.
- A dual record missing stream labels/summaries is malformed, not a legacy identity record.
- Session and block task must agree. Centralize record construction and validate that invariant.
- Stored hashes, raw arrays, and version metadata are historical evidence; do not silently recompute them using current algorithms on load.
- Validate enough shape to avoid crashes in results and CSV, and offer export/recovery for records the current UI cannot interpret.

```ts
function parseTask(value: unknown): Task {
  if (value === undefined) return "identity"; // legacy records only
  if (value === "identity" || value === "dual") return value;
  throw new Error("Unsupported task value");
}
```

This helper is only task normalization, not a complete stored-record validator. Validate schema/config/trial/summary shapes at the persistence boundary and return typed internal records.

**Recommendation:** introduce session/export schema version 2 for newly emitted records, while retaining database version 1 unless the object-store structure actually changes. Preserve readable version-1 sessions in mixed history; state whether export keeps their original per-session schema version or emits an explicitly normalized representation.

Extend CSV with stream denominators, balanced accuracy, raw accuracy, criterion, RT count, confidence intervals, and quality flags in addition to the plan's proposed fields. Counts and rates alone are insufficient to distinguish absent responses, unfinished data, and valid small samples. Keep sequence/intended-category/raw-event detail in JSON, since CSV is one row per block.

Test mixed v1 identity/v2 dual history through save, reload recovery, export, and deletion. Include a fresh dual session with no completed blocks, an interrupted dual trial, a malformed future task, and storage failure with in-memory export.

### R14 — Preserve mandatory practice and distinguish it from tutorial familiarity

**Priority: P2. Demonstrated mismatch with current behavior.**

The plan repeatedly refers to a “practice waiver.” Current [App.tsx](src/App.tsx), lines 202–217, clears the in-session `verified` levels at the start of every session. A historical pass only skips the explanation and launches **new practice**. It does not authorize a scored round. [tests/usability.spec.ts](tests/usability.spec.ts), the returning-player test, explicitly protects that behavior.

**Required wording:**

- Historical task/N/input familiarity may skip the tutorial.
- Every new session must pass practice before scored play.
- Within a session, a previously verified level may be reused only under the defined task/input/practice policy.
- Identity familiarity never skips the dual tutorial, and an identity practice pass never validates a dual level.

`verified: N[]` can remain safe only if a session's task and response policy are immutable. A structured verification key is clearer if future within-session changes are possible. Do not use the raw training config hash as a practice key without normalization: practice and training intentionally differ in mode, counts, and sometimes exposure.

The default N also needs disambiguation. D11's “default dual test N=2” should explicitly mean single-level assessment if that is intended. Recommendation: dual teaching and first training at N=1; single-level dual assessment defaults to N=2; a battery still starts at N=1; required practice always matches the upcoming scored N.

Separate `lastTask`, dual training preference, guide selection, and assessment selection. Do not let changing the guide to 3-back silently change the next identity session or a dual assessment battery.

### R15 — Update the layout baseline and specify measurable dual geometry

**Priority: P2. Demonstrated stale evidence plus design risk.**

Plan §1.1 and §9.2 say identity currently loses its Match control below the fold, referencing [review/REVIEW.md](review/REVIEW.md). That report is historical. [VERIFICATION.md](VERIFICATION.md) explicitly identifies it as the pre-fix baseline, and current [styles.css](src/styles.css), lines 495–520 and 1229–1273, implements viewport fitting and short-landscape placement. The two focused browser reruns in §1.1 passed.

**Correction:** replace “already fails” with “previously failed; preserve the fixed baseline while adding dual controls.” Six holes remain a defensible product choice, but should not be justified by a defect already repaired.

For dual, `repeat(3, 1fr)` is not enough. It gives the response row as much height as each stimulus row and can shrink digits unnecessarily. Reserve a compact response row with explicit minimum control dimensions:

```css
/* Starting point, subject to the full viewport matrix; not a verified patch. */
.playfield[data-task="dual"] {
  grid-template-rows: repeat(2, minmax(0, 1fr)) minmax(56px, auto);
}
.dual-response[data-stream="position"] {
  grid-column: 1;
  grid-row: 3;
}
.dual-response[data-stream="number"] {
  grid-column: 3;
  grid-row: 3;
}
.dual-response {
  min-width: 0;
  min-height: 56px;
}
.dual-feedback {
  min-height: 44px;
  display: grid;
  grid-template-rows: repeat(2, 22px);
}
```

Retain the existing three-column stimulus coordinates in every orientation; do not reorder holes through responsive CSS. Distinguish six stimulus elements from two response elements in selectors, so `.hole` iteration never produces hole indices 6 or 7. Explicitly place row-three controls; decorative empty turf must not accidentally create an extra grid track.

Use the existing digit-height assertion of **at least 20 CSS px** as a baseline release requirement, and maintain readable control labels and a **56 px recommended control height**. That 56 px is a product target drawn from the current Match button, not a WCAG threshold. WCAG's minimum target criterion is 24×24 CSS px with exceptions; large game controls are appropriate here. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Additional checks must cover both labels, focus rings, two acknowledgements, worst-case two-line feedback, the longer persistent dual rule, every occupied stimulus position, and collision with countdown. A control's bounding box fitting inside the viewport does not prove its text or the SVG digit is unclipped.

The current short-landscape stylesheet puts `.play-title` and `.play-response` in the same side column. Inspect the combined rule/feedback height for dual; moving buttons into the board does not remove that collision risk automatically.

Resolve the conflicting release rule: §9.2 permits documenting unsupported sizes, while §13 requires all listed sizes to fit. Recommendation: retain all 13 baseline viewports as v1 release gates. If a size must be excluded, make it a specific revised product decision, not an implementation shortcut. Test browser zoom/text enlargement separately from the default viewport matrix; do not shrink labels indefinitely to achieve zero scroll.

### R16 — Describe constrained streams accurately and strengthen generator validation

**Priority: P2. Mathematical clarification and specification completeness.**

Independent RNG streams do not make accepted sequences statistically independent. Conditioning on a joint overlap band, conflict counts, and a hole/digit lock rejection changes their joint distribution. This is compatible with a valid two-judgment game, but the plan should say **“separately constructed streams with explicit joint constraints.”**

For 60 scored trials with 18 targets per stream and D dual targets:

| Cell | Count |
| --- | --- |
| Both targets | D |
| Location only | 18 − D |
| Number only | 18 − D |
| Neither | 24 + D |

The unconstrained independent-reference expectation `D = 60 × 0.3 × 0.3 = 5.4` is useful context, not a promised property of the final generator. The binary target correlation for a particular accepted block is `(D/60 − 0.09) / 0.21`, ranging from approximately −0.111 at D=4 to +0.206 at D=8.

The `digit === hole + 1` cap detects only one numeric mapping. Another deterministic permutation is not caught by that equality test itself. A fully one-to-one hole/digit mapping would also force target alignment and should be rejected by the overlap constraints, but partial/biased mappings are not ruled out by this single check. Avoid calling it a general independence guarantee.

**Recommendation:** keep narrowly specified invariants; add diagnostics before adding more rejection rules. Record hole/digit frequencies, the 6×9 pair table, overlap count, and conflict counts by direction. If systematic bias appears, revise a named constraint and version the generator. Do not add an arbitrary correlation threshold late without measuring its feasibility and sample-size effects.

Other details to lock:

- Use one canonical number-target field. §5.1 names `numberTarget`/`numberLure`, while §5.2 stores `target`/`lure`. Prefer the latter for compatibility, with explicit comments; do not silently store inconsistent duplicates.
- Specify required `positionTarget`, `positionLure`, lag matches, and intended category on every dual stimulus.
- At N=1, lure lags are `{2}`; lag 0 is excluded. Target takes precedence over incidental adjacent-lag matches, as current `label()` does.
- Reject invalid alphabets, duplicate alphabet values, noninteger/negative counts, invalid band bounds, and impossible overlap intersections before generation.
- Define whether lock checks include warmup; the plan currently says all trials, so retain that unless deliberately revised.
- Define whether minimum conflict means at least two **in total**, as written, or one in each direction. Either is implementable; the latter improves directional coverage but is a new constraint requiring feasibility checks.
- Do not transfer identity's perfectly balanced hole bag to dual. If hole balance is desired, define a tolerable distribution and measure it rather than breaking match structure afterward.
- Store generator identity with the sequence result; a content hash must include task and N as promised, rather than simply copying the current `hash(sequence)` call.

The four PRNG suffixes and RNG draw order are part of deterministic replay. Encode them in the generator version contract and test exact output fixtures, not only same-call equality.

### R17 — Refine metric names, small-sample reporting, and statistical test expectations

**Priority: P2. Demonstrated numerical issue and interpretation risk.**

**Replace “two capacities” in D9 with “two stream performance/sensitivity estimates.”** A d′ value at a selected N is not itself a capacity estimate. The plan already avoids clinical norms and equivalence claims; use the same restraint in its central metric description.

**Call `dualAccuracy` “both-target hit rate” or clearly qualify it.** It is conditional on both streams being targets. Always pressing both controls gives this metric 100% while producing 42 FAs in each stream. It is not overall two-stream accuracy and must not be the headline score.

Report a count and denominator prominently, for example “Both-target trials: 4 of 5.” At D=4, one trial changes the percentage by 25 points; at D=8, by 12.5 points. Existing `wilson()` yields approximately **51.0%–100%** for 4/4 and **67.6%–100%** for 8/8. These are descriptive intervals under the helper's binomial model, not proof that temporally structured n-back trials meet every independence assumption.

**Correct the Phase B d′ expectation.** The proposed location-only strategy test says number d′ should be “near 0.” With the current log-linear correction and 18 targets/42 non-targets, a completely silent number stream has:

```text
corrected hit rate = 0.5 / 19
corrected FA rate  = 0.5 / 43
d′ = z(0.5 / 19) − z(0.5 / 43) ≈ +0.331274
```

Always pressing produces approximately **−0.331274**, while both strategies have balanced accuracy **0.5**. These values were reproduced using the current helper. Test exact expected counts, balanced accuracy, response flags, and finite corrected d′; do not alter the shared formula to force zero. “Near zero” is too vague for an assertion and misleading as a behavioral interpretation.

For no-response streams, keep the quality flag prominent even when corrected d′ is finite. Ensure generic averaging code does not turn a missing stream into a one-stream mean. Use explicit null/finite checks; zero is a valid value.

Finally, “six holes is slightly easier” is not established by the plan. Fewer locations reduce the spatial alphabet, but forced target/lure rates, visual layout, exposure, and stimulus modality also change difficulty. Rewrite as “six holes use a smaller spatial alphabet; relative difficulty has not been validated.”

The original Jaeggi paper describes eight spatial locations paired with auditory consonants, 500 ms presentation, and a 2,500 ms interval, unlike this proposed visual digit/position task with 2,000/750 ms timing. It supports distinguishing these protocols, not treating their scores as interchangeable. [Jaeggi et al., original methods](https://pmc.ncbi.nlm.nih.gov/articles/PMC2383929/).

### R18 — Teach all four actions and define how a player-paced trial ends

**Priority: P2. Demonstrated fixture omission.**

The §2 N=2 sequence correctly gives Location only, Number only, and Both. It has no **scored neither-match** example. Warmup does not teach correct withholding on a scored trial.

Append `(hole: 0, digit: 9)` as trial 5 to the supplied example. At N=2 it compares with trial 3 `(hole: 4, digit: 3)`, so both streams are non-targets. Keep the original five entries as a golden labeling fixture and use the extended sequence for complete tutorial coverage.

| Trial | Hole | Digit | Correct action |
| --- | --- | --- | --- |
| 0 | 2 | 7 | Memory fill |
| 1 | 5 | 3 | Memory fill |
| 2 | 2 | 1 | Location |
| 3 | 4 | 3 | Number |
| 4 | 2 | 1 | Both controls |
| 5 | 0 | 9 | Neither; finish example without either response |

A player-paced tutorial cannot infer intentional withholding from elapsed time. Specify a separate **Check answer/Next example** action that finalizes the current example without acting as a game response. The first Location/Number click must not advance immediately, because the player may still need the other control.

Recommended sequence: render the current and N-back hole/digit pair; let the player choose either/both/no controls; explicitly check the answer; explain each stream; advance. The “Next” control belongs only to tutorial navigation, never the scored response board. Reset response state on N or task changes.

Prepare actual 1-back and 3-back fixtures that cover all four scored actions too. “N-specific equivalent” is not enough without examples or tests. Teach that every appearance updates memory, including warmup, targets, and mistakes; compare N **appearances** ago rather than the last N successful responses.

With the updated unbounded requirement, also synthesize valid hole/digit examples for arbitrary N, including explicit neither, Location-only, Number-only, and both-target steps. A high-N tutorial should show the compared appearance and current appearance clearly while offering intervening history through a bounded or scrollable view. Do not render an arbitrarily large full history before checking resource costs. Any shortened view must label omitted appearances so it does not teach the wrong lag.

### R19 — Expand verification around behaviors that simple green paths miss

**Priority: P2. Coverage gap.**

The plan proposes a good foundation of quota banks, fake clocks, and complete journeys. Add the matrix in §6 below before release. The most valuable missing cases are:

- Multi-touch with one finger still held when the second arrives.
- Native keyboard activation versus global Space suppression.
- Response projection and one silent stream's quality flag.
- Pending conjunction trial with one or both accepted presses at interruption.
- Generation exhaustion as an application journey.
- Task-switching preferences, historical familiarity, and mixed legacy data.
- Adaptation streak-breaking and alternating weak streams.
- Exact identity replay/hash preservation, not merely passing quota tests.
- Worst-case feedback and all six occupied positions at small viewport sizes.

Existing browser solvers in [tests/browser.spec.ts](tests/browser.spec.ts), lines 13–23, observe only digits and press Space. Add a separate dual solver that reads the **visible hole index and digit**, derives equality from the observed history, and uses A/L or the response buttons. Do not let the solver read internal `positionTarget`/`target` flags; that would bypass much of the behavior under test.

The Pages workflow in [.github/workflows/pages.yml](.github/workflows/pages.yml) runs unit tests, formatting, and build, but no browser suite. The plan's release record is useful, yet a new dual layout/input regression can subsequently deploy without a browser check. Add a small deterministic browser gate on pull requests or before deployment, with slower viewport/device coverage separately. Also include formatting in the revised Phase F checklist.

Treat `tsconfig.json`'s `include: ["src"]` explicitly: the normal build type-checks application source, not the test files. If complex new typed fixtures need compilation guarantees, add a dedicated test typecheck configuration rather than assuming a Vitest run proves their types correct.

### R20 — Make N unbounded for both tasks, without losing task-specific protocols

**Priority: P1. User-directed scope amendment and cross-plan integration requirement.**

The unbounded plan proposes changing shared `N` to `number`, widening `label()` to include N and N±1, and removing identity's upper adaptation clamp. These are now prerequisites for both tasks. A dual implementation that retains `{1,2,3}` in its generator, level picker, tutorial, adaptation, or preference parser would violate the updated requirement.

**Shared type and runtime validation.** Use `Number.isSafeInteger(n) && n >= 1` for either task. TypeScript's `number` includes invalid inputs, so validate stored/configured N at application boundaries and again before allocation. Do not use a numeric maximum such as 3, 10, or 99 as a difficulty rule. Safe-integer overflow and device resource exhaustion need explicit error handling rather than silent clamping.

**Labeling must expand before dual generation.** Current `label()` at [sequence.ts](src/game/sequence.ts) scans only lags 1–4. At N=4 it misses lag-5 lures; at N≥5 it misses target matches. Applying that helper separately to digit and hole streams simply duplicates the problem. The unbounded plan's `max(n + 1, 4)` lag window preserves 1–3 labels while covering the high-N comparison rules.

However, implementing that window with a newly allocated `Array.from({length: maxLag})` for every appearance takes O((N + S) × N) work for S scored trials. At N near the plan's 100,000-total-trial resource guard, this implies roughly ten billion lag checks and can produce hundreds of millions of recorded lag matches. The trial-count guard alone does not bound time or label-storage cost sufficiently. This is an algorithmic consequence, not a benchmark result.

Choose and document a resource-aware labeling strategy before claiming broad high-N support. Options include preserving the full lag-recording semantics with occurrence indexing and an explicit output/work budget, or defining sparse diagnostic lag metadata in a separately versioned extension while computing target/lure equality directly. The latter would change the unbounded plan's requested full lag-window metadata and must be recorded as a plan amendment. Preserve existing 1–3 arrays and hashes in either case; do not silently truncate historical metadata.

**Generator feasibility is a separate check.** Keep the target/lure quotas, overlap band, six holes, nine digits, and N warmup appearances unless explicitly revising the protocol. Verify both streams at N=4, 5, 8, and 12. Include N greater than the 12 practice scored trials and greater than the 60 full-block scored trials in a smaller diagnostic bank; neither inequality should be treated as an invalid task by accident. Do not reuse the existing probe's hard-coded 1–3 bank as the complete acceptance test.

**Adaptation remains per task.** Both tasks can cross 3→4 and continue, but their qualification rules remain different. Preserve the same-N requirement in each streak: five new perfect scored rounds starting at N=1 with no prior history play at levels **1, 1, 2, 2, 3**. They do not play at 1, 2, 3, 4, 5. The unbounded plan's claim of that faster five-round climb conflicts with its retained two-round, same-N qualification rule. Update that example, rather than weakening either task's adaptation rule to match it. Record identity rule `1.1` as proposed; select an explicit version for the final unbounded dual rule instead of keeping metadata that promises a capped rule.

**UI and preferences must share capability, not state.** A reusable stepper can serve both tasks, with separate remembered levels and task-specific instructions. Load an identity preference of N=7 as 7; choosing dual should use its own remembered N, which may also exceed 3. Derive progress level options from the selected task's stored blocks rather than a hard-coded trio or a combined identity/dual list. When changing task, choose a valid level/filter without rewriting the other task's preference.

**Prepare before allocating or rendering.** The unbounded plan's guard in `generate()` does not protect a tutorial that constructs N entries first, nor does it make the effect-constructor failure in R06 catchable by `App.launch()`. Apply resource preflight to tutorials, label storage, sequence construction, and export preparation. If a device cannot prepare the requested block, explain that preparation failed and allow changing the level or retrying; do not describe a resource limit as a cognitive maximum or silently substitute another N. The same preparation boundary should serve both tasks.

**Merge and version policy.** Land the shared N/label contract with 1–3 golden fixtures, then integrate dual generation and task-specific UI/adaptation against it. A larger permitted N alone does not require invalidating old 1–3 identity sequence fingerprints if their content and relevant semantics are unchanged. Keep adaptation-rule versioning separate from per-block sequence/scoring versions, and preserve mixed legacy identity/new high-N identity/dual history. Identity can retain its existing session schema where its record shape remains unchanged; dual's new payload still requires the export/reader work in R13.

**Required additional evidence:** generators and labels at high N for both tasks; 3→4 and 4→5 adaptation cases for both tasks; high-N practice and a single-level assessment route; task-isolated level preferences and progress; unchanged named 1→2→3 batteries; and controlled resource/preparation failures without hangs. None of these new high-N checks was claimed as executed in this review.

## 4. Proposed type and state contracts

These are implementation sketches to make the review concrete. They are **not** a patch to paste wholesale into the existing repository. They assume the plan's new task fields and must be integrated with the constructors/readers discussed above.

### 4.1 Keep one-stream summaries strict

The recommended distinction is between a true single-stream `Summary` and dual display aggregates. Required dual fields prevent partially initialized blocks from silently rendering as valid data.

```ts
// Existing types are imported under aliases during the transition.
type N = number; // positive safe integer, validated at runtime for both tasks
type Task = "identity" | "dual";
type Stream = "position" | "number";

function isN(value: unknown): value is N {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

type IdentityConfig = Omit<ExistingConfig, "input" | "n"> & {
  n: N;
  task: "identity";
  input: "fixed" | "aimed";
};

type DualConfig = Omit<ExistingConfig, "input" | "n"> & {
  n: N;
  task: "dual";
  input: "dual";
  // Existing targets/lures continue to describe the number stream.
  positionTargets: number;
  positionLures: number;
  dualTargetBand: readonly [number, number];
  minConflict: number;
};

type DualStimulus = ExistingStimulus & {
  positionTarget: boolean;
  positionLure: boolean;
  positionLagMatches: number[];
  positionIntended: string;
};

type DualTrial = Omit<ExistingTrial, "stimulus"> & {
  stimulus: DualStimulus;
  // Legacy slots remain present but are not dual outcomes.
  response: null;
  rt: null;
  code: "pending";
  positionResponse: Press | null;
  numberResponse: Press | null;
  positionRt: number | null;
  numberRt: number | null;
  positionCode: Code;
  numberCode: Code;
};

interface DualDisplaySummary {
  scoredTrials: number;
  meanBalancedAccuracy: number | null;
  meanDPrime: number | null;
  flags: string[]; // explicitly aggregated block-level display flags
}

type IdentityBlock = Omit<ExistingBlock, "config"> & {
  task: "identity";
  config: IdentityConfig;
};

type DualBlock = Omit<ExistingBlock,
  "config" | "sequence" | "trials" | "summary"
> & {
  task: "dual";
  config: DualConfig;
  sequence: DualStimulus[];
  trials: DualTrial[];
  summary: DualDisplaySummary;
  positionSummary: Summary;
  numberSummary: Summary;
  dualTargets: number;
  dualHits: number;
  dualPartial: number;
  dualMiss: number;
  dualAccuracy: number | null;
  dualInterval: [number, number] | null;
};

type GameBlock = IdentityBlock | DualBlock;
```

This sketch chooses an explicit block-level discriminator in addition to `config.task`, matching D1's “session and block records” wording. Central constructors and load validation must enforce equality. An alternative with only `config.task` is also workable if typed guards narrow entire blocks; choose one convention and remove ambiguity from the plan. Do not let different modules invent different task locations.

The legacy `code: "pending"` in this additive sketch is deliberately not the lifecycle indicator for dual. The dual codes and offset determine finalization. A separate internal dual trial type without legacy slots is cleaner if the team accepts a union at the block/trial boundary. Either approach is preferable to storing a number-only aggregate and accidentally feeding it to identity consumers.

### 4.2 Make protocol construction explicit

Keep the existing identity factory callable by current code/tests. A separate dual factory avoids another ambiguous positional parameter and forces valid task/input combinations.

```ts
function dualProtocol(
  n: N,
  mode: Mode,
  requestedWindowMs = 2000,
): DualConfig {
  if (!isN(n)) throw new Error("N must be a positive safe integer");
  const practice = mode === "practice";
  return {
    task: "dual",
    input: "dual",
    n,
    mode,
    scoredTrials: practice ? 12 : 60,
    targets: practice ? 6 : 18,
    lures: practice ? 1 : 5,
    positionTargets: practice ? 6 : 18,
    positionLures: practice ? 1 : 5,
    dualTargetBand: practice ? [1, 3] : [4, 8],
    minConflict: practice ? 0 : 2,
    windowMs: mode === "assessment"
      ? 2000
      : practice
        ? Math.max(2000, requestedWindowMs)
        : requestedWindowMs,
    isiMs: 750,
  };
}
```

Validate N and exposure at the external request boundary; TypeScript annotations do not validate deserialized data. This snippet adopts the R07 recommendation of 1–3 practice overlap and retains the plan's total-conflict rule. Changing to one conflict in each direction would require different fields/validation.

Every route—home training, assessment modal, guide practice, retries, battery transitions, and adaptation transitions—must obtain its protocol through the task-specific factory. `config.input === "dual"` and `config.task === "dual"` must agree.

### 4.3 Preserve the temporal state machine

| Event/state | Required behavior |
| --- | --- |
| Preparation | Generate/validate sequence; no active response window. |
| Countdown | Log received response inputs as outside-window; no trial is scored. |
| Visible onset | Create trial with both responses/RTs null and both codes pending. |
| First valid input on a stream | Store normalized event and RT for that stream only; acknowledge only that stream. |
| Another input on the same stream | Log duplicate; do not modify the accepted response. |
| Input on the other stream | Accept independently if still inside the window. |
| Hide | Set offset; classify both streams once; render blank feedback. |
| Blank | No responses accepted; schedule stays input-independent. |
| Interrupt during visible | Preserve both raw response slots; leave both codes pending; no new scored outcomes. |
| Interrupt during blank | Preserve the already finalized current trial. |
| Complete | Finalize summaries from trials, attach quality data, finish once. |

Keep the current scheduled timing semantics precise: `deadline = actual onset + exposure`, while next planned onset is based on the block schedule. Consequently, an onset delay can shorten the realized blank interval even though `isiMs` is 750. If preserving identity timing, document that fact instead of implying every actual blank is exactly 750 ms. The dual feature should not silently redesign this clock.

Validate stream membership at runtime (`position`/`number` only); a TypeScript `stream?: Stream` annotation cannot prevent malformed imported/synthetic events. Never implement “any other string means number.” Preserve the current event-time/handler-time boundary checks before accepting either stream.

### 4.4 Aggregate quality without losing stream identity

```ts
function dualFlags(
  position: Summary,
  number: Summary,
  frames: { at: number; gap: number }[],
): string[] {
  return [
    ...position.flags.map((flag) => `Location: ${flag}`),
    ...number.flags.map((flag) => `Number: ${flag}`),
    ...(frames.length ? ["Long frames observed"] : []),
  ];
}

function passedDualPractice(b: DualBlock): boolean {
  const passes = (s: Summary) =>
    s.scored === 12 && s.targets === 6 && s.nonTargets === 6 &&
    s.hits >= 5 && s.fa <= 1 && s.flags.length === 0;
  return b.config.mode === "practice" &&
    b.status === "completed" &&
    b.frames.length === 0 &&
    passes(b.positionSummary) && passes(b.numberSummary);
}
```

Counts are worth checking on both summaries rather than inventing an ambiguous combined `scored`. Route identity practice through the unchanged identity gate. If quality flags later distinguish informational from disqualifying observations, replace the blanket flag check with a named eligibility policy and version it.

## 5. Recommended decisions for the revised plan

These are review recommendations, not evidence that a product owner has approved a revised protocol.

| Decision | Recommendation |
| --- | --- |
| D1: opt-in task | Retain. Normalize legacy records as identity and explicitly isolate all consumers. |
| D2: location + number | Retain; describe construction as separate streams with joint constraints. |
| D3: two controls | Retain; support overlapping touch contacts and native focused-button activation. |
| D4: excluded gestures/OR mode | Retain. |
| D5: six stimulus holes | Retain for v1; remove unsupported “slightly easier” wording. |
| D6: response mounds in row three | Retain, with a compact response row and distinct control appearance/semantics. |
| D7: timing | Retain; document planned versus actual onset/blank semantics. |
| D8: no hats/aimed dual | Retain and enforce through factories/types, not UI labels alone. |
| D9: two capacities | Amend to two stream sensitivity/performance estimates plus both-target hit rate. |
| D10: identity compatibility | Retain; specify the fingerprint/version policy and golden fixtures. |
| D11: N range and defaults | **Override the draft ceiling:** both tasks support positive safe integer N with no gameplay maximum. Teaching/first training N=1; single-level dual assessment defaults to N=2; named battery remains 1→2→3; practice uses upcoming N. |
| D12: adaptation | Prefer fixed-N dual training + assessment for v1; adaptation may follow once isolation and user performance are verified. |
| Step-down, if shipped | Same stream weak on both consecutive eligible blocks; interruptions/flags break the streak. |
| Arrow aliases | Include as an accessible alternative if fully tested and correctly scoped. |
| Practice overlap | Change 1–4 to 1–3 unless explicitly removing practice's alignment cap. |
| Naming | Retain “Recall Garden Dual”; label Location/Number consistently in UI and explain `position` as the stored identifier. |
| Schema | Keep IndexedDB store/version; add a documented v2 data/export schema and normalized readers. |

“LOCK” should mean stable after the protocol is agreed and released. Before implementation, contradictions must be resolvable without treating the draft as immutable. Use a plan change log and explicit decision table so the developer can tell which recommended amendments were adopted.

## 6. Required verification matrix

Each row describes behavior worth testing; this is not a request to create a large collection of tests that merely repeat implementation details.

| Area | Required checks |
| --- | --- |
| Sequence truth | Recompute equality and adjacent-lag lures independently from raw digit/hole arrays for N=1/2/3/4/5/8/12; target precedence; warmup exclusion; legal alphabet; no four identical consecutive symbols; diagnostic cases with N greater than scored length. |
| Sequence quotas | All four joint cells; exact 18/18 and 5/5 training counts; exact 6/6 and 1/1 practice counts; agreed overlap band; total or directional conflicts as specified. |
| Seed replay | Preserve the baseline 200 training/30 practice seeds at N=1/2/3; extend both tasks to at least 200 training seeds at N=4/5 and 30 at N=8/12, plus 30 practice seeds at those levels; exact chosen golden arrays/hashes; seed `184` for N=1. |
| Invalid requests | Negative/fractional counts, impossible bands, impossible lures, duplicate/empty alphabets, unsupported task/input combinations; early explicit rejection. |
| Generation reliability | Budget exhaustion handled by application; retry/exit available; slow preparation does not advance countdown; stale preparation result discarded. |
| Independent input | A then L, L then A, same-time timestamps, mixed keyboard/pointer, duplicate one stream then valid other stream, held A while tapping L. |
| Pointer policy | Two concurrent touch contacts; right/middle mouse ignored; two touches on same stream duplicate; pointerdown plus compatibility click creates no second accepted response. |
| Keyboard policy | Repeat keydowns, editable/contenteditable targets, focus on Stop, focus on each response button, Space in game region, Ctrl/Meta/Alt combinations, aliases, Q/W/E/S/D inert in dual. |
| Window boundaries | Event exactly at onset; just before deadline; exactly deadline; handler at/after deadline with earlier event time; before-onset event; blank/countdown input; timestamp fallback metadata. |
| Scheduling | Zero, one, and two accepted responses produce identical offset/planned-onset schedules; finalize once; duplicate presses never hide the stimulus. |
| Stream scoring | Complete target/non-target response truth table; warmup and pending excluded; hit-only RT distributions; location/number RTs remain independent; flags use projected response objects. |
| Strategies | Perfect play; silence; always both; number-only; location-only; OR strategy; AND-only strategy; both-target partials. Assert exact counts and eligibility, not just one high-level score. |
| Interruption | Interrupt visible after no/one/two responses; interrupt blank; Stop/blur/hidden/resize; terminal engine; pending dual target absent from conjunction denominator. |
| Practice | Pass boundaries 5 hits/1 FA per stream; 4 hits fails; 2 FAs fails; one stream silent fails; wrong trial counts fail; long frames fail. |
| Task isolation | Identity history does not grant dual familiarity; dual practice does not waive identity practice; new sessions always practice; task-specific N preferences remain independent. |
| Adaptation if enabled | Both streams strong twice; one weak twice; alternating weak streams; thresholds at 16/15 hits, 6/7 FAs, 10/11 hits, 12/13 FAs; floor 1 and no upper difficulty clamp; 3→4, 4→5, and 7→8 for both tasks; flagged/interrupted/different-N/different-hash blocks break streaks. |
| Assessment | Single N including N≥4 for both tasks, plus unchanged named 1→2→3 batteries; dual input preserved even after identity aimed preference; exposure fixed at 2,000; no correctness in text/color/audio/announcements; practice at each required N. |
| Persistence | Mixed old/new sessions; missing task normalization; explicit unsupported task handling; interrupted dual reload; failed storage with export; delete all data/preferences. |
| Exports | Parse CSV and JSON; correct task/schema/versions; old performance columns empty on dual rows; stream counts, denominators, flags, raw responses, intended labels, conjunction counts present. |
| Progress/results | Two labeled stream metrics and denominator for both-target hit rate; no identity/dual chart mixing; task filter resets incompatible fingerprint; no “Tap mole” labels for dual. |
| Tutorial | N=1/2/3 and synthesized N≥4 examples with all four actions; both clicks before finalization; explicit neither action via tutorial navigation; task/N changes reset state; guide starts correct task; high-N history stays readable without unbounded rendering. |
| Layout | All 13 viewports; all six occupied positions; both controls ≥ agreed dimensions; digit ≥20 px; no page scroll at standard scale; feedback/focus/acknowledgements fit and do not change board geometry. |
| Accessibility/device | Named controls, focus order and restoration, disable/remap/scoped shortcuts, non-color acknowledgement, enlarged text/zoom, touch device pass; no unsupported assertion of screen-reader or Safari certification. |
| Identity regression | Preserve scoring, fixed/aimed controls, 1–3 sequence/hash goldens, saved-data loading, and the named battery; intentionally replace cap-specific tests with unbounded adaptation/selection tests; preserve identity's new high-N behavior when dual is merged. |

Proposed examples for high-value unit tests, assuming the future fixture helpers exist:

```ts
it("a silent number stream does not suppress location responses", () => {
  const b = dualFixture({ strategy: "location-only" });
  expect(b.positionSummary.hits).toBe(18);
  expect(b.positionSummary.flags).toEqual([]);
  expect(b.numberSummary.hits).toBe(0);
  expect(b.numberSummary.misses).toBe(18);
  expect(b.numberSummary.cr).toBe(42);
  expect(b.numberSummary.balancedAccuracy).toBe(0.5);
  expect(b.numberSummary.dPrime).toBeCloseTo(0.331274283, 6);
  expect(b.numberSummary.flags).toContain("No scored responses");
});

it("an unfinished both-target trial contributes no conjunction outcome", () => {
  const t = pendingDualTarget({ positionPressed: true, numberPressed: true });
  expect(summarizeConjunction([t])).toMatchObject({
    dualTargets: 0, dualHits: 0, dualPartial: 0, dualMiss: 0,
    dualAccuracy: null,
  });
});
```

These illustrate intended behavior; fixture helpers are proposed and not present in the current repository.

## 7. Revised delivery sequence

The plan's phased approach is useful. Add a precise design/compatibility step and a preparation failure path, and avoid postponing all type/export integration until the end.

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 — Resolve contracts | Reconcile both plans with unbounded N for both tasks; adopt/amend decisions in §5; settle types, field naming, practice band, input semantics, retry/resource semantics, schema, and fingerprint policy. | One internally consistent revised contract with examples and acceptance criteria. |
| A — Pure generation | Shared high-N type/label contract and resource policy; dual config validator/generator; immutable versions; raw-value oracle; retained valid-stream construction. | Both-task high-N seed banks, failure/attempt diagnostics, unchanged legacy 1–3 identity replay. |
| B — Scoring and data model | Required dual trial/block types; fixed-semantic classification adapter; full response projection; conjunction finalization; quality aggregation; v1 reader compatibility. | Strategy, pending-trial, null/zero, and legacy-record fixtures. |
| C — Engine and preparation | Dispatch by task; two latches; per-stream RT; unchanged clock; preparation/retry boundary. | Fake-clock tests and user-visible handling of forced preparation failure. |
| D — Minimal end-to-end path | One fixed-N dual practice → scored block → results → save/export flow. | Correct raw/summary data after reload and parsed CSV/JSON. |
| E — UI/tutorial/layout | Response mounds, touch and keyboard policy, four-action examples, feedback, focus, all viewport sizes. | Browser journey and full dual viewport matrix; targeted real-device check. |
| F — Remaining session features | Task defaults, guide entry, assessment/battery, progress/history, task-scoped familiarity; adaptation only if explicitly included. | Isolation matrix and assessment tests; adaptation boundaries if shipped. |
| G — Release verification | Unit tests, formatting, build, identity and dual browser suites; browser CI gate; README and appended Dual verification record. | Actual test commands/results and explicitly recorded device limits. |

Prefer a separate `dualSequence.ts` and `TutorialDual.tsx` if they keep the identity implementation readable. A small shared response-control component may help, but avoid a general-purpose multi-stream framework for a fixed two-stream feature. The type boundaries should make invalid states difficult without making every existing identity helper understand dual scoring.

## 8. File-specific implementation checklist

| File | Specific additions or review points |
| --- | --- |
| [src/game/types.ts](src/game/types.ts) | Shared positive-safe-integer N contract with no task ceiling; task/config discrimination, required dual fields, separate dual display summary, event reason/control metadata, persisted schema definitions. |
| [src/game/protocol.ts](src/game/protocol.ts) | Dual factory; task-aware immutable versions; canonical hashes; identity compatibility; practice gate; adaptation dispatch and eligibility if included. |
| [src/game/sequence.ts](src/game/sequence.ts) | Implement the shared high-N label/resource contract while preserving identity's 1–3 RNG output and golden hashes; retain explicit task-specific generation policies. |
| Proposed `src/game/dualSequence.ts` | Validated candidate construction, retry budgets, independent labels, joint invariants, typed generation result, deterministic diagnostics. |
| [src/game/scoring.ts](src/game/scoring.ts) | Preserve formulas; add explicit projections and dual conjunction summary, or place dual adapters in a separate module. |
| [src/game/engine.ts](src/game/engine.ts) | Task dispatch at generation/initialization/press/hide/complete/interrupt; two response slots; no changes to the temporal schedule. |
| [src/components/Play.tsx](src/components/Play.tsx) | Constructor failure boundary, task-aware input routing, concurrent touch support, actual response-control hitboxes, two acknowledgements, correct audio/feedback gating. |
| [src/components/Tutorial.tsx](src/components/Tutorial.tsx) or proposed `TutorialDual.tsx` | Explicit fixtures for every N, separate check/advance action, no timer for reading, independent response selection, neither/both examples. |
| [src/components/Results.tsx](src/components/Results.tsx) | Task-specific rendering/chart metric selection; denominator/flags; input labels; history naming; filter reset; legacy normalized data. |
| [src/components/Art.tsx](src/components/Art.tsx) | Only change if a labeled response-mound primitive is actually useful; preserve digit visibility and a clear difference between stimulus and control. |
| [src/App.tsx](src/App.tsx) | Explicit task in all start/launch/retry/battery/guide routes; separate N preferences; preserved mandatory practice; preparation failure stage; task-aware continuation and break copy. |
| [src/data/storage.ts](src/data/storage.ts) | Normalized validated readers; schema-v2 envelope; explicit per-task CSV mapping; preserve snapshots/queue/recovery/deletion behavior. |
| [src/styles.css](src/styles.css) | Compact response row; dual selectors; stable feedback; short-landscape collision checks; min control/digit size; visual distinction and focus affordance. |
| [tests/game.test.ts](tests/game.test.ts), [tests/engine.test.ts](tests/engine.test.ts) | Contract and boundary tests above; preferably separate dual suites if size warrants. |
| [tests/browser.spec.ts](tests/browser.spec.ts), [tests/usability.spec.ts](tests/usability.spec.ts) | Observed-history dual solver; multi-touch and focus paths; all task journeys; explicit six-stimulus/two-control geometry. |
| [.github/workflows/pages.yml](.github/workflows/pages.yml) or new check workflow | Browser smoke gate; retain unit/format/build checks. |
| [README.md](README.md), [VERIFICATION.md](VERIFICATION.md) | Accurate task/method naming, controls and Space focus exception, metric interpretation, real verification outcomes and known device limits. |

Keep [TAG-ME-Again-Game-Specification.md](TAG-ME-Again-Game-Specification.md) unchanged as the identity reconstruction reference. The dual plan should become the revised, explicit contract for the optional task.

## 9. Release recommendation

Proceed with the dual feature after revising the P1 contracts: response projection, classifier semantics, dual result types, concurrent touch, generator construction/failure handling, practice overlap, fingerprint compatibility, task isolation, and interrupted conjunction scoring.

The final N requirement applies to **both tasks**: no gameplay ceiling at 3 or any other chosen difficulty. Incorporate R20 before treating the original dual plan or the identity-only scope of the unbounded plan as implementation authority.

The most useful first implementation milestone is a **fixed-N dual practice and scored block that saves and exports two correct stream summaries**, with the identity golden fixtures still unchanged under the chosen compatibility policy. Once that works end to end, add the complete tutorial, task navigation, assessment battery, viewport verification, and any explicitly approved adaptation behavior.

This is a sound optional game concept. Its remaining work is primarily to turn broad intentions into precise, testable contracts at the boundaries where the existing application assumes one stream, one response, and one summary.
