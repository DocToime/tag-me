import { useEffect, useRef, useState } from "react";
import { Icon, Mole } from "./components/Art";
import LevelPicker from "./components/LevelPicker";
import Play from "./components/Play";
import Tutorial from "./components/Tutorial";
import TutorialDual from "./components/TutorialDual";
import { BlockResult, Progress, SessionResults } from "./components/Results";
import {
  adapt,
  dualProtocol,
  passedDualPractice,
  passedPractice,
  prepareDualBlock,
  protocol,
} from "./game/protocol";
import { PreparationError } from "./game/dualSequence";
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
import {
  isDualBlock,
  isDualSession,
  isN,
  resourceOk,
  type GameBlock,
  type GameConfig,
  type InputMode,
  type N,
  type Session,
  type Task,
} from "./game/types";
import type { PreparedDual } from "./game/engine";
import { applyPwaUpdate, pwaNeedRefresh, subscribePwa } from "./pwa";
import { applyAppearance, parseAppearance, type Appearance } from "./theme";
type Page = "home" | "progress" | "guide" | "settings";
type Stage =
  | "instructions"
  | "play"
  | "break"
  | "results"
  | "preparation-error"
  | null;
interface Preferences {
  n: N;
  dualN: N;
  lastTask: Task;
  blocks: number;
  windowMs: number;
  input: InputMode;
  sound: boolean;
  appearance: Appearance;
}
const defaults: Preferences = {
  n: 1,
  dualN: 1,
  lastTask: "identity",
  blocks: 3,
  windowMs: 2000,
  input: "fixed",
  sound: false,
  appearance: "system",
};
function getPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "{}");
    return {
      n: isN(p.n) ? p.n : 1,
      dualN: isN(p.dualN) ? p.dualN : 1,
      lastTask: p.lastTask === "dual" ? "dual" : "identity",
      blocks: [1, 3, 5].includes(p.blocks) ? p.blocks : 3,
      windowMs: [1500, 2000, 3000, 4000].includes(p.windowMs)
        ? p.windowMs
        : 2000,
      input: p.input === "aimed" ? "aimed" : "fixed",
      sound: p.sound === true,
      appearance: parseAppearance(p.appearance),
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
    [playConfig, setPlayConfig] = useState<GameConfig | null>(null),
    [prepared, setPrepared] = useState<PreparedDual | undefined>(),
    [playSeed, setPlaySeed] = useState<string | undefined>(),
    [failedSeed, setFailedSeed] = useState(""),
    [playKey, setPlayKey] = useState(0),
    [lastBlock, setLastBlock] = useState<GameBlock | null>(null),
    [verified, setVerified] = useState<N[]>([]),
    [guideN, setGuideN] = useState<N>(1),
    [guideTask, setGuideTask] = useState<Task>("identity"),
    [confirmDelete, setConfirmDelete] = useState(false),
    [assessment, setAssessment] = useState(false),
    [assessmentTask, setAssessmentTask] = useState<Task>("identity"),
    [assessmentN, setAssessmentN] = useState<N>(2),
    [battery, setBattery] = useState(true),
    [viewed, setViewed] = useState<Session | null>(null),
    [needRefresh, setNeedRefresh] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const pendingMode = useRef<GameConfig["mode"]>("practice");
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
    applyAppearance(prefs.appearance);
    if (prefs.appearance !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [prefs.appearance]);
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
    n?: N,
    tutorialComplete = false,
    task: Task = prefs.lastTask,
  ) {
    void navigator.storage?.persist?.();
    setError("");
    const chosenN = n ?? (task === "dual" ? prefs.dualN : prefs.n);
    let id: string;
    try {
      id = participantId();
    } catch {
      id = crypto.randomUUID();
    }
    const s: Session = {
      id: crypto.randomUUID(),
      participantId: id,
      schemaVersion: task === "dual" ? 2 : 1,
      startedAt: new Date().toISOString(),
      mode,
      status: "running",
      task,
      config: {
        n: chosenN,
        blocks: mode === "assessment" ? (battery ? 3 : 1) : prefs.blocks,
        battery: mode === "assessment" && battery,
        windowMs: mode === "assessment" ? 2000 : prefs.windowMs,
        input:
          task === "dual"
            ? "dual"
            : mode === "assessment"
              ? "fixed"
              : prefs.input,
        task,
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
    setPrefs((previous) => ({ ...previous, lastTask: task }));
    setCurrentN(mode === "assessment" && battery ? 1 : chosenN);
    setVerified([]);
    setLastBlock(null);
    setViewed(null);
    persist(s);
    const upcomingN = mode === "assessment" && battery ? 1 : chosenN;
    const knownLevel = sessions.some((saved) =>
      saved.blocks.some((block) => {
        if (block.config.mode !== "practice" || block.config.n !== upcomingN)
          return false;
        if (task === "dual")
          return isDualBlock(block) && passedDualPractice(block);
        return (
          !isDualBlock(block) &&
          block.config.input === s.config.input &&
          passedPractice(block)
        );
      }),
    );
    if (tutorialComplete || knownLevel) launch("practice", upcomingN);
    else setStage("instructions");
  }
  function launch(mode: GameConfig["mode"], n = currentN) {
    const s = sessionRef.current;
    if (!s) return;
    pendingMode.current = mode;
    try {
      if (isDualSession(s)) {
        const config = dualProtocol(n, mode, s.config.windowMs);
        if (!resourceOk(config.n, config.scoredTrials)) {
          setError(
            "This level is too large to run here. Choose a smaller starting level.",
          );
          return;
        }
        const seed = crypto.randomUUID();
        const next = prepareDualBlock(config, seed);
        setFailedSeed("");
        setPrepared(next);
        setPlaySeed(seed);
        setPlayConfig(config);
        setPlayKey((v) => v + 1);
        setStage("play");
        return;
      }
      const input = s.config.input === "aimed" ? "aimed" : "fixed";
      const config = protocol(n, mode, s.config.windowMs, input);
      if (!resourceOk(config.n, config.scoredTrials)) {
        setError(
          "This level is too large to run here. Choose a smaller starting level.",
        );
        return;
      }
      setPrepared(undefined);
      setPlaySeed(undefined);
      setPlayConfig(config);
      setPlayKey((v) => v + 1);
      setStage("play");
    } catch (e) {
      if (e instanceof PreparationError) {
        setFailedSeed(e.seed);
        setError(e.message);
        setStage("preparation-error");
      } else setError(String(e));
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
      .filter((saved) => saved.id !== current.id && !isDualSession(saved))
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .flatMap((saved) => saved.blocks);
    return adapt([...previous, ...current.blocks], n);
  }
  function onDone(block: GameBlock) {
    const s = sessionRef.current;
    if (!s) return;
    const next = { ...s, blocks: [...s.blocks, block] };
    if (
      !isDualBlock(block) &&
      block.config.mode === "training" &&
      block.status === "completed"
    ) {
      const decision = nextDifficulty(next, block.config.n);
      next.adaptations = [...next.adaptations, decision];
      setPrefs((previous) => ({ ...previous, n: decision.to }));
    }
    setLastBlock(block);
    persist(next);
    if (block.config.mode === "practice") {
      if (
        isDualBlock(block) ? passedDualPractice(block) : passedPractice(block)
      )
        setVerified((prev) => [...new Set([...prev, block.config.n])]);
    }
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
      const passed = isDualBlock(lastBlock)
        ? passedDualPractice(lastBlock)
        : passedPractice(lastBlock);
      launch(passed ? s.mode : "practice");
      return;
    }
    let n = currentN;
    if (s.mode === "assessment") n = currentN + 1;
    else if (!isDualSession(s)) n = nextDifficulty(s, currentN).to;
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
              prepared={prepared}
              seed={playSeed}
              round={round}
              total={session?.config.blocks ?? 1}
              sound={prefs.sound}
              onDone={onDone}
            />
          ) : stage === "preparation-error" ? (
            <section className="break-page">
              <h1>Could not prepare this round</h1>
              <p>
                {error || "The dual sequence could not be built for this seed."}{" "}
                {failedSeed ? `Failed seed ${failedSeed}.` : ""} Retry uses a
                new seed and the same protocol.
              </p>
              <div className="button-row break-actions">
                <button
                  className="primary"
                  onClick={() => {
                    setError("");
                    launch(pendingMode.current);
                  }}
                >
                  Retry <Icon name="arrow" size={18} />
                </button>
                <button className="secondary" onClick={() => end()}>
                  Finish for now
                </button>
              </div>
            </section>
          ) : stage === "instructions" ? (
            <>
              <button className="text-button back-link" onClick={() => end()}>
                ← Finish for now
              </button>
              {session && isDualSession(session) ? (
                <TutorialDual
                  n={currentN}
                  onPractice={() => launch("practice")}
                />
              ) : (
                <Tutorial
                  n={currentN}
                  input={
                    session?.config.input === "aimed" ? "aimed" : prefs.input
                  }
                  onPractice={() => launch("practice")}
                />
              )}
            </>
          ) : stage === "break" && lastBlock ? (
            <section className="break-page">
              <h1>
                {lastBlock.status === "interrupted"
                  ? "Round stopped"
                  : lastBlock.config.mode === "practice"
                    ? (
                        isDualBlock(lastBlock)
                          ? passedDualPractice(lastBlock)
                          : passedPractice(lastBlock)
                      )
                      ? "Practice passed"
                      : "Practice needs a retry"
                    : "Round complete"}
              </h1>
              <p>
                {lastBlock.status === "interrupted"
                  ? `${lastBlock.reason}. Restart with new numbers.`
                  : lastBlock.config.mode === "practice"
                    ? isDualBlock(lastBlock)
                      ? `${lastBlock.positionSummary.hits} of 6 location matches · ${lastBlock.numberSummary.hits} of 6 number matches · ${lastBlock.positionSummary.fa} / ${lastBlock.numberSummary.fa} false alarms.${passedDualPractice(lastBlock) ? "" : " Aim for at least 5 matches and at most 1 false alarm on each stream."}`
                      : `${lastBlock.summary.hits} of 6 matches caught · ${lastBlock.summary.fa} false alarm${lastBlock.summary.fa === 1 ? "" : "s"}.${passedPractice(lastBlock) ? "" : " Aim for at least 5 matches and at most 1 false alarm."}`
                    : session?.mode === "training"
                      ? isDualSession(session)
                        ? "Same level next round. Dual training does not change N automatically yet."
                        : nextDifficulty(session, currentN).reason
                      : "Take a break before the next level."}
              </p>
              <div className="button-row break-actions">
                <button className="primary" onClick={continueSession}>
                  {lastBlock.status === "interrupted"
                    ? "Restart round"
                    : lastBlock.config.mode === "practice"
                      ? (
                          isDualBlock(lastBlock)
                            ? passedDualPractice(lastBlock)
                            : passedPractice(lastBlock)
                        )
                        ? "Start scored round"
                        : "Try practice again"
                      : `Continue · ${session?.mode === "training" ? (session && isDualSession(session) ? currentN : nextDifficulty(session, currentN).to) : currentN + 1}-back`}
                  <Icon name="arrow" size={18} />
                </button>

                <button className="secondary" onClick={() => end()}>
                  Finish for now
                </button>
                {lastBlock.config.mode === "practice" &&
                  !(isDualBlock(lastBlock)
                    ? passedDualPractice(lastBlock)
                    : passedPractice(lastBlock)) && (
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
                    {prefs.lastTask === "dual"
                      ? `Match the hole and the number from ${prefs.dualN} turn${prefs.dualN > 1 ? "s" : ""} ago.`
                      : `Match the number from ${prefs.n} turn${prefs.n > 1 ? "s" : ""} ago.`}
                  </p>
                </div>
                <div className="home-mole">
                  <Mole
                    digit={prefs.lastTask === "dual" ? prefs.dualN : prefs.n}
                    decorative
                  />
                </div>
              </div>
              <section className="card setup-card" aria-label="Training setup">
                <span className="field-label" id="task-choice">
                  Task
                </span>
                <div
                  className="segmented"
                  role="group"
                  aria-labelledby="task-choice"
                >
                  <button
                    type="button"
                    aria-pressed={prefs.lastTask === "identity"}
                    className={prefs.lastTask === "identity" ? "selected" : ""}
                    onClick={() => setPrefs({ ...prefs, lastTask: "identity" })}
                  >
                    Number memory
                  </button>
                  <button
                    type="button"
                    aria-pressed={prefs.lastTask === "dual"}
                    className={prefs.lastTask === "dual" ? "selected" : ""}
                    onClick={() => setPrefs({ ...prefs, lastTask: "dual" })}
                  >
                    Dual memory
                  </button>
                </div>
                <span className="field-label" id="starting-level">
                  Starting level
                </span>
                <LevelPicker
                  n={prefs.lastTask === "dual" ? prefs.dualN : prefs.n}
                  onChange={(n) =>
                    setPrefs(
                      prefs.lastTask === "dual"
                        ? { ...prefs, dualN: n }
                        : { ...prefs, n },
                    )
                  }
                  labelledBy="starting-level"
                />
                <label className="session-length">
                  Session length
                  <select
                    value={prefs.blocks}
                    onChange={(e) =>
                      setPrefs({ ...prefs, blocks: +e.target.value })
                    }
                  >
                    {[1, 3, 5].map((blocks) => {
                      const level =
                        prefs.lastTask === "dual" ? prefs.dualN : prefs.n;
                      return (
                        <option key={blocks} value={blocks}>
                          {blocks} round{blocks > 1 ? "s" : ""} · ~
                          {Math.round(
                            (blocks * (60 + level) * (prefs.windowMs + 750)) /
                              60000,
                          )}{" "}
                          min
                        </option>
                      );
                    })}
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
                    setGuideN(
                      prefs.lastTask === "dual" ? prefs.dualN : prefs.n,
                    );
                    setGuideTask(prefs.lastTask);
                    navigate("guide");
                  }}
                >
                  How to play <Icon name="arrow" size={16} />
                </button>
                <button
                  className="text-button"
                  onClick={(e) => {
                    modalOpener.current = e.currentTarget;
                    setAssessmentTask(prefs.lastTask);
                    setAssessmentN(prefs.lastTask === "dual" ? 2 : prefs.n);
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
            <>
              <div
                className="segmented"
                role="group"
                aria-label="How to play task"
              >
                <button
                  type="button"
                  aria-pressed={guideTask === "identity"}
                  className={guideTask === "identity" ? "selected" : ""}
                  onClick={() => {
                    setGuideTask("identity");
                    setGuideN(prefs.n);
                  }}
                >
                  Number memory
                </button>
                <button
                  type="button"
                  aria-pressed={guideTask === "dual"}
                  className={guideTask === "dual" ? "selected" : ""}
                  onClick={() => {
                    setGuideTask("dual");
                    setGuideN(prefs.dualN);
                  }}
                >
                  Dual memory
                </button>
              </div>
              {guideTask === "dual" ? (
                <TutorialDual
                  n={guideN}
                  onN={setGuideN}
                  onPractice={() => start("training", guideN, true, "dual")}
                />
              ) : (
                <Tutorial
                  n={guideN}
                  onN={setGuideN}
                  input={prefs.input}
                  onPractice={() => start("training", guideN, true, "identity")}
                />
              )}
            </>
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
                    <h3 id="appearance-label">Appearance</h3>
                    <p>Night garden, daytime garden, or follow this device.</p>
                  </div>
                  <div
                    className="segmented appearance-options"
                    role="group"
                    aria-labelledby="appearance-label"
                  >
                    {(
                      [
                        ["light", "Light"],
                        ["dark", "Dark"],
                        ["system", "Match device"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={prefs.appearance === id}
                        className={prefs.appearance === id ? "selected" : ""}
                        onClick={() => setPrefs({ ...prefs, appearance: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
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
              {assessmentTask === "dual"
                ? "Dual assessment uses 60 scored trials per level, 2-second appearances, and the Location and Number buttons. Space is not a global match. Practice comes first. Results stay separate from number-memory scores."
                : "A fixed assessment uses 60 scored trials per level, 2-second numbers, and the match button or Space. Practice comes first. Results are kept separate from training."}
            </p>
            <span className="field-label" id="assessment-task-label">
              Task
            </span>
            <div
              className="segmented"
              role="group"
              aria-labelledby="assessment-task-label"
            >
              <button
                type="button"
                aria-pressed={assessmentTask === "identity"}
                className={assessmentTask === "identity" ? "selected" : ""}
                onClick={() => {
                  setAssessmentTask("identity");
                  setAssessmentN(prefs.n);
                }}
              >
                Number memory
              </button>
              <button
                type="button"
                aria-pressed={assessmentTask === "dual"}
                className={assessmentTask === "dual" ? "selected" : ""}
                onClick={() => {
                  setAssessmentTask("dual");
                  setAssessmentN(2);
                }}
              >
                Dual memory
              </button>
            </div>
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
                One level{" "}
                <small>
                  {assessmentTask === "dual" ? assessmentN : prefs.n}-back ·
                  about 3 min + practice
                </small>
              </button>
            </div>
            {assessmentTask === "dual" && !battery && (
              <LevelPicker
                n={assessmentN}
                onChange={setAssessmentN}
                ariaLabel="Assessment level"
              />
            )}
            <button
              className="primary full-width"
              disabled={!loaded}
              onClick={() => {
                setAssessment(false);
                start(
                  "assessment",
                  battery
                    ? 1
                    : assessmentTask === "dual"
                      ? assessmentN
                      : prefs.n,
                  false,
                  assessmentTask,
                );
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
