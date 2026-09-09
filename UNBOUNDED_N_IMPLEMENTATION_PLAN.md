# Recall Garden — unbounded N implementation plan

Prepared 9 September 2026, from the current identity n-back codebase (`IMPLEMENTATION_PLAN.md`, `src/game/*`, `src/App.tsx`, `src/components/Tutorial.tsx`, `src/components/Results.tsx`) and the product request: **there must be no N-back ceiling**.

**Plan version 1.3** — implement 1.3, not 1.2. Fixes leftover contradictions after the dual-plan review (see §12.2). Identity unbounded-N ships on branch `unbounded-n` / worktree `/home/ltoime/tag-ME-unbounded-n`. Dual application code does not land on this branch.

**Plan version 1.2** — dual-scope erratum only (see §12.1). Superseded where 1.3 disagrees.

**Plan version 1.1** — incorporates a same-day self-review (see §12). Implement identity from 1.3.

This is a **review-and-build plan**. Do not change code until this plan is accepted. It does not claim that 4-back and above are equivalent to published TAG-ME Again, which only studied 1-, 2-, and 3-back.

---

## 0. Product verdict

Today’s identity task is already N-general in the play loop, classifier, and scoring. The ceiling is a **protocol and UI bound**, not an engine rewrite.

The load-bearing request:

> Training must be able to rise past 3-back (4, 5, …) with **no maximum N**.

That means:

- Adaptation must raise N by 1 with **no `Math.min(3, …)`**.
- The player must be able to start at any integer N ≥ 1, not only `{1,2,3}`.
- The generator, labels, tutorial, practice gate, prefs, and progress filter must all accept that N.
- Floor stays **1**. There is a minimum. There is no maximum.

The 1/2/3 **assessment battery** is a separate measurement protocol (Hu / TAG-ME Again levels). It is not a training ceiling. This plan keeps that battery as a named 1→2→3 sweep. Single-level assessment uses whatever N is selected, with no cap.

**Build venue:** implement in the existing worktree `/home/ltoime/tag-ME-unbounded-n` on branch `unbounded-n`. Do not implement this in the primary `/home/ltoime/tag-ME` checkout.

**Out of scope for this branch:** Recall Garden Dual **application code**. Dual is a separate worktree (`../tag-ME-dual`, branch `dual-nback`) and [DUAL_NBACK_IMPLEMENTATION_PLAN.md](DUAL_NBACK_IMPLEMENTATION_PLAN.md) v1.1. Both tasks share the same N contract (positive safe integer, no gameplay ceiling). Do not reintroduce a dual `{1,2,3}` cap, and do not mix dual files into `unbounded-n`. Dual is **not** already implemented in that worktree.

---

## 1. Locked product decisions

Each row is **LOCK** (implement as written; bump the named version if you reopen it) or **FLAG** (reviewer may override before coding).

