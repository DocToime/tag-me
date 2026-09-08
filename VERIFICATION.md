# Implementation verification

Run date: 8 September 2026.

## Environment

- Node.js 22.19.0; npm 11.4.2.
- React 19.2.7, TypeScript 5.9.3, Vite 6.4.3.
- Vitest 3.2.7; Playwright 1.55.1 using installed Google Chrome.
- Desktop viewport 1440 × 1060; mobile viewport 390 × 844.
- Browser test data is isolated in test contexts and does not populate the user's garden.

## Run record

Final expanded checks are being completed; the final counts and results will be recorded here before handoff.

The initial checks passed all 24 deterministic tests and four browser workflows, including a complete training round and persisted result inspection. The expanded suite adds aimed mobile controls, storage failure, adaptive progression, and a complete 1/2/3 assessment battery.

## Verification boundaries

- Core scheduling tests use an injected clock. Long browser flows use Playwright's clock while exercising real DOM rendering, inputs, IndexedDB, navigation, and exports.
- Desktop and mobile screenshots are visually inspected, in addition to checks for horizontal overflow.
- Browser timing describes software scheduling; no physical input/display latency apparatus was used.
- A mobile viewport check is not a real-device touchscreen trial. Firefox and Safari are not included in the current browser run.
- Local storage failure is explicitly simulated. A hard reload preserves finished attempts and records an interrupted session; in-flight raw trial events may be lost.
- No app has been deployed or connected to any external data service.
