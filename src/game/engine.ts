import type { Block, Config, Press, Trial } from "./types";
import { generate, hash } from "./sequence";
import { classify, summarize } from "./scoring";
import { configHash, VERSIONS } from "./protocol";
export interface Scheduler {
  now(): number;
  request(cb: (time: number) => void): number;
  cancel(id: number): void;
}
export type View = {
  phase: "countdown" | "visible" | "blank" | "completed" | "interrupted";
  index: number;
  remaining?: number;
  trial?: Trial;
};
const browserScheduler: Scheduler = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};
export class GameEngine {
  readonly block: Block;
  private startAt = 0;
  private previous = 0;
  private frame = 0;
  private index = -1;
  private phase: View["phase"] = "countdown";
  private active = false;
  private countdownValue = -1;
  constructor(
    config: Config,
    seed: string,
    private render: (view: View) => void,
    private finish: (block: Block) => void,
    private scheduler: Scheduler = browserScheduler,
  ) {
    const sequence = generate(config, seed);
    this.block = {
      id: crypto.randomUUID(),
      seed,
      config,
      configHash: configHash(config),
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
        current.code = classify(current.stimulus, current.response, c.input);
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
        const trial: Trial = {
          id: `${this.block.id}:${next}`,
          stimulus: this.block.sequence[next],
          plannedOnset: planned,
          onset: now,
          deadline: now + c.windowMs,
          offset: null,
          response: null,
          rt: null,
          code: "pending",
        };
        this.block.trials.push(trial);
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
    if (event.repeat || event.ignored) event.disposition = "ignored";
    else if (
      !trial ||
      this.phase !== "visible" ||
      event.eventTime < trial.onset ||
      event.eventTime >= trial.deadline ||
      event.handlerTime >= trial.deadline
    )
      event.disposition = "outside_window";
    else if (trial.response) event.disposition = "duplicate";
    else {
      event.disposition = "accepted";
      trial.response = event;
      trial.rt = event.eventTime - trial.onset;
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
    this.block.summary = summarize(this.block.trials);
    this.render({ phase: "interrupted", index: this.index });
    this.finish(this.block);
  }
  private complete() {
    this.active = false;
    this.block.status = "completed";
    this.block.summary = summarize(this.block.trials);
    if (this.block.frames.length)
      this.block.summary.flags.push("Long frames observed");
    this.render({ phase: "completed", index: this.index });
    this.finish(this.block);
  }
  dispose() {
    this.active = false;
    this.scheduler.cancel(this.frame);
  }
}