| ID | Decision | Status |
| --- | --- | --- |
| U1 | Identity N is any **positive safe integer**. Type `N` becomes `number`. Runtime guard: `Number.isSafeInteger(n) && n >= 1`. | LOCK |
| U2 | **No difficulty maximum** in adaptation, starting-level UI, prefs sanitiser, generator allow-list, or tutorial switcher. Floor remains 1. U20/U22 are resource guards (allocation, label work, tutorial/session preflight), not difficulty caps. | LOCK (1.3: U20 is not allocation-only) |
| U3 | Adaptation still changes N by **exactly one** between qualifying training blocks. Same hit/FA thresholds as today. Only the upper clamp is removed. | LOCK |
| U4 | Adaptation rule version becomes **`1.1`**. `from` / `to` / `reason` / block IDs stay. Old `1.0` records remain readable. | LOCK |
| U5 | Do **not** bump `VERSIONS.generator` if 1–3-back digits, holes, target flags, lure flags, and `lagMatches` for lags 1–4 stay bit-identical. Progress charts key off `configHash`, which includes versions. | LOCK |
| U6 | Target / lure **quotas stay** 18/5 of 60 (practice 6/1 of 12). Digit alphabet 1–9. Six holes. Exposure and ISI unchanged. | LOCK |
| U7 | Memory-fill remains **exactly N** leading trials. A 7-back block is 7 fill + 60 scored (or 12 practice). Session-length estimates already use `60 + n`. | LOCK |
| U8 | Practice gate is unchanged. Every session still requires a passed practice at that N before scored play. Tutorial is skipped only via existing `knownLevel` (prior saved pass at that N+input). Mid-session 3→4 always shows the tutorial because `continueSession` checks this session’s `verified` only. | LOCK |
| U9 | Home starting control is a **stepper** (− / current N-back / +), not an infinite row of buttons and not a `{1,2,3}` trio. Decrease disabled at 1. Increase never disables. | LOCK |
| U10 | Tutorial level switcher uses the **same stepper**. Worked examples exist for every N (keep the golden 1/2/3 sequences; synthesise for N ≥ 4). | LOCK |
| U11 | Assessment option **“All three levels”** remains a fixed 1-back → 2-back → 3-back battery. Copy may still say that. This is the published-style instrument, not a training cap. | LOCK |
| U12 | Assessment option **“One level”** uses `prefs.n` with **no cap** (4-back assessment is allowed). | LOCK |
| U13 | Progress “Level” filter lists **N values that exist in saved blocks**, sorted, falling back to `[1]` when empty. Do not hard-code `{1,2,3}` as the only options. | LOCK |
| U14 | Scoring, timing engine, interruption rules, aimed vs fixed input, and storage schema version stay as they are. `schemaVersion` stays `1`. Stored `config.n` is already a JSON number. | LOCK |
| U15 | Pathological N (unsafe integers, non-integers, N &lt; 1) **throw** in `generate()`. That is input validation, not a gameplay ceiling. Do not add a silent max such as 10 or 99. | LOCK |
| U16 | Decorative home mole shirt **displays `n` as text**, including two-digit N. Shrink the shirt font if `n >= 10`. Do **not** map N onto `{1…9}` with modulo — that makes 10-back look like 1-back. Real trial stimuli remain digits 1–9. | LOCK (changed in 1.1) |
| U17 | README marketing claims of “validated 4-back”, and changing the assessment battery to `1..N`, remain **out of scope** here. Dual **code** stays off this branch. Dual **N** is no longer capped at 3; that contract lives in dual plan v1.1 D11/R20. | LOCK (1.2: dual ceiling withdrawn) |
| U18 | Tutorial digit strip stays **one row**. Use `overflow-x: auto` and `flex-wrap: nowrap` (optionally slightly narrower cells). Do **not** wrap: wrap puts “N ago” and “Now” on different rows and breaks the timeline. 4-back is already 5 cells ≈ 368 px, which overflows a 320 px home. | LOCK (changed in 1.1; was FLAG wrap) |
| U19 | Stepper is **buttons only** in v1 (no typed `<input type="number">`). Starting 3-back costs two taps from the default of 1 (was one tap). Accept that regression. | LOCK (was FLAG) |
| U20 | Resource guard, not a difficulty cap: `generate()` throws if `n + scoredTrials > 100_000` **before** allocating arrays. Also throw if estimated label work `max(n + 1, 4) * (n + scoredTrials) > 10_000_000` (R20; shared with dual plan §2). Corrupted prefs with `n = 1e12` must not freeze the tab. Adaptation will never approach this. | LOCK (1.2: added label-work budget) |
| U21 | Existing CSS `.level-options button.chosen` will **not** style a non-button centre. Restyle as `.level-options .chosen`. Centre has `aria-live="polite"`. | LOCK (added in 1.1) |
| U22 | Apply U20 **before** allocating tutorial examples or mounting `Play`. `generate()` in the engine constructor is too late (uncaught in `App.launch()`). Shared helper, e.g. `resourceOk(n, scoredTrials)`. On failure: visible error, Retry/change level/Finish; do not freeze the tab or silently substitute another N. | LOCK (added in 1.3) |

---

## 2. Current inventory (what actually caps N)

### 2.1 Type and protocol

| Location | Today | Required |
| --- | --- | --- |
| `src/game/types.ts` `export type N` | `1 \| 2 \| 3` | `number` |
| `src/game/sequence.ts` `generate()` | `![1, 2, 3].includes(n)` | `isN(n)` plus U20 (`n + scoredTrials ≤ 100_000` and label-work budget) |
| `src/game/sequence.ts` `label()` | `lagMatches = [1, 2, 3, 4]` | lags `1 .. max(n + 1, 4)` — see §3 |
| `src/game/protocol.ts` `adapt()` | `Math.min(3, n + 1)` | `to = n + 1` |
| `adapt()` success copy | “highest level” when `min(3, n+1) === n` | that branch dies; always “Ready for the next level.” when raising |
| `adapt()` `version` | `"1.0"` | `"1.1"` |
| `App.tsx` prefs load | `[1, 2, 3].includes(p.n) ? p.n : 1` | `isN(p.n) ? p.n : 1` |

