import { findFigure, getFigure, normalizeName } from "@/lib/figures";
import type { Scorer, ScoreResult, ScoreOptions } from "./types";
import { mockScorer } from "./mockScorer";
import { cacheGet, cacheSet } from "@/lib/cache";

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

const SYSTEM_PROMPT = `你是中国历史人物关联度评估器。给定「目标人物」（含其权威身份资料）和用户「猜测输入」，评估两者的历史关联紧密度。
用户消息会提供目标人物的【朝代】和【身份】作为权威事实，你【必须以此为准】，不得凭记忆臆断目标的身份。例如资料写明目标身份为「权臣」，就绝不能说目标是「帝王」。
只输出一个 JSON 对象，字段：
- score: 0-100 的数字，可带小数。关系越紧密越高，请按下列档位给分（尽量贴近档位上沿，不要一律给中间值）：
  · 【顶级关系 → 92-99】直系血亲（父子、母子、亲兄弟姐妹）、夫妻、生死宿敌/毕生对手、核心君臣（如宰相与其君、名将与其主）、师徒嫡传、齐名并称（如李杜、苏门）。这类关系极深，务必给到 92 以上；父子/夫妻这类血缘或终身绑定关系可给到 96-99。
  · 【紧密关系 → 75-92】同一重大事件的关键双方、同朝同殿的重要同僚、同一流派核心成员、有明确交往记载者。
  · 【中等关联 → 45-70】同朝代且同领域（如同为盛唐诗人、同为北宋名臣），但无直接交集。
  · 【弱关联 → 20-40】仅同朝代，或仅同一身份领域（隔代同为名将）。
  · 【几乎无关 → 5-20】同为古代人物但朝代领域皆不同。
  绝不要输出 100（100 仅用于同一人，由系统判定）。
- hint: 6~12字的文言风格提示，帮玩家缩小范围（尽量写满，信息更充分，但不超过12字）。【暗示强度随 score 递增】——越接近（分越高）越明确，越疏远（分越低）越模糊：
  · score ≥ 75（关系极近）：可较明确点出二者的具体关联，如「生死对峙数十载」「同门治学称三苏」「君臣共开贞观治」「诗坛齐名称双璧」——给玩家有力线索，但仍不得直接说出目标姓名。
  · 45 ≤ score < 75（较近）：点出较具体的共同点，如领域相同+互动倾向，「同殿为臣议朝政」「沙场宿将各为主」「同代文宗领风骚」「变法政见相争锋」，但不完全点破关系。
  · 20 ≤ score < 45（稍远）：只给宽泛维度的共同点，如朝代或身份，「同属北宋之名臣」「皆为开疆之名将」「俱在庙堂居高位」。
  · score < 20（很远）：极模糊或不给方向，如「同为古代之人物」，或若毫无共同点则返回空串 ""。
  【必须基于事实】只能写猜测者与目标真实存在的共同点/关系。例如目标身份是「权臣」而猜测者是「帝王」，二者身份不同，绝不能写「皆为帝王」。
  【严禁】只描述猜测者自身（如「一代名臣」），也不得说出目标姓名。若二者毫无共同点，返回空字符串 ""，不要强行编造。
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

function factLine(f: { name: string; dynasty: string; roles: string[] }): string {
  return `${f.name}（朝代：${f.dynasty}；身份：${f.roles.join("、")}）`;
}

async function callLlm(userContent: string, extraSystem?: string): Promise<LlmJudge> {
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
          { role: "system", content: extraSystem ? `${SYSTEM_PROMPT}\n${extraSystem}` : SYSTEM_PROMPT },
          { role: "user", content: userContent },
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
        typeof parsed.canonicalName === "string" ? parsed.canonicalName.trim() : "",
    };
  } finally {
    clearTimeout(timer);
  }
}

export const llmScorer: Scorer = {
  async score(guessInput: string, targetId: string, opts?: ScoreOptions): Promise<ScoreResult> {
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

    // 缓存键：目标 + 规范化后的猜测（库内用 id，库外用归一化文本）
    const guessKey = localHit?.id ?? normalizeName(guessInput);
    const cacheKey = `${target.id}|${guessKey}`;
    const isVariant = (opts?.variant ?? 0) > 0;

    // 首次猜测走缓存；重复猜测（variant>0）跳过缓存，重取一个不同提示
    if (!isVariant) {
      const cached = await cacheGet<ScoreResult>(cacheKey);
      if (cached) return cached;
    }

    let result: ScoreResult;
    try {
      // 注入目标的权威身份，避免模型臆断目标是谁；猜测者若在库中也一并给出事实
      const targetFact = `目标人物：${factLine(target)}`;
      const guessFact = localHit
        ? `猜测输入：${factLine(localHit)}`
        : `猜测输入：${guessInput}`;
      let extraSystem: string | undefined;
      if (isVariant) {
        const avoid = (opts?.avoid ?? []).filter(Boolean);
        extraSystem =
          `【本次为重复猜测】玩家再次输入了同一人物，请换一个角度、用不同措辞重写 hint，` +
          `保持 score 与之前一致的量级（关系没变），但 hint 必须与以下已给过的提示明显不同：` +
          (avoid.length ? avoid.map((h) => `「${h}」`).join("、") : "（无）") +
          `。可从另一维度（时代/领域/事件/性格/际遇）切入。`;
      }
      const judge = await callLlm(`${targetFact}\n${guessFact}`, extraSystem);
      result = {
        // 分数用确定性种子，保证重复猜测分数稳定不变（关系未变）
        score: refineScore(judge.score, cacheKey),
        matched: false,
        known: judge.isPerson,
        canonicalName: localHit?.name || judge.canonicalName || guessInput.trim(),
        hint: judge.hint || undefined,
      };
    } catch {
      // LLM 失败/超时 → 回退本地 mock，保证线上不崩（失败结果不缓存）
      return mockScorer.score(guessInput, targetId, opts);
    }

    // 只缓存首次结果；重复猜测的变体提示不覆盖缓存
    if (!isVariant) await cacheSet(cacheKey, result);
    return result;
  },
};
