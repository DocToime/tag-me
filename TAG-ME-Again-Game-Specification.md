# TAG-ME Again — Reverse-Engineering / Rebuild Specification

**Status:** Reconstruction spec from *published* papers, abstracts, and related BrainTagger documentation.  
**Not** a dump of proprietary source, art, or exact unpublished timing tables.  
Use this to implement a *functionally equivalent* n-back working-memory assessment in a whack-a-mole (or gardening) skin. Do **not** copy BrainTagger sprites, audio, or branding.

Where a value is not published, it is labelled **INFERRED** or **IMPLEMENTATION CHOICE** with a recommended default and a rationale.

---

## 1. Identity

| Field | Value |
|---|---|
| Canonical name | **TAG-ME Again** (also written TAG-ME again / TAG-Me Again) |
| Family | BrainTagger — Target Acquisition Games for Measurement and Evaluation (TAG-ME) |
| Alternate skin | **PLANT-ME Again** (same mechanics, gardening metaphor: weeds/plants instead of moles) |
| Construct | Working memory (updating + identity matching), gamified **visual n-back** |
| Levels | 1-back, 2-back, 3-back |
| Owner / origin | University of Toronto + Centivizer Inc. (UofT spin-off) |
| Lead researchers | You Zhi Hu, Shireen Parimoo, Mark Chignell, Cassandra J. Lowe, J. Bruce Morton |
| Software stack (original) | Reimplemented in **React** (BrainTagger Researcher Platform / BRP, ~2021) |
| Demo URLs (as cited) | https://researcher-demo.braintagger.com — https://intro.braintagger.com/ — https://www.centivizer.com |
| Research access | Free to researchers in exchange for donation of anonymized data to the BrainTagger repository. Contact: Mark Chignell (`chignell@gmail.com`) and `info@centivizer.com` |
| Hardware note | Button boxes recommended for precise RT and older users; sold via Centivizer. Browser mouse/touch also used. |

---

## 2. Primary sources (read these first)

### Core validation paper (must-read)

- Hu, Y. Z., Parimoo, S., Chignell, M., Lowe, C. J., & Morton, J. B. (2023/2025). **TAG-ME again: A serious game for measuring working memory.** *Applied Neuropsychology: Adult, 32*(2), 502–521.  
  - DOI: https://doi.org/10.1080/23279095.2023.2183361  
  - Publisher: https://www.tandfonline.com/doi/full/10.1080/23279095.2023.2183361  
  - PMID: 36881994  
  - Online first: 7 Mar 2023; journal issue pagination 2025.  
  - **Paywalled.** Abstract + acknowledgements are public. Full methods (trial counts, stimulus set, exact scoring formula, figure of UI) live in the PDF. **Buy/request this PDF before locking parameters.**

### Related BrainTagger papers (mechanics + suite context)

- Urakami, J., Hu, Y. Z., & Chignell, M. (2021). **Monitoring cognitive performance with a serious game: A longitudinal case study on online cognitive assessment using serious games.** *CHI EA 2021.*  
  DOI: https://doi.org/10.1145/3411763.3443431  
  HTML: https://dl.acm.org/doi/fullHtml/10.1145/3411763.3443431  
  CHI talk: https://www.youtube.com/watch?v=_d9_IU48bzg  
  **Key published facts:** six holes; moles pop from one hole at a time; TAG-ME Again = remember the number on the mole’s T-shirt and hit a mole whose number matches the mole from **three positions back** (3-back description used in that study’s table). Measures: speed + various accuracy types.

- Zhou, Y., Hu, Y. Z., Xu, Z., Wu, J., & Chignell, M. (2025). **Does changing the game metaphor change the assessment?** *Proceedings of the Human Factors and Ergonomics Society.*  
  https://doi.org/10.1177/10711813251360703  
  **Key published facts:** TAG-ME Again / PLANT-ME Again = n-back via number recall; **30 trials** per game in that study; metrics include RT, accuracy, false alarms; appearance duration is **adaptive for speed/inhibition games only** (not stated for Again); mole vs garden skins, identical task demands. Working-memory skin correlation *r* ≈ .38.

