import { FIGURES } from "@/lib/figures";
import type { ScoreResult } from "@/lib/scorer/types";

export interface GuessRecord extends ScoreResult {
  guess: string;
}

export interface GameSession {
  id: string;
  targetId: string;
  guesses: GuessRecord[];
  won: boolean;
  createdAt: number;
}

// 第一版：进程内存存储。生产可替换为 Redis/DB。
// 挂在 globalThis 上，避免 Next.js 不同 route bundle 各自实例化出独立 Map，
// 也避免 dev 热重载重置状态。
const g = globalThis as unknown as { __gfSessions?: Map<string, GameSession> };
const SESSIONS: Map<string, GameSession> = (g.__gfSessions ??= new Map());

let counter = 0;
function newId(): string {
  counter += 1;
  return `s_${counter.toString(36)}_${(performance.now() | 0).toString(36)}`;
}

function pickRandomTargetId(): string {
  const i = Math.floor(Math.random() * FIGURES.length);
  return FIGURES[i].id;
}

export function createSession(): GameSession {
  const session: GameSession = {
    id: newId(),
    targetId: pickRandomTargetId(),
    guesses: [],
    won: false,
    createdAt: Date.now(),
  };
  SESSIONS.set(session.id, session);
  return session;
}

export function getSession(id: string): GameSession | undefined {
  return SESSIONS.get(id);
}
