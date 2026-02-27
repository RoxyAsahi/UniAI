# 开发手册 — 预设（Mask）点击行为修复

## 背景

用户点击预设市场中的预设卡片后，会触发以下问题：

1. **无限转圈**：左侧历史记录栏出现带 emoji 和名称的预设条目，但旁边一直显示加载动画（Loader2 转圈），永不消失。
2. **Emoji 消失**：发送第一条消息后，预设条目的 emoji 图标消失，变成普通的聊天历史条目。
3. **切换后消失**：点击其他历史记录后，预设条目从侧边栏消失。
4. **再次点击跳转空页**：再次点击预设条目时，跳转到公告/空白页面（"暂无公告，了解更多"），而不是预设聊天界面。

---

## 根本原因分析

### 问题一：无限转圈

文件：[`app/src/components/home/ConversationItem.tsx`](app/src/components/home/ConversationItem.tsx)

```tsx
// 原代码
const loading = conversation.id <= 0;
```

预设触发后，历史记录中会插入一条 `id: -1` 的"预飞"（preflight）条目。由于 `id <= 0` 为 `true`，`loading` 永远为 `true`，转圈永不停止。

### 问题二：Emoji 消失（发送消息后）

文件：[`app/src/store/chat.ts`](app/src/store/chat.ts) — `receive()` 函数

发送第一条消息后，服务端分配真实会话 ID，`receive()` 执行以下流程：

```
raiseConversation(target)  ← 将 conversations[-1] 移动到 conversations[target]
refresh()                  ← 从服务端拉取会话列表（服务端不含 avatar 字段）
setHistory(serverData)     ← 用服务端数据替换历史，avatar 丢失
```

同时，`setHistory` reducer 会保留 `id: -1` 的 preflight 条目，导致侧边栏出现两条记录：一条是残留的 preflight（带 emoji），一条是真实会话（无 emoji）。

### 问题三：切换后消失 & 问题四：再次点击跳转空页

文件：[`app/src/store/chat.ts`](app/src/store/chat.ts) — `toggle()` 函数

```typescript
// 原代码中的两个副作用
if (current === -1 && conversations[-1].messages.length === 0) {
  mask && dispatch(clearMaskItem());  // 切换时清除 mask！
}
if (id > 0) {
  dispatch(removePreflight());  // 切换到真实会话时删除 preflight 条目！
}
```

- **切换到其他会话**（`id > 0`）：`removePreflight()` 删除了 preflight 条目，`clearMaskItem()` 清除了 mask 状态。
- **再次点击 preflight 条目**（`id = -1`，`current` 已是 `-1`）：同样触发 `clearMaskItem()`，mask 被清除，current 仍为 -1，结果显示空白页。

---

## 修复方案

### 修复一：去除无限转圈

**文件**：[`app/src/components/home/ConversationItem.tsx`](app/src/components/home/ConversationItem.tsx)

```tsx
// 修改后
const loading = false;
```

preflight 条目不需要加载动画，直接关闭。

---

### 修复二：Emoji 持久化

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

**新增 reducer** `updateHistoryAvatar`：

```typescript
updateHistoryAvatar: (state, action) => {
  const { id, avatar } = action.payload as { id: number; avatar: string };
  const entry = state.history.find((item) => item.id === id);
  if (entry) entry.avatar = avatar;
},
```

**修改 `receive()` 函数**：

```typescript
receive: async (id, message) => {
  dispatch(updateMessage({ id, message }));
  if (id === -1 && message.conversation) {
    const target = message.conversation;

    // 在 refresh() 覆盖历史之前，先保存 preflight 的 avatar
    const preflightEntry = chatHistory.find((item) => item.id === -1);
    const maskAvatar = preflightEntry?.avatar;

    dispatch(raiseConversation(target));
    setNumberMemory("history_conversation", target);
    stack.raiseConnection(target);
    await refresh();

    // 清除残留的 preflight 条目
    dispatch(removePreflight());

    // 将 avatar 恢复到真实会话条目
    if (maskAvatar) {
      dispatch(updateHistoryAvatar({ id: target, avatar: maskAvatar }));
    }
  }
},
```

---

### 修复三：toggle() 不再清除 mask 和 preflight

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

```typescript
toggle: async (id: number) => {
  // id=-1 是 preflight 槽，直接切换，不从服务端加载
  if (id !== -1) {
    const conversation = conversations[id];
    setNumberMemory("history_conversation", id);
    if (!conversation) {
      const data = await loadConversation(id);
      dispatch(importConversation({ conversation: { model: data.model, messages: data.message }, id }));
    }
  }

  // 不在此处清除 mask 或删除 preflight。
  // mask 在用户发送消息时由 fillMaskItem() 清除，
  // 或由侧边栏 Paintbrush 按钮显式清除。
  dispatch(setCurrent(id));
},
```

---

### 修复四：侧边栏 Paintbrush 按钮显式退出 mask 模式

