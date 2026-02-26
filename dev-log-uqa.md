# UQA 集成开发日志

## 2026-02-26 (UTC+8 06:06) — 提交流程重构：去除 API 依赖，改为纯前端本地计算

### 问题根因

| # | 问题 | 根因 |
|---|------|------|
| 1 | 点击"查看诊断结果"无反应 | `canSubmit = answered === TOTAL`（52题全部作答才解锁），按钮处于 `disabled` 状态，点击无任何响应 |
| 2 | 即使全部作答，提交仍失败 | `handleSubmit` 调用 `POST /api/uqa/assessments`，后端需要鉴权；token 无效或中间件未正确解析时返回 401，错误提示渲染在开放性问题区块**上方**，用户滚动到提交按钮时看不到 |
| 3 | 架构过重 | 结果数据已在前端算好，却要发给后端存储 → 拿 ID → 再拉取展示，完全没必要 |

### 重构方案：纯前端流程

```
问卷页答题 → 本地计算分数 → 存入 sessionStorage → 跳转 /uqa/result → 结果页读 sessionStorage 展示
```

不再依赖后端 API，不需要鉴权，结果可导出为 PDF/图片。

### 变更文件

| 文件 | 变更说明 |
|------|---------|
| `app/src/routes/UqaQuestionnaire.tsx` | 移除 `createAssessment` 导入；`handleSubmit` 改为同步函数：本地计算 `scoresByCategory` + `totalScore` + `suggestions`，序列化存入 `sessionStorage("uqa_result")`，直接 `navigate("/uqa/result")`；移除 `submitting` / `error` state |
| `app/src/routes/UqaResult.tsx` | 移除 `useParams` / `getAssessmentDetail` API 调用；改为 `useEffect` 读取 `sessionStorage("uqa_result")` 并解析；无数据时显示"请先完成问卷"引导页；其余展示逻辑（动画计数器、雷达图、维度卡片、导出）完全保留 |
| `app/src/router.tsx` | `/uqa/result/:id` → `/uqa/result`（去掉动态参数）；`uqa-questionnaire` 和 `uqa-result` 路由移除 `AuthRequired` 包裹 |

### 保持不变

- 后端 `uqa/` 代码（controller、service、router）未修改，API 仍可用于未来的"保存到账户"功能
- `app/src/api/uqa.ts` 未修改，`createAssessment` 保留供后续可选保存
- 所有样式、动画、组件接口均未变动

---

## 2026-02-26 (UTC+8 05:52) — 共享样式提取 + 按钮修复 + API 鉴权修复

### 任务：提取共享样式、修复选项按钮渲染、修复 API 鉴权格式

#### 问题诊断（续）

| # | 问题 | 根因 |
|---|------|------|
| 1 | `.uqa-page-header` / `.uqa-inner` 仅在 landing 页定义 | 问卷页和结果页缺少这两个共享样式，导致 header 和内容居中失效 |
| 2 | 选项按钮无样式（浏览器默认 `<button>` 外观） | 缺少 `appearance: none` / `-webkit-appearance: none` 等按钮重置属性 |
| 3 | 维度标签显示 `energy/7` 而非 `1/7` | 使用了 `currentDimension.id`（字符串）而非数组索引 |
| 4 | 选项文字无间距（`1完全不符合`） | `QuestionCard` 中 score 和 label 之间缺少空格 |
| 5 | API 提交 404 | UQA API 拦截器添加 `Bearer ` 前缀，但主应用发送裸 token；且读取 `uqa_token` 回退键无意义 |

#### 变更文件

| 文件 | 变更说明 |
|------|---------|
| `app/src/assets/pages/uqa-common.less` | **新建** — 提取 `.uqa-page-header`（sticky header + back-btn + page-title + header-action-btn）和 `.uqa-inner`（max-width 720px 居中容器）为共享样式 |
| `app/src/assets/pages/uqa-landing.less` | 移除内联共享样式，改为 `@import "./uqa-common.less"` |
| `app/src/assets/pages/uqa-questionnaire.less` | 添加 `@import "./uqa-common.less"`；`.option` 按钮增加 `appearance: none` / `font-size: inherit` / `color: inherit` / `outline: none` / `box-sizing: border-box` 重置；移动端 `.option` 增加 `min-height: 44px` 触控目标 |
| `app/src/assets/pages/uqa-questionnaire-result.less` | 添加 `@import "./uqa-common.less"` |
| `app/src/components/uqa/QuestionCard.tsx` | 添加 `role="radiogroup"` / `role="radio"` + `aria-checked` 无障碍属性；选项文字改为 `{score} {LABELS[score-1]}`（加空格） |
| `app/src/routes/UqaQuestionnaire.tsx` | 维度标签从 `currentDimension.id` → `DIMENSIONS.indexOf(currentDimension) + 1` |
| `app/src/api/uqa.ts` | 移除 `Bearer ` 前缀（匹配主应用裸 token 格式）；移除 `uqa_token` 回退 |

