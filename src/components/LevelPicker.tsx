import type { N } from "../game/types";

export default function LevelPicker({
  n,
  onChange,
  labelledBy,
  ariaLabel,
}: {
  n: N;
  onChange: (n: N) => void;
  labelledBy?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className="level-options"
      role="group"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Decrease memory level"
        disabled={n <= 1}
        onClick={() => onChange(n - 1)}
      >
        −
      </button>
      <div className="chosen" aria-live="polite">
        <strong>{n}-back</strong>
        <small>
          {n} turn{n > 1 ? "s" : ""} ago
        </small>
      </div>
      <button
        type="button"
        aria-label="Increase memory level"
        onClick={() => onChange(n + 1)}
      >
        +
      </button>
    </div>
  );
}