**文件**：[`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx)

新增导入：

```typescript
import {
  clearMaskItem,
  removePreflight,
  resetNewConversation,
  // ...其他原有导入
} from "@/store/chat.ts";
```

修改 + / Paintbrush 按钮的 `onClick`：

```tsx
onClick={async () => {
  if (current === -1 && mask) {
    // 显式退出 mask 模式
    dispatch(clearMaskItem());
    dispatch(removePreflight());
    dispatch(resetNewConversation());
  } else {
    await toggle(-1);
  }
  if (mobile) dispatch(setMenu(false));
}}
```

---

## 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| `app/src/components/home/ConversationItem.tsx` | `loading` 改为 `false`，去除 preflight 条目的转圈 |
| `app/src/store/chat.ts` | 新增 `updateHistoryAvatar` reducer；修复 `receive()` 保留 avatar；重写 `toggle()` 去除副作用 |
| `app/src/components/home/SideBar.tsx` | Paintbrush 按钮显式清除 mask 状态，不再依赖 `toggle()` 的副作用 |

---

## 行为说明（修复后）

| 操作 | 预期行为 |
|------|---------|
| 点击预设卡片 | 侧边栏顶部出现带 emoji 和名称的条目，无转圈，current=-1，mask 已设置 |
| 切换到其他会话 | 预设条目保留在侧边栏，mask 状态保留 |
| 再次点击预设条目 | 切回 current=-1，显示预设聊天界面（系统提示词预览） |
| 发送第一条消息 | 会话升级为真实 ID，emoji 保留在新条目上，preflight 条目消失 |
| 点击 Paintbrush 按钮 | 清除 mask 状态，删除 preflight 条目，回到普通新建对话模式 |

---

## 后续修复 — 延迟 Preflight（彻底消除闪烁）

### 问题描述

即使完成了上述所有修复，点击预设后侧边栏仍会出现一次闪烁：
- 点击预设 → 侧边栏立即出现带 emoji 的条目（preflight）
- 发送第一条消息、AI 回复后 → `upgradePreflight` 升级 ID → 后台 `refresh()` 触发 `setHistory` → 服务端自动重命名触发 `renameHistory`
- 每一步都会引起 React 重渲染，产生可见的闪烁

### 修复方案

**核心思路：将 preflight 条目的创建推迟到用户发送第一条消息时。**

点击预设时不再向侧边栏写入任何条目，只设置 `mask_item` 和 `current=-1`。
用户发送第一条消息时，才在 `send()` 里创建 preflight 条目（使用预设名字和 emoji）。

#### 修改一：`mask()` 不再调用 `preflightHistory`

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

```typescript
mask: (mask: Mask) => {
  dispatch(setMaskItem(mask));
  dispatch(resetNewConversation());
  dispatch(setCurrent(-1));
  // 不在此处创建 preflight 条目，推迟到 send() 执行时
  setNumberMemory("history_conversation", -1);
},
```

#### 修改二：`send()` 使用预设名字/emoji 创建 preflight

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

```typescript
if (current === -1 && conversations[-1].messages.length === 0) {
  const hasPreflight = chatHistory.some((item) => item.id === -1);
  if (!hasPreflight) {
    if (mask) {
      // 预设对话：使用预设名字和 emoji
      dispatch(preflightHistory({ name: mask.name, avatar: mask.avatar }));
    } else {
      // 普通新对话：使用用户输入的第一句话作为名字
      dispatch(preflightHistory({ name: message }));
    }
  }
}
```

### 行为说明（最终版 v2）

| 操作 | 预期行为 |
|------|---------|
| 点击预设卡片 | 直接跳转到聊天界面，侧边栏**不出现**任何新条目 |
| 发送第一条消息 | 侧边栏顶部出现带 emoji 和预设名字的条目 |
| AI 回复后 | 条目原地升级为真实 ID，emoji 和名字保持不变，无闪烁 |
| 后台 refresh() 完成 | setHistory 合并时保留 emoji 和名字，不覆盖 |
| 切换到其他会话 | 预设条目保留在侧边栏 |
| 点击 Paintbrush 按钮 | 清除 mask 状态，删除 preflight 条目（若已存在），回到普通新建对话模式 |

---

## 后续修复 — 预设名字消失 & 闪烁问题（历史记录）

### 问题描述

上述修复完成后，仍存在两个问题：

1. **预设名字消失**：发送第一条消息、AI 回复后，侧边栏条目的名字被服务端自动生成的标题替换，emoji 虽然保留，但预设名字丢失。
2. **闪烁**：即使恢复了名字，条目仍会短暂消失再出现（因为 `await refresh()` 先用服务端数据覆盖，再由后续 dispatch 恢复）。

---

### 根本原因分析

#### 原因一：旧闭包（Stale Closure）

文件：[`app/src/components/app/AppProvider.tsx`](app/src/components/app/AppProvider.tsx)

```typescript
useEffect(() => {
  stack.setCallback(async (id, message) => {
    await receive(id, message); // ← receive 是挂载时的旧闭包
  });
}, []); // ← 空依赖，只运行一次
```

`useEffect` 依赖数组为空，`stack.setCallback` 只在组件挂载时执行一次。此时 `chatHistory` 为空（预设条目尚未添加），导致 `receive()` 里永远找不到 preflight 条目，`maskAvatar` 始终为 `undefined`，恢复逻辑被跳过。

#### 原因二：`receive()` 未保留预设名字

文件：[`app/src/store/chat.ts`](app/src/store/chat.ts)

原 `receive()` 只捕获了 `maskAvatar`，未捕获 `maskName`，导致 `refresh()` 后名字被服务端标题覆盖。

#### 原因三：`await refresh()` 导致闪烁

`refresh()` 是异步的，`await` 期间 `setHistory(serverData)` 先把条目替换成服务端数据（无 emoji、错误名字），之后再由 `updateHistoryAvatar` + `renameHistory` 恢复，产生可见的闪烁。

---

### 修复方案

#### 修复一：用 `useRef` 解决旧闭包

**文件**：[`app/src/components/app/AppProvider.tsx`](app/src/components/app/AppProvider.tsx)

```typescript
const { receive } = useMessageActions();

// 每次渲染都更新 ref，确保 setCallback 里调用的始终是最新版本
const receiveRef = useRef(receive);
receiveRef.current = receive;

useEffect(() => {
  stack.setCallback(async (id, message) => {
    await receiveRef.current(id, message); // ← 始终最新
  });
}, []);
```

---

#### 修复二：新增 `upgradePreflight` reducer（消除闪烁）

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

```typescript
upgradePreflight: (state, action) => {
  // 原子地将 preflight 条目的 id 从 -1 升级为真实会话 id，
  // 保留 emoji 和预设名字，无中间状态，无闪烁。
  const id = action.payload as number;
  const idx = state.history.findIndex((item) => item.id === -1);
  if (idx !== -1) {
    state.history[idx] = { ...state.history[idx], id };
  }
},
```

---

#### 修复三：`setHistory` 合并时保留 avatar/name

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

```typescript
setHistory: (state, action) => {
  const newHistory = action.payload as ConversationInstance[];
  const preflight = state.history.find((item) => item.id === -1);
  // 保留已有条目的 avatar 和 name（针对有 emoji 的预设对话）
  // 确保后台 refresh() 不会覆盖掉 emoji 和预设名字
  const merged = newHistory.map((item) => {
    const existing = state.history.find((h) => h.id === item.id);
    if (!existing?.avatar) return item;
    return { ...item, avatar: existing.avatar, name: existing.name };
  });
  state.history = preflight ? [preflight, ...merged] : merged;
},
```

---

#### 修复四：`receive()` 对预设对话使用原子升级

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

```typescript
receive: async (id, message) => {
  dispatch(updateMessage({ id, message }));

  if (id === -1 && message.conversation) {
    const target = message.conversation;
    const preflightEntry = chatHistory.find((item) => item.id === -1);
    const maskAvatar = preflightEntry?.avatar;

    dispatch(raiseConversation(target));
    setNumberMemory("history_conversation", target);
    stack.raiseConnection(target);

    if (maskAvatar) {
      // 预设对话：原子升级，保留 emoji 和名字，无闪烁
      dispatch(upgradePreflight(target));
      refresh(); // 后台同步，不 await
    } else {
      // 普通对话：等待服务端列表，再清理 preflight
      await refresh();
      dispatch(removePreflight());
    }
  }
},
```

---

### 修改文件汇总（本次追加）

| 文件 | 修改内容 |
|------|---------|
| `app/src/components/app/AppProvider.tsx` | 用 `useRef` 保持 `receive` 始终最新，解决旧闭包问题 |
| `app/src/store/chat.ts` | 新增 `upgradePreflight` reducer；`setHistory` 合并时保留 avatar/name；`receive()` 对预设对话改用原子升级 + 后台刷新 |

---

### 行为说明（最终版）

| 操作 | 预期行为 |
|------|---------|
| 点击预设卡片 | 侧边栏顶部出现带 emoji 和预设名字的条目，无转圈 |
| 发送第一条消息，AI 回复后 | 条目原地升级为真实 ID，emoji 和预设名字保持不变，无闪烁 |
| 后台 refresh() 完成 | setHistory 合并时保留 emoji 和名字，不覆盖 |
| 切换到其他会话 | 预设条目保留在侧边栏 |
| 点击 Paintbrush 按钮 | 清除 mask 状态，删除 preflight 条目，回到普通新建对话模式 |

---

## 2026-02-26 — AnimatePresence 闪烁 & 刷新后 Emoji 丢失

### 问题一：AnimatePresence 导致的二次闪烁

**时间**：2026-02-26 01:10 CST

**现象**：发送第一条消息后，侧边栏条目出现一次，随即消失再出现（闪烁一次）。

**根本原因**：[`SideBar.tsx`](app/src/components/home/SideBar.tsx) 中 `AnimatePresence` 使用 `conversation.id` 作为 React `key`。`upgradePreflight(realId)` 将条目的 `id` 从 `-1` 改为 `realId` 时，React 检测到 key 变化，触发：
- 旧元素（`key=-1`）的退出动画（淡出 + 上移）
- 新元素（`key=realId`）的进入动画（淡入 + 上移）

这就是可见的"出现一次又出现一次"。

**修复**：为 `ConversationInstance` 添加 `clientKey?: string` 字段，在 `preflightHistory` 创建条目时赋值（`'preflight-' + Date.now()`），`upgradePreflight` 通过 spread 自动保留，`SideBar.tsx` 改用 `clientKey ?? conversation.id` 作为 key。

**修改文件**：

| 文件 | 修改内容 |
|------|---------|
| [`app/src/api/types.tsx`](app/src/api/types.tsx) | `ConversationInstance` 新增 `clientKey?: string` |
| [`app/src/store/chat.ts`](app/src/store/chat.ts) | `preflightHistory` 赋值 `clientKey`；`setHistory` 合并时保留 `clientKey` |
| [`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx) | `key={conversation.clientKey ?? conversation.id}` |

---

### 问题二：刷新浏览器后 Emoji 和预设名字丢失

**时间**：2026-02-26 01:20 CST

