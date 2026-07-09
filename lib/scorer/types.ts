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

export interface ScoreOptions {
  /** 重复猜测的次数，>0 表示这是同一人物的再次猜测，需重取一个不同的提示 */
  variant?: number;
  /** 需避开的历史提示，生成新提示时尽量与之不同 */
  avoid?: string[];
}

export interface Scorer {
  /**
   * 计算一次猜测与目标人物的关联度。
   * @param guess 用户输入的名称
   * @param targetId 目标人物 id
   * @param opts 重复猜测控制（variant/avoid）
   */
  score(guess: string, targetId: string, opts?: ScoreOptions): Promise<ScoreResult>;
}
