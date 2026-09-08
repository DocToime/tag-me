import type { Session } from "../game/types";
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
export async function loadSessions(): Promise<Session[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database
      .transaction("sessions")
      .objectStore("sessions")
      .getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as Session[]).sort((a, b) =>
          b.startedAt.localeCompare(a.startedAt),
        ),
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
      { schemaVersion: 1, exportedAt: new Date().toISOString(), sessions },
      null,
      2,
    ),
    "application/json",
  );
}
export function exportCsv(sessions: Session[]) {
  const header = [
    "session_id",
    "started_at",
    "session_status",
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
  ];
  const rows = sessions.flatMap((s) =>
    s.blocks.map((b) => [
      s.id,
      s.startedAt,
      s.status,
      b.id,
      b.config.mode,
      b.config.n,
      b.configHash,
      b.status,
      b.reason ?? "",
      b.summary.hits,
      b.summary.misses,
      b.summary.fa,
      b.summary.cr,
      b.summary.hitRate,
      b.summary.faRate,
      b.summary.balancedAccuracy,
      b.summary.accuracy,
      b.summary.dPrime,
      b.summary.criterion,
      b.summary.medianRt,
      b.summary.rtCount,
      b.summary.flags.join("; "),
    ]),
  );
  const cell = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  download(
    "recall-garden-blocks.csv",
    [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n"),
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
