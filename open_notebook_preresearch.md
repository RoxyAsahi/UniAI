# Open Notebook × CoAI 融合预研报告

> 生成时间：2026-02-26  
> 目标：评估将 [open-notebook](https://github.com/lfnovo/open-notebook) 的核心能力融合进 CoAI 的可行性与路径

---

## 一、两个项目的定位对比

| 维度 | CoAI | Open Notebook |
|------|------|---------------|
| 核心定位 | 多模型 AI 聊天 + API 分发平台 | 私有化 Notebook LM 替代品（知识库 + 播客） |
| 后端语言 | Go (Gin) | Python (FastAPI / LangChain) |
| 前端 | React + Redux + Tailwind | Next.js + React |
| 数据库 | MySQL + Redis | SurrealDB（向量 + 全文搜索一体） |
| 用户模型 | 多租户 SaaS（计费、订阅、渠道管理） | 单用户 / 私有部署 |
| 文件处理 | PDF/Docx/图片解析（Blob Service） | PDF/视频/音频/网页（LangChain loader） |
| 向量搜索 | ❌（Pro 版有 RAG，开源版无） | ✅ SurrealDB 向量索引 + LangChain |
| 播客生成 | ❌ | ✅ 多说话人 TTS 播客 |
| 内容变换 | ❌ | ✅ 自定义 Transformation（摘要/问答/思维导图等） |
| REST API | ✅ OpenAI 兼容代理 | ✅ 完整 REST API |

---

## 二、Open Notebook 的核心能力拆解

Open Notebook 的价值主要集中在以下 4 个模块：

### 2.1 Source 管理（多模态内容摄入）
- 支持 PDF、YouTube 视频、音频、网页 URL、纯文本
- 每个 Source 自动提取文本、分块、向量化
- 存入 SurrealDB，支持全文 + 向量混合检索

### 2.2 Notebook（知识库）
- 一个 Notebook = 多个 Source + 多个 Note
- 基于 Notebook 内容做 RAG 对话
- 支持跨 Source 的语义搜索

### 2.3 Content Transformation（内容变换）
- 对 Source 内容执行预定义或自定义 Prompt
- 输出：摘要、关键词、问答对、思维导图、学习卡片等
- 结果保存为 Note，可再次引用

### 2.4 Podcast 生成
- 基于 Notebook 内容生成多说话人播客脚本
- 支持 1-4 个说话人，自定义人物设定
- TTS 合成音频文件

---

## 三、融合策略分析

### 策略 A：微服务挂载（推荐 ⭐⭐⭐⭐⭐）

```
┌─────────────────────────────────────────────────────┐
│                    CoAI 前端 (React)                 │
│  现有功能  │  新增：Notebook 页面 / RAG 对话 / 播客  │
└────────────────────────┬────────────────────────────┘
                         │ HTTP / WebSocket
          ┌──────────────┴──────────────┐
          │      CoAI 后端 (Go)          │
          │  - 用户认证 / 计费 / 渠道    │
          │  - 新增：Notebook API 代理   │
          └──────────────┬──────────────┘
                         │ REST API
          ┌──────────────┴──────────────┐
          │  Open Notebook API (Python)  │
          │  - Source 摄入 & 向量化      │
          │  - RAG 检索 & 对话           │
          │  - Transformation            │
          │  - Podcast 生成              │
          └──────────────┬──────────────┘
                         │
          ┌──────────────┴──────────────┐
          │         SurrealDB            │
          │  (向量索引 + 全文搜索)        │
          └─────────────────────────────┘
```

**优点**：
- 零侵入 CoAI 核心代码，风险最低
- Open Notebook 独立迭代，不影响 CoAI 稳定性
- Python 生态（LangChain / Whisper / TTS）直接复用
- Docker Compose 一键扩展

**缺点**：
- 多一个服务进程，运维复杂度略增
- 跨服务调用有网络开销（内网可忽略）
- 用户认证需要打通（JWT 共享或 API Key 传递）

---

### 策略 B：功能移植到 Go（不推荐）

将 Open Notebook 的 Python 逻辑用 Go 重写：
- LangChain → Go 版向量处理库（如 `tmc/langchaingo`）
- SurrealDB → 替换为 pgvector（PostgreSQL 扩展）
- TTS 播客 → 调用外部 TTS API

**问题**：
- 工作量极大（LangChain 生态在 Go 中不成熟）
- 播客生成依赖 Python 的 pydub / TTS 库，Go 无等价物
- 维护两套逻辑，长期成本高

---

### 策略 C：iframe / 独立子域名（最简单但体验差）

直接在 CoAI 前端嵌入 Open Notebook 的 Next.js 页面：
- 优点：零开发成本
- 缺点：UI 风格割裂，无法共享用户状态，体验差

---

## 四、推荐融合路径（策略 A 详细方案）

### Phase 1：基础接入（1-2 周）

1. **Docker Compose 扩展**：在 `docker-compose.yaml` 中新增 `open_notebook` 和 `surrealdb` 服务
2. **Go 代理层**：在 CoAI 后端新增 `/api/notebook/*` 路由，透传到 Open Notebook API（附带用户身份）
3. **前端入口**：在 CoAI 侧边栏新增"知识库"入口，路由到新页面

### Phase 2：深度集成（2-4 周）

4. **统一认证**：Open Notebook API 调用时携带 CoAI 的 JWT，Go 层做鉴权后转发
5. **RAG 对话集成**：在 CoAI 聊天界面新增"引用知识库"开关，发送消息时先检索相关 Source，拼入 context
6. **模型路由**：Open Notebook 的 LLM 调用通过 CoAI 的渠道管理路由（复用计费逻辑）

### Phase 3：功能增强（可选）

7. **Transformation 市场**：将 Open Notebook 的 Transformation 模板集成到 CoAI 的预设市场
8. **播客生成**：在 CoAI 前端新增播客生成页面
9. **计费接入**：对 RAG 检索、播客生成等操作接入 CoAI 的弹性计费

---

## 五、技术风险评估

| 风险点 | 等级 | 说明 |
|--------|------|------|
| SurrealDB 运维 | 中 | 新增一个数据库，需要备份策略 |
| Python 服务稳定性 | 低 | Open Notebook 已有 Docker 镜像，生产可用 |
| 认证打通 | 中 | 需要在 Go 层实现 API Key 传递或 JWT 共享 |
| 模型调用计费 | 中 | Open Notebook 直接调用 LLM，需要改造为通过 CoAI 渠道 |
| 播客 TTS 成本 | 高 | 多说话人 TTS 调用费用较高，需要限流或按量计费 |

---

## 六、最小可行集成（MVP）建议

如果只想快速验证价值，建议先做：

1. **知识库上传**：支持 PDF/网页 URL 上传，自动向量化
2. **RAG 对话**：在聊天时可选择"基于知识库回答"
3. **内容摘要**：对上传的文档一键生成摘要

这三个功能覆盖了 Open Notebook 80% 的核心价值，且与 CoAI 现有的文件解析能力（Blob Service）有天然的衔接点。

---

## 七、结论

**可行性：高**。两个项目的定位互补，Open Notebook 提供了 CoAI 开源版缺失的 RAG 知识库能力。

**推荐方案**：微服务挂载（策略 A），以 Docker Compose 方式将 Open Notebook 作为 CoAI 的知识库微服务，Go 后端做代理和鉴权，前端新增知识库页面。

**预估工作量**：
- Phase 1（基础接入）：1-2 周，1 名全栈工程师
- Phase 2（深度集成）：2-4 周，1 名后端 + 1 名前端
- Phase 3（功能增强）：按需迭代

**下一步行动**：
1. 本地跑通 Open Notebook 的 Docker 环境，验证 API 可用性
2. 评估 SurrealDB 的运维成本（是否可替换为已有的 MySQL + pgvector）
3. 确定 MVP 功能范围，开始 Phase 1 开发
