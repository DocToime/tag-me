// Read-only probes for DUAL_NBACK_IMPLEMENTATION_REVIEW.md.
// Run from the repository root: node review/dual-plan-probes.mjs
// The dual generator below is an experimental interpretation of plan v1.0,
// not a production implementation or validation of a future implementation.
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temporary = await mkdtemp(join(tmpdir(), "dual-plan-review-"));
try {
  for (const name of ["types", "sequence", "scoring", "protocol"]) {
    const source = await readFile(new URL(`../src/game/${name}.ts`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText.replace(/from "(\.\/[^".]+)"/g, 'from "$1.mjs"');
    await writeFile(join(temporary, `${name}.mjs`), compiled);
  }
  const { generate, hash, label } = await import(pathToFileURL(join(temporary, "sequence.mjs")));
  const { classify, summarize, wilson } = await import(pathToFileURL(join(temporary, "scoring.mjs")));
  const { protocol, configHash } = await import(pathToFileURL(join(temporary, "protocol.mjs")));
  const c = protocol(2, "training");
  const sequence = generate(c, "review-projection");
  const trials = sequence.map((stimulus) => {
    const press = stimulus.target ? { eventTime: 300, handlerTime: 300, method: "keyboard", stream: "number" } : null;
    return {
      id: String(stimulus.i), stimulus, plannedOnset: 0, onset: 0, deadline: 2000,
      offset: 2000, response: null, rt: null, code: "pending",
      numberResponse: press, numberRt: press ? 300 : null,
      numberCode: classify(stimulus, press, "fixed"),
    };
  });
  const incompleteProjection = summarize(trials.map((t) => ({ ...t, code: t.numberCode, rt: t.numberRt })));
  const completeProjection = summarize(trials.map((t) => ({ ...t, code: t.numberCode, rt: t.numberRt, response: t.numberResponse })));
  assert.deepEqual(incompleteProjection.flags, ["No scored responses"]);
  assert.deepEqual(completeProjection.flags, []);
  const target = sequence.find((s) => s.target);
  const response = { eventTime: 300, handlerTime: 300, method: "keyboard", stream: "number" };
  assert.equal(classify(target, response, "dual"), "miss");
  const silent = summarize(trials.map((t) => ({ ...t, code: classify(t.stimulus, null, "fixed") })));
  const always = summarize(trials.map((t) => ({ ...t, response, rt: 300, code: classify(t.stimulus, response, "fixed") })));

  function random(seed) {
    let a = parseInt(hash(seed), 16);
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function candidate(c, alphabet, catsRng, pickRng) {
    const categories = shuffle([
      ...Array(c.targets).fill("target"), ...Array(c.lures).fill("lure"),
      ...Array(c.scoredTrials - c.targets - c.lures).fill("ordinary"),
    ], catsRng);
    const values = [];
    for (let i = 0; i < c.n + c.scoredTrials; i++) {
      const cat = i < c.n ? "fill" : categories[i - c.n];
      const prior = values[i - c.n];
      const adjacent = [c.n - 1, c.n + 1].filter((l) => l > 0 && i >= l).map((l) => values[i - l]);
      const choices = alphabet.filter((v) =>
        !(i >= 3 && values.slice(-3).every((x) => x === v)) &&
        (cat === "fill" || (cat === "target" ? v === prior : cat === "lure" ? v !== prior && adjacent.includes(v) : v !== prior && !adjacent.includes(v))),
      );
      if (!choices.length) return null;
      values.push(choices[Math.floor(pickRng() * choices.length)]);
    }
    return { values, labels: label(values, c.n) };
  }
  function prototype(c, seed, retainValidStream = false) {
    const rngs = ["digits:cats", "digits:pick", "holes:cats", "holes:pick"].map((suffix) => random(`${seed}:${suffix}`));
    const band = c.mode === "practice" ? [1, 4] : [4, 8];
    let digits = null, holes = null;
    for (let attempt = 1; attempt <= 8000; attempt++) {
      if (!retainValidStream || !digits) digits = candidate(c, [1,2,3,4,5,6,7,8,9], rngs[0], rngs[1]);
      if (!retainValidStream || !holes) holes = candidate(c, [0,1,2,3,4,5], rngs[2], rngs[3]);
      if (!digits || !holes) continue;
      const overlap = digits.labels.filter((d, i) => d.target && holes.labels[i].target).length;
      const conflict = digits.labels.filter((d, i) => (d.target && holes.labels[i].lure) || (d.lure && holes.labels[i].target)).length;
      const lock = digits.values.filter((d, i) => d === holes.values[i] + 1).length;
      if (overlap < band[0] || overlap > band[1] || overlap / c.targets > 0.5 ||
          (c.mode !== "practice" && conflict < 2) || lock / digits.values.length > 0.25) {
        digits = null; holes = null;
        continue;
      }
      // Independent raw-value verification, separate from the production label helper.
      for (const stream of [digits, holes]) {
        let targets = 0, lures = 0;
        stream.values.forEach((v, i, values) => {
          if (i < c.n) return;
          const target = v === values[i - c.n];
          const lure = !target && [c.n - 1, c.n + 1].some((lag) => lag > 0 && i >= lag && v === values[i - lag]);
          targets += Number(target); lures += Number(lure);
          assert.equal(stream.labels[i].target, target);
          assert.equal(stream.labels[i].lure, lure);
        });
        assert.equal(targets, c.targets); assert.equal(lures, c.lures);
      }
      return { attempt, overlap, conflict, digits: digits.values, holes: holes.values };
    }
    return { failed: true, attempt: 8000 };
  }
  const banks = [];
  for (const retainValidStream of [false, true]) {
  for (const mode of ["training", "practice"]) {
    for (const n of [1,2,3]) {
      const counts = {}, attempts = [], times = [], failedSeeds = [];
      const config = protocol(n, mode);
      const seeds = mode === "practice" ? 30 : 200;
      for (let seed = 0; seed < seeds; seed++) {
        const start = performance.now();
        const result = prototype(config, String(seed), retainValidStream);
        times.push(performance.now() - start);
        assert.deepEqual(prototype(config, String(seed), retainValidStream), result);
        attempts.push(result.attempt);
        if (result.failed) failedSeeds.push(String(seed));
        else counts[result.overlap] = (counts[result.overlap] || 0) + 1;
      }
      attempts.sort((a,b) => a-b); times.sort((a,b) => a-b);
      banks.push({ strategy: retainValidStream ? "retain-valid-stream" : "retry-whole-pair", mode, n, seeds, failedSeeds, overlapHistogram: counts, maxAttempts: attempts.at(-1), p95Attempts: attempts[Math.ceil(seeds * .95)-1], maxMs: times.at(-1), p95Ms: times[Math.ceil(seeds * .95)-1] });
    }
  }
  }
  const output = {
    baseline: { node: process.version, note: "Local probes; prototype timing is not a browser/device benchmark." },
    projection: { hits: incompleteProjection.hits, omittedResponseFlags: incompleteProjection.flags, correctedFlags: completeProjection.flags },
    classifierWithDualInput: classify(target, response, "dual"),
    correctedDPrime: { silent: silent.dPrime, alwaysPress: always.dPrime, silentBalancedAccuracy: silent.balancedAccuracy },
    practiceOverlapAllowedByAllPlanRules: [1,2,3,4].filter((d) => d/6 <= .5),
    conjunctionIntervals: { fourOfFour: wilson(4,4), eightOfEight: wilson(8,8) },
    identityGolden: [1,2,3].map((n) => ({ n, seed: "review-golden", sequenceHash: hash(generate(protocol(n,"training"),"review-golden")), configHash: configHash(protocol(n,"training")) })),
    prototypeBanks: banks,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