**现象**：刷新整个浏览器后，之前带 emoji 的预设对话条目变成普通聊天历史，emoji 和预设名字消失。

**根本原因**：`avatar`（emoji）和预设名字是纯客户端 Redux 状态，服务端从不存储这两个字段。页面刷新后 Redux store 重置，`setHistory` 从服务端拉取列表时，条目没有 `avatar`，emoji 丢失。

**修复**：在 [`app/src/store/chat.ts`](app/src/store/chat.ts) 中新增 localStorage 持久化层（key: `conversation_avatars`）：

```typescript
// 辅助函数
function persistAvatar(id, avatar, name)   // 写入
function forgetAvatar(id)                  // 删除单条
function clearAvatarStore()                // 清空全部
```

- `upgradePreflight` — 升级时调用 `persistAvatar(realId, avatar, name)`
- `setHistory` — 合并时先读 `loadAvatarStore()`，对缺少 `avatar` 的条目从 localStorage 恢复
- `deleteConversation` — 调用 `forgetAvatar(id)` 清理
- `deleteAllConversation` — 调用 `clearAvatarStore()` 清理

**修改文件**：

| 文件 | 修改内容 |
|------|---------|
| [`app/src/store/chat.ts`](app/src/store/chat.ts) | 新增 `AVATAR_STORE_KEY` + 4 个 localStorage 辅助函数；`upgradePreflight` 持久化；`setHistory` 从 localStorage 恢复；`deleteConversation` / `deleteAllConversation` 清理 |

---

### 最终行为说明（v3）

| 操作 | 预期行为 |
|------|---------|
| 点击预设卡片 | 直接跳转聊天界面，侧边栏不出现任何新条目 |
| 发送第一条消息 | 侧边栏顶部出现带 emoji 和预设名字的条目 |
| AI 回复后 | 条目原地升级为真实 ID，emoji 和名字不变，无闪烁，写入 localStorage |
| 后台 refresh() | setHistory 合并保留 emoji/名字/clientKey，无二次闪烁 |
| 刷新浏览器 | setHistory 从 localStorage 恢复 emoji 和预设名字 |
| 删除对话 | localStorage 中对应条目同步清除 |
| 清空全部对话 | localStorage avatar store 全部清除 |

---

## 2026-02-26 02:15 CST — 预设编辑器重构：Tab 拆分 + 系统提示词联动

### 需求背景

1. 预设对话（`context`）不应与提示词设置放在同一 Tab 下，应作为并列的独立 Tab。
2. "提示词"实际上是系统提示词（`description` 字段），预设对话的第一条 system 消息应与其保持双向同步。
3. 默认模型选择框 UI 错位（选中后同时显示 badge 和 Select，导致溢出换行）。

---

### 系统提示词机制分析

#### 原有问题

| 字段 | 是否发送服务端 | 说明 |
|------|--------------|------|
| `description` | ❌ | 系统提示词文本，仅 UI 展示，从未发送 |
| `context[role=system]` | ✅ | context 数组中的 system 消息 |

[`sendMaskEvent()`](app/src/api/connection.ts:186) 只发 `mask.context`，`description` 被完全丢弃。[`fillMaskItem()`](app/src/store/chat.ts:178) 也只复制 `context`，不含 `description`。

#### 运行流程

```
点击预设 → mask() → setMaskItem + resetNewConversation + setCurrent(-1)
发送消息 → send() → sendMaskEvent(mask.context) + fillMaskItem(mask.context)
```

---

### 修复方案

#### 1. Tab 结构重组（[`MaskEditor.tsx`](app/src/components/home/MaskEditor.tsx)）

新增第三个 Tab "预设对话"，`TabId` 从 `"model" | "prompt"` 扩展为 `"model" | "prompt" | "conversation"`：

- **模型设置 Tab** — 不变
- **提示词设置 Tab** — 只保留：头像 + 名称 + 系统提示词 textarea（`description`）
- **预设对话 Tab** — 新增 `ConversationTab` 组件，展示 `context` 消息列表

#### 2. 系统提示词双向同步（[`MaskEditor.tsx`](app/src/components/home/MaskEditor.tsx) reducer）

`description` 与 `context[0]`（system 角色）保持双向同步：

```typescript
// update-description：同步到 context[0]
case "update-description": {
  const ctx = [...state.context];
  if (ctx[0]?.role === SystemRole) {
    ctx[0] = { ...ctx[0], content: newDesc };
  } else if (newDesc.trim()) {
    ctx.unshift({ role: SystemRole, content: newDesc });
  }
  return { ...state, description: newDesc, context: ctx };
}

// update-message-content：编辑 context[0] system 消息时同步回 description
case "update-message-content": {
  const syncedDesc =
    action.index === 0 && state.context[0]?.role === SystemRole
      ? action.payload
      : state.description;
  return { ...state, context: newContext, description: syncedDesc };
}

// set-mask / import-mask：加载时自动提取 context[0] system → description
case "set-mask": {
  if (!m.description?.trim() && m.context[0]?.role === SystemRole) {
    return { ...m, description: m.context[0].content };
  }
  if (m.description?.trim() && m.context[0]?.role !== SystemRole) {
    return { ...m, context: [{ role: SystemRole, content: m.description }, ...m.context] };
  }
  return { ...m };
}
```

#### 3. 保存校验放宽（[`MaskEditor.tsx`](app/src/components/home/MaskEditor.tsx:677)）

允许仅有系统提示词（无预设对话消息）时也能保存：

```typescript
if (data.context.length === 0 && !data.description?.trim()) return;
```

#### 4. `fillMaskItem` 还原（[`chat.ts`](app/src/store/chat.ts:178)）

`description` 已同步到 `context[0]`，不再重复注入：

```typescript
conversation.messages = state.mask_item.context.filter(
  (m) => m.content.trim().length > 0,
);
```

#### 5. `sendMaskEvent` 还原（[`connection.ts`](app/src/api/connection.ts:186)）

同上，直接发送 `context`：

```typescript
const fullContext = mask.context.filter((m) => m.content.trim().length > 0);
this.sendEvent(t, "mask", JSON.stringify(fullContext));
```

#### 6. UI 布局修复（[`preset.less`](app/src/assets/pages/preset.less)）

- `.mask-conversation-list` 及子样式从 `.mask-editor-container` 嵌套中提升到顶层，修复按钮纵向错位
- 新增 `.mask-system-preview` 样式（后续移除，改为直接在列表中显示）

#### 7. 默认模型选择框修复（[`MaskEditor.tsx`](app/src/components/home/MaskEditor.tsx:247)）

移除冗余 badge，改为单一 Select + 独立 × 按钮；触发器固定宽度 `w-[200px]`，内容 `truncate` 截断，`title` 属性悬停显示完整模型名：

```tsx
<SelectTrigger className="h-8 text-sm w-[200px]" title={mask.model || ""}>
  <span className="truncate block max-w-[160px]">
    <SelectValue placeholder="选择模型" />
  </span>
</SelectTrigger>
{mask.model && (
  <button onClick={() => dispatch({ type: "update-model", payload: undefined })}>
    <X className="h-4 w-4" />
  </button>
)}
```

---

### 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| [`app/src/components/home/MaskEditor.tsx`](app/src/components/home/MaskEditor.tsx) | 新增 `ConversationTab`；Tab 扩展为三个；reducer 实现 description↔context[0] 双向同步；保存校验放宽；默认模型 UI 修复 |
| [`app/src/store/chat.ts`](app/src/store/chat.ts) | `fillMaskItem()` 还原为直接复制 context |
| [`app/src/api/connection.ts`](app/src/api/connection.ts) | `sendMaskEvent()` 还原为直接发送 context |
| [`app/src/assets/pages/preset.less`](app/src/assets/pages/preset.less) | `.mask-conversation-list` 样式提升到顶层；新增 `.mask-system-preview` |

---

### 最终行为说明

