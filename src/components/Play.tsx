import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { GameEngine, type PreparedDual, type View } from "../game/engine";
import type { DualTrial, GameBlock, GameConfig, Press } from "../game/types";
import { isDualConfig } from "../game/types";
import { Icon, Mole } from "./Art";
const keys = ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD"];
const POSITION_KEYS = ["KeyA", "ArrowLeft"];
const NUMBER_KEYS = ["KeyL", "ArrowRight"];
function streamLine(code: DualTrial["positionCode"]) {
  return {
    hit: "✓ match",
    correct_rejection: "✓ wait",
    false_alarm: "No match — wait",
    miss: "Missed match",
    warmup: "",
    pending: "",
  }[code];
}
export default function Play({
  config,
  round,
  total,
  sound,
  prepared,
  seed,
  onDone,
}: {
  config: GameConfig;
  round: number;
  total: number;
  sound: boolean;
  prepared?: PreparedDual;
  seed?: string;
  onDone: (b: GameBlock) => void;
}) {
  const dual = isDualConfig(config);
  const [view, setView] = useState<View>({
    phase: "countdown",
    index: -1,
    remaining: 3,
  });
  const [ack, setAck] = useState({ position: false, number: false });
  const engine = useRef<GameEngine | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const holes = useRef<(HTMLElement | null)[]>([]);
  const locationBtn = useRef<HTMLButtonElement | null>(null);
  const numberBtn = useRef<HTMLButtonElement | null>(null);
  const field = useRef<HTMLDivElement | null>(null);
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
      seed ?? crypto.randomUUID(),
      (next) => {
        flushSync(() => {
          setView(next);
          if (next.phase !== "visible")
            setAck({ position: false, number: false });
        });
        if (
          next.phase === "blank" &&
          config.mode !== "assessment" &&
          next.trial &&
          !next.trial.stimulus.warmup
        ) {
          if (dual) {
            const trial = next.trial as DualTrial;
            beep(
              (trial.positionCode === "hit" ||
                trial.positionCode === "correct_rejection") &&
                (trial.numberCode === "hit" ||
                  trial.numberCode === "correct_rejection"),
            );
          } else
            beep(
              next.trial.code === "hit" ||
                next.trial.code === "correct_rejection",
            );
        }
      },
      (b) => done.current(b),
      undefined,
      prepared,
    );
    engine.current = instance;
    instance.block.viewport = {
      width: innerWidth,
      height: innerHeight,
      pixelRatio: devicePixelRatio,
    };
    const held = new Set<string>();
    const keydown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches("input, select, textarea, a, [contenteditable]") ||
          e.target.closest("a, [contenteditable]") ||
          (e.target.closest("button, a") &&
            !e.target.closest(".match-button, .dual-response")))
      )
        return;
      if (dual) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing)
          return;
        const stream = POSITION_KEYS.includes(e.code)
          ? "position"
          : NUMBER_KEYS.includes(e.code)
            ? "number"
            : null;
        if (!stream) return;
        e.preventDefault();
        send({
          eventTime: e.timeStamp,
          handlerTime: performance.now(),
          method: "keyboard",
          key: e.code,
          stream,
          control: stream,
          repeat: e.repeat || held.has(e.code),
        });
        held.add(e.code);
        return;
      }
      const hole = keys.indexOf(e.code);
      if (config.input === "fixed" ? e.code !== "Space" : hole < 0) return;
      if (
        e.target instanceof HTMLElement &&
        e.code === "Space" &&
        e.target.closest("button") &&
        !e.target.closest(".match-button")
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
    const initial = field.current!.getBoundingClientRect();
    const resize = () => {
      const current = field.current?.getBoundingClientRect();
      if (!current) return;
      if (
        Math.abs(current.width - initial.width) > 32 ||
        Math.abs(current.height - initial.height) > 32 ||
        Math.abs(current.x - initial.x) > 24 ||
        Math.abs(current.y - initial.y) > 24
      )
        instance.interrupt("Playfield size changed");
    };
    const observer = new ResizeObserver(resize);
    observer.observe(field.current!);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", resize);
    instance.start();
    return () => {
      instance.dispose();
      observer.disconnect();
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
    if (dual) {
      const control =
        press.control === "number" || press.stream === "number"
          ? numberBtn.current
          : press.control === "position" || press.stream === "position"
            ? locationBtn.current
            : null;
      const rect = control?.getBoundingClientRect();
      if (rect)
        press.hitbox = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
    } else {
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
    }
    const disposition = engine.current?.press(press);
    if (disposition === "accepted") {
      if (dual && (press.stream === "position" || press.stream === "number"))
        setAck((prev) => ({ ...prev, [press.stream!]: true }));
      else if (!dual) setAck({ position: true, number: true });
    }
  }
  function pointer(
    e: React.PointerEvent,
    extra: Pick<Press, "hole" | "stream" | "control" | "ignoreReason">,
  ) {
    e.preventDefault();
    const mouseLike = e.pointerType === "mouse" || e.pointerType === "pen";
    const dualResponse =
      dual && extra.control !== undefined && extra.control !== "stimulus";
    const ignored =
      extra.control === "stimulus"
        ? true
        : dualResponse
          ? mouseLike && e.button !== 0
          : !e.isPrimary || e.button !== 0;
    send({
      eventTime: e.timeStamp,
      handlerTime: performance.now(),
      method: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      ignored,
      ignoreReason:
        extra.control === "stimulus" ? "wrong_control" : extra.ignoreReason,
      ...extra,
    });
  }
  const fill = !!view.trial?.stimulus.warmup;
  const progress = Math.max(
    0,
    view.index - config.n + (view.phase === "blank" ? 1 : 0),
  );
  const dualTrial = dual ? (view.trial as DualTrial | undefined) : undefined;
  const identityFeedback =
    !dual && view.phase === "blank" && config.mode !== "assessment" && !fill
      ? {
          hit: "✓ Correct match",
          correct_rejection: "✓ Correct wait",
          false_alarm: "No match — wait",
          miss: "Missed match",
          warmup: "",
          pending: "",
        }[view.trial!.code]
      : "";
  const dualFeedback =
    dual &&
    view.phase === "blank" &&
    config.mode !== "assessment" &&
    !fill &&
    dualTrial
      ? `Location: ${streamLine(dualTrial.positionCode)}\nNumber: ${streamLine(dualTrial.numberCode)}`
      : "";
  const ackText = dual
    ? ack.position && ack.number
      ? "Location and Number recorded"
      : ack.position
        ? "Location recorded"
        : ack.number
          ? "Number recorded"
          : ""
    : ack.position
      ? "Response recorded"
      : "";
  return (
    <section
      className="play-page"
      tabIndex={-1}
      aria-label={`${config.mode}, ${config.n}-back${dual ? " dual" : ""}`}
    >
      <div className="play-top">
        <h1>
          {config.mode === "practice" ? "Practice" : `Round ${round}/${total}`}{" "}
          · {config.n}-back{dual ? " dual" : ""}
        </h1>
        <span className="trial-count">
          {fill || view.phase === "countdown"
            ? "Memory fill"
            : `${Math.min(progress, config.scoredTrials)} / ${config.scoredTrials}`}
        </span>
        <button
          className="text-button"
          onClick={() => engine.current?.interrupt("Stopped by player")}
        >
          <Icon name="close" size={17} /> Stop round
        </button>
      </div>
      <div className="play-title">
        <p>
          {dual ? (
            <>
              Location if the hole matches{" "}
              <strong>
                {config.n} turn{config.n > 1 ? "s" : ""} ago
              </strong>
              ; Number if the shirt matches. Both allowed; otherwise wait.
            </>
          ) : (
            <>
              Match the number from{" "}
              <strong>
                {config.n} turn{config.n > 1 ? "s" : ""} ago.
              </strong>
            </>
          )}
        </p>
        <div
          className="game-progress"
          role="progressbar"
          aria-label="Round progress"
          aria-valuemin={0}
          aria-valuemax={config.scoredTrials}
          aria-valuenow={progress}
        >
          <div>
            <i
              style={{ width: `${(progress / config.scoredTrials) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div
        ref={field}
        className="playfield"
        data-phase={view.phase}
        data-task={dual ? "dual" : "identity"}
      >
        {Array.from({ length: 6 }, (_, i) => {
          const occupied =
            view.phase === "visible" && view.trial?.stimulus.hole === i;
          const holeProps = {
            ref: (el: HTMLElement | null) => {
              holes.current[i] = el;
            },
            "data-hole": i,
            className: `hole ${occupied ? "occupied" : ""}`,
            children: (
              <>
                <span className="hole-shadow" />
                {occupied && <Mole digit={view.trial!.stimulus.digit} />}
                <span className="hole-rim" />
                {!dual && config.input === "aimed" && (
                  <kbd className="keyboard-hint">{keys[i].slice(-1)}</kbd>
                )}
              </>
            ),
          };
          return dual ? (
            <div
              key={i}
              {...holeProps}
              onPointerDown={(e) =>
                pointer(e, {
                  control: "stimulus",
                  ignoreReason: "wrong_control",
                })
              }
            />
          ) : (
            <button
              key={i}
              {...holeProps}
              type="button"
              disabled={config.input === "fixed"}
              tabIndex={config.input === "aimed" ? 0 : -1}
              aria-label={`Hole ${i + 1}${config.input === "aimed" ? `, ${keys[i].slice(-1)}` : ""}`}
              onPointerDown={(e) => {
                if (config.input === "aimed") pointer(e, { hole: i });
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
            />
          );
        })}
        {dual && (
          <>
            <button
              ref={locationBtn}
              type="button"
              className={`dual-response location ${ack.position ? "acknowledged" : ""}`}
              aria-label="Location match"
              onPointerDown={(e) =>
                pointer(e, { stream: "position", control: "position" })
              }
              onClick={(e) => {
                if (e.detail === 0)
                  send({
                    eventTime: e.timeStamp,
                    handlerTime: performance.now(),
                    method: "keyboard-control",
                    stream: "position",
                    control: "position",
                  });
              }}
            >
              Location <kbd className="keyboard-hint">A</kbd>
            </button>
            <span className="dual-turf" aria-hidden="true" />
            <button
              ref={numberBtn}
              type="button"
              className={`dual-response number ${ack.number ? "acknowledged" : ""}`}
              aria-label="Number match"
              onPointerDown={(e) =>
                pointer(e, { stream: "number", control: "number" })
              }
              onClick={(e) => {
                if (e.detail === 0)
                  send({
                    eventTime: e.timeStamp,
                    handlerTime: performance.now(),
                    method: "keyboard-control",
                    stream: "number",
                    control: "number",
                  });
              }}
            >
              Number <kbd className="keyboard-hint">L</kbd>
            </button>
          </>
        )}
        {view.phase === "countdown" && (
          <div className="countdown">
            <span>Get ready</span>
            <strong>{view.remaining}</strong>
            <p>
              The first {config.n} appearance{config.n > 1 ? "s are" : " is"}{" "}
              for remembering.
            </p>
          </div>
        )}
      </div>
      <div className="play-response">
        <div
          className={`feedback ${dual ? "dual-feedback" : ""}`}
          aria-live={config.mode === "assessment" ? "off" : "polite"}
        >
          {identityFeedback ||
            dualFeedback ||
            (fill
              ? dual
                ? "Remember this hole and number"
                : "Remember this number"
              : ackText || "\u00a0")}
        </div>
        {!dual && config.input === "fixed" ? (
          <button
            className={`match-button ${ack.position ? "acknowledged" : ""}`}
            onPointerDown={(e) => pointer(e, {})}
            onClick={(e) => {
              if (e.detail === 0)
                send({
                  eventTime: e.timeStamp,
                  handlerTime: performance.now(),
                  method: "keyboard-control",
                });
            }}
          >
            <Icon name="check" /> Match{" "}
            <kbd className="keyboard-hint">Space</kbd>
          </button>
        ) : !dual ? (
          <p className="input-hint">
            Tap the mole to match.
            <span className="keyboard-hint">
              {" "}
              Keys: <kbd>Q W E</kbd> / <kbd>A S D</kbd>.
            </span>
          </p>
        ) : null}
        <p className="quiet centered">
          {dual ? "No match on a stream? Wait." : "No match? Wait."}
        </p>
      </div>
    </section>
  );
}
