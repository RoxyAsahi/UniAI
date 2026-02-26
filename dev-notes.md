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