- Zhang, B. (Y.), & Chignell, M. (2021). **Designing the BrainTagger Researcher Platform…** IEA 2021 / EasyChair preprint.  
  https://easychair.org/publications/preprint/TmjZ/download  
  Springer chapter: https://doi.org/10.1007/978-3-030-74608-7_15  
  **Key published facts:** suite of ~8 TAG-ME games; React rewrite; researcher-configurable difficulty; originally delirium-screening origin story.

### Company / demo

- Centivizer: https://www.centivizer.com  
- Researcher demo (cited in Hu et al.): https://researcher-demo.braintagger.com  
- Intro portal cited in later papers: https://intro.braintagger.com/

### Authors / lab

- You Zhi Hu — Dept. Mechanical & Industrial Engineering, University of Toronto — ORCID 0000-0001-8467-2768  
- Mark Chignell — UofT MIE / Interactive Media Lab  
- Named BrainTagger developers (acknowledgements): Junyoung Seok, Allen Han, Ray Kwan, Sieun Lee, Ryan Chang, Thomas Macdonald, Rikin Gurditta, Haoyan Jiang, Natalie Pedlar  
- Clinical collaborator acknowledged: Dr. Jacques Lee  

### Legal / ethics

- Games are **proprietary** assessment instruments. Rebuild for internal research/product is fine if you do **not** reuse their art, name, or claim clinical equivalence without your own validation.  
- UofT REB protocol cited for metaphor study: **#43771**.

---

## 3. Design intent (what you are actually implementing)

TAG-ME Again is **not** dual n-back and **not** a spatial n-back of hole location.

It is a **single-stream identity n-back**:

1. Stimuli appear sequentially in a 6-hole whack-a-mole field (one mole visible at a time).
2. Each mole wears a **T-shirt with a number**.
3. Player must decide whether the **current number equals the number from N trials ago**.
4. If match (**target / go**): hit the mole (click / tap / button).
5. If mismatch (**nontarget / no-go**): withhold.

Working memory demand = hold the last N numbers, update the buffer every trial, compare current vs buffer[0], then shift.

Spatial location of the hole is a **distractor / motor mapping**, not the n-back feature (unless you implement Experiment 2’s equated spatial version — see §8).

---

## 4. Playfield and presentation

### 4.1 Layout (confirmed + inferred)

**Confirmed**

- Whack-a-mole metaphor.
- **Six holes.**
- One mole pops from **one of six holes** per trial (Quick description; Again uses the same field).
- Mole has a **numbered T-shirt**.
- Response = “hit” the target mole (mouse, touch, or button box).
- Alternate skin: garden / weeds / plants, same hit/withhold logic (`PLANT-ME Again`).

**INFERRED layout (reasonable default)**

```
        [Hole 0]   [Hole 1]   [Hole 2]

        [Hole 3]   [Hole 4]   [Hole 5]
```

Two rows of three, cartoon dirt mounds, grassy background. Holes equally spaced. Safe area so numbers remain readable at ~arm’s-length tablet distance.

**IMPLEMENTATION CHOICE — visual**

- Mole sprite: simple cartoon, high-contrast T-shirt.
- Number: large sans-serif, center of chest, stroke/outline for contrast.
- Do not copy Centivizer art. Original character design is fine.

### 4.2 Stimulus set (numbers)

**Not fully published.** Recommend:

