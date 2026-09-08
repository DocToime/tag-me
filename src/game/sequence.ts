import type { Config, Stimulus } from "./types";
export function hash(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
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
export function label(
  digits: number[],
  n: number,
): Pick<Stimulus, "warmup" | "target" | "lure" | "lagMatches">[] {
  return digits.map((d, i) => {
    const lagMatches = [1, 2, 3, 4].filter(
      (l) => i >= l && digits[i - l] === d,
    );
    const warmup = i < n;
    const target = !warmup && lagMatches.includes(n);
    return {
      warmup,
      target,
      lure:
        !warmup &&
        !target &&
        [n - 1, n + 1].some((l) => l > 0 && lagMatches.includes(l)),
      lagMatches,
    };
  });
}
export function generate(config: Config, seed: string): Stimulus[] {
  const { n, scoredTrials, targets, lures } = config;
  if (
    ![1, 2, 3].includes(n) ||
    ![scoredTrials, targets, lures].every(Number.isInteger) ||
    scoredTrials < 1 ||
    targets < 0 ||
    lures < 0 ||
    targets + lures > scoredTrials
  )
    throw new Error("Invalid sequence configuration");
  const rng = random(seed + ":digits");
  const holes = shuffle(
    Array.from({ length: n + scoredTrials }, (_, i) => i % 6),
    random(seed + ":holes"),
  );
  for (let attempt = 0; attempt < 4000; attempt++) {
    const cats = shuffle(
      [
        ...Array(targets).fill("target"),
        ...Array(lures).fill("lure"),
        ...Array(scoredTrials - targets - lures).fill("ordinary"),
      ],
      rng,
    );
    const digits: number[] = [];
    let failed = false;
    for (let i = 0; i < n + scoredTrials; i++) {
      const category = i < n ? "fill" : cats[i - n];
      const prior = digits[i - n];
      const adjacent = [n - 1, n + 1]
        .filter((l) => l > 0 && i >= l)
        .map((l) => digits[i - l]);
      const choices = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (d) =>
          !(i >= 3 && digits.slice(-3).every((x) => x === d)) &&
          (category === "fill" ||
            (category === "target"
              ? d === prior
              : category === "lure"
                ? d !== prior && adjacent.includes(d)
                : d !== prior && !adjacent.includes(d))),
      );
      if (!choices.length) {
        failed = true;
        break;
      }
      digits.push(choices[Math.floor(rng() * choices.length)]);
    }
    if (failed) continue;
    const labels = label(digits, n);
    if (
      labels.filter((s) => s.target).length !== targets ||
      labels.filter((s) => s.lure).length !== lures
    )
      continue;
    return digits.map((digit, i) => ({
      i,
      digit,
      hole: holes[i],
      ...labels[i],
      intended: i < n ? "fill" : cats[i - n],
    }));
  }
  throw new Error(
    "Could not generate a sequence satisfying the protocol. Choose a feasible configuration.",
  );
}
