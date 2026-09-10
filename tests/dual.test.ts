import { describe, expect, it } from "vitest";
import { generate, label, hash } from "../src/game/sequence";
import { classify, summarize } from "../src/game/scoring";
import {
  configHash,
  dualProtocol,
  passedDualPractice,
  passedPractice,
  protocol,
  prepareDualBlock,
} from "../src/game/protocol";
import {
  generateDual,
  overlapBandFeasible,
  PreparationError,
} from "../src/game/dualSequence";
import {
  conjunction,
  finalizeDualTrial,
  projectStream,
  summarizeDual,
} from "../src/game/dualScoring";
import { isDualBlock, type DualTrial, type N } from "../src/game/types";

function oracle(values: number[], n: number) {
  return values.map((v, i) => {
    const warmup = i < n;
    const target = !warmup && v === values[i - n];
    const lure =
      !warmup &&
      !target &&
      [n - 1, n + 1].some(
        (lag) => lag > 0 && i >= lag && v === values[i - lag],
      );
    return { warmup, target, lure };
  });
}

function dualTrialFromStimulus(
  stimulus: DualTrial["stimulus"],
  positionPress: boolean,
  numberPress: boolean,
): DualTrial {
  const press = (stream: "position" | "number") => ({
    eventTime: 200,
    handlerTime: 200,
    method: "keyboard",
    stream,
    control: stream,
  });
  const trial: DualTrial = {
    id: `t${stimulus.i}`,
    stimulus,
    plannedOnset: 0,
    onset: 0,
    deadline: 2000,
    offset: 2000,
    response: null,
    rt: null,
    code: "pending",
    positionResponse: positionPress ? press("position") : null,
    numberResponse: numberPress ? press("number") : null,
    positionRt: positionPress ? 200 : null,
    numberRt: numberPress ? 200 : null,
    positionCode: "pending",
    numberCode: "pending",
  };
  finalizeDualTrial(trial);
  return trial;
}

describe("identity freeze", () => {
  it("keeps 1-3-back hashes for seed seed", () => {
    expect(hash(generate(protocol(1, "training"), "seed"))).toBe("8eadaf0d");
    expect(hash(generate(protocol(2, "training"), "seed"))).toBe("c898454e");
    expect(hash(generate(protocol(3, "training"), "seed"))).toBe("5dc8c1bd");
  });
  it("keeps review-golden identity fingerprints", () => {
    expect(configHash(protocol(1, "training"))).toBe("cde18653");
    expect(configHash(protocol(2, "training"))).toBe("7a28b8f0");
    expect(configHash(protocol(3, "training"))).toBe("03e96915");
    expect(hash(generate(protocol(1, "training"), "review-golden"))).toBe(
      "d4dc7121",
    );
    expect(hash(generate(protocol(2, "training"), "review-golden"))).toBe(
      "99aff584",
    );
    expect(hash(generate(protocol(3, "training"), "review-golden"))).toBe(
      "aa16f486",
    );
  });
});

describe("dual labels", () => {
  it("matches the golden N=2 hole and digit fixture", () => {
    const holes = [2, 5, 2, 4, 2];
    const digits = [7, 3, 1, 3, 1];
    const pos = label(holes, 2);
    const num = label(digits, 2);
    expect(pos.map((s) => [s.warmup, s.target])).toEqual([
      [true, false],
      [true, false],
      [false, true],
      [false, false],
      [false, true],
    ]);
    expect(num.map((s) => [s.warmup, s.target])).toEqual([
      [true, false],
      [true, false],
      [false, false],
      [false, true],
      [false, true],
    ]);
    expect(oracle(holes, 2).map((s) => s.target)).toEqual(
      pos.map((s) => s.target),
    );
    expect(oracle(digits, 2).map((s) => s.target)).toEqual(
      num.map((s) => s.target),
    );
  });
});

