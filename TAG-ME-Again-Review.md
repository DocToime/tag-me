# Browser n-back game: specification review and development recommendations

Prepared 8 September 2026. Reviewed attachment: TAG-ME-Again-Game-Specification.md, version 1.0.

## Overall assessment

The specification is a useful starting point for an engaging browser-based n-back task. It correctly separates number identity from hole location, identifies several incidental cognitive demands, proposes trial-level logging, and distinguishes published facts from implementation choices. However, it is not yet a sufficiently precise specification for a measurement instrument. It also lacks a training protocol and a way to establish whether training benefits extend beyond the game.

My recommendation is to build an independently named product with three distinct components: a standardised assessment, an adaptive training game, and occasional untrained outcome tasks. Share the underlying engine, but version and analyse the protocols separately.

Assumptions: the initial audience is adults using consumer browsers; the first release is an experimental cognitive exercise and performance tracker. Children, clinical populations and diagnostic use require separate decisions and evidence. All numerical defaults proposed below are pilot choices, not established optimal doses or validated cut-offs.

## 1. What the evidence supports

Hu et al. examined convergence with n-back performance in two relatively small adult samples: 31 adults aged 18–54 and 66 university students aged 18–22. The abstract supports stronger relationships at higher loads and confirms that the second experiment aligned response mappings and spatial demands. It does not establish your reconstruction's timing, clinical accuracy, individual change sensitivity or training efficacy. I verified the abstract, but did not obtain the full methods paper; exact original parameters remain unresolved. [1]

Zhou et al.'s accessible paper confirms 30 trials, and specifies six keyboard keys—Q, W, E, A, S, D—mapped to six holes. The attachment should include this published mapping. Its working-memory correlation between skins is r=.38: this is evidence of association, not interchangeable individual scores. Different skins therefore need an equivalence study or separate interpretation. [2]

A digit n-back measures performance on a constrained updating/recognition task. It also involves attention, response strategy, perception and motor execution. Visually presented digits can be verbally rehearsed; calling this a visual task does not establish that it measures visuospatial memory. Research comparing n-back with complex-span measures illustrates why neither task alone should be equated with general working-memory capacity. [3]

Training can improve the practised task. Whether this extends to broader abilities is a separate empirical question. A placebo-controlled study found no intelligence improvement after adaptive dual n-back training. Other research reports potential transfer pathways: Pahor et al. found mediation through untrained n-back performance across three trials, while two trials lacked an overall intervention effect. These findings justify testing transfer, not assuming it. Neither study validates this single-stream mole game. [4,5]

Use a claim ladder: measured performance on this task → repeatable working-memory-related measure → reliable change on untrained tasks → meaningful everyday benefit. Each step needs additional evidence. A higher training level is not an IQ gain, and N is not a literal count of a person's memory capacity.

## 2. Highest-priority corrections

| Priority | Specification issue | Required change |
|---|---|---|
| Critical | Response can terminate the sample loop early | Keep exposure and onset-to-onset timing independent of responses |
| Critical | ≥70% practice accuracy can reward doing nothing | Require evidence of target detection and appropriate withholding |
| Critical | Training and measurement are not separated | Define distinct, versioned modes and independent outcomes |
| High | Thirty trials produce very few targets | Pilot longer/multiple blocks; report uncertainty and denominators |
| High | LISAS formula is wrong; throughput cancels to reciprocal mean RT | Correct or remove these measures |
| High | Aimed click and one-button responses are treated as alternatives | Define distinct protocols; do not pool scores automatically |
| High | Sequence generator does not enforce stated constraints | Generate, independently label and validate complete sequences |
| High | Pauses, late input and repeated presses are underspecified | Define deterministic event and interruption rules |
| High | Original validation is implicitly transferable to the rebuild | Validate this implementation and its target population |
| Medium | Research suggestions remain configurable at runtime | Freeze assessment protocol versions; constrain researcher settings |

## 3. Trial timing and response semantics

### A. Fix the response-dependent loop

