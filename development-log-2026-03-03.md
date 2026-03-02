# 开发日志（2026-03-03）

## 本次目标
- 新增第二套主页样式并支持在设置中切换。
- 保留已有“对话模式”首页（输入框在底部）。
- 新增“默认模式”首页（输入框在中间）。
- 复用现有输入组件、建议提示逻辑与发送流程，降低维护成本。

## 主要完成内容

### 1. 首页样式双模式
- 新增 `ChatPlaceholder` 双模式渲染：
  - `default`：中间输入框、标题更突出、建议列表更贴近首屏信息流。
  - `chat`：沿用当前对话式占位页（输入框在底部）。
- 保持建议提示点击填充输入框、输入过滤建议、换一组等交互。

### 2. 设置项新增
- 在 `settings` store 新增 `homepage_mode`：
  - 枚举：`default | chat`
  - 默认值：`default`
  - 本地持久化：`localStorage(homepage_mode)`
- 在设置弹窗中新增 `Homepage Style` 选择器：
  - `Default`
  - `Chat`

### 3. ChatWrapper 接入切换逻辑
- 空会话时按 `homepage_mode` 决定展示方式：
  - `default`：输入框居中（内嵌在占位页）。
  - `chat`：输入框在底部。
- 有消息时始终使用底部输入框，保持正式对话流体验一致。

### 4. 样式体系扩展
- 新增占位页模式样式：
  - `.chat-placeholder.mode-default`
  - `.chat-placeholder.mode-chat`
- 新增中间输入框样式：
  - `.chat-input-inline`
- 完成移动端与暗色模式对应适配。

## 验证情况
- TypeScript 校验：`npx tsc --noEmit` 通过。
- 说明：仓库内已有历史 lint 问题较多，本次以类型检查通过为主。

## 涉及核心文件
- `app/src/components/home/ChatPlaceholder.tsx`
- `app/src/components/home/ChatWrapper.tsx`
- `app/src/store/settings.ts`
- `app/src/dialogs/SettingsDialog.tsx`
- `app/src/assets/pages/home.less`

## 备注
- 本次提交按“工作区全部改动”统一打包上传。

---

## 追加记录（侧栏历史与工程稳定性改造）

### 本次目标
- 对齐 open-webui 风格，完善历史记录栏与文件夹能力。
- 优先完成文件夹/会话拖拽体验升级。
- 修复开发环境中影响联调的代理与 TypeScript 配置问题。

### 主要完成内容

#### 1. 历史记录与文件夹功能增强
- 侧栏历史分组展示（Today / Yesterday / Previous 7 days / Previous 30 days / 月份分组）。
- 历史懒加载与滚动加载更多。
- 侧栏分组折叠状态持久化。
- 侧栏宽度拖拽调整（含默认/最小/最大值）与本地持久化。
- 移动端边缘滑动开关侧栏。
- 快捷键支持（搜索聚焦、新建会话）。
- 文件夹展开状态持久化、文件夹菜单增强、文件夹会话操作完善。

#### 2. 拖拽体系升级（P2）
- 将核心拖拽从 `react-beautiful-dnd` 迁移到 `dnd-kit`。
- 新增统一 DnD ID 工具：
  - `app/src/components/home/sidebarDnd.ts`
- 迁移文件：
  - `app/src/components/home/SideBar.tsx`
  - `app/src/components/folder/FolderItem.tsx`
  - `app/src/routes/admin/Market.tsx`
- 依赖替换：
  - 新增 `@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`
  - 移除 `react-beautiful-dnd` 与对应类型包

#### 3. 开发环境稳定性修复
- 修复 `globals.less` 中导致 Tailwind 处理失败的问题（改为直接 CSS 变量样式）。
- 修复 `main.tsx` 重复引导初始化（重复导入 `bootstrap`）。
- 扩展并加固 Vite 开发代理，覆盖 `/conversation`、`/info`、`/broadcast` 等直连接口。
- 调整代理目标默认值为 `http://127.0.0.1:8094`，减少本机 `localhost` 解析不稳定影响。
- 调整 `.air.toml` 监听范围，排除 `app/` 与 `blob-service/`，避免后端因前端依赖变化频繁重启。

#### 4. TypeScript 问题修复
- 修复 `tsconfig` 引用关系引发的 `TS6305/TS6307` 问题。
- 修复两个已有类型报错：
  - `app/src/routes/admin/Logger.tsx`（类型名冲突）
  - `app/src/routes/Model.tsx`（`motion.div` 事件类型冲突）

### 验证情况
- `npx tsc --noEmit` 通过。
- `go test ./manager/conversation/...` 通过。
- `npm run build` 的类型检查和打包流程通过；Windows 下 `dist` 被占用时可能出现 `EBUSY`（环境文件锁问题）。

### 涉及核心文件
- `app/src/components/home/SideBar.tsx`
- `app/src/components/home/ConversationItem.tsx`
- `app/src/components/home/sidebarDnd.ts`
- `app/src/components/folder/FolderItem.tsx`
- `app/src/components/folder/FolderTree.tsx`
- `app/src/components/folder/FolderContextMenu.tsx`
- `app/src/routes/admin/Market.tsx`
- `app/src/assets/pages/home.less`
- `app/src/assets/globals.less`
- `app/vite.config.ts`
- `app/tsconfig.json`
- `app/tsconfig.node.json`
- `.air.toml`
