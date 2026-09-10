import { isN, resourceOk, type DualConfig, type DualStimulus } from "./types";
import { hash, label } from "./sequence";

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const HOLES = [0, 1, 2, 3, 4, 5];
const B_STREAM = 4000;
const B_PARTNER = 4000;
const B_PAIR = 50;

export class PreparationError extends Error {
  readonly code = "preparation";
  constructor(
    message: string,
    readonly seed: string,
    readonly reason: "budget" | "invalid" | "infeasible",
    readonly diagnostics?: DualDiagnostics,
  ) {
    super(message);
    this.name = "PreparationError";
  }
}

export interface DualDiagnostics {
  D: number;
  conflict: number;
  conflictPositionLure: number;
  conflictNumberLure: number;
  holeFrequencies: number[];
  pairTable: number[][];
  rejections: Record<string, number>;
  pairsTried: number;
}

interface StreamBuild {
  values: number[];
  intended: string[];
  labels: ReturnType<typeof label>;
}

function random(seed: string) {
  let a = parseInt(hash(seed), 16);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function uniqueAlphabet(values: number[]) {
  return (
    values.length > 0 &&
    values.every((v) => Number.isInteger(v)) &&
    new Set(values).size === values.length
  );
}
export function overlapBandFeasible(
  positionTargets: number,
  numberTargets: number,
  scored: number,
  band: readonly [number, number],
) {
  const impliedMin = Math.max(0, positionTargets + numberTargets - scored);
  const impliedMax = Math.min(positionTargets, numberTargets);
  const alignMax = Math.min(
    Math.floor(positionTargets * 0.5),
    Math.floor(numberTargets * 0.5),
  );
  const lo = Math.max(band[0], impliedMin);
  const hi = Math.min(band[1], impliedMax, alignMax);
  return lo <= hi;
}
function tryOnce(
  alphabet: number[],
  n: number,
  scored: number,
  targets: number,
  lures: number,
  rngCats: () => number,
  rngPick: () => number,
): StreamBuild | null {
  const cats = shuffle(
    [
      ...Array(targets).fill("target"),
      ...Array(lures).fill("lure"),
      ...Array(scored - targets - lures).fill("ordinary"),
    ],
    rngCats,
  );
  const values: number[] = [];
  for (let i = 0; i < n + scored; i++) {
    const category = i < n ? "fill" : cats[i - n];
    const prior = values[i - n];
    const adjacent = [n - 1, n + 1]
      .filter((l) => l > 0 && i >= l)
      .map((l) => values[i - l]);
    const choices = alphabet.filter(
      (d) =>
        !(i >= 3 && values.slice(-3).every((x) => x === d)) &&
        (category === "fill" ||
          (category === "target"
            ? d === prior
            : category === "lure"
              ? d !== prior && adjacent.includes(d)
              : d !== prior && !adjacent.includes(d))),
    );
    if (!choices.length) return null;
    values.push(choices[Math.floor(rngPick() * choices.length)]);
  }
  const labels = label(values, n);
  if (
    labels.filter((s) => s.target).length !== targets ||
    labels.filter((s) => s.lure).length !== lures
  )
    return null;
  return {
    values,
    intended: [...Array(n).fill("fill"), ...cats],
    labels,
  };
}
function constructStream(
  alphabet: number[],
  n: number,
  scored: number,
  targets: number,
  lures: number,
  rngCats: () => number,
  rngPick: () => number,
  attempts: number,
  rejections: Record<string, number>,
): StreamBuild | null {
  for (let i = 0; i < attempts; i++) {
    const built = tryOnce(
      alphabet,
      n,
      scored,
      targets,
      lures,
      rngCats,
      rngPick,
    );
    if (built) return built;
    rejections.stream++;
  }
  return null;
}
function jointOk(
  digits: StreamBuild,
  holes: StreamBuild,
  config: DualConfig,
):
  | { ok: true; stats: Omit<DualDiagnostics, "rejections" | "pairsTried"> }
  | {
      ok: false;
      reason: "stream" | "overlap" | "conflict" | "lock" | "fourRun" | "other";
    } {
  if (
    digits.labels.filter((s) => s.target).length !== config.targets ||
    digits.labels.filter((s) => s.lure).length !== config.lures ||
    holes.labels.filter((s) => s.target).length !== config.positionTargets ||
    holes.labels.filter((s) => s.lure).length !== config.positionLures
  )
    return { ok: false, reason: "other" };
  let D = 0,
    conflict = 0,
    conflictPositionLure = 0,
    conflictNumberLure = 0,
    posTargets = 0,
    numTargets = 0,
    bothOfNum = 0,
    bothOfPos = 0;
  for (let i = 0; i < digits.labels.length; i++) {
    if (digits.labels[i].warmup) continue;
    const numberTarget = digits.labels[i].target,
      positionTarget = holes.labels[i].target;
    const numberLure = digits.labels[i].lure,
      positionLure = holes.labels[i].lure;
    if (numberTarget && positionTarget) D++;
    if (numberTarget && positionLure) {
      conflict++;
      conflictNumberLure++;
    } else if (positionTarget && numberLure) {
      conflict++;
      conflictPositionLure++;
    }
    if (numberTarget) {
      numTargets++;
      if (positionTarget) bothOfNum++;
    }
    if (positionTarget) {
      posTargets++;
      if (numberTarget) bothOfPos++;
    }
  }
  if (D < config.dualTargetBand[0] || D > config.dualTargetBand[1])
    return { ok: false, reason: "overlap" };
  if (conflict < config.minConflict) return { ok: false, reason: "conflict" };
  if (numTargets && bothOfNum / numTargets > 0.5)
    return { ok: false, reason: "lock" };
  if (posTargets && bothOfPos / posTargets > 0.5)
    return { ok: false, reason: "lock" };
  const mapped = digits.values.filter(
    (d, i) => d === holes.values[i] + 1,
  ).length;
  if (mapped / digits.values.length > 0.25)
    return { ok: false, reason: "lock" };
  const pairTable = Array.from({ length: 6 }, () => Array(9).fill(0));
  const holeFrequencies = Array(6).fill(0);
  digits.values.forEach((digit, i) => {
    const hole = holes.values[i];
    holeFrequencies[hole]++;
    pairTable[hole][digit - 1]++;
  });
  return {
    ok: true,
    stats: {
      D,
      conflict,
      conflictPositionLure,
      conflictNumberLure,
      holeFrequencies,
      pairTable,
    },
  };
}
function validateConfig(config: DualConfig, seed: string) {
  const {
    n,
    scoredTrials,
    targets,
    lures,
    positionTargets,
    positionLures,
    dualTargetBand,
    minConflict,
  } = config;
  if (!isN(n) || !resourceOk(n, scoredTrials))
    throw new PreparationError(
      "Invalid sequence configuration",
      seed,
      "invalid",
    );
  const counts = [scoredTrials, targets, lures, positionTargets, positionLures];
  if (
    !counts.every(Number.isInteger) ||
    targets < 0 ||
    lures < 0 ||
    positionTargets < 0 ||
    positionLures < 0 ||
    targets + lures > scoredTrials ||
    positionTargets + positionLures > scoredTrials ||
    minConflict < 0 ||
    !Number.isInteger(minConflict) ||
    dualTargetBand.length !== 2 ||
    dualTargetBand[0] > dualTargetBand[1]
  )
    throw new PreparationError(
      "Invalid sequence configuration",
      seed,
      "invalid",
    );
  if (!uniqueAlphabet(DIGITS) || !uniqueAlphabet(HOLES))
    throw new PreparationError(
      "Invalid sequence configuration",
      seed,
      "invalid",
    );
  if (
    !overlapBandFeasible(positionTargets, targets, scoredTrials, dualTargetBand)
  )
    throw new PreparationError(
      "Dual overlap band is not feasible for this protocol.",
      seed,
      "infeasible",
    );
}
export function generateDual(
  config: DualConfig,
  seed: string,
): { sequence: DualStimulus[]; diagnostics: DualDiagnostics } {
  validateConfig(config, seed);
  const { n, scoredTrials, targets, lures, positionTargets, positionLures } =
    config;
  const rngs = [
    random(seed + ":digits:cats"),
    random(seed + ":digits:pick"),
    random(seed + ":holes:cats"),
    random(seed + ":holes:pick"),
  ];
  const rejections = {
    stream: 0,
    overlap: 0,
    conflict: 0,
    lock: 0,
    fourRun: 0,
    other: 0,
  };
  for (let pair = 1; pair <= B_PAIR; pair++) {
    const digits = constructStream(
      DIGITS,
      n,
      scoredTrials,
      targets,
      lures,
      rngs[0],
      rngs[1],
      B_STREAM,
      rejections,
    );
    if (!digits) continue;
    for (let partner = 0; partner < B_PARTNER; partner++) {
      const holes = tryOnce(
        HOLES,
        n,
        scoredTrials,
        positionTargets,
        positionLures,
        rngs[2],
        rngs[3],
      );
      if (!holes) {
        rejections.stream++;
        continue;
      }
      const checked = jointOk(digits, holes, config);
      if (!checked.ok) {
        rejections[checked.reason]++;
        continue;
      }
      const sequence = digits.values.map((digit, i) => ({
        i,
        digit,
        hole: holes.values[i],
        warmup: digits.labels[i].warmup,
        target: digits.labels[i].target,
        lure: digits.labels[i].lure,
        lagMatches: digits.labels[i].lagMatches,
        intended: digits.intended[i],
        positionTarget: holes.labels[i].target,
        positionLure: holes.labels[i].lure,
        positionLagMatches: holes.labels[i].lagMatches,
        positionIntended: holes.intended[i],
      }));
      return {
        sequence,
        diagnostics: { ...checked.stats, rejections, pairsTried: pair },
      };
    }
  }
  throw new PreparationError(
    "Could not generate a dual sequence satisfying the protocol. Try again or choose a feasible configuration.",
    seed,
    "budget",
    {
      D: 0,
      conflict: 0,
      conflictPositionLure: 0,
      conflictNumberLure: 0,
      holeFrequencies: Array(6).fill(0),
      pairTable: Array.from({ length: 6 }, () => Array(9).fill(0)),
      rejections,
      pairsTried: B_PAIR,
    },
  );
}
