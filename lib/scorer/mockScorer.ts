import { findFigure, getFigure, normalizeName, type Figure } from "@/lib/figures";
import type { Scorer, ScoreResult } from "./types";

/** 确定性抖动：同一对 (guess,target) 每次结果一致，但分数不整齐，观感更自然 */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 映射到 [-1.5, 1.5]
  return ((h >>> 0) % 3000) / 1000 - 1.5;
}

function overlap<T>(a: T[], b: T[]): number {
  const set = new Set(a);
  return b.filter((x) => set.has(x)).length;
}

/**
 * 规则算分：基于结构化特征重叠。
 * - 命中目标 → 100%
 * - 显式关系 → 高分
 * - 同朝代 / 同身份 / 共享 tag → 叠加
 * - 未识别人物 → 低分兜底
 */
function computeScore(guess: Figure, target: Figure): number {
  if (guess.id === target.id) return 100;

  let score = 8; // 已识别人物的基础分

  const rel = target.relations[guess.id] ?? guess.relations[target.id];
  if (rel) score += 45; // 显式关系权重最高

  if (guess.dynasty === target.dynasty) score += 22;

  const roleHit = overlap(guess.roles, target.roles);
  score += roleHit * 12;

  const tagHit = overlap(guess.tags, target.tags);
  score += tagHit * 9;

  score += jitter(`${guess.id}|${target.id}`);

  return Math.max(0, Math.min(99, Math.round(score * 10000) / 10000));
}

function buildHint(guess: Figure, target: Figure): string | undefined {
  const rel = target.relations[guess.id] ?? guess.relations[target.id];
  if (rel) return rel;

  const sharedTags = guess.tags.filter((t) => target.tags.includes(t));
  if (sharedTags.length) return `同涉「${sharedTags[0]}」`;

  if (guess.dynasty === target.dynasty) {
    const sharedRole = guess.roles.find((r) => target.roles.includes(r));
    if (sharedRole) return `同为${guess.dynasty}代${sharedRole}`;
    return `同属${guess.dynasty}代`;
  }
  return undefined;
}

export const mockScorer: Scorer = {
  async score(guessInput: string, targetId: string): Promise<ScoreResult> {
    const target = getFigure(targetId);
    if (!target) throw new Error(`unknown target: ${targetId}`);

    const guess = findFigure(guessInput);
    if (!guess) {
      // 未识别：给个极低兜底分，带一点抖动
      const s = Math.max(0, Math.round((0.4 + jitter(guessInput) * 0.2) * 10000) / 10000);
      return {
        score: s,
        matched: false,
        known: false,
        canonicalName: guessInput.trim(),
      };
    }

    const matched = guess.id === target.id;
    return {
      score: computeScore(guess, target),
      matched,
      known: true,
      canonicalName: guess.name,
      hint: matched ? undefined : buildHint(guess, target),
    };
  },
};

export { normalizeName };
