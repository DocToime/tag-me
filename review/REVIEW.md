# Recall Garden: testing and design review

9 September 2026 · Historical review of baseline `800413f`

The reviewed improvements have since been implemented. See [implementation verification](../VERIFICATION.md) and [current screenshots](implemented/checks.json) for the updated app. Source line references below refer to the baseline.

The tested game mechanics are in good shape. The interface needs a focused simplification before wider player testing: it gives too much space to introductory language, repeated explanations, and statistics, while essential controls fall below the screen on common devices. The most urgent change is to make the complete play area and response control fit together.

Keep the garden artwork, warm colours, and clear primary-button styling. Their character is useful. Reduce the surrounding material and make the next action much more prominent.

At the time of this review, the app source had not been changed. This folder contains the review, reproducible audit scripts, screenshots, measurements, and a [clickable layout proposal](proposed-layout.html). The proposal is a visual study with illustrative states, not an implemented game or a replacement scoring engine.

## What was tested

| Check | Result |
| --- | --- |
| Existing unit tests | **24 passed**, including constrained sequences across 600 training seeds, scoring, timing boundaries, and adaptation |
| Production build | **Passed** TypeScript and Vite build |
| Source formatting | **Passed** |
| Existing browser suite | **9 passed** in 6.4 minutes, using installed Chrome 153.0.8010.36 |
| Additional responsive audit | **13 viewport sizes × 4 states**: home, tutorial, active fixed-input practice, and successful practice result |
| Additional interaction checks | Accessibility tree, text contrast samples, dialog keyboard handling, page focus, and resizing across a breakpoint |
| Firefox 141 on Linux | Home → tutorial → real-clock practice → Space response → stop passed |
| WebKit 26 on Linux | Initial smoke attempt timed out; isolated real-clock and controlled-clock follow-ups both reached play, accepted Space, and stopped successfully |
| Layout proposal | Board and match control fit without page scrolling in six checked phone, landscape, and laptop viewports, including after response acknowledgement |

The existing browser tests cover completed training, practice failure, aimed controls, settings persistence, interruption/reload recovery, IndexedDB failure, export/download initiation, deletion, adaptation, and the full assessment battery. These are useful checks. They do not establish that a human can comfortably see or reach the controls.

Most long rounds use a controlled clock. Reported reaction times in screenshots are automated inputs, not human performance or a latency benchmark. The responsive audit uses desktop Chrome with viewport and touch-capability settings; it does not reproduce mobile browser chrome, notches, or physical touch latency. Firefox/WebKit checks were smoke tests, not the full suite. An actual iPhone/Safari and Android/Chrome pass is still needed. The 640 × 360 check represents the effective CSS viewport of a 1280 × 720 window at 200% zoom; it was not a native browser zoom test. This is an expert inspection and automated review, not a study with representative players or a full accessibility certification.

The sandbox initially prevented the local server from listening; the authorised local run succeeded. The default Playwright browser binary was absent, so the existing `PLAYWRIGHT_CHANNEL=chrome` option was used. These were environment issues, not failed app behaviour. Git revision/diff verification was unavailable because HEAD refers to an empty object (`800413f73d01689b935558f0c762369daa3d9ee7`). No Git repair was attempted.

## Priority 1: essential controls must fit

### 1. The match button disappears below the screen on normal laptops and small phones

**Confirmed layout defect.** Start training, finish the example, and let practice begin without scrolling. The fixed match control is entirely below the initial viewport at 1280 × 720, 1366 × 768, and both tested landscape phone sizes. At 320 × 568, only its top 12 pixels are initially within the viewport.

| CSS viewport | Board top–bottom | Match button top–bottom | Board and button both fully visible at start? |
| --- | --- | --- | --- |
| 320 × 568 | 242–512 | 556–612 | **No** |
| 360 × 640 | 242–512 | 556–612 | Yes; page still has 16 px of vertical overflow |
| 375 × 667 | 242–512 | 556–612 | Yes |
| 390 × 844 | 245–540 | 584–640 | Yes |
| 430 × 932 | 245–540 | 584–640 | Yes |
| 667 × 375, landscape | 245–540 | 584–640 | **No** |
| 844 × 390, landscape | 336–671 | 722–780 | **No** |
| 768 × 1024 | 336–671 | 722–780 | Yes |
| 1024 × 768 | 336–706 | 757–815 | **No** |
| 1280 × 720 | 353–723 | 774–832 | **No** |
| 1366 × 768 | 353–723 | 774–832 | **No** |
| 1440 × 900 | 353–723 | 774–832 | Yes |
| 1920 × 1080 | 360–730 | 781–839 | Yes |