#### 删除文件

| 文件 | 说明 |
|------|------|
| `app/src/assets/pages/uqa.less` | 旧版靛蓝色（`#6366f1`）样式，已被新设计语言替代 |

#### 验证

- `vite build` 通过（14759 modules，0 errors）
- Go 中间件 `ProcessAuthorization` 兼容裸 token（自动剥离 `Bearer ` 前缀）

---

## 2026-02-26 (UTC+8 05:12) — 响应式适配修复

### 任务：修复移动端 / 桌面端 UI 适配问题，保持设计语言一致

#### 问题诊断

| # | 问题 | 根因 |
|---|------|------|
| 1 | 页面内容溢出、无法滚动 | 三个页面均使用 `min-height: 100vh`，与 app shell 的 `.main` 容器（`height: calc(100% - var(--navbar-height)); overflow: hidden`）冲突 |
| 2 | 悬浮返回按钮遮挡 NavBar / ToolBar | `position: fixed` 按钮未考虑 app shell 的 NavBar（顶部）和 ToolBar（左侧/底部） |
| 3 | 题目选项完全无样式（截图可见） | `QuestionCard.tsx` 根 class 为 `question-card`，但 Less 选择器为 `.uqa-question-card` |
| 4 | 维度进度条不显示 | `DimensionCard.tsx` 使用 `dimension-progress-bar` / `dimension-progress-fill`，Less 选择器为 `.dimension-progress > .progress-bar-bg > .progress-bar-fill` |
| 5 | 桌面端内容左对齐、过宽 | Landing / Questionnaire 缺少 `max-width` 居中容器 |
| 6 | 结果页底部操作栏跨全屏宽度 | `position: fixed; left: 0; right: 0` 穿透到 ToolBar 下方 |
| 7 | 结果页下载按钮悬浮遮挡 | 同问题 2 |

#### 修复方案

采用 `miniapps-container` 布局模式：根容器 `width: 100%; height: 100%; overflow-y: auto`，页面自行管理滚动，不依赖 `100vh`。

#### 变更文件

| 文件 | 变更说明 |
|------|---------|
| `app/src/components/uqa/QuestionCard.tsx` | `className` 从 `question-card` → `uqa-question-card`；内部结构对齐 Less 选择器（`.question-text > .question-number + .question-content`，`.options > .option > .radio-circle + .option-label`） |
| `app/src/components/uqa/DimensionCard.tsx` | 进度条 class 从 `dimension-progress-bar` / `dimension-progress-fill` → `.dimension-progress > .progress-bar-bg > .progress-bar-fill` |
| `app/src/routes/UqaLanding.tsx` | 移除 `.floating-back-btn`，改为 `.uqa-page-header`（in-flow sticky header）；内容包裹 `.uqa-inner`（max-width 居中） |
| `app/src/routes/UqaQuestionnaire.tsx` | 同上：`.uqa-page-header` + `.uqa-inner` 包裹 |
| `app/src/routes/UqaResult.tsx` | 移除悬浮返回 + 下载按钮，改为 `.uqa-page-header`（含 `.header-action-btn`）；底部操作栏从 `fixed` → `sticky`；loading / error 状态也使用新 header |
| `app/src/assets/pages/uqa-landing.less` | 重写：根容器 `100% × 100% + overflow-y: auto`；`.uqa-page-header` sticky；`.uqa-inner` max-width 720px 居中；移动端 `@media (max-width: 480px)` 适配 |
| `app/src/assets/pages/uqa-questionnaire.less` | 重写：同上布局模式；`.uqa-question-card` 选项样式含 `.radio-circle > .radio-dot`；桌面端 `@media (min-width: 600px)` 横排选项；保留 shimmer / slide 动画 |
| `app/src/assets/pages/uqa-questionnaire-result.less` | 重写：同上布局模式；`.result-actions` 改为 `sticky + backdrop-filter: blur(8px)` + max-width 720px；保留 ActionSheet / fadeInUp 动画 / print 样式 |

#### 保持不变

- 路由、API、数据定义、RadarChart 组件均未修改
- 设计语言（`#00C476` 主色、20px 圆角卡片、shimmer 进度条、动画计数器 + SVG 圆环）完全保留

---

## 2026-02-26 (UTC+8 04:55) — 样式移植

### 任务：将 `临时/` 目录中的富样式 `.less` 移植到主项目

#### 设计语言变更

