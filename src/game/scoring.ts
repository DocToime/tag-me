import type { Code, Config, Press, Stimulus, Summary, Trial } from "./types";
export function classify(
  stimulus: Stimulus,
  press: Press | null,
  input: Config["input"],
): Code {
  if (stimulus.warmup) return "warmup";
  if (!stimulus.target) return press ? "false_alarm" : "correct_rejection";
  return press && (input === "fixed" || press.hole === stimulus.hole)
    ? "hit"
    : "miss";
}
// Acklam inverse normal approximation; absolute error approximately 1e-9.
export function inverseNormal(p: number): number {
  if (p <= 0 || p >= 1) throw new Error("Probability must be inside (0,1)");
  const a = [
      -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269,
      -30.6647980661472, 2.50662827745924,
    ],
    b = [
      -54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197,
      -13.2806815528857,
    ],
    c = [
      -0.00778489400243029, -0.322396458041136, -2.40075827716184,
      -2.54973253934373, 4.37466414146497, 2.93816398269878,
    ],
    d = [
      0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742,
    ];
  if (p < 0.02425 || p > 0.97575) {
    const q = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
    const z =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return p < 0.5 ? z : -z;
  }
  const q = p - 0.5,
    r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}
export function wilson(k: number, n: number): [number, number] | null {
  if (!n) return null;
  const z = 1.95996398454,
    p = k / n,
    den = 1 + (z * z) / n,
    mid = (p + (z * z) / (2 * n)) / den,
    half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, mid - half), Math.min(1, mid + half)];
}
export function summarize(trials: Trial[]): Summary {
  const count = (c: Code) => trials.filter((t) => t.code === c).length;
  const hits = count("hit"),
    misses = count("miss"),
    fa = count("false_alarm"),
    cr = count("correct_rejection"),
    targets = hits + misses,
    nonTargets = fa + cr,
    scored = targets + nonTargets;
  const hitRate = targets ? hits / targets : null,
    faRate = nonTargets ? fa / nonTargets : null;
  const rts = trials
      .filter((t) => t.code === "hit" && t.rt !== null && t.rt >= 0)
      .map((t) => t.rt!)
      .sort((a, b) => a - b),
    rtCount = rts.length,
    meanRt = rtCount ? rts.reduce((a, b) => a + b, 0) / rtCount : null;
  const h = targets ? inverseNormal((hits + 0.5) / (targets + 1)) : null,
    f = nonTargets ? inverseNormal((fa + 0.5) / (nonTargets + 1)) : null;
  return {
    hits,
    misses,
    fa,
    cr,
    targets,
    nonTargets,
    scored,
    hitRate,
    faRate,
    accuracy: scored ? (hits + cr) / scored : null,
    balancedAccuracy:
      hitRate !== null && faRate !== null ? (hitRate + 1 - faRate) / 2 : null,
    dPrime: h !== null && f !== null ? h - f : null,
    criterion: h !== null && f !== null ? -0.5 * (h + f) : null,
    medianRt: rtCount
      ? (rts[Math.floor((rtCount - 1) / 2)] + rts[Math.floor(rtCount / 2)]) / 2
      : null,
    meanRt,
    sdRt:
      rtCount > 1
        ? Math.sqrt(
            rts.reduce((a, r) => a + (r - meanRt!) ** 2, 0) / (rtCount - 1),
          )
        : null,
    rtCount,
    hitInterval: wilson(hits, targets),
    faInterval: wilson(fa, nonTargets),
    flags:
      scored &&
      !trials.some(
        (t) => !t.stimulus.warmup && t.code !== "pending" && t.response,
      )
        ? ["No scored responses"]
        : [],
  };
}