In §5, wait_hit_or_timeout appears to return immediately after a response. The loop then hides the mole and waits a fixed ISI. Thus a 300 ms response can lead to the next stimulus after roughly 1,050 ms, while withholding leads to roughly 2,750 ms. This contradicts the constant-SOA instruction and changes both encoding time and memory retention demands.

Schedule trials against a monotonic clock. A response records an event; it does not advance the assessment. A reasonable pilot schedule is a fully readable, stationary digit for 2,000 ms, followed by 750 ms blank, giving 2,750 ms SOA. Keep the digit visible after responses. Decorative animation must not reveal the number before the timed onset or shorten its exposure afterwards.

Specify whether animation is before or inside exposure. A pop-up that gradually reveals a digit gives an ambiguous onset; for measurement, reveal the digit in a single frame after any introductory movement.

Do not calculate RT from the time classification runs. Store the input timestamp when the event occurs and subtract the onset estimate. No response means null RT, not the full response-window duration.

### B. Make scoring deterministic

Define the response interval explicitly, for example [onset, onset + 2,000 ms). Use the first eligible new press in the interval for the primary classification and retain all subsequent events for diagnostics. Define eligible controls so a click on an unrelated navigation control is not counted as a cognitive response.

Ignore key auto-repeat and require release before another keyboard response. Deduplicate touch/pointer/click events; specify primary pointer, mouse button and multi-touch rules. Record pre-onset presses, off-target presses, and presses during the blank separately. Never retroactively change a closed trial.

A press during the next trial cannot be confidently identified as a late response to the previous stimulus. Attribute it by the prespecified time window, while retaining timestamps for analysis. Do not infer intent retrospectively.

No-go silence is observationally ambiguous: it may represent a correct rejection, distraction or misunderstanding. Preserve the behavioural classification but attach quality information; do not present every silent block as valid cognition data.

### C. Specify interruption behaviour

If the tab is hidden, the window loses focus, the device changes orientation substantially or the timing budget is exceeded, mark the affected block interrupted. Do not resume with the old memory buffer after an arbitrary delay. Offer a fresh block with new memory-fill trials, preserving the aborted attempt and reason.

Deleting only the visibly interrupted trial is insufficient: subsequent decisions depend on earlier stimuli. Use a conservative block-level rule initially. Any later partial-block salvage rule must describe the dependency window and be validated.

## 4. Sequence generation needs a formal contract

The current Bernoulli generator yields approximately 30% targets over many sequences, not 30% ±2% within each short block. Integer target counts also constrain achievable percentages. Define scoredTrials separately from warmupTrials: 30 total stimuli at N=3 means 27 scored trials, while 30 scored trials requires 33 stimuli.

For a pilot, use 60 scored trials plus N fill trials and 18 targets. Generate target positions subject to declared constraints, construct digits, then independently recompute every target label. Use bounded regeneration/backtracking and fail clearly if constraints cannot be satisfied. Never accept a malformed sequence silently. Exact quotas can make endings more predictable; keep counts undisclosed and examine sequence predictability during piloting.

Lures require special care:

- A non-target lure matches another lag while differing from the required N-back lag.
- At N=1, N−1 is zero and is not a meaningful previous-item lure. Do not use seq[-0].
- N+1 lures need sufficient preceding history.
- The same digit can match multiple lags, including N. Target status takes precedence; retain all lag-match flags.
- The naive base generator already produces incidental lures. An additional 10–15% insertion probability does not equal a final 10–15% lure rate.
- A blanket ban on long repeat runs may alter target patterns, especially at 1-back. Measure the resulting distribution.

Store intended category, observed lag matches, and actual final counts. Define the lure denominator explicitly. An initial 10–15% of non-targets is suitable only as a declared experimental choice; short blocks cannot support precise lure-specific estimates.

Use a fixed digit set, font and font size for each assessment protocol. Balance hole distributions and inspect number–location and target–location associations across the sequence bank. Separate number and location RNG streams so cosmetic code cannot change the number sequence. Save the actual sequence, seed, generator version and hash.

Fix acceptance test 10: the same seed, parameters and algorithm version must reproduce the sequence. Different seeds need not produce identical sequences, nor is uniqueness guaranteed.

## 5. Scoring and statistical precision

