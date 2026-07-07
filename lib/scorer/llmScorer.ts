import { findFigure, getFigure } from "@/lib/figures";
import type { Scorer, ScoreResult } from "./types";
import { mockScorer } from "./mockScorer";

const BASE_URL = process.env.LLM_BASE_URL ?? "";
const API_KEY = process.env.LLM_API_KEY ?? "";
const MODEL = process.env.LLM_MODEL ?? "gpt-5.4-mini";
const TIMEOUT_MS = 20000;

interface LlmJudge {
  score: number; // 0-100 关联度
  hint: string; // 一句文言关系提示
  isPerson: boolean; // 猜测是否为真实历史人物
  canonicalName: string; // 规范化后的人物名
}

const SYSTEM_PROMPT = `你是中国历史人物关联度评估器。给定「目标人物」和用户「猜测输入」，评估两者的历史关联紧密度。
只输出一个 JSON 对象，字段：
- score: 0-100 的数字。关系越紧密越高。直系亲属/君臣核心/生死对手→80-97；同朝代同领域→40-70；仅同朝代→20-40；同为古代人物但无交集→5-20。绝不要输出100（100 仅用于同一人，由系统判定）。
- hint: 不超过15字的文言风格关系提示，点出两人关系但不直接说出目标姓名。
- isPerson: 猜测输入是否为一个真实存在过的中国历史人物（true/false）。乱写/非人名→false。
- canonicalName: 将猜测输入规范化为最常见的本名（如「唐太宗」→「李世民」）；若非人物，原样返回输入。
只输出 JSON，不要解释。`;

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 5;
  return Math.max(0, Math.min(99, Math.round(v * 10000) / 10000));
}

async function callLlm(targetName: string, guess: string): Promise<LlmJudge> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `目标人物：${targetName}\n猜测输入：${guess}` },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as Partial<LlmJudge>;
    return {
      score: clampScore(parsed.score),
      hint: typeof parsed.hint === "string" ? parsed.hint : "",
      isPerson: parsed.isPerson !== false,
      canonicalName:
        typeof parsed.canonicalName === "string" && parsed.canonicalName.trim()
          ? parsed.canonicalName.trim()
          : guess.trim(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export const llmScorer: Scorer = {
  async score(guessInput: string, targetId: string): Promise<ScoreResult> {
    const target = getFigure(targetId);
    if (!target) throw new Error(`unknown target: ${targetId}`);

    // 命中判定始终走本地精确匹配（对目标别名归一化），不交给 LLM，保证 100% 可靠
    const localHit = findFigure(guessInput);
    if (localHit && localHit.id === target.id) {
      return {
        score: 100,
        matched: true,
        known: true,
        canonicalName: localHit.name,
      };
    }

    try {
      const judge = await callLlm(target.name, guessInput);
      return {
        score: judge.score,
        matched: false,
        known: judge.isPerson,
        canonicalName: localHit?.name ?? judge.canonicalName,
        hint: judge.hint || undefined,
      };
    } catch {
      // LLM 失败/超时 → 回退本地 mock，保证线上不崩
      return mockScorer.score(guessInput, targetId);
    }
  },
};