| 操作 | 预期行为 |
|------|---------|
| 打开内置预设编辑 | `context[0]` system 消息自动填入"提示词设置"的系统提示词框 |
| 编辑系统提示词 textarea | `context[0]` system 消息同步更新（不存在则自动插入） |
| 在预设对话中编辑第一条 system 消息 | 系统提示词 textarea 同步更新 |
| 仅设置系统提示词，不添加对话消息 | 可正常保存 |
| 悬停默认模型选择框 | 显示完整模型名称（浏览器原生 tooltip） |

---

## 2026-02-26 01:48 CST — 预设市场功能增强

### 需求概述

1. 所有预设卡片悬停时右上角显示三点菜单（`MoreHorizontal`）
2. "编辑助手"弹出 Dialog，包含**模型设置**与**提示词设置**两个标签页
3. 提示词设置页内新增**预设对话**区域，支持 system / assistant / user 三种角色消息

---

### 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| [`app/src/masks/types.ts`](app/src/masks/types.ts) | 新增 `MaskModelSettings` 类型；`CustomMask` 合并该类型，增加 `model / temperature / top_p / max_tokens / history / stream` 可选字段 |
| [`app/src/components/home/MaskEditor.tsx`](app/src/components/home/MaskEditor.tsx) | 完全重写：Drawer → Dialog；reducer 新增 6 个 model 设置 action；拆分为 `ModelSettingsTab` / `PromptSettingsTab` 两个子组件；新增预设对话区域 |
| [`app/src/routes/Preset.tsx`](app/src/routes/Preset.tsx) | 三点菜单对所有卡片生效；自定义预设：编辑助手 / 使用预设 / 删除；内置预设：使用预设 / 复制并编辑 |
| [`app/src/assets/pages/preset.less`](app/src/assets/pages/preset.less) | 新增 `.mask-editor-dialog` / `.mask-editor-sidebar` / `.mask-editor-tab` / `.mask-settings-content` / `.mask-setting-row` / `.mask-prompt-*` 等样式 |

---

### 详细说明

#### 1. `masks/types.ts` — 类型扩展

```ts
export type MaskModelSettings = {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  history?: number;
  stream?: boolean;
};

export type CustomMask = Mask & MaskModelSettings & { id: number };
```

#### 2. `MaskEditor.tsx` — 重写要点

**Reducer 新增 actions**：

| action | 说明 |
|--------|------|
| `update-model` | 设置默认模型 |
| `update-temperature` | 设置温度（`undefined` = 不覆盖全局） |
| `update-top-p` | 设置 Top-P |
| `update-max-tokens` | 设置最大 Token 数 |
| `update-history` | 设置上下文数 |
| `update-stream` | 设置流式输出 |
| `reset-model-settings` | 将所有模型设置重置为 `undefined` |

**Dialog 布局**：

```
┌─────────────────────────────────────────┐
│ 标题（助手名称）                    [×] │
├──────────┬──────────────────────────────┤
│ 模型设置 │                              │
│ 提示词设置│   Tab 内容区（可滚动）       │
│          │                              │
├──────────┴──────────────────────────────┤
│                        [取消]  [保存]   │
└─────────────────────────────────────────┘
```

**模型设置 Tab**：每个参数行 = 开关（启用覆盖）+ 滑块 + 数值显示；底部有"重置"按钮。

**提示词设置 Tab**：
- 头像（emoji picker）+ 名称输入框
- 提示词 textarea（绑定 `description` 字段）+ token 估算
- 预设对话列表：每条消息左侧为角色切换按钮（`ServerIcon` / `BotIcon` / `UserIcon`，点击循环切换），右侧为 textarea；下方操作栏：`+`（在下方插入）/ `✏️`（全屏编辑）/ `↑` / `↓` / `🗑️`

#### 3. `Preset.tsx` — 三点菜单

```tsx
// 所有卡片均显示，不再限制 isCustom
<div className="opacity-0 group-hover:opacity-100 transition-opacity">
  <DropdownMenu>
    ...
    {isCustom ? (
      // 编辑助手 / 使用预设 / 删除
    ) : (
      // 使用预设 / 复制并编辑（id: -1 → 保存为新自定义预设）
    )}
  </DropdownMenu>
</div>
```

#### 4. `preset.less` — 关键样式

```less
.mask-editor-dialog {
  display: flex !important;
  flex-direction: column !important;
  width: min(780px, 95vw) !important;
  height: min(640px, 90vh) !important;
  padding: 0 !important;
  overflow: hidden !important;
}

.mask-editor-sidebar {
  width: 160px;
  border-right: 1px solid hsl(var(--border));
  background-color: hsl(var(--muted) / 0.3);
}

.mask-editor-tab.active {
  background-color: hsl(var(--muted));
  font-weight: 500;
}

---

## 2026-02-26 02:52 CST — 小程序（MiniApps）子页面

### 需求概述

在左侧导航栏新增"小程序"入口，展示常用 AI 工具的图标网格，点击跳转对应网站。页面作为框架，后续可持续扩展。

---

### 新增文件

| 文件 | 说明 |
|------|------|
| [`app/src/components/miniapps/apps.ts`](app/src/components/miniapps/apps.ts) | `MiniApp` 类型定义、`APP_CATEGORIES` 分类常量、`miniApps` 数据数组（20+ 工具） |
| [`app/src/components/miniapps/AppCard.tsx`](app/src/components/miniapps/AppCard.tsx) | 单个应用卡片组件，含图标（带 fallback）+ 名称，点击调用 `openWindow` 跳转 |
| [`app/src/components/miniapps/MiniAppsPanel.tsx`](app/src/components/miniapps/MiniAppsPanel.tsx) | 主面板：搜索栏 + 分类过滤按钮 + 响应式网格 |
| [`app/src/routes/MiniApps.tsx`](app/src/routes/MiniApps.tsx) | 路由页面入口，包裹 `MiniAppsPanel` |
| [`app/src/assets/pages/miniapps.less`](app/src/assets/pages/miniapps.less) | 页面专属样式（容器、网格、卡片、搜索栏、分类按钮） |

---

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| [`app/src/router.tsx`](app/src/router.tsx:100) | 懒加载 `MiniApps`，注册 `{ id: "miniapps", path: "apps" }` 路由 |
| [`app/src/routes/Index.tsx`](app/src/routes/Index.tsx:125) | 导入 `LayoutGrid`，在 `ToolBar` 中添加 `<BarItem icon={<LayoutGrid />} path="/apps" name="miniapps" />` |
| `app/src/resources/i18n/cn.json` | 新增 `bar.miniapps`、`bar.miniapps-full`、`miniapps.*` 分类翻译 |
| `app/src/resources/i18n/en.json` | 同上（英文） |
| `app/src/resources/i18n/ja.json` | 同上（日文） |
| `app/src/resources/i18n/ru.json` | 同上（俄文） |
| `app/src/resources/i18n/tw.json` | 同上（繁体中文） |

---

### 后续扩展

向 [`apps.ts`](app/src/components/miniapps/apps.ts:21) 的 `miniApps` 数组追加条目即可，无需修改其他文件。

**2026-02-26 02:55 CST 追加**：新增 `feedback.uniquest.top` 条目（`id: "uniquest-feedback"`，分类 `productivity`）。
```

---

## 2026-02-26 — 时间轴导航 + 文件夹管理

### 需求来源

参考 Gemini Voyager 功能设计，在 CoAI 中实现：
1. **Phase 1 时间轴导航**：对话页面右侧浮动面板，展示消息节点，支持点击跳转、收藏、`j`/`k` 键盘导航
2. **Phase 2 文件夹管理**：侧边栏文件夹树，支持创建/重命名/删除/颜色，将对话归入文件夹

---

### 与原指南的关键适配差异

| 指南假设 | 实际实现 |
|---------|---------|
| GORM ORM | 原生 `database/sql`（`globals.ExecDb` / `globals.QueryDb`） |
| `messages` 表有独立 ID | `starred_messages` 表用 `message_index` 定位消息 |
| `users` 表外键 | `auth` 表外键 |
| `@dnd-kit` 拖拽 | 拖拽交互暂缓，后端 move API 已就绪 |
| `folders.id` VARCHAR(36) UUID | `folders.id` INT AUTO_INCREMENT |

---

### Phase 1：时间轴导航