| 项目 | 旧版 | 新版 |
|------|------|------|
| 主色调 | `#6366f1`（靛蓝） | `#00C476`（绿色） |
| 返回按钮 | 文字链接 | 固定悬浮圆形按钮 |
| 卡片风格 | 简单边框 | 圆角 20px + 阴影 |
| 进度条 | 4px 细条 | 8px + shimmer 动画 |
| 结果页 | 静态分数 | 动画计数器 + SVG 圆环 |

#### 变更文件

| 文件 | 变更说明 |
|------|---------|
| `app/src/assets/pages/uqa-landing.less` | 替换为渐变欢迎卡片 + 悬浮返回按钮样式 |
| `app/src/assets/pages/uqa-questionnaire.less` | 替换为进度卡片 + shimmer 动画 + 开放性问题样式 |
| `app/src/assets/pages/uqa-questionnaire-result.less` | 替换为报告标题卡片 + 总体评估 + 入场动画样式 |
| `app/src/routes/UqaLanding.tsx` | 使用新 class 名（`.uqa-landing-page`），加 lucide 图标 |
| `app/src/routes/UqaQuestionnaire.tsx` | 使用新 class 名（`.uqa-questionnaire-page`），新增开放性问题区块 |
| `app/src/routes/UqaResult.tsx` | 使用新 class 名（`.uqa-result-page`），加动画分数计数器 + 区域统计 |

#### 保持不变

- 路由：`/uqa`、`/uqa/questionnaire`、`/uqa/result/:id`
- API：`listAssessments`、`createAssessment`、`getAssessmentDetail`
- 组件接口：`QuestionCard`、`DimensionCard`、`RadarChart` 均未修改
- 数据：`QUESTIONS`、`DIMENSIONS`、`getDimensionZone` 均未修改

---


## 2026-02-25 (UTC+8 04:37)

### 任务：将 `uqa-standalone` 集成到主项目，入口放在小程序面板

#### 后端变更

- **`uqa/types.go`** — 重写。`SubmitRequest` 改为接受前端预计算格式 `{ total_score, report: { scoresByCategory, suggestions } }`，移除旧的 `Answers []int` / `OpenAnswers []string`
- **`uqa/service.go`** — 重写。`SaveAssessment` 直接序列化 `ReportBody` 存入 DB；新增 `ListAssessments`、`GetAssessment`
- **`uqa/controller.go`** — 重写。使用主项目标准模式（`utils.GetDBFromContext` + `auth.GetUserByName`），修复函数名 `GetByIDHandler`

#### 前端新增文件

| 文件 | 说明 |
|------|------|
| `app/src/data/uqa-questions.ts` | 52 道题、7 个维度定义、`getDimensionZone()` |
| `app/src/components/uqa/QuestionCard.tsx` | 单题卡片（5 分制） |
| `app/src/components/uqa/RadarChart.tsx` | 纯 SVG 七维雷达图 |
| `app/src/components/uqa/DimensionCard.tsx` | 维度得分卡（进度条 + 区域标签 + 解读） |
| `app/src/components/ui/action-sheet.tsx` | 底部操作菜单 + `useActionSheet` hook |
| `app/src/utils/pdfExport.ts` | PDF/图片导出（浏览器打印方案） |

#### 前端更新文件

| 文件 | 说明 |
|------|------|
| `app/src/api/uqa.ts` | 完整类型 + `createAssessment` / `listAssessments` / `getAssessmentDetail` |
| `app/src/routes/UqaLanding.tsx` | 首页（七维介绍 + 历史记录） |
| `app/src/routes/UqaQuestionnaire.tsx` | 52 题问卷（逐题 + 本地计分 + 提交） |
| `app/src/routes/UqaResult.tsx` | 结果报告（雷达图 + 七维卡片 + 导出） |
| `app/src/assets/pages/uqa-landing.less` | 首页样式（替换旧 CSS） |
| `app/src/assets/pages/uqa-questionnaire.less` | 问卷样式（含 QuestionCard） |
| `app/src/assets/pages/uqa-questionnaire-result.less` | 结果页样式（含 DimensionCard、ActionSheet） |

#### 删除文件

- `app/src/routes/UqaLanding.css`
- `app/src/routes/UqaQuestionnaire.css`
- `app/src/routes/UqaResult.css`

#### 已有文件（无需修改）

- `app/src/router.tsx` — 三条 UQA 路由已存在（`/uqa`、`/uqa/questionnaire`、`/uqa/result/:id`），均受 `AuthRequired` 保护
- `app/src/components/miniapps/apps.ts` — `uqa` 条目已存在，`route: "/uqa"`
- `uqa/router.go` — 路由注册无变化
- `main.go` — `uqa.Register(app)` 已注册
