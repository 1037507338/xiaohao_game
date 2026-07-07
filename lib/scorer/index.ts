import type { Scorer } from "./types";
import { mockScorer } from "./mockScorer";
import { llmScorer } from "./llmScorer";

/** 根据环境变量选择算分器：USE_LLM_SCORER=1 且配置了 key 时用 LLM，否则用本地 mock。 */
export function getScorer(): Scorer {
  const useLlm = process.env.USE_LLM_SCORER === "1" && !!process.env.LLM_API_KEY;
  return useLlm ? llmScorer : mockScorer;
}
