export interface Figure {
  id: string;
  name: string;
  /** 别名/异名/常见称呼，用于归一化输入 */
  aliases: string[];
  /** 朝代，如"隋""唐" */
  dynasty: string;
  /** 身份/角色标签，如"皇帝""开国君主""名将""诗人" */
  roles: string[];
  /** 主题标签，用于计算特征重叠，如"凌烟阁""玄武门""杨氏" */
  tags: string[];
  /** 与其他人物的显式关系：目标是本人物时，key 为对方 id，value 为关系描述 */
  relations: Record<string, string>;
}

export const FIGURES: Figure[] = [
  {
    id: "yangjian",
    name: "杨坚",
    aliases: ["隋文帝", "杨坚"],
    dynasty: "隋",
    roles: ["皇帝", "开国君主"],
    tags: ["杨氏", "统一南北", "开皇之治"],
    relations: {
      yangguang: "父子，皆出杨氏，一始一终定隋祚",
      ligyuan: "君臣旧识，李渊曾仕于隋",
    },
  },
  {
    id: "yangguang",
    name: "隋炀帝",
    aliases: ["杨广", "隋炀帝"],
    dynasty: "隋",
    roles: ["皇帝"],
    tags: ["杨氏", "大运河", "亡国之君"],
    relations: {
      yangjian: "父子，皆出杨氏，一始一终定隋祚",
      liyuan: "表亲，李渊乘隋乱而起",
    },
  },
  {
    id: "liyuan",
    name: "李渊",
    aliases: ["唐高祖", "李渊"],
    dynasty: "唐",
    roles: ["皇帝", "开国君主"],
    tags: ["李唐", "太原起兵"],
    relations: {
      lishimin: "父子，同为李唐宗室",
      lijiancheng: "父子，同为李唐宗室",
      liyuanji: "父子，同为李唐宗室",
    },
  },
  {
    id: "lishimin",
    name: "李世民",
    aliases: ["唐太宗", "李世民", "天策上将"],
    dynasty: "唐",
    roles: ["皇帝"],
    tags: ["李唐", "玄武门", "贞观之治", "凌烟阁"],
    relations: {
      liyuan: "父子，同为李唐宗室",
      lijiancheng: "兄弟，玄武门之变对手",
      liyuanji: "兄弟，玄武门之变对手",
      weizheng: "君臣，凌烟阁明镜",
      yuchijingde: "君臣，凌烟阁功臣",
      qinqiong: "君臣，凌烟阁功臣",
    },
  },
  {
    id: "lijiancheng",
    name: "李建成",
    aliases: ["隐太子", "李建成"],
    dynasty: "唐",
    roles: ["太子"],
    tags: ["李唐", "玄武门"],
    relations: {
      liyuan: "父子，同为李唐宗室",
      lishimin: "兄弟，玄武门之变对手",
      liyuanji: "兄弟，同谋对抗秦王",
    },
  },
  {
    id: "liyuanji",
    name: "李元吉",
    aliases: ["齐王", "李元吉"],
    dynasty: "唐",
    roles: ["王"],
    tags: ["李唐", "玄武门"],
    relations: {
      liyuan: "父子，同为李唐宗室",
      lishimin: "兄弟，玄武门之变对手",
      lijiancheng: "兄弟，同谋对抗秦王",
    },
  },
  {
    id: "weizheng",
    name: "魏征",
    aliases: ["魏徵", "魏郑公"],
    dynasty: "唐",
    roles: ["名臣", "谏臣"],
    tags: ["李唐", "凌烟阁", "贞观之治"],
    relations: {
      lishimin: "君臣，凌烟阁明镜",
      lijiancheng: "旧主，曾事太子建成",
    },
  },
  {
    id: "yuchijingde",
    name: "尉迟敬德",
    aliases: ["尉迟恭", "鄂国公"],
    dynasty: "唐",
    roles: ["名将"],
    tags: ["李唐", "凌烟阁", "玄武门", "门神"],
    relations: {
      lishimin: "君臣，凌烟阁功臣",
      qinqiong: "同列门神，凌烟阁功臣",
    },
  },
  {
    id: "qinqiong",
    name: "秦琼",
    aliases: ["秦叔宝", "秦琼", "胡国公"],
    dynasty: "唐",
    roles: ["名将"],
    tags: ["李唐", "凌烟阁", "门神"],
    relations: {
      lishimin: "君臣，凌烟阁功臣",
      yuchijingde: "同列门神，凌烟阁功臣",
    },
  },
  {
    id: "libai",
    name: "李白",
    aliases: ["李太白", "青莲居士", "诗仙"],
    dynasty: "唐",
    roles: ["诗人"],
    tags: ["盛唐", "浪漫主义", "诗仙"],
    relations: {
      dufu: "诗坛挚友，李杜并称",
    },
  },
  {
    id: "dufu",
    name: "杜甫",
    aliases: ["杜子美", "少陵野老", "诗圣"],
    dynasty: "唐",
    roles: ["诗人"],
    tags: ["盛唐", "现实主义", "诗圣"],
    relations: {
      libai: "诗坛挚友，李杜并称",
    },
  },
  {
    id: "wuzetian",
    name: "武则天",
    aliases: ["武曌", "则天大圣皇帝"],
    dynasty: "唐",
    roles: ["皇帝", "女皇"],
    tags: ["李唐", "武周", "女皇"],
    relations: {
      lishimin: "曾为太宗才人",
    },
  },
  {
    id: "zhaokuangyin",
    name: "赵匡胤",
    aliases: ["宋太祖", "赵匡胤"],
    dynasty: "宋",
    roles: ["皇帝", "开国君主"],
    tags: ["赵宋", "陈桥兵变", "杯酒释兵权"],
    relations: {},
  },
  {
    id: "libaiyao",
    name: "李元霸",
    aliases: ["李元霸"],
    dynasty: "隋唐演义",
    roles: ["虚构猛将"],
    tags: ["演义", "李唐"],
    relations: {},
  },
];

const NORM = (s: string) => s.trim().replace(/\s+/g, "").toLowerCase();

const LOOKUP = new Map<string, Figure>();
for (const f of FIGURES) {
  LOOKUP.set(NORM(f.name), f);
  for (const a of f.aliases) LOOKUP.set(NORM(a), f);
}

export function findFigure(input: string): Figure | undefined {
  return LOOKUP.get(NORM(input));
}

export function getFigure(id: string): Figure | undefined {
  return FIGURES.find((f) => f.id === id);
}

export { NORM as normalizeName };