#### 后端改动

**新增表**（[`connection/database.go`](connection/database.go)）：

```sql
CREATE TABLE IF NOT EXISTS starred_messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    conversation_id INT NOT NULL,
    message_index   INT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_star (user_id, conversation_id, message_index),
    FOREIGN KEY (user_id) REFERENCES auth(id) ON DELETE CASCADE
)
```

**新增 API**（[`manager/conversation/star_api.go`](manager/conversation/star_api.go)）：

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/conversation/star` | 收藏消息（body: `conversation_id`, `message_index`） |
| `POST` | `/conversation/unstar` | 取消收藏 |
| `GET` | `/conversation/:id/starred` | 获取对话的所有收藏消息索引 |

#### 前端改动

**新增文件**：

| 文件 | 说明 |
|------|------|
| [`app/src/components/timeline/useTimeline.ts`](app/src/components/timeline/useTimeline.ts) | 核心 Hook：滚动定位、`j`/`k` 键盘导航（输入框聚焦时不触发）、IntersectionObserver 自动更新 activeIndex、收藏 API 调用 |
| [`app/src/components/timeline/TimelinePanel.tsx`](app/src/components/timeline/TimelinePanel.tsx) | 浮动面板容器，`fixed right-4 top-1/2`，可折叠/展开 |
| [`app/src/components/timeline/TimelineNode.tsx`](app/src/components/timeline/TimelineNode.tsx) | 单个消息节点，显示角色图标 + 收藏按钮 |
| [`app/src/store/timeline.ts`](app/src/store/timeline.ts) | Redux slice：`visible`、`activeMessageIndex`、`starredIndices` |
| [`app/src/api/star.ts`](app/src/api/star.ts) | `starMessage` / `unstarMessage` / `getStarredMessages` |

**修改文件**：

| 文件 | 修改内容 |
|------|---------|
| [`app/src/components/Message.tsx`](app/src/components/Message.tsx) | 根 div 加 `data-message-index={props.index}` 属性 |
| [`app/src/components/home/ChatInterface.tsx`](app/src/components/home/ChatInterface.tsx) | 渲染 `<TimelinePanel>`（当 `timelineVisible && current > 0`） |
| [`app/src/components/home/assemblies/ChatAction.tsx`](app/src/components/home/assemblies/ChatAction.tsx) | 新增 `TimelineAction` 导出（List 图标，切换 `timelineSlice.visible`） |
| [`app/src/components/home/ChatWrapper.tsx`](app/src/components/home/ChatWrapper.tsx) | 工具栏加入 `<TimelineAction />` |
| [`app/src/store/index.ts`](app/src/store/index.ts) | 注册 `timeline` reducer |

---

### Phase 2：文件夹管理

#### 后端改动

**新增表**（[`connection/database.go`](connection/database.go)）：

```sql
CREATE TABLE IF NOT EXISTS folders (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    name       VARCHAR(100) NOT NULL,
    color      VARCHAR(20) NULL,
    parent_id  INT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES auth(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
)
```

**迁移**（[`connection/db_migration.go`](connection/db_migration.go)）：

```sql
ALTER TABLE conversations ADD COLUMN folder_id INT NULL;
ALTER TABLE conversations ADD COLUMN folder_order INT NOT NULL DEFAULT 0;
```

**新增 API**（[`manager/conversation/folder_api.go`](manager/conversation/folder_api.go)）：

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/conversation/folder` | 获取当前用户所有文件夹 |
| `POST` | `/conversation/folder` | 创建文件夹 |
| `PUT` | `/conversation/folder/:id` | 更新文件夹（名称/颜色） |
| `DELETE` | `/conversation/folder/:id` | 删除文件夹（对话移出，不删除） |
| `PUT` | `/conversation/folder/reorder` | 批量更新排序 |
| `POST` | `/conversation/:id/move` | 将对话移入/移出文件夹 |

两级层级限制：创建子文件夹时校验 parent 的 `parent_id IS NULL`。

#### 前端改动

**新增文件**：

| 文件 | 说明 |
|------|------|
| [`app/src/components/folder/FolderTree.tsx`](app/src/components/folder/FolderTree.tsx) | 文件夹树根组件；创建表单含 Save/Cancel 按钮（`Enter` 保存，`Escape` 取消） |
| [`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx) | 文件夹节点：展开/折叠、内联重命名、子文件夹、归属对话列表 |
| [`app/src/components/folder/FolderContextMenu.tsx`](app/src/components/folder/FolderContextMenu.tsx) | 右键下拉菜单：重命名 / 颜色 / 删除 |
| [`app/src/store/folder.ts`](app/src/store/folder.ts) | Redux slice：`folders[]`、`loading` |
| [`app/src/api/folder.ts`](app/src/api/folder.ts) | `listFolders` / `createFolder` / `updateFolder` / `deleteFolder` / `reorderFolders` / `moveConversation` |

**修改文件**：

| 文件 | 修改内容 |
|------|---------|
| [`app/src/api/types.tsx`](app/src/api/types.tsx) | `ConversationInstance` 新增 `folder_id?: number \| null`、`folder_order?: number` |
| [`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx) | 在对话列表上方渲染 `<FolderTree>`（仅登录用户） |
| [`app/src/store/index.ts`](app/src/store/index.ts) | 注册 `folder` reducer |

---

### 未实现部分

拖拽将对话移入文件夹的前端交互（`useFolderDnd`）暂缓。后端 `POST /conversation/:id/move` 接口已就绪，只差前端拖拽 UI。

---

## 2026-02-26 22:00 CST — 文件夹 & 预设市场 Bug 修复

### 问题汇总

上线后发现以下 6 个 Bug，均在本次修复：

---

#### Bug 1：后端 `CreateFolderAPI` 只返回 `id`，前端类型不匹配

**文件**：[`manager/conversation/folder_api.go`](manager/conversation/folder_api.go)

原代码在创建文件夹后只返回 `{"id": x}`，而前端 `Folder` 类型期望完整对象（含 `name`、`color`、`parent_id` 等字段）。

**修复**：创建后执行 `SELECT` 查询，返回完整 `Folder` 对象。

---

#### Bug 2：`FolderTree.tsx` 创建后用 `addFolder` 写入错误类型

**文件**：[`app/src/components/folder/FolderTree.tsx`](app/src/components/folder/FolderTree.tsx)

`handleCreate` 将 `createFolder` 的返回值（`{id: number}`）直接 dispatch 到 `addFolder`，导致 store 中存入不完整对象，文件夹不显示。

**修复**：创建成功后调用 `listFolders()` 重新拉取完整列表，再 dispatch `setFolders()`。

---

#### Bug 3：`SideBar.tsx` 传给 `FolderTree` 的 `conversations` 是空数组

**文件**：[`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx)

`<FolderTree conversations={[]} />` 导致文件夹内永远看不到归属的对话。

**修复**：改为 `conversations={history.filter(c => c.id > 0)}`，过滤掉 preflight 条目。

---

#### Bug 4：`Preset.tsx` 未在挂载时加载自定义预设

**文件**：[`app/src/routes/Preset.tsx`](app/src/routes/Preset.tsx)

预设市场页面缺少 `useEffect`，进入页面时不调用 `updateMasks(dispatch)`，导致自定义预设不显示。

**修复**：新增：

```tsx
useEffect(() => {
  updateMasks(dispatch);
}, [dispatch]);
```

---

#### Bug 5：`updateMasks` 条件错误，空结果时清空 store

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

原条件 `if (resp.data && resp.data.length > 0)` 在服务端返回空数组时不执行 `setMasks([])`，但在网络错误时也不执行，逻辑混乱。更严重的是，当服务端返回空数组时，旧的自定义预设仍留在 store 中。

**修复**：改为 `if (resp.status)`，只要请求成功就更新 store（包括空数组）。

---

#### Bug 6：后端 `ListFolders` 返回 JSON `null`（Go nil slice）

**文件**：[`manager/conversation/folder.go`](manager/conversation/folder.go)

Go 中 `var folders []Folder` 声明后未赋值，序列化为 JSON `null`，前端 `setFolders(null)` 导致 Redux 状态异常。

**修复**：改为 `folders := make([]Folder, 0)`，确保空列表序列化为 `[]`。

---

#### Bug 7（根本原因）：Air 构建失败，后端运行旧二进制

**文件**：[`test.go`](test.go)、[`test2.go`](test2.go)

两个临时测试文件均声明 `package main` + `func main()`，与 [`main.go`](main.go) 冲突，导致 Air 每次触发重编译时报错：

```
.\test.go:9:6: main redeclared in this block
.\test2.go:16:6: main redeclared in this block
failed to build, error: exit status 1
```

Air 回退到旧二进制（文件夹路由注册前的版本），所有 `/api/conversation/folder*` 请求返回 404。

**修复**：在两个文件顶部添加 `//go:build ignore`，Go 编译器将跳过这些文件：

```go
//go:build ignore

package main
```

---

### 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| [`manager/conversation/folder_api.go`](manager/conversation/folder_api.go) | `CreateFolderAPI` 返回完整 `Folder` 对象 |
| [`manager/conversation/folder.go`](manager/conversation/folder.go) | `ListFolders` 用 `make([]Folder, 0)` 避免 JSON null |
| [`app/src/components/folder/FolderTree.tsx`](app/src/components/folder/FolderTree.tsx) | `handleCreate` 改为刷新完整列表 |
| [`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx) | `FolderTree` 接收真实对话列表 |
| [`app/src/routes/Preset.tsx`](app/src/routes/Preset.tsx) | 挂载时调用 `updateMasks` |
| [`app/src/store/chat.ts`](app/src/store/chat.ts) | `updateMasks` 条件改为 `if (resp.status)` |
| [`test.go`](test.go) | 添加 `//go:build ignore` |
| [`test2.go`](test2.go) | 添加 `//go:build ignore` |

---

## Session 3：修复"移入文件夹后文件夹显示为空"

### 问题描述

用户反馈：将对话移入文件夹后，表面上对话从主列表消失（看起来已移入），但打开文件夹后里面什么都没有。

### 根本原因分析

**症状拆解：**
- 对话从主列表消失 → `SideBar` 过滤 `!c.folder_id`，`updateConversationFolder` 已将 `folder_id` 设为非空值 ✅（这部分正常）
- 文件夹打开后为空 → `FolderItem` 过滤 `c.folder_id === folder.id`，但没有任何机制触发这个过滤

**真正的根本原因：没有"移入文件夹"的 UI 入口。**

之前的实现只有拖拽（`react-beautiful-dnd`），但 `FolderItem` 没有注册为 `Droppable`，`handleDragEnd` 中的 `destination.droppableId.startsWith("folder-")` 分支永远不会触发。用户实际上是通过某种方式触发了 `updateConversationFolder`（可能是旧的测试代码或误操作），导致 Redux 状态中 `folder_id` 被设置，但后端数据库中并没有实际更新。

### 修复方案

放弃依赖拖拽作为唯一入口，改为**右键菜单（下拉菜单）**作为主要交互方式：

1. **`ConversationItem` 下拉菜单新增"移入文件夹"子菜单**：当存在文件夹时，显示所有文件夹列表，点击即调用 `POST /conversation/move` + 派发 `updateConversationFolder`
2. **`FolderItem` 新增"移出文件夹"按钮**：每个文件夹内的对话项 hover 时显示 `FolderOutput` 图标，点击调用 `POST /conversation/move` (folderId=null) + 派发 `updateConversationFolder`
3. **`FolderTree` 新增 `handleMoveOut`**：统一处理移出逻辑，通过 `onMoveOut` prop 传给 `FolderItem`
4. **`SideBar` 传递 `folders` 给 `ConversationItem`**：通过 `useFolders()` 获取文件夹列表并作为 prop 传下去

### 数据流验证

```
用户点击"移入文件夹 > 文件夹A"
  → handleMoveToFolder(folderId)
  → POST /conversation/move { conversation_id, folder_id }
  → 后端 UPDATE conversation SET folder_id = ? WHERE user_id = ? AND conversation_id = ?
  → dispatch(updateConversationFolder({ id, folderId }))
  → Redux: entry.folder_id = folderId
  → SideBar 过滤: !c.folder_id → 对话从主列表消失 ✅
  → FolderItem 过滤: c.folder_id === folder.id → 对话出现在文件夹中 ✅
```

后端 `LoadConversationList` 查询包含 `folder_id`，`setHistory` merge 逻辑保留 `folder_id`，页面刷新后状态也正确。

### 修改文件汇总（Session 3）

| 文件 | 修改内容 |
|------|---------|
| [`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx) | 保留 `Droppable`（支持拖拽）；添加 `onMoveOut` prop；每个对话项 hover 显示移出按钮；空状态提示；显示 emoji/avatar |
| [`app/src/components/folder/FolderTree.tsx`](app/src/components/folder/FolderTree.tsx) | 添加 `handleMoveOut`；导入 `updateConversationFolder`；传 `onMoveOut` 给 `FolderItem` |
| [`app/src/components/home/ConversationItem.tsx`](app/src/components/home/ConversationItem.tsx) | 添加 `folders` prop；添加"移入文件夹"子菜单；`handleMoveToFolder` 调用 API + 派发 action |
| [`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx) | 导入 `useFolders`；获取 `folders`；传给 `ConversationItem`；`conversation-list` Droppable 外层加 `flex-1 min-h-0 overflow-hidden` 包裹，防止 bounding rect 覆盖 folder Droppable |
| [`app/src/resources/i18n/cn.json`](app/src/resources/i18n/cn.json) | 添加 `folder.move-to`、`folder.move-out` |
| [`app/src/resources/i18n/en.json`](app/src/resources/i18n/en.json) | 同上（英文） |
| [`app/src/resources/i18n/tw.json`](app/src/resources/i18n/tw.json) | 同上（繁中） |
| [`app/src/resources/i18n/ja.json`](app/src/resources/i18n/ja.json) | 同上（日文） |
| [`app/src/resources/i18n/ru.json`](app/src/resources/i18n/ru.json) | 同上（俄文） |

---

## Session 4：拖拽移入文件夹 + 排序修复

### 问题描述

Session 3 已添加右键菜单"移入文件夹"入口，但拖拽交互仍不完整：

1. 文件夹内的对话无法拖出（不是 `Draggable`）
2. 主列表排序 index 错位（`source.index` 是 `filteredHistory` 的下标，但 reducer 操作 `realItems`）
3. `reorderHistory` 使用 index 而非 ID，跨列表时下标不对应
4. `setHistory` 合并逻辑用 `??` 处理 `folder_id`，导致移出文件夹后刷新页面会把 `folder_id` 恢复

### 根本原因分析

#### 问题一：`setHistory` 合并逻辑 `??` 错误

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

```typescript
// 原代码（错误）
const folder_id = item.folder_id ?? existing?.folder_id;
```

`??` 在 `item.folder_id` 为 `null` 时也会 fall through 到 `existing?.folder_id`。
Go 后端用 `omitempty`，`folder_id = NULL` 时字段被省略（JS 侧为 `undefined`），所以 `undefined ?? existing?.folder_id` 会把旧值恢复。

**修复**：

```typescript
// 修复后：undefined 才 fall through，null 不 fall through
const folder_id = item.folder_id !== undefined ? item.folder_id : existing?.folder_id;
```

#### 问题二：`reorderHistory` 使用 index，跨列表时错位

**文件**：[`app/src/store/chat.ts`](app/src/store/chat.ts)

原 reducer 接受 `{ fromIndex, toIndex }`，但 `source.index` / `destination.index` 是在 `filteredHistory`（无文件夹对话）中的下标，而 reducer 操作 `realItems`（所有非 preflight 对话），两者下标不对应。

**修复**：改为 ID-based reorder：

```typescript
reorderHistory: (state, action) => {
  const { movedId, insertBeforeId } = action.payload as {
    movedId: number;
    insertBeforeId: number | null;
  };
  const preflight = state.history.find((item) => item.id === -1);
  const realItems = state.history.filter((item) => item.id !== -1);
  const movedIdx = realItems.findIndex((item) => item.id === movedId);
  if (movedIdx === -1) return;
  const [moved] = realItems.splice(movedIdx, 1);
  if (insertBeforeId === null) {
    realItems.push(moved);
  } else {
    const beforeIdx = realItems.findIndex((item) => item.id === insertBeforeId);
    realItems.splice(beforeIdx === -1 ? realItems.length : beforeIdx, 0, moved);
  }
  state.history = preflight ? [preflight, ...realItems] : realItems;
},
```

#### 问题三：`destination.index` 语义（移动方向）

`react-beautiful-dnd` 的 `destination.index` 是拖拽项在目标列表中的**最终位置**。要找到"插入到谁前面"：

- 向下移动（`dst > src`）：最终位置后面的项是 `list[dst + 1]`
- 向上移动（`dst < src`）：最终位置后面的项是 `list[dst]`

**修复**（`SideBar.tsx` `handleDragEnd`）：

```typescript
const insertBeforeConv =
  destination.index > source.index
    ? folderConvs[destination.index + 1]
    : folderConvs[destination.index];
```

#### 问题四：文件夹内对话不是 `Draggable`

**文件**：[`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx)

原代码中文件夹内的对话只是普通 `div`，无法拖拽。

**修复**：用 `Draggable` 包裹每个对话项，添加 `cursor-grab`、`userSelect: "none"`、拖拽时抑制 framer-motion transition。

### `handleDragEnd` 五种场景

| 场景 | source | destination | 处理 |
|------|--------|-------------|------|
| 文件夹内排序 | `folder-X` | `folder-X` | 客户端排序，无 API |
| 跨文件夹移动 | `folder-X` | `folder-Y` | `POST /conversation/move` + `updateConversationFolder` |
| 主列表 → 文件夹 | `conversation-list` | `folder-X` | `POST /conversation/move` + `updateConversationFolder` |
| 文件夹 → 主列表 | `folder-X` | `conversation-list` | `POST /conversation/move(null)` + `updateConversationFolder(null)` |
| 主列表排序 | `conversation-list` | `conversation-list` | ID-based `reorderHistory` |

### 修改文件汇总（Session 4）

| 文件 | 修改内容 |
|------|---------|
| [`app/src/store/chat.ts`](app/src/store/chat.ts) | `setHistory` 合并逻辑改用 `!== undefined` 判断；`reorderHistory` 改为 ID-based |
| [`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx) | 文件夹内对话用 `Draggable` 包裹；拖拽样式优化 |
| [`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx) | `handleDragEnd` 重写，处理全部5种场景；`insertBeforeId` 逻辑修正（移动方向判断）；主列表 `Draggable` 添加 `willChange: "transform"` |

---

## 2026-02-26 — 预设自动创建文件夹（Preset-as-Folder）

### 需求概述

用户在预设市场点击"使用预设"时，自动为该预设创建（或复用）一个文件夹。该预设产生的所有对话都存放在这个文件夹中，文件夹名字 = 预设名字，图标 = 预设 emoji。

---

### 数据流

```
用户点击"使用预设"
  → handleUseMask(mask)
  → 在 Redux folders 中按名字查找同名文件夹
      ├─ 找到 → 直接使用该 folder.id
      └─ 未找到 → POST /conversation/folder { name, avatar }
                  → 新文件夹写入 Redux + DB
  → dispatch mask(mask, folderId)
      → Redux: mask_item = mask, mask_folder_id = folderId, current = -1
  → 导航到 /

用户发送第一条消息
  → send()
  → dispatch preflightHistory({ name, avatar, folder_id: folderId })

AI 回复，conversation 升级
  → receive()
  → dispatch upgradePreflight(realId)
  → moveConversation(realId, mask_folder_id)   ← API 调用（fire-and-forget）
  → dispatch updateConversationFolder({ id: realId, folderId })
  → dispatch clearMaskFolderId()
  → refresh()（后台同步）
```

---

### 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| [`connection/db_migration.go`](connection/db_migration.go) | MySQL + SQLite 两条路径各加 `ALTER TABLE folders ADD COLUMN avatar VARCHAR(100) NULL` |
| [`manager/conversation/folder.go`](manager/conversation/folder.go) | `Folder` struct 新增 `Avatar *string json:"avatar"`；`CreateFolder` 签名加 `avatar *string`；SQL INSERT / SELECT 加 `avatar` |
| [`manager/conversation/folder_api.go`](manager/conversation/folder_api.go) | `CreateFolderForm` 加 `Avatar *string json:"avatar"`；传给 `CreateFolder` |
| [`app/src/api/folder.ts`](app/src/api/folder.ts) | `Folder` interface 加 `avatar?: string`；`createFolder(name, color?, avatar?, parentId?)` |
| [`app/src/store/chat.ts`](app/src/store/chat.ts) | state 加 `mask_folder_id: number \| null`；新增 `setMaskFolderId` / `clearMaskFolderId` reducer；`clearMaskItem` 同时清 `mask_folder_id`；`mask()` 接受 `folderId`；`send()` 将 `folder_id` 写入 preflight；`receive()` 升级后调用 `moveConversation` |
| [`app/src/routes/Preset.tsx`](app/src/routes/Preset.tsx) | `handleUseMask` 改为 async：先 find-or-create 文件夹（按名字匹配），再调 `mask(mask, folderId)` |
| [`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx) | 文件夹头部：若 `folder.avatar` 存在，渲染 `<Emoji>` 替代 `<FolderIcon>`；emoji 容器固定 `h-4 w-4 overflow-hidden`，字号 `text-[13px]` 防止撑大行高 |

---

### 行为说明

| 操作 | 预期行为 |
|------|---------|
| 首次使用某预设 | 自动创建同名文件夹（带 emoji），`mask_folder_id` 写入 Redux |
| 再次使用同一预设 | 复用已有文件夹（按名字匹配） |
| 发送第一条消息 | 侧边栏文件夹内出现带 emoji 的对话条目 |
| AI 回复后 | 对话升级为真实 ID，自动移入预设文件夹，DB 持久化 |
| 刷新浏览器 | 文件夹 + emoji 从 DB 恢复，对话仍在文件夹内 |
| 未登录用户使用预设 | 跳过文件夹创建，行为与之前相同 |

---

## 2026-02-26 — 文件夹系统动效 & UX 补全

### 背景

对照 Gemini Voyager 前端深度研究报告（`临时/folder-frontend-deep-research.md`），梳理出当前文件夹系统与参考实现的差距，并逐项补全。

---

### 差距分析

| 类别 | 问题 | 原状态 |
|------|------|--------|
| 动画 | 文件夹展开/折叠无动画 | `{expanded && <div>}` 瞬间显隐 |
| 动画 | 拖拽悬停高亮不够明显 | 仅 `ring-1 ring-primary/30` 实线边框 |
| 动画 | 文件夹内对话条目无进入/退出动画 | 无 |
| 动画 | 无效操作无抖动反馈 | 无 |
| 功能 | 颜色选择器未实现 | `handleColorPick` 是空 TODO |
| 交互 | 内联重命名无保存/取消按钮 | 仅 blur 触发保存 |
| 反馈 | 文件夹操作无 Toast 提示 | 静默失败 |
| Redux | 缺少 `dragOverFolderId` 状态 | 无法响应式驱动高亮 |
| i18n | 多处硬编码英文字符串 | "Drag conversations here" 等 |

---

### 修复方案

#### 1. 文件夹展开/折叠动画

**文件**：[`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx)

将 `{expanded && <div className="ml-4">}` 替换为 Framer Motion `AnimatePresence` + `motion.div`：

```tsx
<AnimatePresence initial={false}>
  {expanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ overflow: "hidden" }}
      className="ml-4"
    >
      {/* 子文件夹 + 对话列表 */}
    </motion.div>
  )}
</AnimatePresence>
```

折叠箭头改为旋转动画（`motion.span animate={{ rotate: expanded ? 0 : -90 }}`），不再切换 `ChevronDown` / `ChevronRight` 图标。

#### 2. 拖拽悬停虚线边框

**文件**：[`app/src/store/folder.ts`](app/src/store/folder.ts)

新增 `dragOverFolderId: number | null` 状态与 `setDragOverFolder` reducer：

```typescript
setDragOverFolder: (state, action: PayloadAction<number | null>) => {
  state.dragOverFolderId = action.payload;
},
```

**文件**：[`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx)

