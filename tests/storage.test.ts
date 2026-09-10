import { describe, expect, it } from "vitest";
import {
  csvRow,
  exportSchemaVersion,
  normalizeSession,
} from "../src/data/storage";
import { dualProtocol, protocol, configHash } from "../src/game/protocol";
import { generateDual } from "../src/game/dualSequence";
import { summarizeDual } from "../src/game/dualScoring";
import { generate, hash } from "../src/game/sequence";
import { summarize, classify } from "../src/game/scoring";
import type { DualBlock, Session } from "../src/game/types";

function identitySession(): Session {
  const config = protocol(1, "training");
  const sequence = generate(config, "csv");
  const trials = sequence.map((s) => ({
    id: String(s.i),
    stimulus: s,
    plannedOnset: 0,
    onset: 0,
    deadline: 2000,
    offset: 2000,
    response: null,
    rt: null,
    code: classify(s, null, "fixed"),
  }));
  return {
    id: "id-1",
    participantId: "p",
    schemaVersion: 1,
    startedAt: "2026-01-01T00:00:00.000Z",
    mode: "training",
    status: "completed",
    config: {
      n: 1,
      blocks: 1,
      battery: false,
      windowMs: 2000,
      input: "fixed",
    },
    client: { ua: "test", width: 1, height: 1, pixelRatio: 1, timeOrigin: 0 },
    blocks: [
      {
        id: "b1",
        seed: "csv",
        config,
        configHash: configHash(config),
        sequenceHash: hash(sequence),
        versions: {
          engine: "1.0",
          generator: "1.0",
          scoring: "loglinear-1.0",
          art: "garden-2.0",
        },
        sequence,
        trials,
        events: [],
        frames: [],
        status: "completed",
        startedAt: "2026-01-01T00:00:00.000Z",
        summary: summarize(trials),
      },
    ],
    adaptations: [],
  };
}

function dualSession(): Session {
  const config = dualProtocol(1, "practice");
  const { sequence } = generateDual(config, "csv-dual");
  const trials = sequence.map((stimulus) => ({
    id: String(stimulus.i),
    stimulus,
    plannedOnset: 0,
    onset: 0,
    deadline: 2000,
    offset: 2000,
    response: null as null,
    rt: null as null,
    code: "pending" as const,
    positionResponse: null,
    numberResponse: null,
    positionRt: null,
    numberRt: null,
    positionCode: classify(
      { ...stimulus, target: stimulus.positionTarget },
      null,
      "fixed",
    ),
    numberCode: classify(stimulus, null, "fixed"),
  }));
  const scored = summarizeDual(trials);
  const block: DualBlock = {
    id: "d1",
    seed: "csv-dual",
    task: "dual",
    config,
    configHash: "dualhash",
    sequenceHash: "seq",
    versions: {
      engine: "1.0",
      generator: "dual-1.0",
      scoring: "dual-1.0",
      art: "garden-dual-1.0",
    },
    sequence,
    trials,
    events: [],
    frames: [],
    status: "completed",
    startedAt: "2026-01-01T00:00:00.000Z",
    ...scored,
  };
  return {
    id: "dual-1",
    participantId: "p",
    schemaVersion: 2,
    startedAt: "2026-01-02T00:00:00.000Z",
    mode: "training",
    status: "completed",
    task: "dual",
    config: {
      n: 1,
      blocks: 1,
      battery: false,
      windowMs: 2000,
      input: "dual",
      task: "dual",
    },
    client: { ua: "test", width: 1, height: 1, pixelRatio: 1, timeOrigin: 0 },
    blocks: [block],
    adaptations: [],
  };
}

describe("persistence readers", () => {
  it("treats missing task as identity and unknown explicit task as uninterpretable", () => {
    const legacy = normalizeSession(identitySession());
    expect(legacy.task).toBeUndefined();
    expect(legacy.uninterpretable).toBeUndefined();
    const bad = normalizeSession({
      ...identitySession(),
      task: "auditory",
    });
    expect(bad.uninterpretable).toMatch(/Unknown task/);
  });
  it("keeps identity CSV columns blank on dual rows and dual columns blank on identity rows", () => {
    const identity = csvRow(identitySession(), identitySession().blocks[0]);
    const dual = csvRow(dualSession(), dualSession().blocks[0]);
    expect(identity[3]).toBe("identity");
    expect(identity[10]).toBe(0);
    expect(identity[23]).toBe("");
    expect(dual[3]).toBe("dual");
    expect(dual[10]).toBe("");
    expect(dual[23]).toBe(0);
    expect(exportSchemaVersion([identitySession()])).toBe(1);
    expect(exportSchemaVersion([identitySession(), dualSession()])).toBe(2);
  });
});
