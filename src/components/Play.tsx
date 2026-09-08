import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { GameEngine, type View } from "../game/engine";
import type { Block, Config, Press } from "../game/types";
import { Icon, Mole } from "./Art";
const keys = ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD"];
export default function Play({
  config,
  round,
  total,
  sound,
  onDone,
}: {
  config: Config;
  round: number;
  total: number;
  sound: boolean;
  onDone: (b: Block) => void;
}) {
  const [view, setView] = useState<View>({
    phase: "countdown",
    index: -1,
    remaining: 3,
  });
  const [ack, setAck] = useState(false);
  const engine = useRef<GameEngine | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const holes = useRef<(HTMLButtonElement | null)[]>([]);
  const audio = useRef<AudioContext | null>(null);
  function beep(correct: boolean) {
    if (!sound) return;
    try {
      const ctx = (audio.current ??= new AudioContext());
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = correct ? 620 : 240;
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.14);
    } catch {
      /* Audio is optional. */
    }
  }
  useEffect(() => {
    const instance = new GameEngine(
      config,
      crypto.randomUUID(),
      (next) => {
        flushSync(() => {
          setView(next);
          setAck(false);
        });
        if (
          next.phase === "blank" &&
          config.mode !== "assessment" &&
          next.trial &&
          !next.trial.stimulus.warmup
        )
          beep(
            next.trial.code === "hit" ||
              next.trial.code === "correct_rejection",
          );
      },
      (b) => done.current(b),
    );
    engine.current = instance;
    instance.block.viewport = {
      width: innerWidth,
      height: innerHeight,
      pixelRatio: devicePixelRatio,
    };
    const held = new Set<string>();
    const keydown = (e: KeyboardEvent) => {
      const hole = keys.indexOf(e.code);
      if (config.input === "fixed" ? e.code !== "Space" : hole < 0) return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches("input, select, textarea, a") ||
          (e.code === "Space" &&
            e.target.closest("button") &&
            !e.target.closest(".match-button")))
      )
        return;
      e.preventDefault();
      send({
        eventTime: e.timeStamp,
        handlerTime: performance.now(),
        method: "keyboard",
        key: e.code,
        hole: hole >= 0 ? hole : undefined,
        repeat: e.repeat || held.has(e.code),
      });
      held.add(e.code);
    };
    const keyup = (e: KeyboardEvent) => held.delete(e.code);
    const hidden = () => {
      if (document.hidden) instance.interrupt("Tab became hidden");
    };
    const blur = () => instance.interrupt("Window lost focus");
    const initial = { w: innerWidth, h: innerHeight };
    const resize = () => {
      if (
        Math.abs(innerWidth - initial.w) > 80 ||
        Math.abs(innerHeight - initial.h) > 160
      )
        instance.interrupt("Playfield size changed");
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", resize);
    instance.start();
    return () => {
      instance.dispose();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resize);
      audio.current?.close();
    };
  }, []);
  function send(press: Press) {
    const now = press.handlerTime;
    if (
      !Number.isFinite(press.eventTime) ||
      Math.abs(press.eventTime - now) > 60000
    ) {
      press.eventTime = now;
      press.timestampFallback = true;
    }
    const active = engine.current?.block.trials.at(-1)?.stimulus.hole;
    const rect =
      active !== undefined
        ? holes.current[active]?.getBoundingClientRect()
        : undefined;
    if (rect)
      press.hitbox = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    if (engine.current?.press(press) === "accepted") setAck(true);
  }
  function pointer(e: React.PointerEvent, hole?: number) {
    e.preventDefault();
    send({
      eventTime: e.timeStamp,
      handlerTime: performance.now(),
      method: e.pointerType,
      hole,
      x: e.clientX,
      y: e.clientY,
      ignored: !e.isPrimary || e.button !== 0,
    });
  }
  const fill = !!view.trial?.stimulus.warmup;
  const progress = Math.max(
    0,
    view.index - config.n + (view.phase === "blank" ? 1 : 0),
  );
  const feedback =
    view.phase === "blank" && config.mode !== "assessment" && !fill
      ? {
          hit: "✓ Match caught. Nicely done.",
          correct_rejection: "✓ Different number. Good wait.",
          false_alarm: "Different number — let this one pass.",
          miss: "That was a match. Keep going.",
          warmup: "",
          pending: "",
        }[view.trial!.code]
      : "";
  return (
    <section className="play-page">
      <div className="play-top">
        <span className="eyebrow">
          {config.mode} ·{" "}
          {config.mode === "practice"
            ? "Getting familiar"
            : `Round ${round} of ${total}`}
        </span>
        <button
          className="text-button"
          onClick={() => engine.current?.interrupt("Stopped by player")}
        >
          <Icon name="close" size={17} /> Stop round
        </button>
      </div>
      <div className="play-title">
        <span className="level-pill">{config.n}-back</span>
        <h1>Notice. Remember. Match.</h1>
        <p>
          Match the number from{" "}
          <strong>
            {config.n} turn{config.n > 1 ? "s" : ""} ago.
          </strong>{" "}
          Otherwise, wait.
        </p>
      </div>
      <div className="game-progress">
        <span>
          {view.phase === "countdown"
            ? "Settle in"
            : fill
              ? "Memory fill · just remember"
              : `${Math.min(progress, config.scoredTrials)} / ${config.scoredTrials} trials`}
        </span>
        <div>
          <i style={{ width: `${(progress / config.scoredTrials) * 100}%` }} />
        </div>
        <span>{config.windowMs / 1000}s per number</span>
      </div>
      <div className="playfield" data-phase={view.phase}>
        <div className="field-grass grass-one" />
        <div className="field-grass grass-two" />
        {Array.from({ length: 6 }, (_, i) => (
          <button
            ref={(el) => {
              holes.current[i] = el;
            }}
            type="button"
            disabled={config.input === "fixed"}
            tabIndex={config.input === "aimed" ? 0 : -1}
            aria-label={`Hole ${i + 1}${config.input === "aimed" ? `, ${keys[i].slice(-1)}` : ""}`}
            key={i}
            className={`hole ${view.phase === "visible" && view.trial?.stimulus.hole === i ? "occupied" : ""}`}
            onPointerDown={(e) => {
              if (config.input === "aimed") pointer(e, i);
            }}
            onClick={(e) => {
              if (config.input === "aimed" && e.detail === 0)
                send({
                  eventTime: e.timeStamp,
                  handlerTime: performance.now(),
                  method: "keyboard-control",
                  hole: i,
                });
            }}
          >
            <span className="hole-shadow" />
            {view.phase === "visible" && view.trial?.stimulus.hole === i && (
              <Mole digit={view.trial.stimulus.digit} />
            )}
            <span className="hole-rim" />
            {config.input === "aimed" && <kbd>{keys[i].slice(-1)}</kbd>}
          </button>
        ))}
        {view.phase === "countdown" && (
          <div className="countdown">
            <span>Take a breath</span>
            <strong>{view.remaining}</strong>
            <p>
              The first {config.n} number{config.n > 1 ? "s are" : " is"} for
              remembering.
            </p>
          </div>
        )}
      </div>
      <div
        className="feedback"
        aria-live={config.mode === "assessment" ? "off" : "polite"}
      >
        {feedback ||
          (fill
            ? "Just remember this number."
            : ack
              ? "Response recorded"
              : view.phase === "countdown"
                ? "Your garden is ready."
                : "Stay with the rhythm.")}
      </div>
      {config.input === "fixed" ? (
        <button
          className={`match-button ${ack ? "acknowledged" : ""}`}
          onPointerDown={(e) => pointer(e)}
          onClick={(e) => {
            if (e.detail === 0)
              send({
                eventTime: e.timeStamp,
                handlerTime: performance.now(),
                method: "keyboard-control",
              });
          }}
        >
          <Icon name="check" /> It’s a match <kbd>SPACE</kbd>
        </button>
      ) : (
        <p className="input-hint">
          Tap the mole to match, or use <kbd>Q W E</kbd> / <kbd>A S D</kbd>.
        </p>
      )}
      <p className="quiet centered">
        {config.mode === "assessment"
          ? "Keep going at your own rhythm. Results appear after the round."
          : "No match? No action needed."}
      </p>
    </section>
  );
}