describe("dual generator", () => {
  it("rejects impossible bands and configs", () => {
    expect(overlapBandFeasible(6, 6, 12, [1, 3])).toBe(true);
    expect(overlapBandFeasible(6, 6, 12, [4, 4])).toBe(false);
    expect(() =>
      generateDual({ ...dualProtocol(1, "training"), targets: 70 }, "x"),
    ).toThrow(PreparationError);
    expect(() =>
      generateDual(
        { ...dualProtocol(1, "practice"), dualTargetBand: [4, 8] },
        "x",
      ),
    ).toThrow(/feasible/);
  });
  it("replays the same seed and satisfies joint quotas", () => {
    const config = dualProtocol(2, "training");
    const a = generateDual(config, "seed");
    const b = generateDual(config, "seed");
    expect(a.sequence).toEqual(b.sequence);
    expect(a.diagnostics.D).toBeGreaterThanOrEqual(4);
    expect(a.diagnostics.D).toBeLessThanOrEqual(8);
  });
  it("builds N=1 training seed 184", () => {
    const { sequence, diagnostics } = generateDual(
      dualProtocol(1, "training"),
      "184",
    );
    expect(sequence).toHaveLength(61);
    expect(diagnostics.D).toBeGreaterThanOrEqual(4);
    expect(diagnostics.conflict).toBeGreaterThanOrEqual(2);
  });
  it("enforces independent oracles, quotas, D band, and conflicts", () => {
    const sweeps: [N, number, "training" | "practice"][] = [
      [1, 200, "training"],
      [2, 200, "training"],
      [3, 200, "training"],
      [4, 200, "training"],
      [5, 200, "training"],
      [8, 30, "training"],
      [12, 30, "training"],
      [1, 30, "practice"],
      [2, 30, "practice"],
      [3, 30, "practice"],
      [4, 30, "practice"],
      [5, 30, "practice"],
      [8, 30, "practice"],
      [12, 30, "practice"],
    ];
    for (const [n, count, mode] of sweeps) {
      const config = dualProtocol(n, mode);
      for (let seed = 0; seed < count; seed++) {
        const { sequence, diagnostics } = generateDual(config, String(seed));
        expect(sequence).toHaveLength(n + config.scoredTrials);
        const digits = sequence.map((s) => s.digit);
        const holes = sequence.map((s) => s.hole);
        const numOracle = oracle(digits, n);
        const posOracle = oracle(holes, n);
        const numLabels = label(digits, n);
        const posLabels = label(holes, n);
        expect(numLabels.map((s) => s.target)).toEqual(
          numOracle.map((s) => s.target),
        );
        expect(posLabels.map((s) => s.target)).toEqual(
          posOracle.map((s) => s.target),
        );
        expect(sequence.map((s) => s.target)).toEqual(
          numLabels.map((s) => s.target),
        );
        expect(sequence.map((s) => s.positionTarget)).toEqual(
          posLabels.map((s) => s.target),
        );
        expect(sequence.filter((s) => s.target)).toHaveLength(config.targets);
        expect(sequence.filter((s) => s.lure)).toHaveLength(config.lures);
        expect(sequence.filter((s) => s.positionTarget)).toHaveLength(
          config.positionTargets,
        );
        expect(sequence.filter((s) => s.positionLure)).toHaveLength(
          config.positionLures,
        );
        expect(digits.every((d) => d >= 1 && d <= 9)).toBe(true);
        expect(holes.every((h) => h >= 0 && h <= 5)).toBe(true);
        for (let i = 3; i < sequence.length; i++) {
          expect(new Set(digits.slice(i - 3, i + 1)).size).toBeGreaterThan(1);
          expect(new Set(holes.slice(i - 3, i + 1)).size).toBeGreaterThan(1);
        }
        const scored = sequence.filter((s) => !s.warmup);
        const D = scored.filter((s) => s.target && s.positionTarget).length;
        expect(D).toBeGreaterThanOrEqual(config.dualTargetBand[0]);
        expect(D).toBeLessThanOrEqual(config.dualTargetBand[1]);
        expect(diagnostics.D).toBe(D);
        const conflict = scored.filter(
          (s) => (s.target && s.positionLure) || (s.positionTarget && s.lure),
        ).length;
        expect(conflict).toBeGreaterThanOrEqual(config.minConflict);
        if (mode === "practice") {
          const locOnly = scored.filter(
            (s) => s.positionTarget && !s.target,
          ).length;
          const numOnly = scored.filter(
            (s) => s.target && !s.positionTarget,
          ).length;
          const neither = scored.filter(
            (s) => !s.target && !s.positionTarget,
          ).length;
          expect(locOnly).toBeGreaterThanOrEqual(3);
          expect(numOnly).toBeGreaterThanOrEqual(3);
          expect(D).toBeGreaterThanOrEqual(1);
          expect(neither).toBeGreaterThanOrEqual(1);
        }
        const mapped =
          sequence.filter((s) => s.digit === s.hole + 1).length /
          sequence.length;
        expect(mapped).toBeLessThanOrEqual(0.25);
      }
    }
  }, 120_000);
  it("labels when N is greater than scored length", () => {
    const config = dualProtocol(20, "practice");
    const { sequence } = generateDual(config, "high-n");
    expect(sequence.filter((s) => s.warmup)).toHaveLength(20);
    expect(sequence.filter((s) => !s.warmup)).toHaveLength(12);
    expect(
      oracle(
        sequence.map((s) => s.digit),
        20,
      ).filter((s) => s.target),
    ).toHaveLength(6);
  });
});

