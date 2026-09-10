import type {
  Config,
  DualBlock,
  DualStimulus,
  DualTrial,
  GameBlock,
  GameConfig,
  Press,
  Trial,
} from "./types";
import { isDualConfig } from "./types";
import { generate, hash } from "./sequence";
import { classify, summarize } from "./scoring";
import { finalizeDualTrial, summarizeDual } from "./dualScoring";
import {
  configHash,
  dualConfigHash,
  DUAL_VERSIONS,
  VERSIONS,
} from "./protocol";
export interface Scheduler {
  now(): number;
  request(cb: (time: number) => void): number;
  cancel(id: number): void;
}
export type View = {
  phase: "countdown" | "visible" | "blank" | "completed" | "interrupted";
  index: number;
  remaining?: number;
  trial?: Trial | DualTrial;
};
export type PreparedDual = {
  sequence: DualStimulus[];
  configHash: string;
  sequenceHash: string;
  versions: DualBlock["versions"];
};
const browserScheduler: Scheduler = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};
function emptyDual(
  config: GameConfig,
  seed: string,
  prepared: PreparedDual,
): DualBlock {
  const scored = summarizeDual([]);
  return {
    id: crypto.randomUUID(),
    seed,
    task: "dual",
    config: config as DualBlock["config"],
    configHash: prepared.configHash,
    sequenceHash: prepared.sequenceHash,
    versions: prepared.versions,
    sequence: prepared.sequence,
    trials: [],
    events: [],
    frames: [],
    status: "running",
    startedAt: new Date().toISOString(),
    ...scored,
  };
}
export class GameEngine {
  readonly block: GameBlock;
  private startAt = 0;
  private previous = 0;
  private frame = 0;
  private index = -1;
  private phase: View["phase"] = "countdown";
  private active = false;
  private countdownValue = -1;
  private readonly dual: boolean;
  constructor(
    config: GameConfig,
    seed: string,
    private render: (view: View) => void,
    private finish: (block: GameBlock) => void,
    private scheduler: Scheduler = browserScheduler,
    prepared?: PreparedDual,
  ) {
    this.dual = isDualConfig(config);
    if (this.dual) {
      if (!prepared)
        throw new Error("Dual blocks must be prepared before play");
      this.block = emptyDual(config, seed, prepared);
    } else {
      const identity = config as Config;
      const sequence = generate(identity, seed);
      this.block = {
        id: crypto.randomUUID(),
        seed,
        task: "identity",
        config: identity,
        configHash: configHash(identity),
        sequenceHash: hash(sequence),
        versions: VERSIONS,
        sequence,
        trials: [],
        events: [],
        frames: [],
        status: "running",
        startedAt: new Date().toISOString(),
        summary: summarize([]),
      };
    }
  }
  start() {
    if (this.active || this.block.status !== "running") return;
    this.active = true;
    this.previous = this.scheduler.now();
    this.startAt = this.previous + 3000;
    this.frame = this.scheduler.request(this.tick);
  }
  private tick = (now: number) => {
    if (!this.active) return;
    const gap = now - this.previous;
    this.previous = now;
    if (gap > 250) {
      this.interrupt("Timing interruption: frame gap exceeded 250 ms");
      return;
    }
    if (gap > 50 && this.index >= 0) this.block.frames.push({ at: now, gap });
    if (now < this.startAt) {
      const remaining = Math.ceil((this.startAt - now) / 1000);
      if (remaining !== this.countdownValue) {
        this.countdownValue = remaining;
        this.render({ phase: "countdown", index: -1, remaining });
      }
    } else {
      const c = this.block.config,
        soa = c.windowMs + c.isiMs;
      const current = this.block.trials[this.index];
      if (this.phase === "visible" && current && now >= current.deadline) {
        current.offset = now;
        if (this.dual) finalizeDualTrial(current as DualTrial);
        else
          current.code = classify(
            current.stimulus,
            (current as Trial).response,
            c.input === "aimed" ? "aimed" : "fixed",
          );
        this.phase = "blank";
        this.render({ phase: "blank", index: this.index, trial: current });
      }
      const next = this.index + 1,
        planned = this.startAt + next * soa;
      if (now >= planned && this.phase !== "visible") {
        if (now - planned > 250) {
          this.interrupt("Timing interruption: onset delayed more than 250 ms");
          return;
        }
        if (next >= this.block.sequence.length) {
          this.complete();
          return;
        }
        this.index = next;
        const trial = this.dual
          ? ({
              id: `${this.block.id}:${next}`,
              stimulus: this.block.sequence[next] as DualStimulus,
              plannedOnset: planned,
              onset: now,
              deadline: now + c.windowMs,
              offset: null,
              response: null,
              rt: null,
              code: "pending",
              positionResponse: null,
              numberResponse: null,
              positionRt: null,
              numberRt: null,
              positionCode: "pending",
              numberCode: "pending",
            } satisfies DualTrial)
          : ({
              id: `${this.block.id}:${next}`,
              stimulus: this.block.sequence[next],
              plannedOnset: planned,
              onset: now,
              deadline: now + c.windowMs,
              offset: null,
              response: null,
              rt: null,
              code: "pending",
            } satisfies Trial);
        this.block.trials.push(trial as never);
        this.phase = "visible";
        this.render({ phase: "visible", index: next, trial });
      }
    }
    this.frame = this.scheduler.request(this.tick);
  };
  press(press: Press) {
    if (!this.active) return;
    const event = { ...press, trialIndex: this.index >= 0 ? this.index : null };
    const trial = this.block.trials[this.index];
    if (
      event.control === "stimulus" ||
      event.ignoreReason === "wrong_control"
    ) {
      event.disposition = "ignored";
      event.ignoreReason = event.ignoreReason ?? "wrong_control";
    } else if (event.repeat || event.ignored) {
      event.disposition = "ignored";
      if (event.repeat) event.ignoreReason = event.ignoreReason ?? "repeat";
    } else if (
      this.dual &&
      event.stream !== "position" &&
      event.stream !== "number"
    ) {
      event.disposition = "ignored";
      event.ignoreReason = "malformed_stream";
    } else if (
      !trial ||
      this.phase !== "visible" ||
      event.eventTime < trial.onset ||
      event.eventTime >= trial.deadline ||
      event.handlerTime >= trial.deadline
    )
      event.disposition = "outside_window";
    else if (this.dual) {
      const dual = trial as DualTrial;
      const taken =
        event.stream === "position"
          ? dual.positionResponse
          : dual.numberResponse;
      if (taken) event.disposition = "duplicate";
      else {
        event.disposition = "accepted";
        if (event.stream === "position") {
          dual.positionResponse = event;
          dual.positionRt = event.eventTime - dual.onset;
        } else {
          dual.numberResponse = event;
          dual.numberRt = event.eventTime - dual.onset;
        }
      }
    } else if ((trial as Trial).response) event.disposition = "duplicate";
    else {
      event.disposition = "accepted";
      (trial as Trial).response = event;
      (trial as Trial).rt = event.eventTime - trial.onset;
    }
    this.block.events.push(event);
    return event.disposition;
  }
  interrupt(reason: string) {
    if (!this.active) return;
    this.active = false;
    this.scheduler.cancel(this.frame);
    this.block.status = "interrupted";
    this.block.reason = reason;
    this.score();
    this.render({ phase: "interrupted", index: this.index });
    this.finish(this.block);
  }
  private complete() {
    this.active = false;
    this.block.status = "completed";
    this.score();
    if (!this.dual && this.block.frames.length)
      this.block.summary.flags.push("Long frames observed");
    this.render({ phase: "completed", index: this.index });
    this.finish(this.block);
  }
  private score() {
    if (this.dual) {
      const dual = this.block as DualBlock;
      Object.assign(dual, summarizeDual(dual.trials, dual.frames));
    } else this.block.summary = summarize(this.block.trials as Trial[]);
  }
  dispose() {
    this.active = false;
    this.scheduler.cancel(this.frame);
  }
}
