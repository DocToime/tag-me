import { useMemo, useState } from "react";
import { isN, type Block, type Session } from "../game/types";
import { Icon } from "./Art";
function deviceKey(point: { s: Session; b: Block }) {
  const viewport = point.b.viewport ?? point.s.client;
  return JSON.stringify([
    point.s.client.ua,
    viewport.width,
    viewport.height,
    viewport.pixelRatio,
    [
      ...new Set(
        point.b.events
          .filter((event) => event.disposition === "accepted")
          .map((event) => event.method),
      ),
    ].sort(),
  ]);
}
export const pct = (v: number | null) =>
  v === null ? "—" : `${Math.round(v * 100)}%`;
const num = (v: number | null, d = 2) => (v === null ? "—" : v.toFixed(d));
export function BlockResult({ block }: { block: Block }) {
  const s = block.summary;
  return (
    <div className="block-result">
      <div className="section-heading">
        <h3>
          {block.config.n}-back{" "}
          <span className="small-tag">{block.config.mode}</span>
        </h3>
        <span
          className={`status-tag ${block.status === "interrupted" ? "warning" : ""}`}
        >
          {block.status === "completed" ? "Completed" : "Interrupted"}
        </span>
      </div>
      {block.reason && (
        <p className="notice">
          {block.reason}. This attempt is saved separately; restart with fresh
          numbers.
        </p>
      )}
      <div className="result-metrics">
        <div>
          <span>Balanced accuracy</span>
          <strong>{pct(s.balancedAccuracy)}</strong>
          <small>Matches & correct waits</small>
        </div>
        <div>
          <span>Match detection</span>
          <strong>{pct(s.hitRate)}</strong>
          <small>
            {s.hits} of {s.targets} targets caught
          </small>
        </div>
        <div>
          <span>False alarms</span>
          <strong>{pct(s.faRate)}</strong>
          <small>
            {s.fa} of {s.nonTargets} non-targets
          </small>
        </div>
      </div>
      {s.flags.length > 0 && (
        <p className="notice">
          {s.flags.join(" · ")}.
          {block.config.mode === "training" &&
            " This round does not change your training level."}
        </p>
      )}
      <details>
        <summary>Detailed round data</summary>
        <div className="detail-grid">
          <span>
            Median response time <b>{num(s.medianRt, 0)} ms</b>
          </span>
          <span>
            Correct timed responses <b>{s.rtCount}</b>
          </span>
          <span>
            Hits <b>{s.hits}</b>
          </span>
          <span>
            Misses <b>{s.misses}</b>
          </span>
          <span>
            False alarms <b>{s.fa}</b>
          </span>
          <span>
            Correct waits <b>{s.cr}</b>
          </span>
          <span>
            Raw accuracy <b>{pct(s.accuracy)}</b>
          </span>
          <span>
            Sensitivity (d′) <b>{num(s.dPrime)}</b>
          </span>
          <span>
            Response criterion <b>{num(s.criterion)}</b>
          </span>
          <span>
            RT mean / SD{" "}
            <b>
              {num(s.meanRt, 0)} / {num(s.sdRt, 0)} ms
            </b>
          </span>
          <span>
            Hit rate 95% interval{" "}
            <b>{s.hitInterval ? s.hitInterval.map(pct).join(" – ") : "—"}</b>
          </span>
          <span>
            FA rate 95% interval{" "}
            <b>{s.faInterval ? s.faInterval.map(pct).join(" – ") : "—"}</b>
          </span>
          <span>
            Long frames <b>{block.frames.length}</b>
          </span>
          <span>
            Protocol <b>{block.configHash}</b>
          </span>
        </div>
        <p className="quiet">
          {block.config.windowMs} ms exposure · {block.config.input} input ·{" "}
          {s.scored} scored trials · {block.config.n} unscored memory-fill
          trials. Rate intervals use the Wilson method.
        </p>
      </details>
    </div>
  );
}
export function SessionResults({ session }: { session: Session }) {
  const played = session.blocks.filter(
    (b) => b.config.mode !== "practice" && b.status === "completed",
  );
  const interrupted = session.blocks.filter(
    (b) => b.config.mode !== "practice" && b.status === "interrupted",
  );
  return (
    <>
      <div className="session-meta">
        <span>{new Date(session.startedAt).toLocaleString()}</span>
        <span>
          {session.mode} · {session.status}
        </span>
      </div>
      {session.recoveryNote && <p className="notice">{session.recoveryNote}</p>}
      {played.length ? (
        played.map((b) => <BlockResult key={b.id} block={b} />)
      ) : (
        <div className="empty-card">
          <Icon name="sprout" size={36} />
          <h3>No completed rounds yet</h3>
          <p>Saved attempts are available below.</p>
        </div>
      )}
      {interrupted.length > 0 && (
        <details className="interrupted-details">
          <summary>Interrupted attempts ({interrupted.length})</summary>
          {interrupted.map((b) => (
            <BlockResult key={b.id} block={b} />
          ))}
        </details>
      )}
      <details className="practice-details">
        <summary>
          Practice attempts (
          {session.blocks.filter((b) => b.config.mode === "practice").length})
        </summary>
        {session.blocks
          .filter((b) => b.config.mode === "practice")
          .map((b) => (
            <BlockResult key={b.id} block={b} />
          ))}
      </details>
    </>
  );
}
export function Progress({
  sessions,
  onOpen,
}: {
  sessions: Session[];
  onOpen: (s: Session) => void;
}) {
  const [mode, setMode] = useState("training"),
    [n, setN] = useState(1),
    [fingerprint, setFingerprint] = useState("");
  const levels = [
    ...new Set(
      sessions.flatMap((s) => s.blocks.map((b) => b.config.n)).filter(isN),
    ),
  ].sort((a, b) => a - b);
  const options = levels.length ? levels : [1];
  const selectedN = options.includes(n) ? n : options[0];
  const eligible = useMemo(
    () =>
      sessions
        .flatMap((s) =>
          s.blocks
            .filter(
              (b) =>
                b.status === "completed" &&
                b.config.mode === mode &&
                b.config.n === selectedN,
            )
            .map((b) => ({ s, b })),
        )
        .sort((a, b) => a.b.startedAt.localeCompare(b.b.startedAt)),
    [sessions, mode, selectedN],
  );
  const configs = [...new Set(eligible.map((x) => x.b.configHash))];
  const selected = configs.includes(fingerprint)
    ? fingerprint
    : (configs.at(-1) ?? "");
  const points = eligible.filter((x) => x.b.configHash === selected).slice(-16);
  const valid = points.filter((x) => x.b.summary.balancedAccuracy !== null);
  const width = 680,
    height = 210;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your progress</h1>
          <p>Compare rounds at the same level and settings.</p>
        </div>
        <Icon name="chart" size={38} />
      </div>
      <section className="card progress-card">
        <div className="section-heading">
          <h2>Round by round</h2>
          <span className="quiet">Balanced accuracy</span>
        </div>
        <div className="filters">
          <label>
            Mode
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setFingerprint("");
              }}
            >
              <option value="training">Training</option>
              <option value="assessment">Assessment</option>
            </select>
          </label>
          <label>
            Level
            <select
              value={selectedN}
              onChange={(e) => {
                setN(+e.target.value);
                setFingerprint("");
              }}
            >
              {options.map((level) => (
                <option key={level} value={level}>
                  {level}-back
                </option>
              ))}
            </select>
          </label>
          <label>
            Settings
            <select
              value={selected}
              onChange={(e) => setFingerprint(e.target.value)}
            >
              {configs.length ? (
                configs.map((c, index) => {
                  const b = eligible.find((x) => x.b.configHash === c)!.b;
                  return (
                    <option key={c} value={c}>
                      {b.config.windowMs / 1000}s ·{" "}
                      {b.config.input === "fixed" ? "Match button" : "Tap mole"}
                      {configs.length > 1 ? ` · set ${index + 1}` : ""}
                    </option>
                  );
                })
              ) : (
                <option value="">No rounds yet</option>
              )}
            </select>
          </label>
        </div>
        {valid.length ? (
          <div className="chart-wrap">
            <svg
              viewBox={`0 0 ${width} ${height + 35}`}
              role="group"
              aria-label={`Balanced accuracy across ${valid.length} comparable ${n}-back ${mode} rounds`}
            >
              <title>Balanced accuracy by completed round</title>
              {[0, 0.5, 1].map((v) => (
                <g key={v}>
                  <line
                    x1="45"
                    x2={width - 15}
                    y1={height - v * (height - 25)}
                    y2={height - v * (height - 25)}
                    stroke="var(--chart-grid)"
                    strokeDasharray="4 5"
                  />
                  <text
                    x="2"
                    y={height - v * (height - 25) + 4}
                    fontSize="12"
                    fill="var(--chart-ink)"
                  >
                    {v * 100}%
                  </text>
                </g>
              ))}
              <polyline
                points={valid
                  .map(
                    (p, i) =>
                      `${55 + (i * (width - 85)) / Math.max(1, valid.length - 1)},${height - p.b.summary.balancedAccuracy! * (height - 25)}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="var(--chart-line)"
                strokeWidth="3"
              />
              {valid.map((p, i) => (
                <g key={p.b.id}>
                  <circle
                    cx={55 + (i * (width - 85)) / Math.max(1, valid.length - 1)}
                    cy={height - p.b.summary.balancedAccuracy! * (height - 25)}
                    r="6"
                    fill={
                      p.b.summary.flags.length
                        ? "var(--chart-flag)"
                        : "var(--chart-line)"
                    }
                    stroke={
                      i > 0 && deviceKey(p) !== deviceKey(valid[i - 1])
                        ? "var(--chart-flag)"
                        : "transparent"
                    }
                    strokeWidth="4"
                    aria-hidden="true"
                  />
                  <circle
                    className="chart-hit"
                    cx={55 + (i * (width - 85)) / Math.max(1, valid.length - 1)}
                    cy={height - p.b.summary.balancedAccuracy! * (height - 25)}
                    r="6"
                    fill={
                      p.b.summary.flags.length
                        ? "var(--chart-flag-hit)"
                        : "var(--chart-line)"
                    }
                    stroke={
                      i > 0 && deviceKey(p) !== deviceKey(valid[i - 1])
                        ? "var(--chart-flag-hit)"
                        : "transparent"
                    }
                    strokeWidth="4"
                    tabIndex={0}
                    role="button"
                    aria-label={`Open round ${i + 1}: ${pct(p.b.summary.balancedAccuracy)} balanced accuracy`}
                    onClick={() => onOpen(p.s)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(p.s);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <title>
                      {new Date(p.b.startedAt).toLocaleDateString()}:{" "}
                      {pct(p.b.summary.balancedAccuracy)}
                      {p.b.summary.flags.length
                        ? " · " + p.b.summary.flags.join(", ")
                        : ""}
                      {i > 0 && deviceKey(p) !== deviceKey(valid[i - 1])
                        ? " · Input or display changed"
                        : ""}
                    </title>
                  </circle>
                  <text
                    x={55 + (i * (width - 85)) / Math.max(1, valid.length - 1)}
                    y={height + 25}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--chart-ink)"
                  >
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
            <p className="quiet">
              Amber points mark timing or response observations; rings mark an
              input or display change.
            </p>
            <details>
              <summary>Rounds in this chart</summary>
              <ul className="round-list">
                {valid.map((point, i) => (
                  <li key={point.b.id}>
                    <button onClick={() => onOpen(point.s)}>
                      <span>
                        Round {i + 1} ·{" "}
                        {new Date(point.b.startedAt).toLocaleDateString()}
                      </span>
                      <strong>{pct(point.b.summary.balancedAccuracy)}</strong>
                      <Icon name="arrow" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : (
          <div className="chart-empty">
            <h3>No rounds for these settings</h3>
            <p>Complete a round or choose another level to see results.</p>
          </div>
        )}
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>Session history</h2>
          <span className="small-tag">{sessions.length} sessions</span>
        </div>
        {sessions.length ? (
          sessions.map((s) => (
            <button
              className="history-row"
              key={s.id}
              onClick={() => onOpen(s)}
            >
              <span className="history-icon">
                <Icon name={s.mode === "training" ? "sprout" : "target"} />
              </span>
              <span>
                <strong>
                  {s.mode === "training" ? "Memory training" : "Assessment"}
                </strong>
                <small>
                  {new Date(s.startedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  ·{" "}
                  {
                    s.blocks.filter(
                      (b) =>
                        b.status === "completed" &&
                        b.config.mode !== "practice",
                    ).length
                  }{" "}
                  rounds completed
                </small>
              </span>
              <span className="history-status">
                {s.status}
                <Icon name="arrow" size={18} />
              </span>
            </button>
          ))
        ) : (
          <p className="empty-text">
            Your completed sessions and saved attempts will appear here.
          </p>
        )}
      </section>
    </>
  );
}