### A. Accuracy alone is misleading

With 30% targets, never responding gives 70% accuracy. Always responding gives 30%. Balanced accuracy, (hit rate + correct-rejection rate)/2, gives 50% for either strategy and is more intelligible than raw accuracy as a user-facing summary. Still show both component rates.

Use practice containing enough examples of both classes. A possible comprehension check is six scored targets and six scored non-targets, requiring at least five hits and no more than one false alarm, following worked examples and N memory-fill trials. This is a pilot rule, not a cognitive threshold. Offer limited retraining; distinguish difficulty understanding instructions from low performance, and retain non-completion information to avoid selecting only high performers.

### B. Report sensitivity and response tendency separately

For non-zero target and non-target counts, a consistent log-linear correction is:

```
H = (hits + 0.5) / (targets + 1)
F = (falseAlarms + 0.5) / (nonTargets + 1)
dPrime = inverseNormal(H) - inverseNormal(F)
criterion = -0.5 * (inverseNormal(H) + inverseNormal(F))
```

The attachment's half-trial extreme correction is also recognised; it is not intrinsically wrong. Choose and version one method. Corrections prevent infinite values but do not make a short or disengaged block informative. With unequal denominators even all-silent corrected data can produce a non-zero estimate. Show the counts and an appropriate validity flag rather than interpreting that number as evidence of ability. [6]

d′ combines hit and false-alarm rates; it does not combine speed and accuracy or remove all strategy effects. It is a descriptive signal-detection measure with modelling assumptions, not a direct brain-capacity unit.

### C. Correct the composite formulas

The specified LISAS expression, RT + SD_RT × (P_error/P_correct), is not the published formula. The usual structure is mean correct RT + (SD_RT/SD_error) × P_error, with the scope of the standard deviations explicitly defined. A paper correcting and comparing implementations emphasises that this choice matters. Correcting the formula alone does not establish suitability for this go/no-go task. [7]

The specified throughput, hits/sum(hit_RTs), simplifies exactly to 1/mean(hit_RT). It provides no independent accuracy penalty. Remove it as a combined performance score.

The proposed IES uses median hit RT divided by overall accuracy. This is a customised variant and mixes a target-only latency with accuracy dominated by non-targets. Omit it from the primary dashboard. Retain hit RT and accuracy components separately; if a composite is later required, validate it for the intended comparisons.

### D. Thirty trials are thin evidence for individual tracking

At 30 scored trials and nine targets, one additional hit changes hit rate by 11.1 percentage points. Eight hits from nine targets looks like 88.9%, but an illustrative 95% Wilson interval is approximately 56.5–98.0%. This calculation assumes independent binomial observations and does not capture the task's serial dependencies; it illustrates imprecision, not a complete uncertainty model.

Correct-hit RT may then rest on only a handful of observations. Faster RT can also arise because the person missed their hardest targets, leaving easier responses in the RT sample.

Pilot 60–100 scored trials per N, potentially split into short blocks with new fill trials. At 60 trials and 30% targets there are only 18 targets: this is a starting point, not a reliability guarantee. Sixty scored trials at each of N=1,2,3 plus six total fill trials take approximately 8.5 minutes at 2.75 s SOA, before practice and breaks.

Show denominators, uncertainty and the number of valid hit RTs. Use null for unavailable metrics, not zero. Avoid claiming improvement from a single short session or pooling d′ indiscriminately across N levels.

## 6. Separate assessment and training

| Feature | Assessment | Training |
|---|---|---|
| Purpose | Comparable task performance | Practice and sustained engagement |
| Difficulty | Fixed, versioned | Adjusted between blocks |
| Timing | Fixed | Initially fixed; change only deliberately |
| Feedback | No correctness feedback within scored block | Correctness feedback and explanations |
| Appearance | Fixed within longitudinal protocol | Rewards and optional cosmetic variation |
| Outcome | Rates, sensitivity, latency, quality | Level, adherence and task improvement |
| Evidence of broader benefit | Independent outcome tasks | Cannot establish this from training scores alone |

The test-mode suggestion of feedback only for successful hits leaks correctness. Either remove it or use the same neutral response acknowledgement irrespective of correctness. Keep achievements and rewards outside scored blocks.