| Parameter | Recommended default | Notes |
|---|---|---|
| Digit set | `{1, 2, 3, 4, 5, 6}` or `{0–9}` | Small set ↑ lure rate; large set ↓ lure rate. Start with **1–9** excluding confusing glyphs if font is weak. |
| Same number can repeat | Yes | Required for matches. |
| Match probability | **~30% targets** after warmup | Classic n-back often uses ~25–33% targets. |
| Lure rate | Include **N±1 lures** at ~10–15% of nontargets | Optional but improves construct validity. |
| Hole selection | Uniform random, independent of number | Location is not the matching feature. |

**IMPLEMENTATION CHOICE:** generate sequences offline with constraints:

- First `N` trials are **non-scored warmup** (no valid n-back comparison).
- After warmup, enforce target rate ±2%.
- Avoid runs of 4+ identical digits unless you want lures.
- Seed RNG per session for reproducibility.

### 4.3 Trial timing

**Confirmed**

- Zhou et al. 2025: **30 trials** per game in that protocol.
- Adaptive vanish-time is explicitly described for **speed and inhibition games only**. Again is an n-back; treat duration as **fixed** unless you find otherwise in Hu PDF.

**INFERRED / recommended timing** (standard visual n-back + mole animation)

| Phase | Duration | Notes |
|---|---|---|
| Hole idle | — | Empty mound. |
| Pop-up animation | 80–150 ms | Ease-out. |
| Stimulus visible (response window) | **1500–2500 ms** default **2000 ms** | Must be long enough to encode the digit *and* decide. |
| Hit feedback | 100–200 ms | Mole retracts / “bonk” if hit. |
| ISI / empty hole | **500–1000 ms** default **750 ms** | Buffer update happens here. |
| SOA (onset to onset) | ~2500–3000 ms | Keep constant within a block. |

**Timeout:** if no response by end of window:

- Target trial → **miss**
- Nontarget trial → **correct rejection**

Do **not** allow late hits after the mole has fully retracted (or log them separately as late).

### 4.4 Block structure

**Confirmed variants in literature**

| Source | Structure |
|---|---|
| Hu et al. 2023 | Three difficulty levels = 1-back, 2-back, 3-back. Exp 1 vs lab n-back (RT, accuracy, combined metric). Exp 2 equated S-R mapping and spatial demands. |
| Urakami et al. 2021 | Table describes Again as **3-back** (“mole three positions back”). |
| Zhou et al. 2025 | 30 trials, four games in fixed order, optional stop. |

**Recommended session (assessment mode)**

```
1. Consent / ID
2. Instruction + animated example for current N
3. Practice block: 12–15 trials, feedback ON, not scored
    Pass criterion: IMPLEMENTATION CHOICE e.g. ≥70% or always proceed
4. Test block N=1: 30–40 trials, feedback OFF or minimal
5. Short break (5–15 s)
6. Test block N=2
7. Test block N=3
8. Debrief / scores
```

Allow researcher config: single-N session (as in Urakami’s 3-back-only table) vs full 1/2/3 battery.

**Scored trials** = all trials with index `i >= N` (0-based). First N trials fill the buffer only.

---

## 5. Core game loop (authoritative)

```
buffer = []                    # FIFO of last N numbers
n = currentN                   # 1, 2, or 3

for trial_index, stimulus in enumerate(sequence):
    hole = random_hole()
    show_mole(hole, number=stimulus.number)
    t0 = now()

    response = wait_hit_or_timeout(window)

    is_target = (len(buffer) >= n) and (stimulus.number == buffer[-n])
    # buffer[-n] is the number from N steps ago once buffer has N items
    # equivalently: after append, compare current with buffer[0] if using
    # a buffer that always stores the previous N *before* append.

    classify(response, is_target, rt=now()-t0)
    buffer.append(stimulus.number)
    if len(buffer) > n:
        buffer.pop(0)

    hide_mole()
    wait(ISI)
```

**Comparison rule (be exact):**

After the buffer contains at least N prior items, target iff  
`current_number == number_on_trial_(i - N)`.

Example, N=3, numbers `2, 5, 8, 2, 5`:

| Trial | Number | Compare to | Target? |
|---|---|---|---|
| 0 | 2 | — | warmup |
| 1 | 5 | — | warmup |
| 2 | 8 | — | warmup |
| 3 | 2 | trial 0 = 2 | **YES** |
| 4 | 5 | trial 1 = 5 | **YES** |

---

## 6. Response mapping

### 6.1 Default (whack-a-mole)

- **Go / target:** pointer-down or button-press on the active mole (or any “whack” button if using a 1-button box — **see Exp 2**).
- **No-go / nontarget:** no press.
- Multi-hole click: if player clicks a **wrong hole** while the mole is up, log as `wrong_hole` (treat as miss if target, false alarm if you count any press as a hit — pick one and document it). **Recommended:** any press during a nontarget = false alarm; press on correct hole during target = hit; press on empty hole during target = miss.

### 6.2 Input devices

| Device | Mapping |
|---|---|
| Mouse | Click mole sprite |
| Touch | Tap mole sprite |
| Keyboard | e.g. Space = whack (loses spatial discrimination) |
| Centivizer button box | Dedicated hit button; recommended for aging samples |

Log `pointerType`, screen size, and estimated input lag.

### 6.3 Experiment 2 alignment (Hu et al.)

They “minimized differences between the task and the game by **equating stimulus-response mappings and spatial processing demands**.”

**INFERRED meaning:** lab n-back often uses two keys (match / mismatch) on a central stimulus. The game uses spatial hitting. Exp 2 probably:

- put n-back items in a similar spatial layout, **or**
- reduced the game to a single response button (whack / don’t), matching a go/no-go n-back.

If you need convergent validity with a standard n-back, implement a **sidecar lab task**:

- Same numbers, same sequence, same timing.
- Keys: `F` = mismatch, `J` = match (or Space = match only).
- No moles.

---

## 7. Scoring (confirmed categories + recommended formulas)

Hu et al. report three families of measures:

1. **Reaction time**
2. **Accuracy**
3. **Combined RT / accuracy metric**

Zhou et al. also log **false alarms** and “other types of responses.” d-prime is used for the inhibition game; use it here too.

### 7.1 Trial taxonomy

| Event | Target trial | Nontarget trial |
|---|---|---|
| Press in window | **Hit** | **False alarm (FA)** |
| No press | **Miss** | **Correct rejection (CR)** |
| Press after timeout | Late (optional separate bin) | Late FA |
| Press wrong hole | Configurable | FA |

Ignore warmup trials (`i < N`) in aggregates.

### 7.2 Primary metrics (per N-level)

```
n_targets     = hits + misses
n_nontargets  = FA + CR
hit_rate      = hits / n_targets
fa_rate       = FA / n_nontargets
accuracy      = (hits + CR) / scored_trials
```

**d′ (recommended combined sensitivity):**

```
H  = clip(hit_rate, 1/(2*n_targets), 1 - 1/(2*n_targets))
FA = clip(fa_rate,  1/(2*n_nontargets), 1 - 1/(2*n_nontargets))
d_prime = z(H) - z(FA)
```

**RT:** median RT of **hits only** (correct go). Also store mean, SD, IES.

**Inverse efficiency / combined score (IMPLEMENTATION CHOICE)**  
Hu’s exact combined formula is in the paywalled PDF. Until you have it, expose several and label them:

```
IES  = median_hit_RT_ms / accuracy          # Townsend & Ashby
LISAS = RT + SDrt * (Perr / Pcorr)          # Vandierendonck
throughput = hits / sum(hit_RTs)            # optional
```

Do **not** claim numeric equivalence to BrainTagger norms without the official formula.

### 7.3 What to persist (session JSON)