### 2.2 UI and tests

| Location | Today |
| --- | --- |
| `App.tsx` home starting level | `([1, 2, 3] as N[]).map` three buttons |
| `Tutorial.tsx` example switcher | same trio; `else` sequence is 3-back |
| `Results.tsx` progress filter | `{[1, 2, 3].map` |
| `App.tsx` assessment battery copy | “1-, 2-, and 3-back” — **keep** (U11) |
| `tests/game.test.ts` | loops `[1, 2, 3]`; `adapt(..., 3).to` expects `3` |
| `tests/browser.spec.ts` | clicks named `3-back` button; battery loop `[1, 2, 3]` |
| `tests/usability.spec.ts` | `.level-options button`.nth(2) is 3-back |

### 2.3 What already works for any N

- `classify()` / `summarize()` — use `stimulus.target`, not a 1–3 union.
- `GameEngine` — schedules `sequence.length === n + scoredTrials`.
- Practice pass rule — counts, not N.
- Session `config.n`, block `config.n`, `configHash` (includes `n`).
- Break-screen “Continue · {n}-back” and assessment `currentN + 1`.
- Warmup exclusion `i < n`.
- `Play.tsx` heading, progress, and “N turns ago” copy (already parametric).
- Home session-length estimate: already `blocks * (60 + prefs.n) * (windowMs + 750)`.

---

## 3. Sequence generator and labels

### 3.1 Why the lag window is the only real engine bug

```ts
const lagMatches = [1, 2, 3, 4].filter((l) => i >= l && digits[i - l] === d);
const target = !warmup && lagMatches.includes(n);
lure = !warmup && !target && [n - 1, n + 1].some((l) => l > 0 && lagMatches.includes(l));
```

Placement already copies lag N and adjacent lags N−1 / N+1. Labelling is what is short:

| N | Target lag | Lure lags | Today’s `[1,2,3,4]` |
| --- | --- | --- | --- |
| 1 | 1 | 2 | OK |
| 2 | 2 | 1, 3 | OK |
| 3 | 3 | 2, 4 | OK |
| 4 | 4 | 3, 5 | **lag-5 lures never labelled** → post-hoc lure count often fails |
| 5 | 5 | 4, 6 | **targets never labelled** — hard stop |

### 3.2 Required `label()` change

Scan lags `1 … max(n + 1, 4)`:

```ts
const maxLag = Math.max(n + 1, 4);
const lagMatches = Array.from({ length: maxLag }, (_, i) => i + 1).filter(
  (l) => i >= l && digits[i - l] === d,
);
```

Why `max(n + 1, 4)` rather than “all lags 1..i”:

- For N ≤ 3, `max(n+1, 4) === 4`, so stored `lagMatches` stay identical to generator 1.0.
- `sequenceHash` and replay equality for existing 1/2/3 seeds stay stable.
- `VERSIONS.generator` can remain `"1.0"` (U5).
- For N ≥ 4, the window grows just far enough for target N and lure N+1.

Do **not** scan every lag through `i` in this change. Extra lag-5+ entries on 1-back trials would change hashes for old seeds.

Lure **definition** stays adjacent-only: `[n-1, n+1]` with `l > 0`. That is the protocol, independent of how large N is.

### 3.3 `generate()` validation

Replace `![1, 2, 3].includes(n)` with:

```ts
if (
  !isN(n) ||
  ![scoredTrials, targets, lures].every(Number.isInteger) ||
  scoredTrials < 1 ||
  targets < 0 ||
  lures < 0 ||
  targets + lures > scoredTrials ||
  n + scoredTrials > 100_000 ||
  Math.max(n + 1, 4) * (n + scoredTrials) > 10_000_000
) throw new Error("Invalid sequence configuration");
```

Throw **before** `Array.from` / retry loops. `N > scoredTrials` is **valid** (e.g. 15-back practice is 15 fill + 12 scored). Do not add `n < scoredTrials` as a hidden sanity check.

Export a shared guard (suggested home: `src/game/types.ts` or `protocol.ts`):

