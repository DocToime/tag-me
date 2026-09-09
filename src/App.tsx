import { useEffect, useRef, useState } from "react";
import { Icon, Mole } from "./components/Art";
import Play from "./components/Play";
import Tutorial from "./components/Tutorial";
import { BlockResult, Progress, SessionResults } from "./components/Results";
import { adapt, passedPractice, protocol } from "./game/protocol";
import {
  clearData,
  exportCsv,
  exportJson,
  loadSessions,
  participantId,
  PREFS,
  RECOVERY,
  saveSession,
} from "./data/storage";
import type { Block, Config, InputMode, N, Session } from "./game/types";
import { applyPwaUpdate, pwaNeedRefresh, subscribePwa } from "./pwa";
type Page = "home" | "progress" | "guide" | "settings";
type Stage = "instructions" | "play" | "break" | "results" | null;
interface Preferences {
  n: N;
  blocks: number;
  windowMs: number;
  input: InputMode;
  sound: boolean;
}
const defaults: Preferences = {
  n: 1,
  blocks: 3,
  windowMs: 2000,
  input: "fixed",
  sound: false,
};
function getPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "{}");
    return {
      n: [1, 2, 3].includes(p.n) ? p.n : 1,
      blocks: [1, 3, 5].includes(p.blocks) ? p.blocks : 3,
      windowMs: [1500, 2000, 3000, 4000].includes(p.windowMs)
        ? p.windowMs
        : 2000,
      input: p.input === "aimed" ? "aimed" : "fixed",
      sound: p.sound === true,
    };
  } catch {
    return defaults;
  }
}
export default function App() {
  const [page, setPage] = useState<Page>("home"),
    [stage, setStage] = useState<Stage>(null),
    [prefs, setPrefs] = useState<Preferences>(getPreferences),
    [sessions, setSessions] = useState<Session[]>([]),
    [session, setSession] = useState<Session | null>(null),
    [loaded, setLoaded] = useState(false),
    [saveStatus, setSaveStatus] = useState("Saved on this device"),
    [error, setError] = useState(""),
    [currentN, setCurrentN] = useState<N>(prefs.n),
    [playConfig, setPlayConfig] = useState<Config | null>(null),
    [playKey, setPlayKey] = useState(0),
    [lastBlock, setLastBlock] = useState<Block | null>(null),
    [verified, setVerified] = useState<N[]>([]),
    [guideN, setGuideN] = useState<N>(1),
    [confirmDelete, setConfirmDelete] = useState(false),
    [assessment, setAssessment] = useState(false),
    [battery, setBattery] = useState(true),
    [viewed, setViewed] = useState<Session | null>(null),
    [needRefresh, setNeedRefresh] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const initialised = useRef(false);
  const modalOpener = useRef<HTMLElement | null>(null);
  useEffect(() => subscribePwa(() => setNeedRefresh(pwaNeedRefresh())), []);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    (async () => {
      try {
        const saved = await loadSessions();
        let recovery: string | null = null;
        try {
          recovery = localStorage.getItem(RECOVERY);
        } catch {}
        for (const s of saved) {
          if (s.status === "running" || s.id === recovery) {
            s.status = "interrupted";
            s.recoveryNote =
              "The page closed or reloaded during this session. Completed attempts were preserved; unfinished trial data may be unavailable. Start a fresh session to continue.";
            await saveSession(s);
          }
        }
        setSessions(saved);
        try {
          localStorage.removeItem(RECOVERY);
        } catch {}
      } catch {
        setSaveStatus("Storage unavailable — export to keep your results");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {
      setSaveStatus("Preferences could not be saved");
    }
  }, [prefs]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const target = document.querySelector<HTMLElement>(
      stage === "play" ? ".play-page" : "main h1",
    );
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }, [page, stage, viewed]);
  useEffect(() => {
    if (!assessment && !confirmDelete) return;
    const previousFocus = modalOpener.current;
    const background = document.querySelectorAll<HTMLElement>(
      ".sidebar, .main-area",
    );
    background.forEach((element) => (element.inert = true));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAssessment(false);
        setConfirmDelete(false);
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".modal button:not(:disabled), .modal select, .modal a[href]",
        ),
      );
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      background.forEach((element) => (element.inert = false));
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [assessment, confirmDelete]);
  function persist(s: Session) {
    sessionRef.current = s;
    setSession(s);
    setSessions((prev) => [s, ...prev.filter((p) => p.id !== s.id)]);
    setSaveStatus("Saving…");
    void saveSession(s)
      .then(() => setSaveStatus("Saved on this device"))
      .catch(() => setSaveStatus("Save failed — export to keep your results"));
  }
  function start(
    mode: "training" | "assessment",
    n: N = prefs.n,
    tutorialComplete = false,
  ) {
    void navigator.storage?.persist?.();
    setError("");
    let id: string;
    try {
      id = participantId();
    } catch {
      id = crypto.randomUUID();
    }
    const s: Session = {
      id: crypto.randomUUID(),
      participantId: id,
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      mode,
      status: "running",
      config: {
        n,
        blocks: mode === "assessment" ? (battery ? 3 : 1) : prefs.blocks,
        battery: mode === "assessment" && battery,
        windowMs: mode === "assessment" ? 2000 : prefs.windowMs,
        input: mode === "assessment" ? "fixed" : prefs.input,
      },
      client: {
        ua: navigator.userAgent,
        width: innerWidth,
        height: innerHeight,
        pixelRatio: devicePixelRatio,
        timeOrigin: performance.timeOrigin,
      },
      blocks: [],
      adaptations: [],
    };
    try {
      localStorage.setItem(RECOVERY, s.id);
    } catch {
      setSaveStatus("Recovery unavailable — keep this tab open");
    }
    setCurrentN(mode === "assessment" && battery ? 1 : n);
    setVerified([]);
    setLastBlock(null);
    setViewed(null);
    persist(s);
    const upcomingN = mode === "assessment" && battery ? 1 : n;
    const knownLevel = sessions.some((saved) =>
      saved.blocks.some(
        (block) =>
          block.config.mode === "practice" &&
          block.config.n === upcomingN &&
          block.config.input === s.config.input &&
          passedPractice(block),
      ),
    );
    if (tutorialComplete || knownLevel) launch("practice", upcomingN);
    else setStage("instructions");
  }
  function launch(mode: Config["mode"], n = currentN) {
    const s = sessionRef.current;
    if (!s) return;
    try {
      setPlayConfig(protocol(n, mode, s.config.windowMs, s.config.input));
      setPlayKey((v) => v + 1);
      setStage("play");
    } catch (e) {
      setError(String(e));
    }
  }
  function end(s = sessionRef.current, completed = false) {
    if (!s) return;
    const next = {
      ...s,
      status: completed ? ("completed" as const) : ("interrupted" as const),
      completedAt: new Date().toISOString(),
    };
    persist(next);
    try {
      localStorage.removeItem(RECOVERY);
    } catch {}
    setStage("results");
  }
  function nextDifficulty(current: Session, n: N) {
    const previous = sessions
      .filter((saved) => saved.id !== current.id)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .flatMap((saved) => saved.blocks);
    return adapt([...previous, ...current.blocks], n);
  }
  function onDone(block: Block) {
    const s = sessionRef.current;
    if (!s) return;
    const next = { ...s, blocks: [...s.blocks, block] };
    if (block.config.mode === "training" && block.status === "completed") {
      const decision = nextDifficulty(next, block.config.n);
      next.adaptations = [...next.adaptations, decision];
      setPrefs((previous) => ({ ...previous, n: decision.to }));
    }
    setLastBlock(block);
    persist(next);
    if (block.config.mode === "practice" && passedPractice(block))
      setVerified((prev) => [...new Set([...prev, block.config.n])]);
    const completed = next.blocks.filter(
      (b) => b.config.mode === s.mode && b.status === "completed",
    ).length;
    if (
      block.config.mode !== "practice" &&
      block.status === "completed" &&
      completed >= s.config.blocks
    )
      end(next, true);
    else setStage("break");
  }
  function continueSession() {
    const s = sessionRef.current;
    if (!s || !lastBlock) return;
    if (lastBlock.status === "interrupted") {
      launch(lastBlock.config.mode);
      return;
    }
    if (lastBlock.config.mode === "practice") {
      launch(passedPractice(lastBlock) ? s.mode : "practice");
      return;
    }
    let n = currentN;
    if (s.mode === "assessment") n = (currentN + 1) as N;
    else {
      const decision = nextDifficulty(s, currentN);
      n = decision.to;
    }
    setCurrentN(n);
    if (verified.includes(n)) launch(s.mode, n);
    else setStage("instructions");
  }
  function navigate(next: Page) {
    setViewed(null);
    setPage(next);
    setStage(null);
  }
  const ongoing = stage !== null && stage !== "results";
  const actualSession = viewed ?? session;
  const round =
    (session?.blocks.filter(
      (b) => b.config.mode === session.mode && b.status === "completed",
    ).length ?? 0) + 1;
  return (
    <div
      className={`app-shell ${ongoing ? "is-session" : ""} ${stage === "play" ? "is-playing" : ""}`}
    >
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          aria-label="Recall Garden home"
          onClick={(e) => {
            e.preventDefault();
            if (!ongoing) navigate("home");
          }}
        >
          <span className="brand-mark">
            <Icon name="sprout" size={28} />
          </span>
          <span>
            recall<span className="brand-second">garden</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "home", name: "My garden", icon: "grid" },
              { id: "progress", name: "My progress", icon: "chart" },
              { id: "guide", name: "How to play", icon: "book" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              disabled={ongoing}
              aria-label={item.name}
              aria-current={page === item.id && !viewed ? "page" : undefined}
              title={item.name}
              className={page === item.id && !viewed ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
        <button
          aria-label="Settings & data"
          title="Settings & data"
          aria-current={page === "settings" ? "page" : undefined}
          className={`settings-nav ${page === "settings" ? "active" : ""}`}
          disabled={ongoing}
          onClick={() => navigate("settings")}
        >
          <Icon name="settings" />
          <span>Settings & data</span>
        </button>
      </aside>
      <div className="main-area">
        <main>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {stage === "play" && playConfig ? (
            <Play
              key={playKey}
              config={playConfig}
              round={round}
              total={session?.config.blocks ?? 1}
              sound={prefs.sound}
              onDone={onDone}
            />
          ) : stage === "instructions" ? (
            <>
              <button className="text-button back-link" onClick={() => end()}>
                ← Finish for now
              </button>
              <Tutorial
                n={currentN}
                input={session?.config.input ?? prefs.input}
                onPractice={() => launch("practice")}
              />
            </>
          ) : stage === "break" && lastBlock ? (
            <section className="break-page">
              <h1>
                {lastBlock.status === "interrupted"
                  ? "Round stopped"
                  : lastBlock.config.mode === "practice"
                    ? passedPractice(lastBlock)
                      ? "Practice passed"
                      : "Practice needs a retry"
                    : "Round complete"}
              </h1>
              <p>
                {lastBlock.status === "interrupted"
                  ? `${lastBlock.reason}. Restart with new numbers.`
                  : lastBlock.config.mode === "practice"
                    ? lastBlock.frames.length
                      ? "Timing was uneven on this device. Retry practice before starting a scored round."
                      : `${lastBlock.summary.hits} of 6 matches caught · ${lastBlock.summary.fa} false alarm${lastBlock.summary.fa === 1 ? "" : "s"}.${passedPractice(lastBlock) ? "" : " Aim for at least 5 matches and at most 1 false alarm."}`
                    : session?.mode === "training"
                      ? nextDifficulty(session, currentN).reason
                      : "Take a break before the next level."}
              </p>
              <div className="button-row break-actions">
                <button className="primary" onClick={continueSession}>
                  {lastBlock.status === "interrupted"
                    ? "Restart round"
                    : lastBlock.config.mode === "practice"
                      ? passedPractice(lastBlock)
                        ? "Start scored round"
                        : "Try practice again"
                      : `Continue · ${session?.mode === "training" ? nextDifficulty(session, currentN).to : currentN + 1}-back`}
                  <Icon name="arrow" size={18} />
                </button>

                <button className="secondary" onClick={() => end()}>
                  Finish for now
                </button>
                {lastBlock.config.mode === "practice" &&
                  !passedPractice(lastBlock) && (
                    <button
                      className="secondary"
                      onClick={() => setStage("instructions")}
                    >
                      Review tutorial
                    </button>
                  )}
              </div>
              <details className="break-details">
                <summary>
                  {lastBlock.config.mode === "practice"
                    ? "Practice details"
                    : "Round details"}
                </summary>
                <BlockResult block={lastBlock} />
              </details>
            </section>
          ) : stage === "results" || viewed ? (
            <section>
              <button
                className="text-button back-link"
                onClick={() => navigate("home")}
              >
                ← Back to my garden
              </button>
              <div className="page-heading">
                <div>
                  <h1>
                    {actualSession?.status === "completed"
                      ? "Session complete"
                      : "Saved session"}
                  </h1>
                </div>
                <button
                  className="secondary"
                  onClick={() => actualSession && exportJson([actualSession])}
                >
                  <Icon name="download" size={17} /> Export session
                </button>
              </div>
              {actualSession && (
                <>
                  <SessionResults session={actualSession} />
                  <details className="device-details">
                    <summary>Device details</summary>
                    <p className="quiet">
                      Device context: {actualSession.client.width} ×{" "}
                      {actualSession.client.height} ·{" "}
                      {actualSession.config.input} input ·{" "}
                      {actualSession.client.ua}
                    </p>
                  </details>
                </>
              )}
            </section>
          ) : page === "home" ? (
            <section className="home-page">
              <div className="home-heading">
                <div>
                  <h1>Ready for a round?</h1>
                  <p>
                    Match the number from {prefs.n} turn{prefs.n > 1 ? "s" : ""}{" "}
                    ago.
                  </p>
                </div>
                <div className="home-mole">
                  <Mole digit={prefs.n} decorative />
                </div>
              </div>
              <section className="card setup-card" aria-label="Training setup">
                <span className="field-label" id="starting-level">
                  Starting level
                </span>
                <div
                  className="level-options"
                  role="group"
                  aria-labelledby="starting-level"
                >
                  {([1, 2, 3] as N[]).map((n) => (
                    <button
                      key={n}
                      aria-pressed={prefs.n === n}
                      className={prefs.n === n ? "chosen" : ""}
                      onClick={() => setPrefs({ ...prefs, n })}
                    >
                      <strong>{n}-back</strong>
                      <small>
                        {n} turn{n > 1 ? "s" : ""} ago
                      </small>
                    </button>
                  ))}
                </div>
                <label className="session-length">
                  Session length
                  <select
                    value={prefs.blocks}
                    onChange={(e) =>
                      setPrefs({ ...prefs, blocks: +e.target.value })
                    }
                  >
                    {[1, 3, 5].map((blocks) => (
                      <option key={blocks} value={blocks}>
                        {blocks} round{blocks > 1 ? "s" : ""} · ~
                        {Math.round(
                          (blocks * (60 + prefs.n) * (prefs.windowMs + 750)) /
                            60000,
                        )}{" "}
                        min
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary full-width start-training"
                  disabled={!loaded}
                  onClick={() => start("training")}
                >
                  {loaded ? "Start training" : "Loading…"}
                  <Icon name="arrow" size={18} />
                </button>
                <p className="quiet setup-footnote">
                  Plus a short practice and breaks.
                </p>
              </section>
              <div className="home-links">
                <button
                  className="text-button"
                  onClick={() => {
                    setGuideN(prefs.n);
                    navigate("guide");
                  }}
                >
                  How to play <Icon name="arrow" size={16} />
                </button>
                <button
                  className="text-button"
                  onClick={(e) => {
                    modalOpener.current = e.currentTarget;
                    setAssessment(true);
                  }}
                >
                  Explore assessment <Icon name="arrow" size={16} />
                </button>
              </div>
            </section>
          ) : page === "progress" ? (
            <Progress sessions={sessions} onOpen={(s) => setViewed(s)} />
          ) : page === "guide" ? (
            <Tutorial
              n={guideN}
              onN={setGuideN}
              input={prefs.input}
              onPractice={() => start("training", guideN, true)}
            />
          ) : (
            <section>
              <div className="page-heading">
                <div>
                  <h1>Settings</h1>
                </div>
              </div>
              <div className="card settings-card">
                <h2>Training preferences</h2>
                <div className="setting-row">
                  <div>
                    <h3>Response style</h3>
                    <p>Assessment always uses the Match button.</p>
                  </div>
                  <select
                    aria-label="Response style"
                    value={prefs.input}
                    onChange={(e) =>
                      setPrefs({ ...prefs, input: e.target.value as InputMode })
                    }
                  >
                    <option value="fixed">Match button / Space</option>
                    <option value="aimed">Tap mole / Q W E A S D</option>
                  </select>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Time with each number</h3>
                    <p>Assessment always uses 2 seconds.</p>
                  </div>
                  <select
                    aria-label="Time with each number"
                    value={prefs.windowMs}
                    onChange={(e) =>
                      setPrefs({ ...prefs, windowMs: +e.target.value })
                    }
                  >
                    <option value={1500}>1.5 seconds</option>
                    <option value={2000}>2 seconds · standard</option>
                    <option value={3000}>3 seconds</option>
                    <option value={4000}>4 seconds</option>
                  </select>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Sound cues</h3>
                    <p>Optional feedback during training and practice.</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={prefs.sound}
                    aria-label="Sound cues"
                    className={`toggle ${prefs.sound ? "on" : ""}`}
                    onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}
                  >
                    <span />
                  </button>
                </div>
              </div>
              <div className="card settings-card">
                <div className="section-heading">
                  <h2>Saved data</h2>
                  <Icon name="lock" />
                </div>
                <p>
                  Sessions are stored in this browser on this device. No
                  account, uploads, or analytics. Clearing browser data removes
                  your history, so export a copy whenever you want to keep it.
                  After this visit, this browser can open Recall Garden without
                  a network. Phone: browser menu → Install app. iPhone: Share →
                  Add to Home Screen. Scores stay on this device; export if you
                  want a copy.
                </p>
                {!("serviceWorker" in navigator) && (
                  <p>
                    This browser cannot keep the app files cached. Play still
                    works while the page stays open.
                  </p>
                )}
                {needRefresh && (
                  <div className="setting-row">
                    <div>
                      <h3>App update</h3>
                      <p>
                        {ongoing
                          ? "A new version will apply when you finish this session."
                          : "A new version is ready. Applying it reloads the page."}
                      </p>
                    </div>
                    {!ongoing && (
                      <button className="secondary" onClick={applyPwaUpdate}>
                        Update now
                      </button>
                    )}
                  </div>
                )}
                <div className="button-row left">
                  <button
                    className="secondary"
                    onClick={() => exportJson(sessions)}
                  >
                    <Icon name="download" size={17} /> Export all JSON
                  </button>
                  <button
                    className="secondary"
                    onClick={() => exportCsv(sessions)}
                  >
                    <Icon name="download" size={17} /> Export summary CSV
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Delete saved data</h3>
                    <p>
                      Delete saved sessions and reset preferences on this
                      device.
                    </p>
                  </div>
                  <button
                    className="danger-button"
                    onClick={(e) => {
                      modalOpener.current = e.currentTarget;
                      setConfirmDelete(true);
                    }}
                  >
                    Delete local data
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
        {stage !== "play" && (
          <div
            className={`save-footer ${/failed|unavailable|could not/.test(saveStatus) ? "save-error" : ""}`}
            role="status"
          >
            <span>
              <Icon name="lock" size={13} />
              {saveStatus}
            </span>
            {/failed|unavailable|could not/.test(saveStatus) && (
              <button
                className="text-button"
                onClick={() => exportJson(sessions)}
              >
                Export results
              </button>
            )}
          </div>
        )}
      </div>
      {assessment && (
        <div className="modal-backdrop">
          <section
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assessment-title"
          >
            <button
              autoFocus
              className="modal-close"
              aria-label="Close assessment"
              onClick={() => setAssessment(false)}
            >
              <Icon name="close" />
            </button>
            <h2 id="assessment-title">Assessment</h2>
            <p>
              A fixed assessment uses 60 scored trials per level, 2-second
              numbers, and the match button or Space. Practice comes first.
              Results are kept separate from training.
            </p>
            <span className="field-label" id="assessment-choice-label">
              Choose your assessment
            </span>
            <div
              className="assessment-choices"
              role="group"
              aria-labelledby="assessment-choice-label"
            >
              <button
                aria-pressed={battery}
                className={battery ? "selected" : ""}
                onClick={() => setBattery(true)}
              >
                All three levels{" "}
                <small>1-, 2-, and 3-back · about 9 min + practice</small>
              </button>
              <button
                aria-pressed={!battery}
                className={!battery ? "selected" : ""}
                onClick={() => setBattery(false)}
              >
                One level <small>{prefs.n}-back · about 3 min + practice</small>
              </button>
            </div>
            <button
              className="primary full-width"
              disabled={!loaded}
              onClick={() => {
                setAssessment(false);
                start("assessment");
              }}
            >
              Begin assessment <Icon name="arrow" size={18} />
            </button>
          </section>
        </div>
      )}
      {confirmDelete && (
        <div className="modal-backdrop">
          <section
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete saved data?</h2>
            <p>
              This deletes all {sessions.length} sessions and preferences stored
              by Recall Garden on this device. You can export a copy first.
            </p>
            <div className="button-row left">
              <button
                className="secondary"
                onClick={() => exportJson(sessions)}
              >
                Export first
              </button>
              <button
                autoFocus
                className="secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Keep my data
              </button>
              <button
                className="danger-button"
                onClick={async () => {
                  try {
                    await clearData();
                    setSessions([]);
                    setPrefs(defaults);
                    setSession(null);
                    sessionRef.current = null;
                    setConfirmDelete(false);
                    setSaveStatus("Local data cleared");
                  } catch {
                    setError("Could not clear local data. Please try again.");
                    setConfirmDelete(false);
                  }
                }}
              >
                Delete everything
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
