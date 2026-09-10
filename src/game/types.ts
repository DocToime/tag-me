export type N = number;
export function isN(value: unknown): value is N {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
export function resourceOk(n: number, scoredTrials: number): boolean {
  return (
    isN(n) &&
    Number.isInteger(scoredTrials) &&
    scoredTrials >= 1 &&
    n + scoredTrials <= 100_000 &&
    Math.max(n + 1, 4) * (n + scoredTrials) <= 10_000_000
  );
}
export type Mode = "training" | "assessment" | "practice";
export type InputMode = "fixed" | "aimed";
export type Code =
  | "warmup"
  | "hit"
  | "miss"
  | "false_alarm"
  | "correct_rejection"
  | "pending";
export interface Config {
  n: N;
  mode: Mode;
  scoredTrials: number;
  targets: number;
  lures: number;
  windowMs: number;
  isiMs: number;
  input: InputMode;
}
export interface Stimulus {
  i: number;
  digit: number;
  hole: number;
  warmup: boolean;
  target: boolean;
  lure: boolean;
  lagMatches: number[];
  intended: string;
}
export interface Press {
  eventTime: number;
  handlerTime: number;
  method: string;
  hole?: number;
  key?: string;
  x?: number;
  y?: number;
  repeat?: boolean;
  ignored?: boolean;
  timestampFallback?: boolean;
  hitbox?: { x: number; y: number; width: number; height: number };
  disposition?: string;
  trialIndex?: number | null;
  stream?: Stream;
  control?: "position" | "number" | "stimulus";
  ignoreReason?: string;
  pointerId?: number;
  pointerType?: string;
}
export interface Trial {
  id: string;
  stimulus: Stimulus;
  plannedOnset: number;
  onset: number;
  deadline: number;
  offset: number | null;
  response: Press | null;
  rt: number | null;
  code: Code;
}
export interface Summary {
  hits: number;
  misses: number;
  fa: number;
  cr: number;
  targets: number;
  nonTargets: number;
  scored: number;
  hitRate: number | null;
  faRate: number | null;
  accuracy: number | null;
  balancedAccuracy: number | null;
  dPrime: number | null;
  criterion: number | null;
  medianRt: number | null;
  meanRt: number | null;
  sdRt: number | null;
  rtCount: number;
  hitInterval: [number, number] | null;
  faInterval: [number, number] | null;
  flags: string[];
}
export interface Block {
  id: string;
  seed: string;
  config: Config;
  configHash: string;
  sequenceHash: string;
  versions: { engine: string; generator: string; scoring: string; art: string };
  sequence: Stimulus[];
  trials: Trial[];
  events: Press[];
  frames: { at: number; gap: number }[];
  status: "running" | "completed" | "interrupted";
  reason?: string;
  startedAt: string;
  viewport?: { width: number; height: number; pixelRatio: number };
  summary: Summary;
  task?: "identity";
}
export interface Adaptation {
  from: N;
  to: N;
  reason: string;
  blockIds: string[];
  version: string;
}
export interface Session {
  id: string;
  participantId: string;
  schemaVersion: number;
  startedAt: string;
  completedAt?: string;
  mode: "training" | "assessment";
  status: "running" | "completed" | "interrupted";
  config: {
    n: N;
    blocks: number;
    battery: boolean;
    windowMs: number;
    input: InputMode | "dual";
    task?: Task;
  };
  client: {
    ua: string;
    width: number;
    height: number;
    pixelRatio: number;
    timeOrigin: number;
  };
  blocks: GameBlock[];
  adaptations: Adaptation[];
  recoveryNote?: string;
  task?: Task;
  uninterpretable?: string;
}
export type Task = "identity" | "dual";
export type Stream = "position" | "number";
export interface DualConfig {
  n: N;
  mode: Mode;
  scoredTrials: number;
  targets: number;
  lures: number;
  positionTargets: number;
  positionLures: number;
  dualTargetBand: readonly [number, number];
  minConflict: number;
  windowMs: number;
  isiMs: number;
  task: "dual";
  input: "dual";
}
export type GameConfig = Config | DualConfig;
export interface DualStimulus extends Stimulus {
  positionTarget: boolean;
  positionLure: boolean;
  positionLagMatches: number[];
  positionIntended: string;
}
export interface DualTrial {
  id: string;
  stimulus: DualStimulus;
  plannedOnset: number;
  onset: number;
  deadline: number;
  offset: number | null;
  response: null;
  rt: null;
  code: "pending";
  positionResponse: Press | null;
  numberResponse: Press | null;
  positionRt: number | null;
  numberRt: number | null;
  positionCode: Code;
  numberCode: Code;
}
export interface DualDisplaySummary {
  scoredTrials: number;
  meanBalancedAccuracy: number | null;
  meanDPrime: number | null;
  flags: string[];
}
export interface DualBlock {
  id: string;
  seed: string;
  task: "dual";
  config: DualConfig;
  configHash: string;
  sequenceHash: string;
  versions: { engine: string; generator: string; scoring: string; art: string };
  sequence: DualStimulus[];
  trials: DualTrial[];
  events: Press[];
  frames: { at: number; gap: number }[];
  status: "running" | "completed" | "interrupted";
  reason?: string;
  startedAt: string;
  viewport?: { width: number; height: number; pixelRatio: number };
  summary: DualDisplaySummary;
  positionSummary: Summary;
  numberSummary: Summary;
  dualTargets: number;
  dualHits: number;
  dualPartial: number;
  dualMiss: number;
  dualAccuracy: number | null;
  dualInterval: [number, number] | null;
}
export type GameBlock = Block | DualBlock;
export function isDualConfig(config: GameConfig): config is DualConfig {
  return (config as DualConfig).task === "dual";
}
export function isDualBlock(block: GameBlock): block is DualBlock {
  return (block as DualBlock).task === "dual";
}
export function isDualSession(session: Session): boolean {
  return session.task === "dual" || session.config.task === "dual";
}
