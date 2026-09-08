import { describe, expect, it } from "vitest";
import { generate, label, hash } from "../src/game/sequence";
import {
  classify,
  inverseNormal,
  summarize,
  wilson,
} from "../src/game/scoring";
import {
  adapt,
  configHash,
  passedPractice,
  protocol,
  VERSIONS,
} from "../src/game/protocol";
import type { Block, N, Trial } from "../src/game/types";
function block(
  n: N = 1,
  press: "targets" | "none" | "all" = "targets",
  practice = false,
): Block {
  const config = protocol(n, practice ? "practice" : "training");
  const sequence = generate(config, "fixture");
  const trials: Trial[] = sequence.map((s) => {
    const response =
      press === "all" || (press === "targets" && s.target)
        ? {
            eventTime: s.i * 2750 + 250,
            handlerTime: s.i * 2750 + 250,
            method: "keyboard",
          }
        : null;
    return {
      id: `fixture:${s.i}`,
      stimulus: s,
      plannedOnset: s.i * 2750,
      onset: s.i * 2750,
      deadline: s.i * 2750 + 2000,
      offset: s.i * 2750 + 2000,
      response,
      rt: response ? 250 : null,
      code: classify(s, response, config.input),
    };
  });
  return {
    id: crypto.randomUUID(),
    seed: "fixture",
    config,
    configHash: configHash(config),
    sequenceHash: hash(sequence),
    versions: VERSIONS,
    sequence,
    trials,
    events: [],
    frames: [],
    status: "completed",
    startedAt: new Date().toISOString(),
    summary: summarize(trials),
  };
}
describe("constrained sequences", () => {
  it("enforces exact independently verified target and lure counts across N and 600 seeds", () => {
    for (const n of [1, 2, 3] as N[])
      for (let seed = 0; seed < 200; seed++) {
        const c = protocol(n, "training"),
          s = generate(c, String(seed)),
          labels = label(
            s.map((t) => t.digit),
            n,
          );
        expect(s).toHaveLength(60 + n);
        expect(labels.filter((s) => s.target)).toHaveLength(18);
        expect(labels.filter((s) => s.lure)).toHaveLength(5);
        expect(s.filter((s) => s.warmup)).toHaveLength(n);
        for (let i = 3; i < s.length; i++)
          expect(
            new Set(s.slice(i - 3, i + 1).map((s) => s.digit)).size,
          ).toBeGreaterThan(1);
        const holes = Array.from(
          { length: 6 },
          (_, i) => s.filter((s) => s.hole === i).length,
        );
        expect(Math.max(...holes) - Math.min(...holes)).toBeLessThanOrEqual(1);
        expect(s.map((s) => s.target)).toEqual(labels.map((s) => s.target));
      }
  });
  it("replays the same seed and config exactly", () =>
    expect(generate(protocol(3, "training"), "seed")).toEqual(
      generate(protocol(3, "training"), "seed"),
    ));
  it("handles practice quotas and first possible lure lag", () => {
    for (const n of [1, 2, 3] as N[])
      for (let seed = 0; seed < 30; seed++) {
        const s = generate(protocol(n, "practice"), String(seed));
        expect(s.filter((s) => s.target)).toHaveLength(6);
        expect(s.filter((s) => s.lure)).toHaveLength(1);
        expect(s.some((s) => s.lagMatches.includes(0))).toBe(false);
      }
  });
  it("rejects impossible configs explicitly", () => {
    expect(() =>
      generate({ ...protocol(1, "training"), targets: 70 }, "x"),
    ).toThrow();
    expect(() =>
      generate(
        { ...protocol(1, "training"), scoredTrials: 1, targets: 0, lures: 1 },
        "x",
      ),
    ).toThrow();
  });
  it("labels the golden 3-back example", () =>
    expect(label([2, 5, 8, 2, 5], 3).map((s) => s.target)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]));
  it("prioritises target status over incidental lag matches", () => {
    const s = label([2, 2, 2], 1)[2];
    expect(s.target).toBe(true);
    expect(s.lure).toBe(false);
    expect(s.lagMatches).toEqual([1, 2]);
  });
});
describe("scoring", () => {
  it("perfect responses get perfect rates and finite sensitivity", () => {
    const s = block().summary;
    expect(s.hits).toBe(18);
    expect(s.cr).toBe(42);
    expect(s.balancedAccuracy).toBe(1);
    expect(s.medianRt).toBe(250);
    expect(s.dPrime).toBeGreaterThan(3);
    expect(s.flags).toEqual([]);
  });
  it("silence yields 70% raw but 50% balanced accuracy and a quality flag", () => {
    const s = block(3, "none").summary;
    expect(s.accuracy).toBe(0.7);
    expect(s.balancedAccuracy).toBe(0.5);
    expect(s.misses).toBe(18);
    expect(s.rtCount).toBe(0);
    expect(s.medianRt).toBeNull();
    expect(s.flags).toContain("No scored responses");
  });
  it("always press yields 30% raw, 50% balanced accuracy", () => {
    const s = block(2, "all").summary;
    expect(s.accuracy).toBe(0.3);
    expect(s.balancedAccuracy).toBe(0.5);
    expect(s.fa).toBe(42);
  });
  it("excludes fill and unfinished trials", () => {
    const b = block();
    expect(b.summary.scored).toBe(60);
    b.trials.forEach((t) => (t.code = "pending"));
    expect(summarize(b.trials).scored).toBe(0);
    expect(summarize(b.trials).dPrime).toBeNull();
  });
  it("scores aimed errors as misses or false alarms and never scores fill", () => {
    const s = generate(protocol(1, "training"), "aim");
    const target = s.find((s) => s.target)!,
      other = s.find((s) => !s.target && !s.warmup)!;
    const press = {
      eventTime: 10,
      handlerTime: 10,
      method: "mouse",
      hole: (target.hole + 1) % 6,
    };
    expect(classify(target, press, "aimed")).toBe("miss");
    expect(classify(target, press, "fixed")).toBe("hit");
    expect(classify(other, press, "aimed")).toBe("false_alarm");
    expect(classify(s[0], press, "aimed")).toBe("warmup");
  });
  it("calculates known inverse normal and Wilson values", () => {
    expect(inverseNormal(0.5)).toBeCloseTo(0, 7);
    expect(inverseNormal(0.975)).toBeCloseTo(1.959964, 5);
    expect(inverseNormal(0.025)).toBeCloseTo(-1.959964, 5);
    expect(wilson(8, 9)![0]).toBeCloseTo(0.565, 2);
    expect(wilson(0, 0)).toBeNull();
  });
  it("practice requires matching and withholding", () => {
    expect(passedPractice(block(1, "targets", true))).toBe(true);
    expect(passedPractice(block(1, "none", true))).toBe(false);
    expect(passedPractice(block(1, "all", true))).toBe(false);
  });
});
describe("adaptation", () => {
  it("raises after two successes, not one, and stays bounded", () => {
    expect(adapt([block()], 1).to).toBe(1);
    expect(adapt([block(), block()], 1).to).toBe(2);
    expect(adapt([block(3), block(3)], 3).to).toBe(3);
  });
  it("lowers after two high false-alarm rounds", () =>
    expect(adapt([block(2, "all"), block(2, "all")], 2).to).toBe(1));
  it("quality failures, mismatched settings and interruptions break progression", () => {
    const a = block(),
      b = block();
    b.status = "interrupted";
    expect(adapt([a, b], 1).to).toBe(1);
    b.status = "completed";
    b.frames = [{ at: 100, gap: 80 }];
    expect(adapt([a, b], 1).to).toBe(1);
    b.frames = [];
    b.configHash = "different";
    expect(adapt([a, b], 1).to).toBe(1);
    expect(adapt([block(2, "none"), block(2, "none")], 2).to).toBe(2);
  });
  it("assessment is always fixed", () => {
    const c = protocol(2, "assessment", 4000, "aimed");
    expect(c.windowMs).toBe(2000);
    expect(c.input).toBe("fixed");
  });
});
