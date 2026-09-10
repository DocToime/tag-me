import type {
  Adaptation,
  Block,
  Config,
  DualBlock,
  DualConfig,
  GameBlock,
  InputMode,
  Mode,
  N,
} from "./types";
import { isDualBlock, isN } from "./types";
import { hash } from "./sequence";
import { generateDual, PreparationError } from "./dualSequence";
export const VERSIONS = {
  engine: "1.0",
  generator: "1.0",
  scoring: "loglinear-1.0",
  art: "garden-2.0",
};
export const DUAL_VERSIONS = {
  generator: "dual-1.0",
  scoringAdapter: "dual-1.0",
  display: "garden-dual-1.0",
};
export function protocol(
  n: N,
  mode: Mode,
  windowMs = 2000,
  input: InputMode = "fixed",
): Config {
  return {
    n,
    mode,
    scoredTrials: mode === "practice" ? 12 : 60,
    targets: mode === "practice" ? 6 : 18,
    lures: mode === "practice" ? 1 : 5,
    windowMs:
      mode === "assessment"
        ? 2000
        : mode === "practice"
          ? Math.max(2000, windowMs)
          : windowMs,
    isiMs: 750,
    input: mode === "assessment" ? "fixed" : input,
  };
}
export function configHash(c: Config) {
  return hash({ config: c, versions: VERSIONS, digits: "1-9", holes: 6 });
}
export function dualProtocol(
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
    windowMs:
      mode === "assessment"
        ? 2000
        : practice
          ? Math.max(2000, requestedWindowMs)
          : requestedWindowMs,
    isiMs: 750,
  };
}
export function dualConfigHash(c: DualConfig) {
  return hash({
    task: "dual",
    n: c.n,
    mode: c.mode,
    scoredTrials: c.scoredTrials,
    targets: c.targets,
    lures: c.lures,
    positionTargets: c.positionTargets,
    positionLures: c.positionLures,
    dualTargetBand: [c.dualTargetBand[0], c.dualTargetBand[1]],
    minConflict: c.minConflict,
    digits: "1-9",
    holes: 6,
    windowMs: c.windowMs,
    isiMs: c.isiMs,
    input: "dual",
    versions: DUAL_VERSIONS,
  });
}
export function prepareDualBlock(config: DualConfig, seed: string) {
  try {
    const { sequence, diagnostics } = generateDual(config, seed);
    return {
      config,
      seed,
      sequence,
      configHash: dualConfigHash(config),
      sequenceHash: hash(sequence),
      versions: {
        engine: VERSIONS.engine,
        generator: DUAL_VERSIONS.generator,
        scoring: DUAL_VERSIONS.scoringAdapter,
        art: DUAL_VERSIONS.display,
      },
      diagnostics,
    };
  } catch (error) {
    if (error instanceof PreparationError) throw error;
    throw new PreparationError(String(error), seed, "invalid");
  }
}
export function adapt(blocks: GameBlock[], n: N): Adaptation {
  const relevant = blocks.filter(
    (b): b is Block => !isDualBlock(b) && b.config.mode === "training",
  );
  const recent = relevant.slice(-2);
  let to = n,
    reason = "Keep building a steady rhythm.";
  if (
    recent.length === 2 &&
    recent.every(
      (b) =>
        b.status === "completed" &&
        b.config.n === n &&
        !b.summary.flags.length &&
        !b.frames.length,
    ) &&
    recent[0].configHash === recent[1].configHash
  ) {
    if (
      recent.every(
        (b) =>
          b.summary.hitRate !== null &&
          b.summary.hitRate >= 0.85 &&
          b.summary.faRate !== null &&
          b.summary.faRate <= 0.15,
      )
    ) {
      to = n + 1;
      reason = "Two strong rounds. Ready for the next level.";
    } else if (
      recent.every(
        (b) =>
          b.summary.hitRate !== null &&
          b.summary.faRate !== null &&
          (b.summary.hitRate < 0.6 || b.summary.faRate > 0.3),
      )
    ) {
      to = Math.max(1, n - 1);
      reason =
        to < n
          ? "Let’s consolidate at a gentler level."
          : "Take your time. Try the tutorial or a longer exposure next session.";
    }
  }
  return {
    from: n,
    to,
    reason,
    blockIds: recent.map((b) => b.id),
    version: "1.1",
  };
}
export function passedPractice(b: GameBlock) {
  if (isDualBlock(b)) return false;
  // Hits/false-alarms only. Long frames stay a scored-round quality flag; 250 ms gaps still interrupt.
  return (
    b.status === "completed" &&
    b.summary.hits >= 5 &&
    b.summary.fa <= 1 &&
    b.summary.scored === 12
  );
}
export function passedDualPractice(b: DualBlock) {
  const passes = (s: DualBlock["positionSummary"]) =>
    s.scored === 12 &&
    s.targets === 6 &&
    s.nonTargets === 6 &&
    s.hits >= 5 &&
    s.fa <= 1 &&
    s.flags.length === 0;
  // Long frames stay a scored-round quality flag; 250 ms gaps still interrupt.
  return (
    b.config.mode === "practice" &&
    b.status === "completed" &&
    passes(b.positionSummary) &&
    passes(b.numberSummary)
  );
}
