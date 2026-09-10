import {
  isDualBlock,
  isDualSession,
  type DualBlock,
  type GameBlock,
  type Session,
  type Summary,
} from "../game/types";
const DB = "recall-garden-v1";
export const RECOVERY = "recall-garden-active";
export const PREFS = "recall-garden-preferences";
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("sessions", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = undefined;
      reject(request.error);
    };
  }));
}
let queue: Promise<unknown> = Promise.resolve();
export function saveSession(session: Session): Promise<void> {
  const snapshot = structuredClone(session);
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const database = await db();
      return new Promise<void>((resolve, reject) => {
        const tx = database.transaction("sessions", "readwrite");
        tx.objectStore("sessions").put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    });
  queue = operation;
  return operation;
}
export function exportSchemaVersion(sessions: Session[]) {
  return sessions.some(
    (s) =>
      s.schemaVersion === 2 || isDualSession(s) || s.blocks.some(isDualBlock),
  )
    ? 2
    : 1;
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
function dualSummariesPresent(block: Record<string, unknown>) {
  return (
    asRecord(block.positionSummary) !== null &&
    asRecord(block.numberSummary) !== null &&
    asRecord(block.summary) !== null
  );
}
export function normalizeSession(raw: unknown): Session {
  const record = asRecord(raw);
  if (!record) {
    return {
      id: crypto.randomUUID(),
      participantId: "unknown",
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      mode: "training",
      status: "interrupted",
      config: {
        n: 1,
        blocks: 1,
        battery: false,
        windowMs: 2000,
        input: "fixed",
      },
      client: { ua: "", width: 0, height: 0, pixelRatio: 1, timeOrigin: 0 },
      blocks: [],
      adaptations: [],
      uninterpretable: "Malformed session record",
      recoveryNote:
        "This record could not be read. Export JSON to keep a copy.",
    };
  }
  const session = record as unknown as Session;
  const blocks = Array.isArray(session.blocks) ? session.blocks : [];
  const explicit =
    session.task ??
    session.config?.task ??
    blocks.find((b) => (b as DualBlock).task)?.task;
  if (
    explicit !== undefined &&
    explicit !== "identity" &&
    explicit !== "dual"
  ) {
    return {
      ...session,
      blocks,
      uninterpretable: `Unknown task ${String(explicit)}`,
      recoveryNote:
        "This session uses an unknown task and was not treated as number memory. Export JSON to keep a copy.",
    };
  }
  const task = explicit === "dual" ? "dual" : session.task;
  const normalizedBlocks = blocks.map((block) => {
    const dual = isDualBlock(block);
    if (
      dual &&
      !dualSummariesPresent(block as unknown as Record<string, unknown>)
    ) {
      session.uninterpretable = "Dual block missing stream summaries";
      session.recoveryNote =
        "A dual round was missing required stream summaries and cannot be scored.";
    }
    if (
      task === "dual" &&
      (block as DualBlock).task &&
      (block as DualBlock).task !== "dual"
    ) {
      session.uninterpretable = "Session and block tasks disagree";
    }
    if (task !== "dual" && dual) {
      session.uninterpretable = "Session and block tasks disagree";
    }
    return block;
  });
  return { ...session, task, blocks: normalizedBlocks };
}
export async function loadSessions(): Promise<Session[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database
      .transaction("sessions")
      .objectStore("sessions")
      .getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as unknown[])
          .map(normalizeSession)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      );
    req.onerror = () => reject(req.error);
  });
}
export async function clearData() {
  await queue.catch(() => {});
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("sessions", "readwrite");
    tx.objectStore("sessions").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  localStorage.removeItem(RECOVERY);
  localStorage.removeItem(PREFS);
  localStorage.removeItem("recall-garden-participant");
}
export function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportJson(sessions: Session[]) {
  download(
    "recall-garden-sessions.json",
    JSON.stringify(
      {
        schemaVersion: exportSchemaVersion(sessions),
        exportedAt: new Date().toISOString(),
        sessions,
      },
      null,
      2,
    ),
    "application/json",
  );
}
const CSV_HEADER = [
  "session_id",
  "started_at",
  "session_status",
  "task",
  "block_id",
  "mode",
  "n",
  "protocol",
  "block_status",
  "reason",
  "hits",
  "misses",
  "false_alarms",
  "correct_rejections",
  "hit_rate",
  "fa_rate",
  "balanced_accuracy",
  "raw_accuracy",
  "d_prime",
  "criterion",
  "median_hit_rt_ms",
  "hit_rt_count",
  "quality_flags",
  "location_hits",
  "location_misses",
  "location_false_alarms",
  "location_correct_rejections",
  "location_hit_rate",
  "location_fa_rate",
  "location_balanced_accuracy",
  "location_raw_accuracy",
  "location_d_prime",
  "location_criterion",
  "location_median_hit_rt_ms",
  "location_hit_rt_count",
  "location_hit_interval_lo",
  "location_hit_interval_hi",
  "location_flags",
  "number_hits",
  "number_misses",
  "number_false_alarms",
  "number_correct_rejections",
  "number_hit_rate",
  "number_fa_rate",
  "number_balanced_accuracy",
  "number_raw_accuracy",
  "number_d_prime",
  "number_criterion",
  "number_median_hit_rt_ms",
  "number_hit_rt_count",
  "number_hit_interval_lo",
  "number_hit_interval_hi",
  "number_flags",
  "mean_balanced_accuracy",
  "mean_d_prime",
  "dual_targets",
  "dual_hits",
  "dual_partial",
  "dual_miss",
  "dual_accuracy",
  "dual_interval_lo",
  "dual_interval_hi",
  "scored_trials",
];
function blankIdentityMetrics() {
  return Array(13).fill("");
}
function streamColumns(s: Summary) {
  return [
    s.hits,
    s.misses,
    s.fa,
    s.cr,
    s.hitRate,
    s.faRate,
    s.balancedAccuracy,
    s.accuracy,
    s.dPrime,
    s.criterion,
    s.medianRt,
    s.rtCount,
    s.hitInterval?.[0] ?? "",
    s.hitInterval?.[1] ?? "",
    s.flags.join("; "),
  ];
}
export function csvRow(session: Session, block: GameBlock): unknown[] {
  const task = isDualBlock(block)
    ? "dual"
    : (session.task ?? block.task ?? "identity");
  const shared = [
    session.id,
    session.startedAt,
    session.status,
    task,
    block.id,
    block.config.mode,
    block.config.n,
    block.configHash,
    block.status,
    block.reason ?? "",
  ];
  if (isDualBlock(block)) {
    return [
      ...shared,
      ...blankIdentityMetrics(),
      ...streamColumns(block.positionSummary),
      ...streamColumns(block.numberSummary),
      block.summary.meanBalancedAccuracy,
      block.summary.meanDPrime,
      block.dualTargets,
      block.dualHits,
      block.dualPartial,
      block.dualMiss,
      block.dualAccuracy,
      block.dualInterval?.[0] ?? "",
      block.dualInterval?.[1] ?? "",
      block.summary.scoredTrials,
    ];
  }
  const dualBlanks = Array(CSV_HEADER.length - shared.length - 13).fill("");
  return [
    ...shared,
    block.summary.hits,
    block.summary.misses,
    block.summary.fa,
    block.summary.cr,
    block.summary.hitRate,
    block.summary.faRate,
    block.summary.balancedAccuracy,
    block.summary.accuracy,
    block.summary.dPrime,
    block.summary.criterion,
    block.summary.medianRt,
    block.summary.rtCount,
    block.summary.flags.join("; "),
    ...dualBlanks,
  ];
}
export function exportCsv(sessions: Session[]) {
  const rows = sessions.flatMap((s) => s.blocks.map((b) => csvRow(s, b)));
  const cell = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  download(
    "recall-garden-blocks.csv",
    [CSV_HEADER, ...rows].map((row) => row.map(cell).join(",")).join("\r\n"),
    "text/csv",
  );
}
export function participantId() {
  let id = localStorage.getItem("recall-garden-participant");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("recall-garden-participant", id);
  }
  return id;
}