```ts
export function isN(value: unknown): value is N {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

export function resourceOk(n: number, scoredTrials: number): boolean {
  return (
    isN(n) &&
    Number.isInteger(scoredTrials) &&
    scoredTrials >= 1 &&
    n + scoredTrials <= 100_000 &&
    Math.max(n + 1, 4) * (n + scoredTrials) <= 10_000_000
  );
}
```

Use `isN` in prefs loading and any UI parse path. Use `resourceOk` in `generate()`, session start, and `exampleSequence` (for the tutorial, pass `scoredTrials = n + 3` or the actual example length).

Retry budget (4000) and four-in-a-row rejection stay. First scored trial (`i === n`) has no lag N+1 yet; lures there use only N−1 when N &gt; 1. Same as today for 2- and 3-back.

### 3.4 Feasibility at high N

Quotas do not depend on N. Constraints remain: 9 digits, copy-at-lag-N, exclude N and adjacent for non-targets, no four identical consecutive digits.

Expected: N = 4, 5, 8, 12 generate reliably in the existing retry loop. Also generate at **N greater than scored length** (practice N=15 with 12 scored; a small diagnostic bank at training N=70). Verification must prove that empirically (see §8), not assume it.

If a seed cannot satisfy quotas, keep throwing *Could not generate a sequence…* after 4000 attempts. Do not lower lure counts as a hidden function of N.

N fill trials make very large N slow to *play* (N × (exposure + ISI) of unscored moles). That is honest task cost, not a reason to cap N in software.

### 3.5 Practice gate (U8)

`start()` skips the **tutorial** (not practice) when any saved session has a passed practice at that N and input (`knownLevel`). `verified` is cleared every session, so practice still runs.

`continueSession()` after a scored round only checks this session’s `verified`. A 3→4 rise **in the same session** always opens the 4-back tutorial, even if the player passed 4-back last week. A **later** session that *starts* at 4 may skip the tutorial. Do not change that split here.

---

## 4. Adaptation version 1.1

Keep every 1.0 condition except the upper clamp.

**Same-N, two-round qualification is unchanged.** From a fresh N=1 with no history, five qualifying rounds play at **1, 1, 2, 2, 3**. Reaching 5-back takes two qualifying rounds at each of 1, 2, 3, and 4, then the following round is 5-back. Do **not** test or implement a five-round climb of 1→2→3→4→5.

**Within-session climb past 3 is new and intended.** `adapt()` concatenates prior sessions. Players already sitting on two qualifying 3-back training blocks will be offered 4-back after their **next** qualifying 3-back round, not “highest level”. That is migration, not a bug.

Keep the current list rule (do not “fix” it to last-two-completed, which would bridge over interrupted blocks):

```ts
const recent = blocks
  .filter((b) => b.config.mode === "training")
  .slice(-2);
```

Then test: length 2, both completed, both `config.n === n`, same `configHash`, no quality flags, no long-frame log. Practice and assessment never contribute. Interrupted or mismatched-hash blocks break the streak because they occupy a slot in `recent`.

Raise:

```
if BOTH blocks have hitRate >= 0.85 AND faRate <= 0.15:
  to = n + 1
  reason = "Two strong rounds. Ready for the next level."
```

Lower (match today’s parentheses; do not rewrite the rule):

```
if BOTH blocks have (hitRate < 0.60 OR faRate > 0.30):
  to = max(1, n - 1)
  reason = to < n
    ? "Let’s consolidate at a gentler level."
    : "Take your time. Try the tutorial or a longer exposure next session."
```

At 18/42 this is raise ≥16 hits and ≤6 FAs; weak is ≤10 hits or ≥13 FAs. Delete the “Strong work at the highest level.” branch. It only existed because `min(3, n+1)` could equal `n`.

Record `version: "1.1"` on every new `Adaptation` object.

`App.tsx` already writes `decision.to` into prefs and `currentN`. Remove leftover `as N` casts on `currentN + 1`; they were union-narrowing hacks.

---

## 5. UI

### 5.1 Level stepper (home + tutorial)

Replace the three-button grid with one control used in both places (small shared component, e.g. `src/components/LevelPicker.tsx`, or an exported function next to Tutorial — **one** component, two call sites).

Structure:

```text
[ − ]   3-back          [ + ]
        3 turns ago
```

