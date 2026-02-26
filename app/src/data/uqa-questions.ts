export interface Dimension {
  id: string;
  name: string;
  /** number of questions in this dimension */
  count: number;
  /** max possible score = count * 5 */
  maxScore: number;
  color: string;
  interpretations: {
    advantage: string;
    develop: string;
    warning: string;
    risk: string;
  };
}

export interface Question {
  id: number;
  text: string;
  dimensionId: string;
}

export type Zone = "advantage" | "develop" | "warning" | "risk";

export const DIMENSIONS: Dimension[] = [
  {
    id: "energy",
    name: "学习能量",
    count: 8,
    maxScore: 40,
    color: "#6366f1",
    interpretations: {
      advantage: "学习动力充沛，对新知识充满热情，能主动探索并保持持续的学习状态。",
      develop: "学习动力基本稳定，但在面对挑战时可能需要额外的激励和支持。",
      warning: "学习动力不足，容易感到疲惫或失去兴趣，需要关注并寻找激发动力的方法。",
      risk: "学习能量严重不足，可能存在明显的学习倦怠，建议寻求专业支持。",
    },
  },
  {
    id: "emotion",
    name: "情绪复原力",
    count: 8,
    maxScore: 40,
    color: "#ec4899",
    interpretations: {
      advantage: "情绪调节能力强，能快速从挫折中恢复，保持积极的心理状态。",
      develop: "情绪管理基本良好，偶尔会受到负面情绪影响，但能逐渐调整。",
      warning: "情绪波动较大，面对压力时容易产生焦虑或沮丧，需要加强情绪管理技能。",
      risk: "情绪复原力较弱，可能长期处于负面情绪中，建议寻求心理支持。",
    },
  },
  {
    id: "cognition",
    name: "认知思维",
    count: 8,
    maxScore: 40,
    color: "#f59e0b",
    interpretations: {
      advantage: "思维灵活，善于分析和解决问题，能从多角度理解复杂概念。",
      develop: "认知能力良好，能处理大多数学习任务，在复杂问题上可进一步提升。",
      warning: "认知思维有待加强，在理解抽象概念或解决复杂问题时存在困难。",
      risk: "认知思维发展受限，需要针对性的学习策略和专业指导。",
    },
  },
  {
    id: "action",
    name: "行动习惯",
    count: 7,
    maxScore: 35,
    color: "#10b981",
    interpretations: {
      advantage: "行动力强，自律性高，能有效规划和执行学习计划。",
      develop: "行动习惯基本良好，能完成大多数任务，但在坚持性上有提升空间。",
      warning: "行动力不足，容易拖延，需要建立更好的学习习惯和时间管理技能。",
      risk: "行动习惯较差，严重影响学习效果，需要系统性的习惯培养干预。",
    },
  },
  {
    id: "belief",
    name: "信念系统",
    count: 7,
    maxScore: 35,
    color: "#8b5cf6",
    interpretations: {
      advantage: "拥有积极的自我信念，相信自己的能力，能以成长型思维面对挑战。",
      develop: "信念系统基本积极，但在面对失败时可能产生自我怀疑，需要强化成长型思维。",
      warning: "存在较多限制性信念，容易自我否定，需要重建积极的自我认知。",
      risk: "信念系统消极，严重影响学习动力和自信心，建议寻求专业心理支持。",
    },
  },
  {
    id: "memory",
    name: "记忆表达",
    count: 7,
    maxScore: 35,
    color: "#06b6d4",
    interpretations: {
      advantage: "记忆力强，表达清晰，能有效整合和传递所学知识。",
      develop: "记忆和表达能力良好，能掌握大多数学习内容，可进一步优化记忆策略。",
      warning: "记忆和表达存在一定困难，需要学习更有效的记忆技巧和表达方法。",
      risk: "记忆表达能力较弱，严重影响学习效果，需要专业的学习策略指导。",
    },
  },
  {
    id: "social",
    name: "规则关系",
    count: 7,
    maxScore: 35,
    color: "#f97316",
    interpretations: {
      advantage: "善于处理人际关系，能遵守规则并在团队中发挥积极作用。",
      develop: "人际关系和规则意识基本良好，在某些社交情境中可进一步提升。",
      warning: "在规则遵守或人际关系处理上存在困难，需要加强社交技能培养。",
      risk: "规则关系方面存在明显问题，可能影响学习环境和人际互动，需要专业支持。",
    },
  },
];

