# UQA 响应式适配修复方案

## 问题诊断

### 核心问题：页面未适配 App Shell 布局

所有 UQA 页面都作为 `<Outlet />` 渲染在 `.main` flex 容器内（`height: calc(100% - var(--navbar-height))` + `overflow: hidden`），但页面样式使用了 `min-height: 100vh` + `padding-top: 80px`，导致：

- 内容溢出容器，无法正常滚动
- 桌面端内容偏左，未居中
- 悬浮返回按钮与 NavBar / ToolBar 重叠

### 具体 Bug 清单

| # | 问题 | 影响 |
|---|------|------|
| 1 | `QuestionCard.tsx` 使用 `className="question-card"`，CSS 选择器为 `.uqa-question-card` | 选项按钮完全无样式，显示为纯文本 |
| 2 | `DimensionCard.tsx` 使用 `.dimension-progress-bar` / `.dimension-progress-fill`，CSS 选择器为 `.dimension-progress > .progress-bar-bg > .progress-bar-fill` | 进度条不显示 |
| 3 | 三个页面均使用 `min-height: 100vh`，在 app shell 内溢出 | 滚动异常 |
| 4 | `padding-top: 80px` 为悬浮按钮预留空间，但 app 已有 NavBar | 顶部大量空白 |
| 5 | `position: fixed` 悬浮按钮在 `top: 16px; left: 16px` | 与 NavBar 和 ToolBar 重叠 |
| 6 | Landing 和 Questionnaire 页无 `max-width` 容器 | 桌面端内容偏左不居中 |
| 7 | Result 页底部操作栏 `position: fixed; left: 0; right: 0` | 覆盖 ToolBar 区域 |

## 修复策略

### 原则

- 保持现有设计语言（绿色主色调、圆角 20px 卡片、shimmer 动画等）
- 遵循 app shell 的布局模式（参考 `miniapps-container` 的做法）
- 桌面端居中 + 合理最大宽度，移动端全宽
- 用 in-flow 页面头部替代 fixed 悬浮按钮

### 文件变更清单

#### 1. 组件 class 修复

- `QuestionCard.tsx` — `"question-card"` → `"uqa-question-card"`
- `DimensionCard.tsx` — 统一 progress bar 的 class 名与 CSS 选择器

#### 2. 三个 Less 文件重构

共同变更：
- 根容器：`min-height: 100vh` → `width: 100%; height: 100%; overflow-y: auto;`
- 移除 `padding-top: 80px`
- 移除 `.floating-back-btn` 的 fixed 定位样式
- 添加 `.uqa-inner`（max-width: 720px; margin: 0 auto; padding: 1.5rem）
- 添加桌面端媒体查询优化间距
- 添加移动端 portrait 媒体查询适配

#### 3. 三个 TSX 文件重构

共同变更：
- 移除悬浮返回按钮，改为页面顶部 in-flow header bar（返回按钮 + 页面标题）
- 包裹内容在 `.uqa-inner` 容器中实现居中
- Result 页底部操作栏改为 sticky 定位或 in-flow

#### 4. 桌面端增强

- Result 页：总体评估 + 雷达图在宽屏下并排显示
- Questionnaire 页：题目卡片居中，合理最大宽度
- Landing 页：历史记录卡片网格布局

## 架构示意

```
Before:
┌─NavBar──────────────────────────┐
│┌─ToolBar─┐┌─Outlet────────────┐│
││         ││ [fixed back btn]   ││  ← 重叠
││         ││ padding-top: 80px  ││  ← 空白
││         ││ min-height: 100vh  ││  ← 溢出
││         ││ content...         ││
│└─────────┘└────────────────────┘│
└─────────────────────────────────┘

After:
┌─NavBar──────────────────────────┐
│┌─ToolBar─┐┌─Outlet────────────┐│
││         ││ [in-flow header]   ││
││         ││ ┌─.uqa-inner─────┐ ││
││         ││ │ max-w: 720px   │ ││
││         ││ │ centered cards │ ││
││         ││ └────────────────┘ ││
││         ││ overflow-y: auto   ││
│└─────────┘└────────────────────┘│
└─────────────────────────────────┘
```