Coordinates are rounded CSS pixels, measured from the top with scroll position zero. Browser toolbars would reduce the available space further. See the [laptop screenshot](evidence/1280x720-play.png), [small phone](evidence/320x568-play.png), and [landscape screenshot](evidence/844x390-play.png).

The cause is cumulative: the top bar, disabled desktop sidebar, stage label, level pill, large slogan, instruction, progress row, fixed-height board, feedback row, button, and another instruction. On a laptop, the board does not start until y=353. The `.is-playing` rules hide navigation only below 680 px. The current test viewport is unusually tall at 1440 × 1060, which conceals this problem.

**Recommended change:** use a dedicated play layout at every width. Show one compact row containing level, progress, and Stop; one short rule; the board; and the match control. Remove the motivational heading and app navigation during a round. Give the board the remaining viewport height using a grid/flex layout with shrinking children. Use a side control panel in short landscape viewports. Reserve space for feedback and the response button before allocating the board height. Include safe-area spacing on actual phones.

Do not fix this by merely hiding body overflow: that would make the response button inaccessible. Do not solve it by shrinking important text. Keep the digit large, stable, and readable and retain the six-hole arrangement and recorded timing.

**Acceptance:** at all listed sizes, all six holes, the current digit, Stop, and the entire match control are visible simultaneously at zero scroll, with no overlap during countdown, exposure, blank, or acknowledgement. Verify touch gestures cannot scroll the play area accidentally.

Source: [styles.css](../src/styles.css), especially lines 1053–1250 and 2085 onwards; [Play.tsx](../src/components/Play.tsx), line 180 onwards.

### 2. Tablet navigation loses its accessible names

**Confirmed accessibility defect.** At 768 × 1024, Chrome's accessibility tree reports four unnamed navigation buttons and an unnamed brand link. The 681–900 px layout hides their text with `display: none`, and the SVG icons are also hidden from assistive technology. `getByRole('button', {name: 'My garden'})` finds zero matches at this size.

