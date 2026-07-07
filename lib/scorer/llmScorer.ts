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
- score: 0-100 的数字，可带小数。关系越紧密越高。直系亲属/君臣核心/生死对手→80-97；同朝代同领域→40-70；仅同朝代→20-40；同为古代人物但无交集→5-20。绝不要输出100（100 仅用于同一人，由系统判定）。
- hint: 不超过18字的文言风格提示，目的是帮玩家推断目标身份、缩小范围。规则按两人关系强弱分两种写法：
  ① 若两人有明确关联（君臣、亲属、师徒、同僚、对手、同一事件、同一流派等）→ 直接点明该关系。例：「君臣共定天下」「同列凌烟阁」「李杜诗坛双璧」「玄武门生死对手」。
  ② 若两人关系疏远（异代、无交集）→ 不要只写「相隔千年」这类空话，而要以目标为参照给出方向性线索：点出目标的领域/身份/时代相对猜测者的差异，引导玩家。例（目标为思想家而猜测为帝王时）：「目标不掌权柄，乃立言之圣」「尔为帝王，目标以学说传世」；例（目标为武将而猜测为文人时）：「目标不事笔墨，乃沙场之将」。
  绝不能只描述猜测人物自身身份（如「一代名臣」「盛唐诗人」），也不能直接说出目标姓名。
- isPerson: 猜测输入是否为一个真实存在过的中国历史人物（true/false）。乱写/非人名→false。
- canonicalName: 将猜测输入规范化为最常见的本名（如「唐太宗」→「李世民」）；若非人物，原样返回输入。
只输出 JSON，不要解释。`;

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 5;
  return Math.max(0, Math.min(99, v));
}

/**
 * 确定性小数扰动：LLM 常给整数分（如都是 12），导致多项并列无法区分排序。
 * 用 (guess,target) 派生一个 [0,1) 的确定性小数附加到整数分上，
 * 同一对每次结果一致，且几乎不会碰撞，让排序稳定且可辨。
 */
function decimalJitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff; // [0,1)
}

/** 把 LLM 的整数分变成带小数、可区分的分数 */
function refineScore(raw: number, seed: string): number {
  const clamped = clampScore(raw);
  // 已带小数则保留；接近整数时叠加确定性小数扰动
  const frac = clamped - Math.floor(clamped);
  const base = frac > 0.0001 ? clamped : clamped + decimalJitter(seed) * 0.9;
  return Math.max(0, Math.min(99, Math.round(base * 10000) / 10000));
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
        score: refineScore(judge.score, `${target.id}|${localHit?.id ?? guessInput}`),
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
