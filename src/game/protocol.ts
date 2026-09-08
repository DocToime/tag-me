import type { Adaptation, Block, Config, InputMode, Mode, N } from "./types";
import { hash } from "./sequence";
export const VERSIONS = {
  engine: "1.0",
  generator: "1.0",
  scoring: "loglinear-1.0",
  art: "garden-1.0",
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
export function adapt(blocks: Block[], n: N): Adaptation {
  const relevant = blocks.filter((b) => b.config.mode === "training");
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
      to = Math.min(3, n + 1) as N;
      reason =
        to > n
          ? "Two strong rounds. Ready for the next level."
          : "Strong work at the highest level.";
    } else if (
      recent.every(
        (b) =>
          b.summary.hitRate !== null &&
          b.summary.faRate !== null &&
          (b.summary.hitRate < 0.6 || b.summary.faRate > 0.3),
      )
    ) {
      to = Math.max(1, n - 1) as N;
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
    version: "1.0",
  };
}
export function passedPractice(b: Block) {
  return (
    b.status === "completed" &&
    b.summary.hits >= 5 &&
    b.summary.fa <= 1 &&
    b.summary.scored === 12 &&
    !b.frames.length
  );
}