For training, start at an appropriate N after tutorial and practice, use fresh constrained sequences, and adapt only one demand at a time. Changing N, speed, target frequency and lure density simultaneously makes progress uninterpretable.

An operational pilot rule could raise N after two consecutive 60-trial blocks with hit rate ≥85% and false-alarm rate ≤15%; lower N after two consecutive blocks with hit rate <60% or false-alarm rate >30%; otherwise maintain N. Quality-failed blocks should not trigger difficulty changes. At N=1, difficulty persisting should lead to assisted practice or an offer to stop. These thresholds need tuning to avoid frustration and ceiling effects.

Use approximately 10–15 minute sessions, three to five times weekly for a four-to-six-week feasibility pilot, with optional breaks and an easy stop. This is a manageable schedule to evaluate adherence and tolerability, not an established effective treatment dose. Adaptation at block boundaries requires a fresh buffer and an explicit rule reminder.

Reward completion and appropriate challenge. Speed-only bonuses, punishing missed days and public cognitive rankings are poor fits for this goal. Adult-appropriate art and optional audio can improve usability, but alternate skins must remain tagged in the data.

Do not display recent digits during scored trials: that externalises the memory requirement. Demonstrations may show them; assessment must remove them. Additional modalities, dual n-back and distractors can become separate training variants, not automatic improvements to the measurement task.

## 7. Choose the response protocol deliberately

I would start with a large fixed match button, with keyboard activation, to reduce aiming variance. Keep random hole locations if preserving the game format, acknowledging the remaining visual-search demand. A central-stimulus reference condition can help estimate the contribution of spatial search.

Treat these as distinct protocols: aimed mouse/touch responses, six mapped keys, one fixed match button, and two-choice match/mismatch. The last provides explicit responses and RTs on non-target trials, but changes decision and inhibition demands. Do not describe them as equivalent accessibility fallbacks.

If retaining aimed whacking, separately log recognition response and spatial execution. Under a declared rule, a wrong-hole press on a target can be a recognition hit plus a spatial error, while the game outcome remains unsuccessful. This operational separation cannot prove what the person intended; inspect it empirically. Do not mix such scoring with the attachment's wrong-hole-as-miss convention.

A brief simple-response or target-acquisition baseline can reveal interface difficulty. Do not automatically subtract it from n-back RT: subtraction can add measurement error and requires its own justification.

Keep input mode and device stable for within-person comparisons where practical. Mark device changes visibly in trend data. Increasing exposure time, changing font size substantially, or using auditory digits should create a documented protocol variant. Support accessible instructions and adequate controls without pretending all accommodated versions have identical norms.

## 8. Browser implementation

React is suitable for menus, account flows, instructions and results. Keep the timed task engine separate from ordinary component state updates. Consider a pinned jsPsych version or a small custom engine with equivalent explicit timing controls; jsPsych exposes stimulus duration, trial duration and whether a response ends a trial. A library does not remove the need to validate the custom rendering and inputs. [8]

Use performance.now() and requestAnimationFrame for monotonic timing and frame-aligned visual changes. requestAnimationFrame runs before a repaint, so its timestamp is an onset estimate, not proof of when photons reached the user's eyes. Document this distinction. [9]

Replace the requirement for 'no GC hitch' with measurable tolerances and quality flags. Preload and decode assets and fonts, reuse render objects where sensible, avoid synchronous work and network dependency during blocks, and flush results asynchronously with retry. A worker can handle generation or analysis, but does not make main-thread rendering immune to delays.

Record intended and observed scheduling, dropped/long frames and dispatch delay where measurable. Avoid invented 'estimated input lag': user reaction time cannot calibrate hardware latency. Hardware-assisted testing with a photodiode and controlled input is required to estimate end-to-end timing independently. Published timing comparisons demonstrate why actual platform testing matters; results from 2020 are not a certification of browsers in 2026. [10]

The proposed ±2 frames acceptance test permits roughly ±33 ms at 60 Hz and only tests a simulation unless tied to physical measurement. Split verification into deterministic software timestamp tests, stressed-browser timing tests, and hardware timing checks if small RT differences will drive claims. A stable offset and trial-to-trial jitter have different consequences; report both.