export const QUESTIONS: Question[] = [
  // 学习能量 (8题)
  { id: 1, text: "我对学习新知识感到兴奋和期待", dimensionId: "energy" },
  { id: 2, text: "即使遇到困难，我也能保持学习的热情", dimensionId: "energy" },
  { id: 3, text: "我会主动寻找额外的学习资源和机会", dimensionId: "energy" },
  { id: 4, text: "学习让我感到充实和有成就感", dimensionId: "energy" },
  { id: 5, text: "我能长时间专注于学习任务", dimensionId: "energy" },
  { id: 6, text: "我对自己感兴趣的科目会深入钻研", dimensionId: "energy" },
  { id: 7, text: "我相信努力学习能带来进步", dimensionId: "energy" },
  { id: 8, text: "我在学习中能体验到心流状态", dimensionId: "energy" },

  // 情绪复原力 (8题)
  { id: 9, text: "考试失利后，我能较快调整心态继续努力", dimensionId: "emotion" },
  { id: 10, text: "面对学习压力，我有有效的应对方法", dimensionId: "emotion" },
  { id: 11, text: "我不会因为一次失败而长期沮丧", dimensionId: "emotion" },
  { id: 12, text: "我能识别并管理自己的负面情绪", dimensionId: "emotion" },
  { id: 13, text: "在紧张的考试环境中，我能保持冷静", dimensionId: "emotion" },
  { id: 14, text: "我能从失败经历中找到积极的意义", dimensionId: "emotion" },
  { id: 15, text: "我有可以倾诉学习烦恼的人", dimensionId: "emotion" },
  { id: 16, text: "我能平衡学习压力与日常生活", dimensionId: "emotion" },

  // 认知思维 (8题)
  { id: 17, text: "我能理解并运用抽象的概念和理论", dimensionId: "cognition" },
  { id: 18, text: "面对复杂问题，我能分析其中的关键要素", dimensionId: "cognition" },
  { id: 19, text: "我善于从不同角度思考同一个问题", dimensionId: "cognition" },
  { id: 20, text: "我能将新知识与已有知识建立联系", dimensionId: "cognition" },
  { id: 21, text: "我能快速理解老师讲解的新内容", dimensionId: "cognition" },
  { id: 22, text: "我善于归纳总结学习内容的规律", dimensionId: "cognition" },
  { id: 23, text: "我能用自己的话解释复杂的概念", dimensionId: "cognition" },
  { id: 24, text: "我在解题时能想到多种解决方案", dimensionId: "cognition" },

  // 行动习惯 (7题)
  { id: 25, text: "我会制定学习计划并按时完成", dimensionId: "action" },
  { id: 26, text: "我能抵制娱乐诱惑，专注于学习任务", dimensionId: "action" },
  { id: 27, text: "我有固定的学习时间和学习环境", dimensionId: "action" },
  { id: 28, text: "我会及时复习当天学习的内容", dimensionId: "action" },
  { id: 29, text: "我能按时完成作业和学习任务", dimensionId: "action" },
  { id: 30, text: "我会主动预习即将学习的内容", dimensionId: "action" },
  { id: 31, text: "我能坚持执行自己制定的学习计划", dimensionId: "action" },

  // 信念系统 (7题)
  { id: 32, text: "我相信自己有能力学好各门功课", dimensionId: "belief" },
  { id: 33, text: "我认为智力和能力是可以通过努力提升的", dimensionId: "belief" },
  { id: 34, text: "我不会因为别人的否定而放弃学习目标", dimensionId: "belief" },
  { id: 35, text: "我相信自己的努力终将得到回报", dimensionId: "belief" },
  { id: 36, text: "面对挑战，我会把它看作成长的机会", dimensionId: "belief" },
  { id: 37, text: "我对自己的学习能力有信心", dimensionId: "belief" },
  { id: 38, text: "我相信通过正确的方法可以克服学习困难", dimensionId: "belief" },

  // 记忆表达 (7题)
  { id: 39, text: "我能记住课堂上学习的重要内容", dimensionId: "memory" },
  { id: 40, text: "我有有效的记忆方法帮助记忆知识点", dimensionId: "memory" },
  { id: 41, text: "我能清晰地表达自己的想法和观点", dimensionId: "memory" },
  { id: 42, text: "在考试中，我能准确回忆所学内容", dimensionId: "memory" },
  { id: 43, text: "我善于用图表、思维导图等方式整理知识", dimensionId: "memory" },
  { id: 44, text: "我能在课堂讨论中流畅地表达自己", dimensionId: "memory" },
  { id: 45, text: "我能将所学知识应用到实际问题中", dimensionId: "memory" },

  // 规则关系 (7题)
  { id: 46, text: "我能遵守学校和课堂的规则", dimensionId: "social" },
  { id: 47, text: "我与同学的关系融洽，能有效合作", dimensionId: "social" },
  { id: 48, text: "我尊重老师，能与老师良好沟通", dimensionId: "social" },
  { id: 49, text: "在小组学习中，我能承担自己的责任", dimensionId: "social" },
  { id: 50, text: "我能理解并接受学校规则存在的意义", dimensionId: "social" },
  { id: 51, text: "我能在竞争中保持公平竞争的态度", dimensionId: "social" },
  { id: 52, text: "我能从与他人的互动中获得学习动力", dimensionId: "social" },
];

/**
 * Determine the zone for a given score within a dimension.
 * Thresholds: ≥80% → advantage, ≥60% → develop, ≥40% → warning, <40% → risk
 */
export function getDimensionZone(score: number, maxScore: number): Zone {
  const ratio = score / maxScore;
  if (ratio >= 0.8) return "advantage";
  if (ratio >= 0.6) return "develop";
  if (ratio >= 0.4) return "warning";
  return "risk";
}

export const ZONE_LABELS: Record<Zone, string> = {
  advantage: "优势区",
  develop: "发展区",
  warning: "预警区",
  risk: "风险区",
};

export const ZONE_COLORS: Record<Zone, string> = {
  advantage: "#10b981",
  develop: "#6366f1",
  warning: "#f59e0b",
  risk: "#ef4444",
};