```json
{
  "game": "tag-me-again",
  "version": "1.0.0",
  "n": 3,
  "started_at": "ISO-8601",
  "client": { "ua": "", "w": 0, "h": 0, "input": "mouse" },
  "params": { "window_ms": 2000, "isi_ms": 750, "holes": 6, "digit_set": [1,2,3,4,5,6,7,8,9] },
  "trials": [
    {
      "i": 0,
      "number": 4,
      "hole": 2,
      "is_warmup": true,
      "is_target": false,
      "response": "none",
      "rt_ms": null,
      "code": "warmup"
    }
  ],
  "summary": {
    "hits": 0, "misses": 0, "fa": 0, "cr": 0,
    "accuracy": 0, "d_prime": 0,
    "median_hit_rt_ms": 0
  }
}
```

---

## 8. Cognitive task analysis (for QA)

| Component | How the game loads it |
|---|---|
| Phonological / visual store | Encode digit on shirt |
| Updating | FIFO of length N every trial |
| Inhibition | Withhold on nontargets |
| Attention | Detect pop + read number under time pressure |
| Visuospatial (incidental) | Mole jumps between 6 holes |
| Motor | Aimed click or simple button |

If validation against a **letter n-back** fails at 1-back, suspect motor/spatial variance, not WM. That is why Hu Exp 2 equated mappings.

---

## 9. Suite context (do not mix rules)

| Game | Construct | Rule (published) |
|---|---|---|
| TAG-ME Quick / PLANT-ME Quick | Processing speed | Hit every mole; 6 holes; adaptive visibility in some studies |
| TAG-ME Only / PLANT-ME Only | Inhibition (go/no-go) | Hit plain moles; **avoid moles with hats** (or flowers in garden skin) |
| TAG-ME Greater / PLANT-ME Bigger | Cognitive flexibility / Stroop-like | Magnitude comparison rules |
| TAG-ME Switch | Shifting | Six rules of “which mole to hit” switch during play |
| **TAG-ME Again / PLANT-ME Again** | **Working memory** | **N-back on T-shirt number** |
| Others in 8-game suite | Not fully enumerated here | See BRP paper |

Again must **not** use hat-distractors or adaptive speed-up unless you are deliberately creating a dual-demand variant.

---

## 10. UI / UX spec

### 10.1 Screens

1. **Title** — game name, N selector or auto battery, Start.
2. **Instructions** (N-specific copy):

   > Moles will pop up wearing numbered shirts.  
   > Hit the mole if its number is the **same as the mole from N turns ago**.  
   > Do nothing if the number is different.  
   > Be as fast and accurate as you can.

3. **Worked example** — play 6 scripted trials with “this was a match because …” overlays.
4. **Practice** — checkmark / X feedback.
5. **Test** — no numeric score on screen during the block (reduces strategy shift). Optional subtle hit flash.
6. **Result** — accuracy, median RT, d′, level complete. Do not display raw clinical claims.

### 10.2 Feedback

| Mode | Hit | FA | Miss |
|---|---|---|---|
| Practice | Green flash + optional ding | Red flash | Soft miss cue |
| Test | Tiny squash animation only | None or very subtle | None |

### 10.3 Accessibility

- Number contrast ≥ WCAG AA.
- Color not the only signal.
- Configurable window 1.5–4 s for older adults.
- Keyboard fallback.
- Pause between blocks.

### 10.4 Motivation (Urakami finding)

Repeated un-gamified moles lost “fun” over weeks. If this is a product, add **optional** (off by default in assessment mode): streaks, session XP, leaderboard. Keep assessment blocks clean.

---

## 11. Technical architecture (suggested)

Original stack: **React** web app + researcher portal.

Suggested rebuild:

```
web/
  src/
    games/tagMeAgain/
      engine.ts          # loop, scoring, sequence generator
      playfield.tsx      # 6 holes + mole
      skins/mole.ts
      skins/garden.ts
    telemetry/
      schema.ts
```

Requirements:

- `performance.now()` for RT (not `Date.now()`).
- Preload assets; no GC hitch mid-trial.
- Lock orientation landscape on mobile if holes would crowd.
- Deterministic sequence from `{participantId, session, n, seed}`.
- Unit-test the classifier with golden sequences.

