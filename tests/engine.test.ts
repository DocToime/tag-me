import { describe, expect, it } from "vitest";
import { GameEngine, type Scheduler, type View } from "../src/game/engine";
import { protocol } from "../src/game/protocol";
import type { Block } from "../src/game/types";
class FakeClock implements Scheduler {
  time = 0;
  cb: ((n: number) => void) | undefined;
  now = () => this.time;
  request = (cb: (n: number) => void) => {
    this.cb = cb;
    return 1;
  };
  cancel = () => {
    this.cb = undefined;
  };
  tick(ms = 10) {
    this.time += ms;
    const cb = this.cb;
    this.cb = undefined;
    cb?.(this.time);
  }
  advance(ms: number) {
    const target = this.time + ms;
    while (this.time < target) this.tick(Math.min(10, target - this.time));
  }
}
function setup() {
  const clock = new FakeClock(),
    views: View[] = [];
  let result: Block | undefined;
  const engine = new GameEngine(
    protocol(1, "practice"),
    "test",
    (v) => views.push(v),
    (b) => {
      result = b;
    },
    clock,
  );
  engine.start();
  return { clock, engine, views, result: () => result };
}
describe("timed engine", () => {
  it("keeps stimulus and next onset independent of a 300 ms press", () => {
    const a = setup(),
      b = setup();
    a.clock.advance(3000);
    b.clock.advance(3000);
    a.clock.advance(300);
    a.engine.press({ eventTime: 3300, handlerTime: 3300, method: "keyboard" });
    a.clock.advance(1700);
    b.clock.advance(2000);
    expect(a.engine.block.trials[0].offset).toBe(5000);
    expect(b.engine.block.trials[0].offset).toBe(5000);
    a.clock.advance(750);
    b.clock.advance(750);
    expect(a.engine.block.trials[1].onset).toBe(5750);
    expect(a.engine.block.trials[1].onset).toBe(b.engine.block.trials[1].onset);
    expect(a.engine.block.trials[0].rt).toBe(300);
  });
  it("first eligible press wins and repeat/duplicates stay in the event log", () => {
    const { engine, clock } = setup();
    clock.advance(3100);
    engine.press({
      eventTime: 3100,
      handlerTime: 3100,
      method: "keyboard",
      repeat: true,
    });
    engine.press({ eventTime: 3110, handlerTime: 3110, method: "keyboard" });
    engine.press({ eventTime: 3200, handlerTime: 3200, method: "mouse" });
    expect(engine.block.trials[0].rt).toBe(110);
    expect(engine.block.events.map((e) => e.disposition)).toEqual([
      "ignored",
      "accepted",
      "duplicate",
    ]);
  });
  it("rejects pre-onset, exact-deadline, delayed-dispatch and blank presses", () => {
    const { engine, clock } = setup();
    engine.press({ eventTime: 1, handlerTime: 1, method: "mouse" });
    clock.advance(3000);
    engine.press({ eventTime: 5000, handlerTime: 5000, method: "mouse" });
    engine.press({ eventTime: 4999, handlerTime: 5001, method: "mouse" });
    clock.advance(2000);
    engine.press({ eventTime: 5100, handlerTime: 5100, method: "mouse" });
    expect(
      engine.block.events.every((e) => e.disposition === "outside_window"),
    ).toBe(true);
    expect(engine.block.trials[0].response).toBeNull();
  });
  it("accepts the exact onset and the final instant before deadline", () => {
    const a = setup(),
      b = setup();
    a.clock.advance(3000);
    b.clock.advance(3000);
    expect(
      a.engine.press({ eventTime: 3000, handlerTime: 3000, method: "mouse" }),
    ).toBe("accepted");
    expect(a.engine.block.trials[0].rt).toBe(0);
    expect(
      b.engine.press({ eventTime: 4999, handlerTime: 4999, method: "mouse" }),
    ).toBe("accepted");
  });
  it("interruption preserves partial data without inventing a miss and is terminal", () => {
    const { engine, clock, result } = setup();
    clock.advance(3100);
    engine.interrupt("Hidden tab");
    expect(result()!.status).toBe("interrupted");
    expect(result()!.trials[0].code).toBe("pending");
    expect(result()!.summary.scored).toBe(0);
    engine.start();
    clock.advance(20000);
    expect(engine.block.trials).toHaveLength(1);
  });
  it("aborts on large frame gaps and records smaller anomalies", () => {
    const a = setup();
    a.clock.advance(3000);
    a.clock.tick(70);
    expect(a.engine.block.frames).toHaveLength(1);
    a.clock.tick(300);
    expect(a.result()!.reason).toContain("frame gap");
  });
  it("completes with N fill plus scored trials and null no-response RT", () => {
    const { engine, clock, result } = setup();
    clock.advance(3000 + 13 * 2750);
    expect(result()!.status).toBe("completed");
    expect(engine.block.trials).toHaveLength(13);
    expect(result()!.summary.scored).toBe(12);
    expect(result()!.summary.medianRt).toBeNull();
    expect(result()!.summary.flags).toContain("No scored responses");
  });
});