新增 `handleDragUpdate`，拖拽经过文件夹时实时更新 Redux：

```typescript
const handleDragUpdate = (update: DragUpdate) => {
  const { destination } = update;
  if (destination?.droppableId.startsWith("folder-")) {
    dispatch(setDragOverFolder(parseInt(destination.droppableId.replace("folder-", ""))));
  } else {
    dispatch(setDragOverFolder(null));
  }
};
```

`handleDragEnd` 开头加 `dispatch(setDragOverFolder(null))` 清除高亮。

**文件**：[`app/src/assets/pages/home.less`](app/src/assets/pages/home.less)

```css
.folder-header.drag-over {
  background-color: hsl(var(--primary) / 0.06) !important;
  outline: 2px dashed hsl(var(--primary) / 0.4);
  border-radius: 8px;
}
```

**文件**：[`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx)

从 Redux 读取 `dragOverFolderId`，匹配时应用 `.drag-over` 类：

```tsx
const dragOverFolderId = useSelector((s: RootState) => s.folder.dragOverFolderId);
const isDragOver = dragOverFolderId === folder.id;

<div className={cn("folder-header ...", isDragOver && "drag-over")} ...>
```

#### 3. 对话条目进入/退出动画

**文件**：[`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx)

文件夹内对话列表用 `AnimatePresence` 包裹，每个 `Draggable` 改用 `motion.div`：