describe("dual scoring", () => {
  it("projects response so a perfect stream is unflagged", () => {
    const { sequence } = generateDual(dualProtocol(2, "training"), "score");
    const trials = sequence.map((stimulus) =>
      dualTrialFromStimulus(stimulus, stimulus.positionTarget, stimulus.target),
    );
    const projected = summarize(trials.map((t) => projectStream(t, "number")));
    expect(projected.hits).toBe(18);
    expect(projected.flags).toEqual([]);
    expect(summarizeDual(trials).numberSummary.flags).toEqual([]);
  });
  it("silent number stream keeps location unflagged with known d′", () => {
    const { sequence } = generateDual(dualProtocol(2, "training"), "silent");
    const trials = sequence.map((stimulus) =>
      dualTrialFromStimulus(stimulus, stimulus.positionTarget, false),
    );
    const result = summarizeDual(trials);
    expect(result.numberSummary.balancedAccuracy).toBe(0.5);
    expect(result.numberSummary.dPrime).toBeCloseTo(0.331274283, 9);
    expect(result.numberSummary.flags).toContain("No scored responses");
    expect(result.positionSummary.flags).toEqual([]);
    expect(result.summary.flags).toContain("Number: No scored responses");
    expect(result.summary.flags.some((f) => f.startsWith("Location:"))).toBe(
      false,
    );
    const always = summarizeDual(
      sequence.map((stimulus) => dualTrialFromStimulus(stimulus, true, true)),
    );
    expect(always.numberSummary.dPrime).toBeCloseTo(-0.331274283, 9);
    expect(always.numberSummary.balancedAccuracy).toBe(0.5);
    expect(always.dualAccuracy).toBe(1);
    expect(always.numberSummary.fa).toBe(42);
  });
  it("pending dual-target trials do not count toward conjunction", () => {
    const { sequence } = generateDual(dualProtocol(1, "practice"), "pending");
    const dualTarget = sequence.find(
      (s) => !s.warmup && s.target && s.positionTarget,
    )!;
    const pending: DualTrial = {
      ...dualTrialFromStimulus(dualTarget, true, true),
      offset: null,
      positionCode: "pending",
      numberCode: "pending",
    };
    const stats = conjunction([pending]);
    expect(stats.dualTargets).toBe(0);
    expect(stats.scoredTrials).toBe(0);
  });
  it("classifies dual presses with no hole as hits via fixed semantics", () => {
    const stimulus = generateDual(
      dualProtocol(1, "practice"),
      "cls",
    ).sequence.find((s) => !s.warmup && s.target)!;
    const press = {
      eventTime: 10,
      handlerTime: 10,
      method: "keyboard",
      stream: "number" as const,
    };
    expect(classify(stimulus, press, "fixed")).toBe("hit");
    expect(classify(stimulus, press, "aimed")).toBe("miss");
  });
  it("practice pass requires both streams and rejects identity or single-stream strategies", () => {
    const config = dualProtocol(1, "practice");
    const { sequence } = generateDual(config, "practice-pass");
    const perfect = sequence.map((s) =>
      dualTrialFromStimulus(s, s.positionTarget, s.target),
    );
    const scored = summarizeDual(perfect);
    const block = {
      id: "p",
      seed: "practice-pass",
      task: "dual" as const,
      config,
      configHash: "x",
      sequenceHash: "y",
      versions: {
        engine: "1.0",
        generator: "dual-1.0",
        scoring: "dual-1.0",
        art: "garden-dual-1.0",
      },
      sequence,
      trials: perfect,
      events: [],
      frames: [],
      status: "completed" as const,
      startedAt: new Date().toISOString(),
      ...scored,
    };
    expect(isDualBlock(block)).toBe(true);
    expect(passedDualPractice(block)).toBe(true);
    expect(passedPractice(block)).toBe(false);
    const silentNumber = summarizeDual(
      sequence.map((s) => dualTrialFromStimulus(s, s.positionTarget, false)),
    );
    expect(passedDualPractice({ ...block, ...silentNumber })).toBe(false);
    const always = summarizeDual(
      sequence.map((s) => dualTrialFromStimulus(s, true, true)),
    );
    expect(passedDualPractice({ ...block, ...always })).toBe(false);
  });
});

describe("prepareDualBlock", () => {
  it("returns hashes and versions without using identity configHash", () => {
    const prepared = prepareDualBlock(dualProtocol(2, "training"), "prep");
    expect(prepared.versions.generator).toBe("dual-1.0");
    expect(prepared.configHash).not.toBe(configHash(protocol(2, "training")));
    expect(prepared.sequenceHash).toBe(hash(prepared.sequence));
  });
});