- `role="group"` with `aria-labelledby="starting-level"` on home and `aria-label="Example level"` in the tutorial.
- Decrease: `aria-label="Decrease memory level"`, `disabled={n <= 1}`.
- Increase: `aria-label="Increase memory level"`, never disabled.
- Centre is **not** a button. It shows `{n}-back` and `{n} turn(s) ago`, `aria-live="polite"`. Class `chosen` on the centre (U21: CSS must target `.level-options .chosen`, not `button.chosen`).
- CSS: change `.level-options` from `repeat(3, 1fr)` to `52px minmax(0,1fr) 52px` (or similar). ± hit targets ≥ 44 px.
- Do not keep unused 1/2/3 buttons behind a breakpoint. One-tap 3-back is gone; two Increase clicks from 1 is the new path (tests must follow it).

### 5.2 Tutorial examples

Keep the golden sequences (browser tests assert them):

| N | Sequence | Notes |
| --- | --- | --- |
| 1 | `2, 2, 5, 8, 8, 3` | first scored is a match |
| 2 | `2, 5, 2, 8, 2, 8` | |
| 3 | `2, 5, 8, 2, 7, 8` | first scored is a match (`2` vs 3 ago) |

For N ≥ 4, synthesise:

1. Fill N digits from a fixed cycle, e.g. `[2, 5, 8, 3, 4, 6, 7, 9, 1]` repeating.
2. Append one **match** (`digits[0]`).
3. Append two **non-matches** (digit ≠ the N-back item at that index).

Length ≥ N + 3 so “Next example” has somewhere to go. `step` still starts at `n`. `numbers[step] === numbers[step - n]` remains the match test. Call `resourceOk(n, exampleLength)` first (U22). If it fails, show an error instead of allocating.

`.digit-history` is a **horizontal scroller** (U18). `overflow-x: auto; flex-wrap: nowrap; justify-content: center` (or `flex-start` once the row overflows). The page itself must not grow wider than the viewport (`documentElement.scrollWidth <= innerWidth` at 320 px), including a 4-back and 7-back example. Verify in the usability pass. Do not render an unbounded full history as extra page width; the strip may scroll. Label “N ago” and “Now” on the compared and current cells.

Current 3-back example is 4 cells: `4×64 + 3×12 = 292` px, which fits. **4-back is 5 cells: `5×64 + 4×12 = 368` px**, which already fails 320 px unless CSS changes. This is not optional polish.

### 5.3 Home mole

`Mole digit={prefs.n}` is cute at 1–3. At 10+ the shirt still shows the actual N (U16), at a smaller font if needed. Stimuli in play never use N as a digit.

### 5.4 Assessment modal

Leave the two choices. Only “One level” becomes able to say `7-back` when prefs are 7. Battery copy and `blocks: 3` with `currentN` starting at 1 stay.

### 5.5 Progress

```ts
const levels = [
  ...new Set(
    sessions.flatMap((s) => s.blocks.map((b) => b.config.n)).filter(isN),
  ),
].sort((a, b) => a - b);
const options = levels.length ? levels : [1];
```

If the selected filter N is not in `options` (e.g. user deleted data), fall back to `options[0]`. Do not inject 2 and 3 when they have never been played.

---

## 6. Copy and docs (after code, not instead)

Do **not** rewrite `TAG-ME-Again-Game-Specification.md` (published 1–3). Do **not** treat 4-back as Hu-validated.

Update when implementing:

| File | Change |
| --- | --- |
| `README.md` | Training N is unbounded; adaptive has no top; assessment battery still 1/2/3; one-level assessment uses selected N |
| `IMPLEMENTATION_PLAN.md` | Historical v1 plan; add a one-line pointer to this file rather than silently rewriting 8 Sep decisions, **or** patch the N rows in §3.2 / §4 to “see UNBOUNDED_N plan”. Prefer a pointer plus a short erratum over a full rewrite. |

In-app strings that currently imply a cap:

- Break reason “highest level” — remove (see §4).
- Home / tutorial still say “N turns ago” — already parametric. Keep.

Do not add “unlimited difficulty” marketing. Say “level rises after two strong rounds” and “there is no maximum level”.

---

## 7. File-level work list

Surgical. No scoring/engine/storage redesign.