Do not rely on orientation lock being available. Detect insufficient space before starting, provide an appropriate layout or supported-device message, and handle mid-block changes as interruptions. Ensure page scrolling and browser gesture interactions do not contaminate gameplay inputs while preserving normal accessibility elsewhere.

## 9. Data model and quality controls

Extend the existing schema with these fields or equivalents:

| Level | Essential additions |
|---|---|
| Identity | Pseudonymous participant ID; session/block/trial UUIDs; mode |
| Version | Protocol, engine, scoring, generator and asset versions |
| Sequence | Actual digits/holes; seed; hash; target and lag-match labels |
| Timing | Planned onset; onset estimate; offset; deadline; event and handler timestamps |
| Input | Method; coordinates or key; active hitbox geometry; all presses; repeats |
| Quality | Focus/visibility changes; interruption reason; timing anomalies; valid status |
| Adaptation | Previous N; new N; decision inputs; rule version |
| Context | Prior task exposure; optional sleep/fatigue and relevant testing conditions |
| Summary | Raw counts; denominators; missingness; RT sample count; uncertainty |

Use separate configuration hashes for scientifically material parameters. Store session timestamps for chronology and monotonic trial times for latency; handle reloads as new time origins. Keep raw events immutable and scoring reproducible. An append-only local queue with idempotent upload IDs prevents retries from duplicating sessions; show save status if synchronisation fails.

Quality flags should describe observations, not speculate about motivation. No responses can mean poor performance, misunderstanding, disengagement or input failure. Do not silently discard all low scores. Record why a block was excluded and report how exclusion affects the sample.

## 10. Validation programme

1. **Mechanical correctness.** Test known sequences, N boundaries, lures, exact counts, warmup, deterministic replay and score recomputation. Include never-press, always-press, duplicate events, deadline boundaries, wrong-hole events, interrupted blocks and zero-count metrics. Verify that responding at 300 ms does not alter exposure or next onset.
2. **Usability and instrumentation.** Observe a small diverse adult pilot using the intended devices. Check rule understanding, readability, accidental presses, fatigue, browser interruptions and ability to stop. Fix these before interpreting cognition results.
3. **Reliability and comparable forms.** Obtain repeated sessions with fresh matched forms, separating familiarisation from baseline. Estimate absolute-agreement test–retest reliability and within-person error, with confidence intervals. Inspect floor/ceiling effects and device/skin differences. A task can distinguish experimental conditions while being inadequate for ranking individuals.
4. **Construct validity.** Compare with a carefully matched n-back and at least one different working-memory task such as complex span. Include an interface-speed measure. Counterbalance task order; use matched alternate sequences rather than repeating the exact sequence for the same person. Correlation alone does not demonstrate score agreement or isolate working memory.
5. **Training efficacy.** Randomise participants to this training versus an active comparison matched for time, engagement, contact and plausible benefit. Prespecify independent primary outcomes, allocation and exclusions; measure expectations, adherence and attrition. Assess before, after and at follow-up, keeping outcome testing separate from recent training fatigue. Analyse between-group change, not merely improvement within the trained group.

For broader benefit, use multiple independent outcomes selected in advance: a different working-memory paradigm, reasoning if that is a claim, and a relevant functional measure. Collecting many measures and highlighting whichever improves is not convincing evidence. Choose study size using the smallest meaningful effect, measurement reliability, planned model and anticipated attrition; no fixed small pilot sample establishes efficacy.

Repeated assessment itself produces practice. Use alternate forms and a control group's expected practice trajectory. An eventual reliable-change score should adjust for expected practice and account for repeat-measurement error; do not simply divide change by the population SD. Maintain assessment performance and training progression as separate dashboard series.

If the product is ultimately meant to measure broad brain function, add independently validated measures for other domains rather than relabelling this single score. Keep domain scores visible until a composite has an explicit model, normative sample and validation. Clinical sensitivity and specificity would require a separate study against an appropriate reference standard in the intended population.