```tsx
<motion.div
  initial={{ opacity: 0, x: -8 }}
  animate={{ opacity: dragSnapshot.isDragging ? 0.7 : 1, x: 0 }}
  exit={{ opacity: 0, x: -8 }}
  transition={dragSnapshot.isDragging ? { duration: 0 } : { duration: 0.15 }}
  style={{ ...dragProvided.draggableProps.style, userSelect: "none" }}
>
```

> **注意**：不加 `layout` prop，避免与 `react-beautiful-dnd` 的 transform 定位冲突。

#### 4. 抖动动画 CSS

**文件**：[`app/src/assets/pages/home.less`](app/src/assets/pages/home.less)

```css
@keyframes invalidShake {
  0%, 100% { transform: translateX(0); }
  10%, 50%, 90% { transform: translateX(-4px); }
  30%, 70% { transform: translateX(4px); }
}
.folder-shake {
  animation: invalidShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
```

#### 5. 颜色选择器

**新增文件**：[`app/src/components/folder/FolderColorPicker.tsx`](app/src/components/folder/FolderColorPicker.tsx)

7 种语义颜色（default/red/orange/yellow/green/blue/purple），圆形色块，悬停 `scale(1.25)`，选中外环。

**文件**：[`app/src/components/folder/FolderContextMenu.tsx`](app/src/components/folder/FolderContextMenu.tsx)

