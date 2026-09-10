import { classify, summarize, wilson } from "./scoring";
import type { DualTrial, Stream, Summary, Trial } from "./types";

export function projectStream(t: DualTrial, stream: Stream): Trial {
  if (stream === "position") {
    return {
      id: t.id,
      stimulus: {
        ...t.stimulus,
        target: t.stimulus.positionTarget,
        lure: t.stimulus.positionLure,
        lagMatches: t.stimulus.positionLagMatches,
        intended: t.stimulus.positionIntended,
      },
      plannedOnset: t.plannedOnset,
      onset: t.onset,
      deadline: t.deadline,
      offset: t.offset,
      response: t.positionResponse,
      rt: t.positionRt,
      code: t.positionCode,
    };
  }
  return {
    id: t.id,
    stimulus: t.stimulus,
    plannedOnset: t.plannedOnset,
    onset: t.onset,
    deadline: t.deadline,
    offset: t.offset,
    response: t.numberResponse,
    rt: t.numberRt,
    code: t.numberCode,
  };
}

export function finalizeDualTrial(t: DualTrial): void {
  t.positionCode = classify(
    { ...t.stimulus, target: t.stimulus.positionTarget },
    t.positionResponse,
    "fixed",
  );
  t.numberCode = classify(t.stimulus, t.numberResponse, "fixed");
}

export function dualFlags(
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

export function conjunction(trials: DualTrial[]) {
  const finalized = trials.filter(
    (t) =>
      !t.stimulus.warmup &&
      t.offset !== null &&
      t.positionCode !== "pending" &&
      t.numberCode !== "pending",
  );
  const duals = finalized.filter(
    (t) => t.stimulus.positionTarget && t.stimulus.target,
  );
  let dualHits = 0,
    dualPartial = 0,
    dualMiss = 0;
  for (const t of duals) {
    const posHit = t.positionCode === "hit";
    const numHit = t.numberCode === "hit";
    if (posHit && numHit) dualHits++;
    else if (posHit || numHit) dualPartial++;
    else dualMiss++;
  }
  const dualTargets = duals.length;
  return {
    dualTargets,
    dualHits,
    dualPartial,
    dualMiss,
    dualAccuracy: dualTargets ? dualHits / dualTargets : null,
    dualInterval: wilson(dualHits, dualTargets),
    scoredTrials: finalized.length,
  };
}

export function summarizeDual(
  trials: DualTrial[],
  frames: { at: number; gap: number }[] = [],
) {
  const positionSummary = summarize(
    trials.map((t) => projectStream(t, "position")),
  );
  const numberSummary = summarize(
    trials.map((t) => projectStream(t, "number")),
  );
  const both = conjunction(trials);
  return {
    positionSummary,
    numberSummary,
    summary: {
      scoredTrials: both.scoredTrials,
      meanBalancedAccuracy:
        positionSummary.balancedAccuracy !== null &&
        numberSummary.balancedAccuracy !== null
          ? (positionSummary.balancedAccuracy +
              numberSummary.balancedAccuracy) /
            2
          : null,
      meanDPrime:
        positionSummary.dPrime !== null && numberSummary.dPrime !== null
          ? (positionSummary.dPrime + numberSummary.dPrime) / 2
          : null,
      flags: dualFlags(positionSummary, numberSummary, frames),
    },
    dualTargets: both.dualTargets,
    dualHits: both.dualHits,
    dualPartial: both.dualPartial,
    dualMiss: both.dualMiss,
    dualAccuracy: both.dualAccuracy,
    dualInterval: both.dualInterval,
  };
}
