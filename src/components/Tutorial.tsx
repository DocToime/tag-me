import { useState } from "react";
import { resourceOk, type InputMode, type N } from "../game/types";
import { Icon, Mole } from "./Art";
import LevelPicker from "./LevelPicker";

function exampleSequence(n: N): number[] {
  if (n === 1) return [2, 2, 5, 8, 8, 3];
  if (n === 2) return [2, 5, 2, 8, 2, 8];
  if (n === 3) return [2, 5, 8, 2, 7, 8];
  const cycle = [2, 5, 8, 3, 4, 6, 7, 9, 1];
  const digits = Array.from({ length: n }, (_, i) => cycle[i % cycle.length]);
  digits.push(digits[0]);
  for (let i = n + 1; i < n + 3; i++) {
    const prior = digits[i - n];
    digits.push(cycle.find((d) => d !== prior) ?? 1);
  }
  return digits;
}

export default function Tutorial({
  n,
  input,
  onN,
  onPractice,
}: {
  n: N;
  input: InputMode;
  onN?: (n: N) => void;
  onPractice: () => void;
}) {
  const [step, setStep] = useState<number>(n);
  const [answer, setAnswer] = useState("");
  const [seenN, setSeenN] = useState(n);
  if (n !== seenN) {
    setSeenN(n);
    setStep(n);
    setAnswer("");
  }
  const allowed = resourceOk(n, Math.max(12, n + 3));
  const numbers = allowed ? exampleSequence(n) : [];
  const target = allowed && numbers[step] === numbers[step - n];
  const respond = () =>
    setAnswer(
      target
        ? "Correct — these numbers match."
        : "Different numbers. Wait for the next one.",
    );
  return (
    <section className="tutorial">
      <div className="page-heading">
        <div>
          <h1>How to play</h1>
          <p>
            Match the number from{" "}
            <strong>
              {n} turn{n > 1 ? "s" : ""} ago
            </strong>
            .
          </p>
        </div>
      </div>
      {onN && <LevelPicker n={n} onChange={onN} ariaLabel="Example level" />}
      {allowed ? (
        <div className="card example-card">
          <div className="digit-history" aria-label={`${n}-back example`}>
            {numbers.slice(step - n, step + 1).map((digit, i) => (
              <div
                key={i}
                className={`example-digit ${i === n ? "current" : i === 0 ? "compare" : ""}`}
              >
                <span>{digit}</span>
                <small>
                  {i === n ? "Now" : i === 0 ? `${n} ago` : "Earlier"}
                </small>
              </div>
            ))}
          </div>
          <p className="example-explanation">
            {target ? "Same number: match." : "Different number: wait."}
          </p>
          <div className="example-controls">
            {input === "aimed" ? (
              <button
                className="example-mole"
                aria-label={`Match number ${numbers[step]}`}
                onClick={respond}
              >
                <Mole digit={numbers[step]} />
              </button>
            ) : (
              <button className="secondary" onClick={respond}>
                Match <kbd className="keyboard-hint">Space</kbd>
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                setStep(step === numbers.length - 1 ? n : step + 1);
                setAnswer("");
              }}
            >
              Next example <Icon name="arrow" size={16} />
            </button>
          </div>
          <p className="example-answer" role="status">
            {answer ||
              (input === "aimed"
                ? "Try tapping the mole above."
                : "Try the Match button above.")}
          </p>
        </div>
      ) : (
        <p className="notice" role="alert">
          This level is too large to illustrate here. Choose a smaller starting
          level.
        </p>
      )}
      <p className="tutorial-rule">
        {input === "aimed" ? (
          <>
            Tap the mole when it matches.
            <span className="keyboard-hint"> Keys: Q W E / A S D.</span>
          </>
        ) : (
          <>
            Tap <strong>Match</strong> when it matches.
            <span className="keyboard-hint"> Or press Space.</span>
          </>
        )}{" "}
        Otherwise, wait. Remember the shirt number; the hole can change.
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
          The first {n} number{n > 1 ? "s" : ""} fill your memory. Then catch at
          least 5 of 6 matches, with at most 1 false alarm across 12 turns. Each
          number stays for its full time after a response. Practice must pass
          before scored play.
        </p>
      </details>
    </section>
  );
}
