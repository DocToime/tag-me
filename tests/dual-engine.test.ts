import { describe, expect, it } from "vitest";
import { GameEngine, type Scheduler, type View } from "../src/game/engine";
import { dualProtocol, prepareDualBlock } from "../src/game/protocol";
import { PreparationError } from "../src/game/dualSequence";
import { isDualBlock, type DualBlock, type GameBlock } from "../src/game/types";
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
  let result: GameBlock | undefined;
  const config = dualProtocol(1, "practice");
  const prepared = prepareDualBlock(config, "dual-engine");
  const engine = new GameEngine(
    config,
    "dual-engine",
    (v) => views.push(v),
    (b) => {
      result = b;
    },
    clock,
    prepared,
  );
  engine.start();
  return { clock, engine, views, result: () => result, prepared };
}
describe("dual engine", () => {
  it("requires a prepared sequence", () => {
    expect(
      () =>
        new GameEngine(
          dualProtocol(1, "practice"),
          "x",
          () => {},
          () => {},
        ),
    ).toThrow(/prepared/);
  });
  it("accepts independent stream latches in either order without moving onset", () => {
    const a = setup(),
      b = setup();
    a.clock.advance(3000);
    b.clock.advance(3000);
    expect(
      a.engine.press({
        eventTime: 3100,
        handlerTime: 3100,
        method: "keyboard",
        stream: "position",
        control: "position",
      }),
    ).toBe("accepted");
    expect(
      a.engine.press({
        eventTime: 3200,
        handlerTime: 3200,
        method: "keyboard",
        stream: "number",
        control: "number",
      }),
    ).toBe("accepted");
    expect(
      b.engine.press({
        eventTime: 3100,
        handlerTime: 3100,
        method: "touch",
        stream: "number",
        control: "number",
      }),
    ).toBe("accepted");
    expect(
      b.engine.press({
        eventTime: 3200,
        handlerTime: 3200,
        method: "touch",
        stream: "position",
        control: "position",
      }),
    ).toBe("accepted");
    a.clock.advance(2000);
    b.clock.advance(2000);
    const trialA = a.engine.block.trials[0];
    const trialB = b.engine.block.trials[0];
    expect(trialA.offset).toBe(5000);
    expect(trialB.offset).toBe(5000);
    expect(isDualBlock(a.engine.block)).toBe(true);
    if (!isDualBlock(a.engine.block) || !isDualBlock(b.engine.block)) return;
    expect(a.engine.block.trials[0].positionRt).toBe(100);
    expect(a.engine.block.trials[0].numberRt).toBe(200);
    expect(b.engine.block.trials[0].numberRt).toBe(100);
    expect(b.engine.block.trials[0].positionRt).toBe(200);
    a.clock.advance(750);
    expect(a.engine.block.trials[1].onset).toBe(5750);
  });
  it("duplicates one stream while still accepting the other", () => {
    const { engine, clock } = setup();
    clock.advance(3100);
    engine.press({
      eventTime: 3100,
      handlerTime: 3100,
      method: "keyboard",
      stream: "position",
      control: "position",
    });
    expect(
      engine.press({
        eventTime: 3120,
        handlerTime: 3120,
        method: "keyboard",
        stream: "position",
        control: "position",
      }),
    ).toBe("duplicate");
    expect(
      engine.press({
        eventTime: 3140,
        handlerTime: 3140,
        method: "keyboard",
        stream: "number",
        control: "number",
      }),
    ).toBe("accepted");
  });
  it("ignores wrong-control, malformed streams, and repeats before the window check", () => {
    const { engine, clock } = setup();
    clock.advance(3100);
    expect(
      engine.press({
        eventTime: 3100,
        handlerTime: 3100,
        method: "touch",
        control: "stimulus",
        ignoreReason: "wrong_control",
      }),
    ).toBe("ignored");
    expect(
      engine.press({
        eventTime: 3110,
        handlerTime: 3110,
        method: "keyboard",
        stream: "both" as never,
      }),
    ).toBe("ignored");
    expect(
      engine.press({
        eventTime: 3120,
        handlerTime: 3120,
        method: "keyboard",
        stream: "position",
        control: "position",
        repeat: true,
      }),
    ).toBe("ignored");
    const dual = engine.block as DualBlock;
    expect(dual.trials[0].positionResponse).toBeNull();
  });
  it("leaves dual codes pending on visible interrupt", () => {
    const { engine, clock, result } = setup();
    clock.advance(3100);
    engine.press({
      eventTime: 3100,
      handlerTime: 3100,
      method: "keyboard",
      stream: "position",
      control: "position",
    });
    engine.interrupt("Hidden tab");
    const block = result() as DualBlock;
    expect(block.status).toBe("interrupted");
    expect(block.trials[0].positionCode).toBe("pending");
    expect(block.trials[0].numberCode).toBe("pending");
    expect(block.dualTargets).toBe(0);
  });
  it("classifies both streams at hide and completes with two summaries", () => {
    const { engine, clock, result, prepared } = setup();
    clock.advance(3000 + 13 * 2750);
    const block = result() as DualBlock;
    expect(block.status).toBe("completed");
    expect(block.trials).toHaveLength(13);
    expect(block.positionSummary.scored).toBe(12);
    expect(block.numberSummary.scored).toBe(12);
    expect(block.summary.flags).toContain("Location: No scored responses");
    expect(block.summary.flags).toContain("Number: No scored responses");
    expect(block.sequenceHash).toBe(prepared.sequenceHash);
  });
  it("surfaces a typed preparation failure", () => {
    expect(() =>
      prepareDualBlock(
        { ...dualProtocol(1, "training"), targets: 70, positionTargets: 70 },
        "fail-seed",
      ),
    ).toThrow(PreparationError);
    try {
      prepareDualBlock(
        { ...dualProtocol(1, "training"), targets: 70, positionTargets: 70 },
        "fail-seed",
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PreparationError);
      expect((error as PreparationError).seed).toBe("fail-seed");
      expect((error as PreparationError).reason).toBe("invalid");
    }
  });
});
