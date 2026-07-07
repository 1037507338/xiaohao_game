export interface ScoreResult {
  /** 0-100 关联度 */
  score: number;
  /** 是否命中目标 */
  matched: boolean;
  /** 规范化后的人物名（处理别名/异名后的展示名） */
  canonicalName: string;
  /** 关系提示，如"同出杨氏，一始一终定隋祚"；无强关系时可为空 */
  hint?: string;
  /** 该输入是否在人物库中被识别 */
  known: boolean;
}

export interface Scorer {
  /**
   * 计算一次猜测与目标人物的关联度。
   * @param guess 用户输入的名称
   * @param targetId 目标人物 id
   */
  score(guess: string, targetId: string): Promise<ScoreResult>;
}