## 11. Product and governance issues in the attachment

Delete the blanket assertion that rebuilding for internal research/product is legally fine if artwork and naming are changed. The attachment does not establish relevant permissions, licences or freedom to operate. Use original assets and a distinct product name, and assess actual rights and access terms before commercial launch. A published description is not a licence to proprietary implementation materials.

Do not hard-code company access arrangements, prices or contacts as enduring facts. Confirm them if pursuing a collaboration. The precise original methods matter for a replication claim; your own pilot can proceed under an explicitly new protocol without pretending those gaps have been resolved.

Write an intended-use statement early. If the app is intended for diagnosis, screening or monitoring a medical condition, evaluate the applicable medical-device route; a disclaimer alone does not settle classification. MHRA guidance makes intended purpose central. [11]

Design for minimal collection, user-controlled export/deletion, appropriate access controls and a defined retention period. Identifiable cognitive results used to infer health can engage special-category data requirements; determine the lawful basis and applicable condition for the actual processing. A pseudonymous ID does not automatically anonymise longitudinal data. Do not automatically donate results to the original game's repository. [12]

## 12. Proposed first implementation

Build the deterministic engine, one original restrained skin, a fixed match control, and an assessment profile with 2,000 ms exposure plus 750 ms blank. Pilot 60 scored trials per N with 18 targets, fresh fill trials per block and independently checked lure labels. Use instruction checks at each new N, no correctness feedback during assessment, and explicit interruption handling.

Report hit rate, false-alarm rate, balanced accuracy, d′, response criterion, median hit RT and quality information by N. Put interpretive cautions beside weak estimates rather than making a global brain score. Keep raw accuracy available for audit.

Then add block-adaptive training, followed by repeated-session reliability testing and an independent-outcome pilot. Do not spend the initial effort on elaborate skins, leaderboards, speculative composites or machine-learned brain-age scores. The highest-value work is a trustworthy event stream, stable protocol and an experimental design capable of distinguishing practice from transfer.

## Sources and verification scope

The source attachment was read in full. Recommendations and calculations above are my analysis; proposed pilot values are not attributed to the original game. This was a targeted literature and documentation review, not a systematic evidence review or an examination of proprietary code. The original demos were not instrumented and the full Hu methods paper remains unverified.

1. Hu et al. TAG-ME again: A serious game for measuring working memory. Abstract, published online 2023; issue 2025. https://pubmed.ncbi.nlm.nih.gov/36881994/
2. Zhou et al. Does Changing the Game Metaphor Change the Assessment? 2025. https://journals.sagepub.com/doi/10.1177/10711813251360703
3. Kane et al. Working memory, attention control, and the N-back task: a question of construct validity. 2007. https://pubmed.ncbi.nlm.nih.gov/17470009/
4. Redick et al. No evidence of intelligence improvement after working memory training: a randomized, placebo-controlled study. 2013. https://pubmed.ncbi.nlm.nih.gov/22708717/
5. Pahor et al. Near transfer to an unrelated N-back task mediates the effect of N-back working memory training on matrix reasoning. 2022. https://www.nature.com/articles/s41562-022-01384-w
6. Hautus. SDT Assistant Manual, version 2.0. Correction procedures. https://hautus.org/resources/SDT%20Assistant%20Manual%20-%20V.%202.0%20-%202021.pdf
7. Liesefeld and Janczyk. Same same but different: Subtle but consequential differences between two measures to linearly integrate speed and accuracy (LISAS vs. BIS). Online 2022; issue 2023. https://link.springer.com/article/10.3758/s13428-022-01843-2
8. jsPsych v8, html-keyboard-response documentation. https://www.jspsych.org/v8/plugins/html-keyboard-response/
9. MDN. Window.requestAnimationFrame. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
10. Bridges et al. The timing mega-study: comparing a range of experiment generators, both lab-based and online. 2020. https://peerj.com/articles/9414/
11. MHRA. Crafting an intended purpose in the context of software as a medical device. https://www.gov.uk/government/publications/crafting-an-intended-purpose-in-the-context-of-software-as-a-medical-device-samd
12. ICO. What is special category data? https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