| File | Change |
| --- | --- |
| `src/game/types.ts` | `type N = number`; add `isN()` and `resourceOk()` |
| `src/game/sequence.ts` | validation including U20; `label()` window `max(n+1, 4)` |
| `src/game/protocol.ts` | unbounded raise; drop highest-level copy; `version: "1.1"` |
| `src/components/LevelPicker.tsx` | **new**, tiny stepper |
| `src/components/Tutorial.tsx` | use stepper; `exampleSequence(n)`; U22 before allocating |
| `src/components/Results.tsx` | dynamic level options |
| `src/App.tsx` | prefs `isN`; home stepper; mole shows `n` (smaller font at 10+); drop `as N` hacks; U22 preflight before launch |
| `src/styles.css` | stepper grid; `.chosen` without `button`; digit-history **nowrap + overflow-x** |
| `DUAL_NBACK_IMPLEMENTATION_PLAN.md` | Do not patch from this branch. Dual v1.1 shares the unbounded N contract and will be implemented in `../tag-ME-dual` after this work lands. |
| `tests/game.test.ts` | N = 4, 5 (and a higher N) in generator loops; adapt 3→4 and 4→5; 5-back label golden; invalid N throws |
| `tests/browser.spec.ts` | tutorial: increase twice from 1 to reach 3-back example; `.level-options .chosen` still contains `2-back` after adapt; battery loop unchanged `[1,2,3]` |
| `tests/usability.spec.ts` | stop using `.nth(2)` as 3-back; click Increase twice; still assert `3 turns ago` and the 3-back example digits |
| `README.md` | after behaviour is real |

**Do not change:** `src/game/scoring.ts`, `src/game/engine.ts`, `src/data/storage.ts`, `src/components/Play.tsx` (already parametric). Dual **code** stays off this branch.

---

## 8. Tests and verification

### 8.1 Unit (must pass before UI polish)

1. **Hash stability for 1–3.** Leave the `generate()` loop body untouched aside from the N allow-list. Commit these **current** `hash(generate(protocol(n, "training"), "seed"))` values and assert they still match after the change:

   | N | `hash(sequence)` for seed `"seed"` (captured 9 Sep 2026, generator 1.0) |
   | --- | --- |
   | 1 | `8eadaf0d` |
   | 2 | `c898454e` |
   | 3 | `5dc8c1bd` |

   Also: for n ∈ {1,2,3}, every `lagMatches` value is ≤ 4. Do not “diff against main after merging” — that is circular.
2. **4-back and 5-back quotas.** Same invariants as today’s 600-seed test: length `60+n`, 18 targets, 5 lures, n warmup, no four identical consecutive digits, holes balanced, independent `label()` agrees. Run **at least 200 seeds** for N = 4 and N = 5; **at least 30 seeds** for N = 8.
3. **5-back golden label.** e.g. `label([2,5,8,3,4,2], 5)` last item is a target; first five are warmup / non-target.
4. **Invalid N and resource guards.** `n = 0`, `n = 1.5`, `n = -1` throw before the retry loop. `n + scoredTrials > 100_000` throws without allocating. `max(n+1,4) * (n + scoredTrials) > 10_000_000` throws without allocating (e.g. huge N with practice-length scored count). `N = 15` practice (15 fill + 12 scored) **succeeds**. Do not reject `n > scoredTrials`.
5. **Adaptation 1.1.**
   - Two perfect 3-back blocks → `to === 4`, version `"1.1"`.
   - Two perfect 7-back blocks → `to === 8`.
   - Two always-press 2-back → `to === 1`.
   - Two failures at 1-back → `to === 1` (floor).
   - Existing “one success does not raise” and quality-flag tests still hold.
   - From empty history, two perfect 1-back then two perfect 2-back → next is 3, not 5. Do **not** add a test that five perfect rounds from N=1 yield 5-back.

Practice quota loop: include N = 4, 5 (30 seeds is enough). Add a diagnostic: 5 seeds of practice at N=15; 5 seeds of training at N=70.

### 8.2 Browser

| Existing test | Patch |
| --- | --- |
| Tutorial 3-back example | From default 1-back, click **Increase memory level** twice; expect spans `2,5,8,2` |
| Adapt 1→2 | Unchanged except chosen control is the centre label, still `2-back` |
| Assessment battery | Still N = 1,2,3 only |
| Usability 320 px home | Increase twice; heading “3 turns ago”; **also open How to play at 4-back and 7-back** and assert `documentElement.scrollWidth <= innerWidth`. The strip may scroll internally; the page must not. |

Add one focused path (can be a short extra test, not a full 60-trial 4-back):

- Start at 3-back via stepper, open How to play, example shows a **match at index 3** for the 3-back golden sequence (already implied).
- Optionally: set starting N to 4, start training, tutorial heading says “4 turns ago”, fill count in practice-rules details is 4.

