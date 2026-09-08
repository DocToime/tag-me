export type N = 1 | 2 | 3;
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
    input: InputMode;
  };
  client: {
    ua: string;
    width: number;
    height: number;
    pixelRatio: number;
    timeOrigin: number;
  };
  blocks: Block[];
  adaptations: Adaptation[];
  recoveryNote?: string;
}