"颜色"菜单项改为内嵌 `Popover`（`onSelect` 阻止默认关闭），右侧显示当前颜色小圆点：

```tsx
<Popover>
  <PopoverTrigger asChild>
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      <Palette className="h-3.5 w-3.5 mr-1.5" /> Color
      {currentColor && <span className="ml-auto w-3 h-3 rounded-full" style={{ backgroundColor: currentColor }} />}
    </DropdownMenuItem>
  </PopoverTrigger>
  <PopoverContent side="right" align="start" className="w-auto p-0">
    <FolderColorPicker value={currentColor} onChange={onColorChange} />
  </PopoverContent>
</Popover>
```

**文件**：[`app/src/components/folder/FolderTree.tsx`](app/src/components/folder/FolderTree.tsx)

新增 `handleColorChange`，调用 `apiUpdateFolder` 并派发 `updateFolderInStore`。

#### 6. 内联重命名 Save/Cancel 按钮

**文件**：[`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx)

重命名状态下显示 `[✓] [✕]` 按钮，`Enter` 保存，`Escape` 取消，使用 `useRef` 读取输入值：

```tsx
{renaming ? (
  <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
    <input ref={renameInputRef} autoFocus defaultValue={folder.name}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSaveRename(e.currentTarget.value);
        if (e.key === "Escape") setRenaming(false);
      }}
    />
    <button onClick={() => handleSaveRename(renameInputRef.current?.value || "")}><Check /></button>
    <button onClick={() => setRenaming(false)}><X /></button>
  </div>
) : (
  <span className="flex-1 truncate">{folder.name}</span>
)}
```

#### 7. Toast 通知

**文件**：[`app/src/components/folder/FolderTree.tsx`](app/src/components/folder/FolderTree.tsx)

`handleCreate` / `handleRename` / `handleDelete` 均加 `toast.success` / `toast.error`。

#### 8. i18n

5 个语言文件（cn/en/tw/ja/ru）的 `folder` 节点新增：

| 键 | 中文值 |
|----|--------|
| `folder.drag-here` | 将对话拖到这里 |
| `folder.new-folder` | 新建文件夹 |
| `folder.section-title` | 文件夹 |
| `folder.save` | 保存 |
| `folder.cancel` | 取消 |
| `folder.create-success` | 文件夹已创建 |
| `folder.create-failed` | 创建文件夹失败 |
| `folder.rename-success` | 文件夹已重命名 |
| `folder.rename-failed` | 重命名失败 |
| `folder.delete-success` | 文件夹已删除 |
| `folder.delete-failed` | 删除文件夹失败 |

---

### 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| [`app/src/components/folder/FolderItem.tsx`](app/src/components/folder/FolderItem.tsx) | AnimatePresence 展开/折叠；motion.div 对话条目动画；drag-over 虚线边框；Save/Cancel 重命名按钮；i18n |
| [`app/src/components/folder/FolderTree.tsx`](app/src/components/folder/FolderTree.tsx) | Toast 通知；handleColorChange；i18n 字符串 |
| [`app/src/components/folder/FolderContextMenu.tsx`](app/src/components/folder/FolderContextMenu.tsx) | 颜色菜单项改为 Popover + FolderColorPicker；显示当前颜色 |
| [`app/src/components/folder/FolderColorPicker.tsx`](app/src/components/folder/FolderColorPicker.tsx) | **新文件** — 7 色圆形色块选择器 |
| [`app/src/store/folder.ts`](app/src/store/folder.ts) | 新增 `dragOverFolderId` 状态 + `setDragOverFolder` reducer + `useDragOverFolderId` hook |
| [`app/src/components/home/SideBar.tsx`](app/src/components/home/SideBar.tsx) | `onDragUpdate` 派发 `setDragOverFolder`；拖拽结束清除 |
| [`app/src/assets/pages/home.less`](app/src/assets/pages/home.less) | `.folder-header.drag-over` 虚线边框；`@keyframes invalidShake`；`.folder-shake` |
| `app/src/resources/i18n/cn.json` + en/tw/ja/ru | 新增 11 个 `folder.*` 键 |

---

### 最终行为说明

| 操作 | 预期行为 |
|------|---------|
| 点击文件夹展开/折叠 | 内容区高度平滑过渡，箭头旋转动画 |
| 拖拽对话经过文件夹 | 文件夹头部出现蓝色虚线边框高亮 |
| 拖拽结束 | 高亮立即清除 |
| 对话移入文件夹 | 条目以淡入+左移动画出现 |
| 对话移出文件夹 | 条目以淡出+左移动画消失 |
| 点击"颜色"菜单项 | 右侧弹出颜色选择器，选色后立即更新文件夹图标颜色 |
| 点击"重命名" | 输入框聚焦，显示 ✓ / ✕ 按钮，Enter 保存，Escape 取消 |
| 创建/重命名/删除文件夹 | 操作成功/失败均有 Toast 提示 |
