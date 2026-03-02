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
