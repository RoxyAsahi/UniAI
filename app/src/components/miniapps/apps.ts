export type MiniApp = {
  id: string;
  name: string;
  url: string;
  icon: string; // URL to image or emoji fallback
  category: string;
  description?: string;
  route?: string; // 内部路由，设置后点击跳转内部页面而非外部链接
};

export const APP_CATEGORIES = [
  "all",
  "chat",
  "search",
  "code",
  "image",
  "productivity",
  "education",
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number];

export const miniApps: MiniApp[] = [
  // Chat / AI Assistants
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chat.openai.com",
    icon: "https://cdn.oaistatic.com/assets/favicon-o20kmmos.svg",
    category: "chat",
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com",
    icon: "https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06.svg",
    category: "chat",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    icon: "https://claude.ai/favicon.ico",
    category: "chat",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    icon: "https://chat.deepseek.com/favicon.svg",
    category: "chat",
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://kimi.moonshot.cn",
    icon: "https://statics.moonshot.cn/kimi-chat/favicon.ico",
    category: "chat",
  },
  {
    id: "doubao",
    name: "豆包",
    url: "https://www.doubao.com",
    icon: "https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/web/logo-icon.png",
    category: "chat",
  },
  {
    id: "tongyi",
    name: "通义千问",
    url: "https://tongyi.aliyun.com",
    icon: "https://img.alicdn.com/imgextra/i1/O1CN01asLYeX1WhbsyEZn5u_!!6000000002820-55-tps-56-56.svg",
    category: "chat",
  },
  {
    id: "wenxin",
    name: "文心一言",
    url: "https://yiyan.baidu.com",
    icon: "https://nlp-eb.cdn.bcebos.com/logo/favicon.ico",
    category: "chat",
  },
  {
    id: "hunyuan",
    name: "腾讯元宝",
    url: "https://yuanbao.tencent.com",
    icon: "https://yuanbao.tencent.com/favicon.ico",
    category: "chat",
  },
  {
    id: "groq",
    name: "Groq",
    url: "https://groq.com",
    icon: "https://groq.com/favicon.ico",
    category: "chat",
  },
  {
    id: "poe",
    name: "Poe",
    url: "https://poe.com",
    icon: "https://poe.com/favicon.svg",
    category: "chat",
  },
  {
    id: "coze",
    name: "Coze",
    url: "https://www.coze.cn",
    icon: "https://lf-coze-web-cdn.coze.cn/obj/coze-web-cn/obric/coze/favicon.1970.ico",
    category: "chat",
  },
  // Search / Research
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai",
    icon: "https://www.perplexity.ai/favicon.ico",
    category: "search",
  },
  {
    id: "genspark",
    name: "Genspark",
    url: "https://www.genspark.ai",
    icon: "https://www.genspark.ai/favicon.ico",
    category: "search",
  },
  {
    id: "notebooklm",
    name: "NotebookLM",
    url: "https://notebooklm.google.com",
    icon: "https://notebooklm.google.com/favicon.ico",
    category: "search",
  },
  // Code
  {
    id: "bolt",
    name: "bolt",
    url: "https://bolt.new",
    icon: "https://bolt.new/favicon.svg",
    category: "code",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    url: "https://github.com/features/copilot",
    icon: "https://github.githubassets.com/favicons/favicon.svg",
    category: "code",
  },
  {
    id: "cursor",
    name: "Cursor",
    url: "https://www.cursor.com",
    icon: "https://www.cursor.com/favicon.ico",
    category: "code",
  },
  // Productivity
  {
    id: "siliconflow",
    name: "SiliconFlow",
    url: "https://siliconflow.cn",
    icon: "https://siliconflow.cn/favicon.ico",
    category: "productivity",
  },
  {
    id: "dify",
    name: "Dify",
    url: "https://dify.ai",
    icon: "https://dify.ai/favicon.ico",
    category: "productivity",
  },
  {
    id: "flowith",
    name: "Flowith",
    url: "https://flowith.io",
    icon: "https://flowith.io/favicon.ico",
    category: "productivity",
  },
  {
    id: "uniquest-feedback",
    name: "Feedback",
    url: "https://feedback.uniquest.top",
    icon: "https://feedback.uniquest.top/favicon.ico",
    category: "productivity",
  },
];