Do **not** add a full Playwright 4-back 60-trial solve unless time is cheap; unit generator coverage carries N = 4. A practice-length 4-back solve (12 scored) is enough if one end-to-end is wanted.

### 8.3 Manual / screenshot

- Home stepper at 1 (minus disabled), 2, 3, 4.
- Tutorial at 5-back: one scrolling row, compared digit labelled “5 ago”, Now labelled, Match still works. Page does not grow horizontally.
- After two strong 3-back rounds in training: continue to **4-back** practice, not “highest level”.
- Progress filter shows 4 once a 4-back block exists.
- Assessment “All three levels” still 1 then 2 then 3.
- Assessment “One level” at 4-back launches 4-back practice.

### 8.4 Success criteria

- [ ] Training, generator, adaptation, prefs, tutorial switcher, and progress **filter** have no N maximum. Assessment **battery** may still mention and loop `[1, 2, 3]`.
- [ ] `type N` is no longer `1 \| 2 \| 3`. `Math.min(3, n + 1)` is gone from `adapt()`.
- [ ] Golden hashes in §8.1 still match for N = 1, 2, 3 seed `"seed"`.
- [ ] Two qualifying 3-back training rounds produce N = 4.
- [ ] Generator produces legal 4-, 5-, and 8-back blocks on many seeds.
- [ ] 1-, 2-, and 3-back sequences for existing seeds are unchanged.
- [ ] Assessment battery still only 1/2/3.
- [ ] 320 px home and a high-N tutorial do not overflow horizontally.
- [ ] Practice is required when N changes, including 3→4.
- [ ] `resourceOk` / U22: pathological N fails visibly without hanging; tutorial does not allocate before the guard.

---

## 9. Implementation order

1. `isN` + `resourceOk` + `type N = number`.
2. `label()` window + `generate()` validation. Unit tests including 4/5/8 and 1–3 stability.
3. `adapt()` 1.1 + adaptation tests (3→4).
4. LevelPicker + CSS; wire home, tutorial, prefs.
5. Tutorial `exampleSequence`; digit-history nowrap + overflow-x.
6. Progress filter.
7. Patch Playwright/usability selectors.
8. README / pointer from `IMPLEMENTATION_PLAN.md`. Do not patch the dual plan from this branch.
9. Run `npm test` and `npm run test:browser`. Fix until §8.4 is green.

Do not mix dual-n-back **code** into this branch. Dual consumes this branch’s N/label/hash-freeze work after it lands; see dual plan §0.

---

## 10. Risks and non-goals

| Risk | Handling |
| --- | --- |
| Generator failure at some high N / seed | Keep throw; expand seed sweep in tests. Do not silently drop lures. |
| Hash split of old 1–3 progress | Avoided by U5 + `max(n+1, 4)` window. |
| Players start at N = 40 and fail practice | Allowed. Practice gate and down-adaptation (once they complete two weak scored rounds) handle it. No nanny cap. |
| Assessment “all levels” still 1–3 looks like a ceiling | Copy: it is the **standard three-level assessment**, not the training maximum. |
| Dual N | Shared unbounded contract; dual code is a different worktree. Do not cap dual at 3. |
| `lagMatches` for N = 10 omits lag 8 incidental matches | Acceptable: lure/target only need N−1, N, N+1. Do not widen to all lags in this change. |
| Typed N = 1e12 from a future input or hand-edited prefs | U20 throws before `Array.from({ length: n + scored })`. |
| Assessment “about 3 min” at N = 20 | Fill adds ~N × 2.75 s. Leave the rough label in v1; training’s minute estimate already scales with N. | FLAG |
| Two extra taps to pick 3-back | Accepted (U19). |

---

## 11. Open questions for the reviewer (do not block coding if unanswered)

1. Should `IMPLEMENTATION_PLAN.md` be patched in place or only linked? Default: pointer plus short erratum at the top.
2. Assessment one-level duration copy at high N: leave “about 3 min” or compute like training? Default: leave.

U18/U19 are no longer open. Silent defaults from 1.0 (wrap, optional number field) are **withdrawn**.

---

## 12. Self-review errata (plan 1.0 → 1.1)

Checked against `sequence.ts`, `protocol.ts`, `App.tsx`, `Tutorial.tsx`, `styles.css`, and the current generator output for seed `"seed"`.

### Errors in 1.0 (wrong, not just incomplete)

