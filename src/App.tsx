import { useEffect, useRef, useState } from "react";
import { Garden, Icon, Mole } from "./components/Art";
import Play from "./components/Play";
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
function Tutorial({
  n,
  onN,
  onPractice,
  standalone = false,
}: {
  n: N;
  onN?: (n: N) => void;
  onPractice: () => void;
  standalone?: boolean;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [n]);
  const numbers =
    n === 1
      ? [2, 2, 5, 8, 8, 3]
      : n === 2
        ? [2, 5, 2, 8, 2, 8]
        : [2, 5, 8, 2, 7, 8];
  const target = step >= n && numbers[step] === numbers[step - n];
  return (
    <section className="tutorial">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {standalone ? "HOW TO PLAY" : "A MOMENT TO GET FAMILIAR"}
          </span>
          <h1>A number. A memory. A match.</h1>
          <p>
            Remember the number from{" "}
            <strong>
              {n} turn{n > 1 ? "s" : ""} ago
            </strong>
            . If it appears again, it’s a match.
          </p>
        </div>
      </div>
      {onN && (
        <div className="segmented tutorial-level">
          {([1, 2, 3] as N[]).map((v) => (
            <button
              key={v}
              className={n === v ? "selected" : ""}
              onClick={() => onN(v)}
            >
              {v}-back
            </button>
          ))}
        </div>
      )}
      <div className="card example-card">
        <span className="small-tag">
          Guided example · {step + 1} / {numbers.length}
        </span>
        <div className="example-mole">
          <Mole digit={numbers[step]} />
        </div>
        <div className="digit-history">
          {numbers.map((digit, i) => (
            <div
              key={i}
              className={`example-digit ${i === step ? "current" : ""} ${step >= n && i === step - n ? "compare" : ""} ${i > step ? "future" : ""}`}
            >
              <span>{i <= step ? digit : "·"}</span>
              <small>
                {i === step
                  ? "Now"
                  : step >= n && i === step - n
                    ? `${n} ago`
                    : i < step
                      ? "Earlier"
                      : "Next"}
              </small>
            </div>
          ))}
        </div>
        <div className="example-explanation" aria-live="polite">
          <strong>
            {step < n
              ? "First, fill your memory."
              : target
                ? "Yes, this is a match."
                : "Different number. Let it pass."}
          </strong>
          <p>
            {step < n
              ? `There ${n - step === 1 ? "is" : "are"} ${n - step} more number${n - step > 1 ? "s" : ""} to remember before comparisons begin. No response is needed.`
              : `The number now is ${numbers[step]}. ${n} turn${n > 1 ? "s" : ""} ago it was ${numbers[step - n]}. ${target ? "Press the match control." : "Wait for the next mole."}`}
          </p>
        </div>
        <div className="button-row">
          <button
            className="secondary"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
          {step < numbers.length - 1 ? (
            <button className="primary" onClick={() => setStep(step + 1)}>
              Next number <Icon name="arrow" size={18} />
            </button>
          ) : (
            <button className="primary" onClick={onPractice}>
              Try it in practice <Icon name="arrow" size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="instruction-notes">
        <div>
          <Icon name="target" />
          <h3>Numbers, not positions</h3>
          <p>The mole moves around. Only its shirt number matters.</p>
        </div>
        <div>
          <Icon name="clock" />
          <h3>Keep a steady rhythm</h3>
          <p>
            Every number stays for the same amount of time, even after you
            respond.
          </p>
        </div>
        <div>
          <Icon name="leaf" />
          <h3>Make room for the next</h3>
          <p>
            Remember, compare, then update. The number trail is only shown in
            this example.
          </p>
        </div>
      </div>
    </section>
  );
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
    [viewed, setViewed] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const initialised = useRef(false);
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
  }, [page, stage, viewed]);
  useEffect(() => {
    if (!assessment && !confirmDelete) return;
    const previousFocus = document.activeElement as HTMLElement | null;
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
    if (tutorialComplete) launch("practice", n);
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
  const completedTraining = sessions
    .flatMap((s) => s.blocks)
    .filter((b) => b.config.mode === "training" && b.status === "completed");
  const days = new Set(
    sessions
      .filter((s) =>
        s.blocks.some(
          (b) => b.config.mode === "training" && b.status === "completed",
        ),
      )
      .map((s) => new Date(s.startedAt).toLocaleDateString()),
  ).size;
  const best = completedTraining.length
    ? Math.max(...completedTraining.map((b) => b.config.n))
    : null;
  const ongoing = stage !== null && stage !== "results";
  const actualSession = viewed ?? session;
  const round =
    (session?.blocks.filter(
      (b) => b.config.mode === session.mode && b.status === "completed",
    ).length ?? 0) + 1;
  return (
    <div className={`app-shell ${stage === "play" ? "is-playing" : ""}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
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
        <div className="sidebar-caption">A LITTLE FOCUS, EVERY DAY</div>
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
              className={page === item.id && !viewed ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.name}</span>
              {page === item.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="sprout" size={29} />
          <p>
            A little practice.
            <br />A little more possibility.
          </p>
          <span>GROW AT YOUR OWN PACE</span>
        </div>
        <button
          className={`settings-nav ${page === "settings" ? "active" : ""}`}
          disabled={ongoing}
          onClick={() => navigate("settings")}
        >
          <Icon name="settings" />
          <span>Settings & data</span>
        </button>
        <div className="local-badge">
          <span /> Your own quiet corner
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span>
            {stage === "play"
              ? "A moment for your memory"
              : page === "home"
                ? "Your daily space to grow"
                : page === "progress"
                  ? "Every round is a small step"
                  : page === "guide"
                    ? "Get to know the rhythm"
                    : "Make yourself at home"}
          </span>
          <div>
            <span className="private-label">
              <Icon name="lock" size={14} /> Local & private
            </span>
            <span className="avatar">You</span>
          </div>
        </header>
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
              <Tutorial n={currentN} onPractice={() => launch("practice")} />
              <p className="quiet centered">
                Practice has 12 trials after memory fill. Catch at least 5 of 6
                matches, with no more than 1 false alarm.
              </p>
            </>
          ) : stage === "break" && lastBlock ? (
            <section className="break-page">
              <div className="completion-symbol">
                <Icon
                  name={lastBlock.status === "interrupted" ? "clock" : "sprout"}
                  size={38}
                />
              </div>
              <span className="eyebrow">
                {lastBlock.status === "interrupted"
                  ? "LET’S TAKE A BREATH"
                  : lastBlock.config.mode === "practice"
                    ? "PRACTICE COMPLETE"
                    : "A LITTLE MORE GROWTH"}
              </span>
              <h1>
                {lastBlock.status === "interrupted"
                  ? "Ready for a fresh start?"
                  : lastBlock.config.mode === "practice"
                    ? passedPractice(lastBlock)
                      ? "You’ve got the rhythm."
                      : "Let’s give it another go."
                    : "A good moment to pause."}
              </h1>
              <p>
                {lastBlock.status === "interrupted"
                  ? "This attempt has been saved. Restart with new numbers and a fresh memory buffer."
                  : lastBlock.config.mode === "practice"
                    ? passedPractice(lastBlock)
                      ? "You’re ready for the scored round. Take your time before starting."
                      : "Catch at least 5 of 6 matches, with no more than 1 false alarm. The tutorial is here whenever you need it."
                    : session?.mode === "training"
                      ? nextDifficulty(session, currentN).reason
                      : "Take a break. The next round introduces a new level."}
              </p>
              <BlockResult block={lastBlock} />
              <div className="button-row">
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
              </div>
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
                  <span className="eyebrow">
                    {actualSession?.status === "completed"
                      ? "SESSION COMPLETE"
                      : "YOUR SAVED SESSION"}
                  </span>
                  <h1>
                    {actualSession?.status === "completed"
                      ? "A little time, well spent."
                      : "Every attempt has a place."}
                  </h1>
                  <p>Your practice, one round at a time.</p>
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
                  <p className="quiet">
                    Device context: {actualSession.client.width} ×{" "}
                    {actualSession.client.height} · {actualSession.config.input}{" "}
                    input · {actualSession.client.ua}
                  </p>
                </>
              )}
            </section>
          ) : page === "home" ? (
            <>
              <div className="welcome-line">
                <span className="eyebrow">YOUR MIND HAS ROOM TO GROW</span>
                <span>
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="pill">
                    <span /> A small daily practice
                  </span>
                  <h1>
                    A little focus.
                    <br />A growing memory.
                  </h1>
                  <p>
                    Meet your daily moment of mental exercise.
                    <br className="desktop-break" /> Remember, recognise, and
                    find your rhythm.
                  </p>
                  <button
                    className="primary hero-cta"
                    disabled={!loaded}
                    onClick={() => start("training")}
                  >
                    {loaded ? "Start training" : "Getting your garden ready…"}
                    <Icon name="arrow" size={20} />
                  </button>
                  <div className="hero-meta">
                    <span>
                      <Icon name="clock" size={15} />
                      {Math.round(
                        (prefs.blocks * 62 * (prefs.windowMs + 750)) / 60000,
                      )}{" "}
                      min of play
                    </span>
                    <span>
                      <Icon name="leaf" size={15} />
                      At your own pace
                    </span>
                  </div>
                </div>
                <Garden />
                <span className="hero-bottom-note">
                  A FRESH CHALLENGE, EVERY TIME
                </span>
              </section>
              <div className="stats-row">
                <div>
                  <span className="stat-icon sage">
                    <Icon name="sprout" />
                  </span>
                  <span>
                    <strong>
                      {completedTraining.length}
                      <small>rounds</small>
                    </strong>
                    <p>Seeds of progress</p>
                  </span>
                </div>
                <div>
                  <span className="stat-icon peach">
                    <Icon name="sun" />
                  </span>
                  <span>
                    <strong>
                      {days}
                      <small>{days === 1 ? "day" : "days"}</small>
                    </strong>
                    <p>Time made for yourself</p>
                  </span>
                </div>
                <div>
                  <span className="stat-icon yellow">
                    <Icon name="target" />
                  </span>
                  <span>
                    <strong>{best === null ? "—" : `${best}-back`}</strong>
                    <p>
                      {best === null
                        ? "Your next chapter starts here"
                        : "Highest level practised"}
                    </p>
                  </span>
                </div>
              </div>
              <div className="dashboard-grid">
                <section className="card setup-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">MAKE IT YOURS</span>
                      <h2>Today’s practice</h2>
                    </div>
                    <span className="small-tag">Adaptive training</span>
                  </div>
                  <label className="field-label">
                    Your starting level <span>Challenge grows with you</span>
                  </label>
                  <div className="level-options">
                    {([1, 2, 3] as N[]).map((n) => (
                      <button
                        key={n}
                        className={prefs.n === n ? "chosen" : ""}
                        onClick={() => setPrefs({ ...prefs, n })}
                      >
                        <span className="level-dots">
                          {"●".repeat(n)}
                          <span>{"○".repeat(3 - n)}</span>
                        </span>
                        <strong>{n}-back</strong>
                        <small>
                          {n === 1
                            ? "Find your rhythm"
                            : n === 2
                              ? "Stretch your focus"
                              : "Go a little deeper"}
                        </small>
                        {prefs.n === n && (
                          <span className="selection-check">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="setup-bottom">
                    <label>
                      Session length
                      <select
                        value={prefs.blocks}
                        onChange={(e) =>
                          setPrefs({ ...prefs, blocks: +e.target.value })
                        }
                      >
                        <option value={1}>1 round · a quick reset</option>
                        <option value={3}>3 rounds · a daily practice</option>
                        <option value={5}>5 rounds · a longer stretch</option>
                      </select>
                    </label>
                    <label>
                      Response style
                      <select
                        value={prefs.input}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            input: e.target.value as InputMode,
                          })
                        }
                      >
                        <option value="fixed">Match button / Space</option>
                        <option value="aimed">Tap mole / Q W E A S D</option>
                      </select>
                    </label>
                  </div>
                  <p className="quiet setup-footnote">
                    <Icon name="leaf" size={15} />
                    Short practice first. Breaks whenever you need them.
                  </p>
                </section>
                <section className="card how-card">
                  <span className="eyebrow">SIMPLE TO LEARN</span>
                  <h2>See a familiar number?</h2>
                  <div className="mini-example">
                    <span>2</span>
                    <i>→</i>
                    <span>5</span>
                    <i>→</i>
                    <span className="match-digit">
                      2<small>match!</small>
                    </span>
                  </div>
                  <p>
                    In <strong>2-back</strong>, match the number from two turns
                    ago. Different number? Just let it pass.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("guide")}
                  >
                    Show me how <Icon name="arrow" size={18} />
                  </button>
                </section>
              </div>
              <section className="assessment-strip">
                <span className="stat-icon">
                  <Icon name="chart" />
                </span>
                <div>
                  <h3>A moment to measure</h3>
                  <p>
                    Try a fixed assessment and keep a separate record of your
                    performance.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setAssessment(true)}
                >
                  Explore assessment <Icon name="arrow" size={16} />
                </button>
              </section>
              <footer className="page-footer">
                <Icon name="sprout" size={18} />
                <span>
                  Progress grows with practice. Make a little room for yours.
                </span>
              </footer>
            </>
          ) : page === "progress" ? (
            <Progress sessions={sessions} onOpen={(s) => setViewed(s)} />
          ) : page === "guide" ? (
            <Tutorial
              n={guideN}
              onN={setGuideN}
              standalone
              onPractice={() => start("training", guideN, true)}
            />
          ) : (
            <section>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR SPACE, YOUR WAY</span>
                  <h1>Make yourself comfortable.</h1>
                  <p>A few simple settings for your daily practice.</p>
                </div>
              </div>
              <div className="card settings-card">
                <h2>Practice preferences</h2>
                <div className="setting-row">
                  <div>
                    <h3>Time with each number</h3>
                    <p>Training exposure. Assessment always uses 2 seconds.</p>
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
                    <h3>Gentle sound cues</h3>
                    <p>Optional feedback during training and practice.</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={prefs.sound}
                    aria-label="Gentle sound cues"
                    className={`toggle ${prefs.sound ? "on" : ""}`}
                    onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}
                  >
                    <span />
                  </button>
                </div>
              </div>
              <div className="card settings-card">
                <div className="section-heading">
                  <h2>Your data stays with you</h2>
                  <Icon name="lock" />
                </div>
                <p>
                  Sessions are stored in this browser on this device. No
                  account, uploads, or analytics. Clearing browser data removes
                  your history, so export a copy whenever you want to keep it.
                </p>
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
                    <h3>Clear my garden</h3>
                    <p>
                      Delete saved sessions and reset preferences on this
                      device.
                    </p>
                  </div>
                  <button
                    className="danger-button"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete local data
                  </button>
                </div>
              </div>
              <div className="card about-card">
                <span className="brand-mark">
                  <Icon name="sprout" />
                </span>
                <div>
                  <h3>
                    Recall Garden <span className="small-tag">1.0</span>
                  </h3>
                  <p>
                    An independent number n-back game, made for focused
                    practice. Match numbers from 1, 2, or 3 turns ago in your
                    own little garden.
                  </p>
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
            <span className="eyebrow">A CONSISTENT CHECK-IN</span>
            <h2 id="assessment-title">Your memory, in the moment.</h2>
            <p>
              A fixed assessment uses 60 scored trials per level, 2-second
              numbers, and the match button or Space. Practice comes first.
              Results are kept separate from training.
            </p>
            <label className="field-label">Choose your assessment</label>
            <div className="assessment-choices">
              <button
                className={battery ? "selected" : ""}
                onClick={() => setBattery(true)}
              >
                Full check-in{" "}
                <small>1-, 2-, and 3-back · about 9 min + practice</small>
              </button>
              <button
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
            <h2 id="delete-title">Clear your saved garden?</h2>
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
