import { useState } from "react";
import { resourceOk, type N } from "../game/types";
import { Icon, Mole } from "./Art";
import LevelPicker from "./LevelPicker";

function exampleDual(n: N): { holes: number[]; digits: number[] } {
  if (n === 1) return { holes: [2, 2, 5, 5, 0], digits: [7, 1, 1, 1, 9] };
  if (n === 2) return { holes: [2, 5, 2, 4, 2, 0], digits: [7, 3, 1, 3, 1, 9] };
  if (n === 3)
    return { holes: [1, 2, 3, 1, 5, 3, 0], digits: [7, 8, 9, 4, 8, 9, 1] };
  const holeCycle = [0, 1, 2, 3, 4, 5];
  const digitCycle = [2, 5, 8, 3, 4, 6, 7, 9, 1];
  const holes = Array.from({ length: n }, (_, i) => holeCycle[i % 6]);
  const digits = Array.from({ length: n }, (_, i) => digitCycle[i % 9]);
  holes.push(holes[0]);
  digits.push(digitCycle.find((d) => d !== digits[0]) ?? 1);
  holes.push(holeCycle.find((h) => h !== holes[1]) ?? 0);
  digits.push(digits[1]);
  holes.push(holes[2]);
  digits.push(digits[2]);
  const neitherHole = holeCycle.find((h) => h !== holes[3]) ?? 0;
  const neitherDigit = digitCycle.find((d) => d !== digits[3]) ?? 1;
  holes.push(neitherHole);
  digits.push(neitherDigit);
  return { holes, digits };
}

function actionLabel(pos: boolean, num: boolean) {
  if (pos && num) return "both Location and Number";
  if (pos) return "Location only";
  if (num) return "Number only";
  return "neither";
}

export default function TutorialDual({
  n,
  onN,
  onPractice,
}: {
  n: N;
  onN?: (n: N) => void;
  onPractice: () => void;
}) {
  const [step, setStep] = useState(n);
  const [position, setPosition] = useState(false);
  const [number, setNumber] = useState(false);
  const [checked, setChecked] = useState(false);
  const [seenN, setSeenN] = useState(n);
  if (n !== seenN) {
    setSeenN(n);
    setStep(n);
    setPosition(false);
    setNumber(false);
    setChecked(false);
  }
  const allowed = resourceOk(n, Math.max(12, n + 4));
  const example = allowed ? exampleDual(n) : { holes: [], digits: [] };
  const posMatch = allowed && example.holes[step] === example.holes[step - n];
  const numMatch = allowed && example.digits[step] === example.digits[step - n];
  const midCount = Math.max(0, n - 1);
  const omitted = Math.max(0, midCount - 4);
  const shownFrom = step - Math.min(4, midCount);
  function resetResponses() {
    setPosition(false);
    setNumber(false);
    setChecked(false);
  }
  const answer = !checked
    ? "Choose Location, Number, both, or neither, then check."
    : position === posMatch && number === numMatch
      ? `Correct — ${actionLabel(posMatch, numMatch)}.`
      : `The right action was ${actionLabel(posMatch, numMatch)}.`;
  return (
    <section className="tutorial">
      <div className="page-heading">
        <div>
          <h1>How to play Dual</h1>
          <p>
            Two judgements each turn: the <strong>hole</strong> and the{" "}
            <strong>shirt number</strong> from {n} turn{n > 1 ? "s" : ""} ago.
          </p>
        </div>
      </div>
      {onN && <LevelPicker n={n} onChange={onN} ariaLabel="Example level" />}
      {allowed ? (
        <div className="card example-card">
          <div
            className="digit-history dual-history"
            aria-label={`${n}-back dual example`}
          >
            <div className="example-digit compare">
              <Mole digit={example.digits[step - n]} />
              <small>
                {n} ago · hole {example.holes[step - n] + 1}
              </small>
            </div>
            {omitted > 0 && (
              <div className="example-omitted">
                <small>
                  {omitted} earlier appearance{omitted > 1 ? "s" : ""} omitted
                </small>
              </div>
            )}
            {example.holes.slice(shownFrom, step).map((_, i) => {
              const idx = shownFrom + i;
              return (
                <div className="example-digit" key={idx}>
                  <span>{example.digits[idx]}</span>
                  <small>Earlier</small>
                </div>
              );
            })}
            <div className="example-digit current">
              <Mole digit={example.digits[step]} />
              <small>Now · hole {example.holes[step] + 1}</small>
            </div>
          </div>
          <p className="example-explanation">
            Location if the hole matches; Number if the shirt matches; both
            allowed; otherwise wait, then Check.
          </p>
          <div className="example-controls dual-example-controls">
            <button
              className={`secondary ${position ? "selected" : ""}`}
              aria-pressed={position}
              onClick={() => {
                setPosition((v) => !v);
                setChecked(false);
              }}
            >
              Location <kbd className="keyboard-hint">A</kbd>
            </button>
            <button
              className={`secondary ${number ? "selected" : ""}`}
              aria-pressed={number}
              onClick={() => {
                setNumber((v) => !v);
                setChecked(false);
              }}
            >
              Number <kbd className="keyboard-hint">L</kbd>
            </button>
            <button className="secondary" onClick={() => setChecked(true)}>
              Check answer
            </button>
            <button
              className="text-button"
              onClick={() => {
                const last = example.holes.length - 1;
                setStep(step === last ? n : step + 1);
                resetResponses();
              }}
            >
              Next example <Icon name="arrow" size={16} />
            </button>
          </div>
          <p className="example-answer" role="status">
            {answer}
          </p>
        </div>
      ) : (
        <p className="notice" role="alert">
          This level is too large to illustrate here. Choose a smaller starting
          level.
        </p>
      )}
      <p className="tutorial-rule">
        Tap <strong>Location</strong> when the hole matches {n} turn
        {n > 1 ? "s" : ""} ago, and <strong>Number</strong> when the shirt
        matches. You may press both. Hitting the mole is not a response.{" "}
        <span className="keyboard-hint">
          Keys: <kbd>A</kbd> location, <kbd>L</kbd> number.
        </span>
      </p>
      <button
        className="primary full-width practice-start"
        onClick={onPractice}
        disabled={!allowed}
      >
        Start practice <Icon name="arrow" size={18} />
      </button>
      <details className="tutorial-details">
        <summary>Practice rules</summary>
        <p>
          The first {n} appearance{n > 1 ? "s" : ""} fill your memory. Then you
          need at least 5 of 6 location matches and 5 of 6 number matches, with
          at most 1 false alarm on each stream across 12 turns. Practice must
          pass before scored play. Dual training keeps the level you choose.
        </p>
      </details>
    </section>
  );
}