**Sequence generator pseudocode**

```
function makeSequence({ n, trials, pTarget=0.3, digits=[1,2,3,4,5,6,7,8,9], seed }):
  rng = seeded(seed)
  seq = [rng.choice(digits) for _ in range(n)]   # warmup
  while len(seq) < trials:
    if rng.random() < pTarget:
      seq.append(seq[-n])                        # forced match
    else:
      d = rng.choice(digits)
      while d == seq[-n]: d = rng.choice(digits) # forced mismatch
      seq.append(d)
  return seq
```

Add lure option: with small probability set `d = seq[-(n-1)]` or `seq[-(n+1)]` when those exist.

---

## 12. Acceptance tests

1. **Warmup:** first N trials never scored as misses.
2. **Forced match:** if sequence[i] == sequence[i-N] and player hits → Hit.
3. **Forced mismatch + hit** → FA.
4. **Timeout on target** → Miss.
5. **Timeout on nontarget** → CR.
6. **3-back example** in §5 classifies correctly.
7. **30-trial block** produces 30 log rows + summary excluding warmup.
8. Skin swap (mole ↔ plant) does not change `is_target` or scores given the same sequence and responses.
9. RT resolution: simulated 250 ms hit recorded within ±2 frames at 60 Hz.
10. Two seeds produce identical sequences.

---

## 13. Parameters the Hu PDF will likely settle

Lock these only after reading the full paper (or running the official demo):

- Exact digit alphabet and font
- Exact trial count per N in Exp 1 vs Exp 2
- Target / lure probabilities
- Stimulus duration and ISI
- Whether response is spatially aimed or a single button
- Combined RT/accuracy formula
- Practice rules and feedback
- Whether hole location was constrained
- Lab n-back parameters used as criterion (letters vs digits, dual vs single, timing)

Until then, ship the defaults in this spec and keep them **config flags**.

---

## 14. Demo / recon plan for the developer

1. Open https://researcher-demo.braintagger.com and https://intro.braintagger.com/  
   Record: hole count, number set, timing (phone slow-mo), trial count, feedback, instructions text.
2. Buy / library-request Hu et al. 2023 PDF; extract Methods + figures.
3. Watch CHI 2021 talk: https://www.youtube.com/watch?v=_d9_IU48bzg  
4. Email `info@centivizer.com` / `chignell@gmail.com` if this is a research collaboration (they already license to labs for data-sharing).
5. Implement engine + one skin; run acceptance tests.
6. Optional: concurrent standard n-back for your own convergent-validity check.

---

## 15. Known published results (context only — not game rules)

- Exp 1: n = 31 adults, ages 18–54. Correlations with lab n-back on RT, accuracy, combined metric; **strongest at 3-back**.
- Exp 2: n = 66 university students, ages 18–22. After equating S-R mapping and spatial load, significant correlations at **2-back and 3-back**.
- Zhou et al.: mole vs garden skins, WM *r* = .38 (modest; theme is not score-equivalent at the individual level).
- Urakami et al.: 19 students, 5 weeks remote play; enjoyment dropped without extra gamification.
- Authors’ conclusion: TAG-ME Again is a gamified n-back with **convergent validity**, not a clinical diagnosis.

---

## 16. One-page rules you can print

**TAG-ME Again (N-back moles)**

- 6 holes. One mole at a time. Number on the shirt.
- Hit if the number equals the number from **N moles ago**.
- Do not hit otherwise.
- N ∈ {1, 2, 3}.
- Score: hits, misses, false alarms, correct rejections, median hit RT, d′.
- First N moles are memory fill, not scored.

---

*Spec version 1.0 — assembled from public BrainTagger / TAG-ME literature for an independent reimplementation. Update §4–§7 after the Hu et al. full text and a live demo pass.*