Add stable accessible names to the controls, preserve text for screen readers, and give sighted users a label or tooltip for unfamiliar icons. Expose the selected page with `aria-current`. Level and assessment choices should also communicate their selected state with native radios or `aria-pressed`, rather than relying on their colour or a printed tick. Programmatic control names and states are addressed by [W3C's Name, Role, Value guidance](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html).

Source: [styles.css](../src/styles.css), line 1614; [App.tsx](../src/App.tsx), navigation around line 440. Evidence: [interaction.json](evidence/interaction.json).

### 3. Too much of the text is tiny and faint

**Confirmed sampled contrast failures.** At 390 × 844:

| Text sample | Font size | Contrast against rendered background |
| --- | --- | --- |
| Hero description | 12 px | 3.46:1 |
| Duration / “At your own pace” | 9 px | 3.29:1 |
| Stat descriptions | 8 px | 3.02:1 |
| Setup footnote | 9 px | 3.36:1 |
| Starting-level label | 11 px | 4.73:1 |

The first four fall below the 4.5:1 threshold for ordinary text in [W3C's minimum contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). This was a targeted sample, not a whole-page contrast scan.

Keep pale greens for surfaces, but use darker text. Aim for roughly 14–16 px for instructions and important labels and 12–14 px for secondary information. These font sizes are design recommendations, not WCAG minimum font-size rules. Recover space by deleting words and excess spacing rather than making text smaller. Preserve a clear focus outline on all interactive controls, including chart points.

## Priority 2: reduce the work required to start and continue

### 4. The home page is a long introduction with the settings underneath it

**Confirmed layout plus design recommendation.** On 390 × 844, the home document is **1,804 px tall**. The settings card begins at **y=808**, behind the initial bottom-navigation area. The hero alone has a forced **595 px minimum height**. The home main content contains about 199 words on mobile, before counting surrounding navigation.

The Start button is visible early, which is good. However, choosing a level or session length requires scrolling down, and then returning to the only Start button above. A new player can also start without ever seeing the chosen level or response style. See [mobile home](evidence/390x844-home.png).

**Recommended order:** small brand/header → level and duration → Start training → optional How to play. Put the current level and expected duration next to the action. Move lifetime statistics to Progress; move response style and pace to Settings; keep Assessment as a secondary route. Reduce the large landscape illustration to a small brand detail. Drop the daily date, faux “You” avatar, welcome slogan, decorative badges, repeated privacy text, and motivational footer.

Retain one accurate duration note such as “About 9 min + practice and breaks.” “At your own pace” is misleading beside a timed game; “Breaks between rounds” is more useful.

Source: [App.tsx](../src/App.tsx), lines 657 onwards; [styles.css](../src/styles.css), line 2259.

### 5. Home has real horizontal overflow at 320 px

**Confirmed layout defect.** At 320 × 568 the document width is **337 px**. The setup and help cards expand to approximately 319 px inside a 284 px content column. This is independent of the vertical-scrolling issue. See [320 px screenshot](evidence/320x568-home.png).

Allow grid children to shrink, use `minmax(0, 1fr)` where appropriate, and let the setup-card heading and optional tag wrap or stack. Check the actual overflowing children; clipping the page would conceal the problem. Retest with longer labels and enlarged text.

Source: [styles.css](../src/styles.css), `.dashboard-grid`, `.section-heading`, `.level-options`, and mobile overrides. Measurements: [followup.json](evidence/followup.json).

### 6. The tutorial is long, repetitive, and compulsory on every normal start

**Confirmed flow plus design recommendation.** The normal route requires Start → five Next number clicks → Try it in practice → a full practice → Start scored round. That is eight activations before scored play, in addition to practice responses. Each session resets verification and starts at the example again. There is no direct “I know how—start practice” action on that route.

At 375 × 667 the first example's actions are at **y=738–782**, below the viewport; at 390 × 844 their bottom edge slightly meets the fixed bottom bar. The title, large mole illustration, explanation space, three additional instruction blocks, and practice criteria together make this much longer than it needs to be. See [tutorial screenshot](evidence/390x844-tutorial.png).

Use one compact rule and one worked example with the comparison visually marked. The phrase “If it appears again” should be “If it matches the number exactly N turns ago.” Once the rule is shown, let the user try the actual Match control. Offer the full worked walkthrough as optional help. Returning players should reach the existing required practice directly; simplifying the walkthrough need not bypass comprehension checks or change assessment eligibility.

Pass the selected response style into the tutorial: aimed players currently read “Press the match control” even though their play screen asks them to tap a mole. Keep the rule, controls, and selected level consistent.

Source: [App.tsx](../src/App.tsx), `Tutorial` at line 49, `start` around line 288, and instruction rendering around line 538.

### 7. The home example teaches a different level from the selected game

**Confirmed content mismatch.** The default selection is 1-back, while the home help card always shows `2 → 5 → 2` as a 2-back match. The paragraph does label it as 2-back, so it is not a scoring error, but it introduces an unnecessary competing rule. “See a familiar number?” also encourages matching any earlier repetition.

Bind the example to the selected level: `2 → 2` for 1-back, `2 → 5 → 2` for 2-back, and `2 → 5 → 8 → 2` for 3-back. Label the compared number “1/2/3 turns ago.” Replace decorative difficulty descriptions with those literal meanings.

Source: [App.tsx](../src/App.tsx), line 822 and starting-level controls above it.

### 8. Practice completion looks like a statistics report before it lets you continue

**Confirmed layout plus design recommendation.** A successful practice shows a large symbol, three lines of celebration/explanation, four metrics, and detailed-data disclosure before the main action. At 375 × 667, the buttons are at **y=685–729**, below the screen. At 320 × 568, they are at **y=699–743**. Disabled bottom navigation still takes space during the break.

Use “Practice passed” followed by “6 of 6 matches caught · no false alarms” and a prominent Start round button. Put technical metrics in a disclosure below the action. On failure, say what to change: “Caught 4 of 6 matches. Aim for 5; try again.” Hide irrelevant navigation throughout the in-session tutorial/break flow as well as active play. See [practice result](evidence/375x667-practicePassed.png).

The gate also rejects otherwise successful practice when long frames are recorded. Code inspection shows this can still receive generic “Catch at least 5…” retry advice. Distinguish a timing problem from a comprehension problem and explain why a retry is needed. This branch was inspected in code, not reproduced with an injected frame fault.

Source: [App.tsx](../src/App.tsx), break rendering around line 545; [Results.tsx](../src/components/Results.tsx), `BlockResult`; [protocol.ts](../src/game/protocol.ts), line 87.

### 9. Feedback competes with remembering the number

**Design recommendation based on the rendered flow.** During the short blank interval, players see full sentences such as “✓ Different number. Good wait.” Between those messages they see “Stay with the rhythm.” The same screen already includes the main instruction and “No match? No action needed.” This adds reading during a memory task.

Keep one persistent rule. Use short, stable feedback: “Correct”, “Missed match”, “No match”, and a small response acknowledgement. Teach the meaning during practice. Keep correctness feedback absent in assessment and keep feedback from moving the board or control. On touch-only devices, omit the Space badge. In the fixed-input mode, clearly teach use of the button: the mole artwork otherwise suggests that the mole itself is the tap target, although those holes are disabled.

Source: [Play.tsx](../src/components/Play.tsx), lines 168–294. The current single-response rule and independent stimulus timing should be preserved.

## Further functional and results improvements

### 10. Dialog closure loses keyboard focus

**Confirmed functional defect.** Focus Explore assessment, activate it with Enter, and press Escape. Focus returns to BODY rather than the opener. Initial dialog focus and Shift+Tab wrapping do work.

The restoration effect records `document.activeElement` after the dialog's `autoFocus` has already run, so it can retain a soon-to-be-removed dialog control. Capture the opener before setting the modal state, restore it after closing, and add a keyboard regression check. Page/stage transitions also leave focus on BODY; focus an appropriate heading or first action without accidentally activating the game.

Source: [App.tsx](../src/App.tsx), lines 244–278. Evidence: [followup.json](evidence/followup.json).

### 11. A one-pixel resize can move the board substantially without interrupting

**Confirmed functional defect relative to the documented resize protection.** Start practice at 681 × 844 and resize to 680 × 844. The board moves from **(110,336), 543 × 335** to **(18,245), 644 × 295**, while the round remains in its visible phase. The browser width changed by one pixel, but the responsive layout moved the board by about 92 px horizontally and 91 px vertically.

The handler watches viewport deltas rather than the playfield geometry. Observe the actual playfield and coordinate layout transitions with the round. Define what size/position change requires a clean restart, especially for aimed input. Preserve the current no-resume behaviour for interrupted memory sequences. Do not allow a responsive redesign to silently move targets mid-trial.

Source: [Play.tsx](../src/components/Play.tsx), lines 104–110. Evidence: [interaction.json](evidence/interaction.json).

### 12. Results give interrupted attempts and technical data too much prominence

**Observed output plus design recommendation.** After stopping and restarting a scored round, the final results put the earlier interrupted attempt first, including a full row of empty metrics. The completed result appears below it. The page also prints raw browser user-agent and viewport details in the main flow. See [results screenshot](evidence/results-with-interrupted-attempt.png).

Lead with completed rounds and a clear next action. Put interrupted attempts in their own collapsed list, alongside the existing collapsed practice attempts. Retain raw data for export and detailed inspection. Keep balanced accuracy correctly labelled and preserve the underlying match-detection and false-alarm counts; replacing it with an unexplained “score” would lose useful meaning. Move reaction-time detail below the primary outcome unless the user explicitly opens it.

Progress filters should show understandable settings such as “2 seconds · Match button”; keep the protocol hash in technical details. The current separation by mode, level, and protocol is valuable and should remain.

The chart's interactive points have radius 6 in a 680-unit SVG that scales down on phones, so their direct hit area becomes especially small. Enlarge the interaction area independently of the visible dot and offer an accessible list of rounds. The exact target-size compliance outcome also depends on surrounding spacing and alternatives; it was not fully audited. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) explains those exceptions.

Source: [Results.tsx](../src/components/Results.tsx), `SessionResults` at line 134, protocol filter around line 246, chart points around line 310; [App.tsx](../src/App.tsx), line 638.

## Copy changes ready for the developer

| Current | Recommended |
| --- | --- |
| “A little focus. A growing memory.” | “Ready for a round?” |
| “Your mind has room to grow” / “A small daily practice” | Remove |
| “Find your rhythm” / “Stretch your focus” / “Go a little deeper” | “1 turn ago” / “2 turns ago” / “3 turns ago” |
| “A number. A memory. A match.” | “Match the number from 2 turns ago” — use selected level |
| “Notice. Remember. Match.” | Remove; keep the literal rule |
| “Memory fill · just remember” | “Remember these first 2 numbers” — use selected level |
| “Stay with the rhythm” / “Your garden is ready” | Remove |
| “It’s a match” | “Match” with Space hint when relevant |
| “You’ve got the rhythm.” | “Practice passed” |
| “Let’s give it another go.” | “Try practice again” plus the actual reason |
| “Ready for a fresh start?” | “Round stopped” or “Round interrupted”, according to cause |
| “A little time, well spent.” | “Session complete” |
| “Small steps. Visible progress.” | “Your progress” |
| “Make yourself comfortable.” | “Settings” |
| “A moment to measure” / “Full check-in” | “Assessment” / “All three levels” |
| “Seeds of progress” / “Your own quiet corner” / motivational footer | Remove |

Warmth can come from the illustration, colour, and occasional short encouragement. It does not need a separate slogan in each section.

## Suggested implementation order and acceptance checks

1. **Fix active play geometry first.** Hide the app shell during play at every breakpoint, allocate viewport height deliberately, and add a short-landscape arrangement. Check all phases at the 13 measured sizes, plus actual mobile browser controls and enlarged text. Keep the match target comfortably large; the prototype uses 56 px height as a usability choice.
2. **Reorder home and reduce onboarding.** Keep settings with Start, make the example agree with the selected N and response style, and offer direct access to required practice for returning users. Preserve session duration choices and comprehension checks.
3. **Compact break/results screens and replace copy.** Put Continue before detailed statistics; separate interrupted attempts; retain exports and explain storage failures visibly.
4. **Repair accessibility and resize handling.** Check accessible names at 680/681/900/901 px, keyboard focus return, selected states, readable contrast, and actual board geometry across breakpoints.
5. **Retest and observe players.** Rerun the existing mechanics/browser suites. Add viewport-intersection checks instead of relying only on `toBeVisible()`—an element can pass that assertion while being below the fold, and automated clicks can scroll it into view. Test touch taps, button visibility after feedback, long labels, and no overlap from fixed navigation. Ask representative new and returning players to explain the rule and start a short session without coaching; observe wrong-target taps, scrolling, and retry comprehension.

The [layout proposal](proposed-layout.html) demonstrates the intended hierarchy and reuses the existing mole drawing. Switch between Home, Learn, Play, and Practice done, and resize the browser. It retains the default three-round choice. At 320 × 568, its active board and response button fit within the viewport; at 1280 × 720 they also fit, where the current app's button is off-screen. The proposal home still has a little scrolling on the smallest phone and landscape; the critical requirement is that setup and Start stay together and active play requires none. It is not a final accessibility, device, or gameplay validation.

## Evidence and reproduction

- [Responsive measurements](evidence/responsive.json), including per-state overflow, control rectangles, and page heights.
- [Interaction and accessibility results](evidence/interaction.json), plus [isolated follow-up results](evidence/followup.json).
- [Proposal measurements](evidence/proposal.json), [small-phone proposal screenshot](evidence/proposed-320x568-play.png), and [laptop proposal screenshot](evidence/proposed-1280x720-play.png).
- [Current mobile home](evidence/390x844-home.png), [tutorial](evidence/390x844-tutorial.png), [practice completion](evidence/375x667-practicePassed.png), [laptop gameplay](evidence/1280x720-play.png), [landscape gameplay](evidence/844x390-play.png), [progress](evidence/progress-desktop.png), and [aimed mobile gameplay](evidence/aimed-mobile.png).

From the repository root, with the local Vite server available at `http://127.0.0.1:5173`:

```sh
npm test
npm run build
npm run format:check
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
node review/responsive-audit.mjs
node review/interaction-audit.mjs
node review/followup-audit.mjs
node review/proposal-check.mjs
```

The original `responsive-audit.mjs`, `interaction-audit.mjs`, and `followup-audit.mjs` target the pre-redesign UI and require that baseline build. Use `tests/usability.spec.ts` and `implementation-audit.mjs` for the current app.

The audit scripts record observations, including failures; they are not regression suites that assert every layout is correct. They use installed Chrome. The additional Firefox/WebKit scripts contain this machine's cached executable paths, which need adjusting elsewhere. Screenshots and generated JSON contain only synthetic local test sessions.