| Item | 1.0 said | Reality |
| --- | --- | --- |
| Success criteria “no remaining `[1,2,3]`” | Ban every 1/2/3 list | Contradicts U11. Battery and its Playwright loop **keep** `[1,2,3]`. |
| U16 modulo shirt | `((n-1)%9)+1` | 10-back would display as 1-back. Misleading. Show the real N. |
| U18 wrap | Wrap is OK for v1 | 4-back example is already **368 px** vs 320 px viewport. Wrap also splits “N ago” / “Now”. Must scroll on one row. |
| CSS `.chosen` | “keep the class” | Today the rule is `button.chosen`. A `div.chosen` would look unselected unless CSS is retargeted. |
| Hash test “diff against main” | Circular after merge | Use the committed hashes in §8.1. |
| §8.3 numbered twice | Manual vs success | Success is now §8.4. |
| U8 “3→4 always needs tutorial” | Overstated | Mid-session yes (`verified` only). Next session may skip tutorial via `knownLevel`. Practice never skipped. |
| U1/U15 as the only bound | Safe integer is enough | `Number.isSafeInteger(1e12)` is true; `Array.from({length: 1e12})` would freeze the tab. U20 added. |

### What 1.0 got right (kept)

- Ceiling is protocol/UI, not the play engine.
- `label()` window `[1,2,3,4]` is the only generator correctness bug for N ≥ 5; 4-back is flaky rather than impossible.
- `max(n+1, 4)` preserves 1–3 `lagMatches` and therefore `configHash` / `sequenceHash` if the generate loop is otherwise untouched.
- Assessment battery stays 1→2→3; one-level assessment follows `prefs.n`.
- Adaptation version 1.1; do not bump `VERSIONS.generator`.
- Quotas, holes, timing, scoring, storage schema unchanged.

### Behaviour 1.0 understated (now in §4)

Qualifying rounds **span sessions**. After this ships, anyone already at 3-back with two recent qualifying 3-back training blocks will climb on the **next** qualifying round. That can reach 4-back and then 5-back in one sitting **if they already start at 3**. From N=1 with no history, five qualifying rounds are 1, 1, 2, 2, 3 (corrected in 1.3; 1.0/1.1 overstated this as 1→2→3→4→5).

---

### 12.1 Dual-scope erratum (1.1 → 1.2)

The original U17 / D11 story locked dual at `{1,2,3}` while identity became unbounded. Product clarification and [DUAL_NBACK_IMPLEMENTATION_REVIEW.md](DUAL_NBACK_IMPLEMENTATION_REVIEW.md) R20 override that: **both tasks** use positive safe-integer N with no gameplay maximum. Named 1→2→3 batteries stay as finite assessment selections.

Identity work on `unbounded-n` is unchanged except this documentation. Dual implementation plan v1.1 is the dual contract. Do not implement dual in this worktree.

The five-round same-N climb remains **1, 1, 2, 2, 3**, not 1–5 in five rounds.

U20 now also bounds `label()` work. Allocation alone is not enough at large N with `scoredTrials` still under 100,000.

### 12.2 Contract errata (1.2 → 1.3)

These are leftover 1.2 bugs a developer would have implemented incorrectly. 1.3 is the authority.

| Item | 1.2 said | 1.3 |
| --- | --- | --- |
| §4 five-round climb | “can now go 1→2→3→4→5” | Same-N two-round rule: from N=1 that is **1, 1, 2, 2, 3** |
| U2 | “U20 is an allocation guard only” | U20 also has a label-work budget; U22 preflights UI |
| §3.3 snippet | Only `n + scoredTrials > 100_000` | Include `max(n+1,4) * (n+scored) > 10_000_000` |
| Dual worktree | Dual “is implemented” in `../tag-ME-dual` | Dual is **not** implemented yet; identity work lands first |
| Adapt list | “last two consecutive completed” | Keep today’s `training.slice(-2)` then test completed (do not bridge interrupts) |
| Lower-rule wording | Ambiguous `both hitRate < 0.60 or faRate > 0.30` | Both blocks have `(hit < 0.60 \|\| fa > 0.30)` |
| `n > scoredTrials` | Unstated | Valid; do not reject |
| Tutorial / `launch()` | Guard only in `generate()` | U22: preflight before example arrays and before Play |

---

*Plan version 1.3 — remove the identity n-back ceiling. Assessment battery remains 1/2/3. Dual code is out of scope on this branch; dual N is unbounded in the dual plan. Implement in `/home/ltoime/tag-ME-unbounded-n`.*
