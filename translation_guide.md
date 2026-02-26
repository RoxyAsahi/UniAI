# 🚀 翻译页面开发指南 (Translate Page Development Guide)

**创建时间：** 2026年2月24日 07:27:40 (基于当前系统时间)

---

## 🎯 核心技术栈概览

该页面将采用 React + Redux + Tailwind CSS + Radix UI 定制组件的架构，以确保与现有项目风格一致性。

- **框架：** React 18 + Vite
- **路由：** React Router v6 (`react-router-dom`)
- **样式：** Tailwind CSS (优先) + Less (用于全局/页面级定制，如 `app/src/assets/pages/translate.less`)
- **UI 组件库：** 基于 Radix UI 的定制组件 (`app/src/components/ui/`)。
- **状态管理：** Redux Toolkit (`react-redux`)。
- **多语言：** i18next (`react-i18next`)，位于 `app/src/resources/i18n/`。
- **图标库：** Lucide React (`lucide-react`)。

## 📁 核心目录结构约定

所有新文件应放在 `app/src/` 下，并遵循以下约定：

- `routes/Translate.tsx`: 页面主容器。
- `components/translate/`: 存放该页面特有的子组件。
- `store/translate.ts`: **新的 Redux Slice**。

## 🛠️ 开发步骤与细节

### 阶段一：目录结构与路由注册

1.  **创建组件目录**：在 `app/src/components/` 下创建 `translate/` 目录。
    *   `TranslateToolbar.tsx`: 顶部操作栏。
    *   `TranslatePanel.tsx`: 双栏布局，处理输入/输出/滚动同步。
    *   `HistorySidebar.tsx`: 左侧历史记录侧边栏。
    *   `SettingsDialog.tsx`: 高级设置弹窗（Prompt, 自定义语言）。
    *   `SettingsPopover.tsx`: 快速设置气泡（开关项）。
2.  **创建页面主容器**：
    *   创建 `app/src/routes/Translate.tsx`。
3.  **路由注册** (修改 `app/src/router.tsx`)：
    *   **引入**：使用 `lazyFactor` 引入 `Translate.tsx`。
    *   **配置**：在主路由子项中添加 `/translate` 路由，使用 `Suspense` 包裹。
4.  **导航栏集成** (修改 `app/src/routes/Index.tsx`)：
    *   在 `ToolBar` 中添加一个使用 `Languages` (或类似图标) 的 `BarItem`，`path` 为 `/translate`，`name` 为 `translate`。

### 阶段二：状态管理 (Redux Store)

**文件**：`app/src/store/translate.ts` (需新建并导入 `index.ts`)。

**核心状态 (`TranslateState`) 结构**：

```typescript
interface TranslateState {
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  isTranslating: boolean;
  
  settings: {
    markdownPreview: boolean;
    autoCopy: boolean;
    syncScroll: boolean;
    detectMethod: 'auto' | 'algorithm' | 'llm';
    bidirectional: boolean;
    systemPrompt: string; // 翻译指令
  };
  
  customLanguages: Array<{ emoji: string, name: string, code: string }>;
  history: Array<{
    id: string;
    sourceLang: string;
    targetLang: string;
    sourceText: string;
    targetText: string;
    timestamp: number;
  }>;
}
```
*状态持久化：`history` 和 `settings` 应使用 `localforage` 或 `localStorage` 进行持久化。*

### 阶段三：核心 UI 组件开发与标准保持

**项目标准保持**：
1.  **样式**：优先使用 **Tailwind CSS**。参考 `Wallet.tsx` 中的 `motion` 和 `cn()` 调用。
2.  **组件复用**：大量使用 `app/src/components/ui/` 下的组件，例如 `Select`, `Dialog`, `ScrollArea`。

**UI 细节实现**：

1.  **顶部工具栏 (`TranslateToolbar.tsx`)**：
    *   使用 `Select` 组件实现语言选择。
    *   使用 `ArrowRightLeft` 图标按钮进行语言交换（派发 Redux Action）。
    *   集成现有的模型选择组件（如图五所示）来选择翻译模型。
2.  **双栏主面板 (`TranslatePanel.tsx`)**：
    *   使用 Grid 或 Flexbox 分割左右面板。
    *   **输入**：自定义 `<Textarea>` (注意字数统计/清除)。
    *   **输出**：如果 `markdownPreview` 开启，使用 `react-markdown` 渲染，否则渲染纯文本。
    *   **滚动同步**：实现 `onScroll` 事件监听，通过计算百分比同步两个面板的 `scrollTop`。
3.  **历史记录侧边栏 (`HistorySidebar.tsx`)**：
    *   使用 `Sheet` 或 `Drawer` 组件实现侧滑效果。
    *   顶部包含搜索框，用于过滤 `history` 状态。
    *   点击历史项：派发 Action 覆盖当前的输入/输出状态。
4.  **设置面板 (`SettingsDialog.tsx`)**：
    *   包含图三所示的**翻译提示词编辑区**（一个高亮边框的 `Textarea`）。
    *   包含**自定义语言管理表格**。
5.  **快速设置气泡 (`SettingsPopover.tsx`)**：
    *   包含 `Switch` 组件用于控制布尔设置（如自动复制、同步滚动）。
    *   使用 `ToggleGroup` 用于切换“自动检测方法”。

### 阶段四：翻译核心逻辑对接

1.  **API 封装**：创建或修改 `app/src/api/translation.ts` 来封装调用后端翻译服务 (类似 `/v1/chat/completions`) 的逻辑。
2.  **Prompt 组装**：根据 `systemPrompt` 和当前语言，动态构建发送给 LLM 的结构，替换 `{{targetLang}}` 等占位符。
3.  **流式处理**：实现从后端获取流式数据并**增量更新**到 `targetText` 状态，以实现实时翻译效果。
4.  **后置操作**：翻译完成后，执行“自动复制”和将本次会话存入 `history`。

### 阶段五：国际化 (i18n) 适配

在 `app/src/resources/i18n/` 目录下的所有语言文件 (如 `cn.json`, `en.json`) 中添加 `translate` 命名空间下的所有文本键值，以确保新页面的国际化支持。

---

### ⚖️ 总结与下一步

此计划详细覆盖了从架构设计到具体 UI 实现的标准和步骤。下一步将是**代码实现**。