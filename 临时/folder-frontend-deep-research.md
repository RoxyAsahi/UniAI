# 文件夹管理前端深度研究报告

> **参考来源**: Gemini Voyager [`src/pages/content/folder/`](src/pages/content/folder/)
> **目标**: 为 CoAI (ChatNio) 实现同等级别的文件夹管理前端
> **报告日期**: 2026-02-26

---

## 目录

1. [整体前端架构](#1-整体前端架构)
2. [拖拽系统详解](#2-拖拽系统详解)
3. [动效与视觉反馈系统](#3-动效与视觉反馈系统)
4. [多选模式](#4-多选模式)
5. [颜色系统](#5-颜色系统)
6. [右键菜单与内联重命名](#6-右键菜单与内联重命名)
7. [通知 Toast 系统](#7-通知-toast-系统)
8. [深色模式适配](#8-深色模式适配)
9. [CoAI React 实现方案](#9-coai-react-实现方案)
10. [完整 CSS 参考](#10-完整-css-参考)

---

## 1. 整体前端架构

### 1.1 Gemini Voyager 的实现方式

Gemini Voyager 的文件夹管理是一个**纯原生 DOM 操作**的 TypeScript 类（[`manager.ts`](src/pages/content/folder/manager.ts)，231KB），因为它运行在 Chrome 扩展的 Content Script 环境中，无法使用 React。

核心类结构：

```
FolderManager (class)
├── 状态管理（class properties）
│   ├── data: FolderData              # 文件夹数据
│   ├── selectedConversations: Set    # 多选状态
│   ├── isMultiSelectMode: boolean    # 多选模式开关
│   └── multiSelectSource: string    # 多选来源（folder/native）
│
├── 渲染层（render* 方法）
│   ├── renderFolderList()
│   ├── renderFolder(folder)
│   └── renderConversation(conv)
│
├── 拖拽层（drag* 方法）
│   ├── setupDropZone(el, folderId)   # 设置文件夹接收区
│   ├── setupRootDropZone(el)         # 设置根级接收区
│   ├── enableFolderDragging(el)      # 启用文件夹拖拽
│   └── disableFolderDragging(el)     # 禁用（有子文件夹时）
│
└── 交互层
    ├── showFolderMenu(folder)        # 右键菜单
    ├── showInvalidSelectionFeedback  # 无效选择抖动动画
    └── showNotification(msg, type)   # Toast 通知
```

### 1.2 CoAI 的对应方案

CoAI 使用 React，可以用更现代的方式实现：

```
FolderTree (React Component)
├── 状态管理：Redux slice 或 Zustand
├── 拖拽：@dnd-kit/core + @dnd-kit/sortable
├── 动效：CSS Transitions + Framer Motion（可选）
└── 右键菜单：Radix UI DropdownMenu（CoAI 已有 Radix UI）
```

---

## 2. 拖拽系统详解

### 2.1 Gemini Voyager 的原生 HTML5 DnD 实现

Gemini Voyager 使用**原生 HTML5 Drag and Drop API**，不依赖任何第三方库。

#### 数据传输格式

拖拽数据通过 `DataTransfer` 对象以 JSON 格式传递：

```typescript
// 拖拽开始时序列化数据
const dragData: DragData = {
  type: 'conversation',           // 或 'folder'
  conversationId: conv.conversationId,
  title: conv.title,
  url: conv.url,
  isGem: conv.isGem,
  gemId: conv.gemId,
  sourceFolderId: folderId,       // 记录来源文件夹
  conversations: [conv],          // 多选时包含所有选中项
};
e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
```

#### 拖拽源（Drag Source）设置

```typescript
// 对话项拖拽
convEl.draggable = true;
convEl.addEventListener('dragstart', (e) => {
  e.stopPropagation();  // 防止事件冒泡到父文件夹
  e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
  element.style.opacity = '0.5';  // 拖拽中半透明
});

convEl.addEventListener('dragend', () => {
  element.style.opacity = '1';    // 恢复透明度
});
```

#### 文件夹拖拽的特殊限制

**有子文件夹的文件夹不能被拖拽**（防止循环嵌套）：

```typescript
private updateFolderDraggability(folder: Folder): void {
  const hasSubfolders = this.data.folders.some((f) => f.parentId === folder.id);
  if (hasSubfolders) {
    this.disableFolderDragging(element);  // 移除 draggable 属性和事件
  } else {
    this.enableFolderDragging(element);   // 添加 draggable 属性和事件
  }
}
```

防止循环嵌套的校验：

```typescript
// 防止文件夹拖入自身
if (draggedFolderId === targetFolderId) return;

// 防止文件夹拖入其后代（会形成循环）
if (this.isFolderDescendant(targetFolderId, draggedFolderId)) return;
```

#### 接收区（Drop Zone）设置

项目有两种接收区：

**1. 文件夹接收区**（`setupDropZone`）：

```typescript
element.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();  // 关键：阻止冒泡到根接收区
  element.classList.add('gv-folder-dragover');  // 高亮反馈
});

element.addEventListener('dragleave', () => {
  element.classList.remove('gv-folder-dragover');
});

element.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();  // 关键：防止根接收区也触发
  element.classList.remove('gv-folder-dragover');
  // 处理 drop 逻辑...
});
```

**2. 根级接收区**（`setupRootDropZone`）：

```typescript
element.addEventListener('dragleave', (e) => {
  // 用坐标判断是否真正离开（防止子元素触发 dragleave）
  const rect = element.getBoundingClientRect();
  const x = e.clientX, y = e.clientY;
  if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
    element.classList.remove('gv-folder-list-dragover');
  }
});
```

> **关键技术点**：`dragleave` 事件在鼠标移入子元素时也会触发，需要用坐标判断是否真正离开容器。

#### 多选拖拽

多选时，`dragData.conversations` 包含所有选中的对话：

```typescript
if (this.selectedConversations.size > 1) {
  // 收集所有选中对话的数据
  const conversations: ConversationReference[] = [];
  this.selectedConversations.forEach((id) => {
    const conv = this.findConversationInFolder(id, folderId);
    if (conv) conversations.push(conv);
  });
  dragData.conversations = conversations;

  // 所有选中项同时半透明
  this.selectedConversations.forEach((id) => {
    const el = this.findConversationElement(id);
    if (el) el.style.opacity = '0.5';
  });
}
```

### 2.2 CoAI 的 @dnd-kit 实现方案

`@dnd-kit` 是 React 生态中最成熟的拖拽库，比原生 DnD API 有以下优势：
- 支持触摸屏（移动端）
- 内置排序动画
- 无障碍支持（键盘拖拽）
- 不依赖 HTML5 DnD API（避免 Firefox 兼容问题）

#### 安装

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

#### 核心概念映射

| Gemini Voyager | @dnd-kit |
|----------------|----------|
| `draggable = true` | `useDraggable` hook |
| `setupDropZone` | `useDroppable` hook |
| `dragData` JSON | `data` 属性 |
| `dragover` 高亮 | `isOver` 状态 |
| 排序 | `useSortable` + `SortableContext` |

#### 完整拖拽实现

```tsx
// useFolderDnd.ts
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export function useFolderDnd() {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const dispatch = useDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,  // 拖拽激活距离（防止误触）
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(event.active.data.current as DragItem);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // 实时更新 over 状态（用于高亮目标文件夹）
    const { over } = event;
    if (over) {
      dispatch(setDragOverFolder(over.id as string));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    dispatch(setDragOverFolder(null));

    if (!over) return;

    const activeData = active.data.current as DragItem;
    const overData = over.data.current as DragItem;

    if (activeData.type === 'conversation') {
      // 对话拖入文件夹
      dispatch(moveConversationToFolder({
        conversationId: active.id as string,
        targetFolderId: over.id as string,
      }));
    } else if (activeData.type === 'folder') {
      // 文件夹排序
      if (active.id !== over.id) {
        dispatch(reorderFolders({
          activeId: active.id as string,
          overId: over.id as string,
        }));
      }
    }
  };

  return { sensors, activeItem, handleDragStart, handleDragOver, handleDragEnd };
}
```

#### 可拖拽对话项

```tsx
// DraggableConversation.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function DraggableConversation({ conversation, folderId }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: conversation.id,
    data: {
      type: 'conversation',
      conversation,
      sourceFolderId: folderId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,  // 拖拽中半透明
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`conversation-item ${isDragging ? 'dragging' : ''}`}
    >
      {conversation.title}
    </div>
  );
}
```

#### 可接收文件夹

```tsx
// DroppableFolder.tsx
import { useDroppable } from '@dnd-kit/core';

export function DroppableFolder({ folder, children }: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: folder.id,
    data: { type: 'folder', folder },
  });

  return (
    <div
      ref={setNodeRef}
      className={`folder-drop-zone ${isOver ? 'drag-over' : ''}`}
    >
      {children}
    </div>
  );
}
```

#### 拖拽预览（DragOverlay）

`DragOverlay` 是 @dnd-kit 的核心特性，在拖拽时显示一个跟随鼠标的预览元素：

```tsx
// FolderTree.tsx
<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
  {/* 文件夹列表 */}
  {folders.map((folder) => <FolderItem key={folder.id} folder={folder} />)}

  {/* 拖拽预览（跟随鼠标） */}
  <DragOverlay>
    {activeItem?.type === 'conversation' && (
      <div className="drag-preview conversation-drag-preview">
        {activeItem.conversation.title}
      </div>
    )}
    {activeItem?.type === 'folder' && (
      <div className="drag-preview folder-drag-preview">
        <span>{activeItem.folder.name}</span>
      </div>
    )}
  </DragOverlay>
</DndContext>
```

---

## 3. 动效与视觉反馈系统

### 3.1 拖拽高亮效果

Gemini Voyager 通过 CSS 类切换实现拖拽高亮，核心 CSS：

```css
/* 文件夹接收区高亮 */
.gv-folder-item-header.gv-folder-dragover {
  background-color: var(--folder-dragover-bg);
  border-radius: 8px;
  outline: 2px dashed var(--folder-dragover-border);
}

/* 根级接收区高亮 */
.gv-folder-list-dragover {
  background-color: var(--folder-dragover-bg);
  border-radius: 8px;
  outline: 2px dashed var(--folder-dragover-border);
}

/* CSS 变量（亮色/暗色模式） */
:root {
  --folder-dragover-bg: rgba(66, 133, 244, 0.08);
  --folder-dragover-border: rgba(66, 133, 244, 0.4);
}
html.dark, [data-theme='dark'] {
  --folder-dragover-bg: rgba(138, 180, 248, 0.12);
  --folder-dragover-border: rgba(138, 180, 248, 0.5);
}
```

### 3.2 抖动动画（无效选择反馈）

当用户尝试跨文件夹多选时，触发抖动动画提示操作无效：

```css
/* 抖动动画 */
.gv-invalid-selection {
  animation: invalidShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes invalidShake {
  0%, 100% { transform: translateX(0); }
  10%, 50%, 90% { transform: translateX(-4px); }
  30%, 70% { transform: translateX(4px); }
}
```

触发逻辑（强制重绘以支持连续触发）：

```typescript
private showInvalidSelectionFeedback(element: HTMLElement): void {
  // 先移除类（允许动画重新开始）
  element.classList.remove('gv-invalid-selection');

  // 强制 reflow（触发浏览器重新计算样式）
  void element.offsetWidth;

  // 添加类触发动画
  element.classList.add('gv-invalid-selection');

  // 动画结束后自动清理（比 setTimeout 更精确）
  element.addEventListener(
    'animationend',
    () => element.classList.remove('gv-invalid-selection'),
    { once: true }
  );
}
```

> **技术要点**：`void element.offsetWidth` 强制触发 reflow，确保即使快速连续点击也能重新播放动画。

### 3.3 收藏对话的视觉样式

收藏的对话有一个金色左侧渐变条：

```css
/* 收藏对话 - 金色左侧渐变 */
.gv-folder-conversation.gv-starred {
  background: linear-gradient(to right, rgba(251, 191, 36, 0.08) 0%, transparent 100%);
}

.gv-folder-conversation.gv-starred::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: #fbbf24;  /* amber-400 */
  border-radius: 0 2px 2px 0;
}
```

### 3.4 多选状态的视觉样式

选中的对话有蓝色左侧渐变条（与收藏的金色区分）：

```css
/* 选中状态 - 蓝色渐变 */
.gv-folder-conversation-selected {
  position: relative;
  background: linear-gradient(
    to right,
    rgba(66, 133, 244, 0.08) 0%,
    transparent 100%
  ) !important;
  border-radius: 10px;
}

.gv-folder-conversation-selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: #4285f4;  /* Google Blue */
  border-radius: 0 2px 2px 0;
}
```

### 3.5 文件夹展开/折叠动画

文件夹内容区域的展开/折叠使用 CSS `max-height` 过渡：

```css
.gv-folder-content {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.2s ease-out;
}

.gv-folder-item.expanded .gv-folder-content {
  max-height: 2000px;  /* 足够大的值 */
  transition: max-height 0.3s ease-in;
}
```

> **注意**：`max-height` 动画比 `height: auto` 更容易实现，但需要设置一个足够大的最大值。

### 3.6 按钮悬停动效

操作按钮（固定/更多/删除）默认隐藏，悬停时淡入：

```css
.gv-folder-pin-btn,
.gv-folder-actions-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.gv-folder-item-header:hover .gv-folder-pin-btn,
.gv-folder-item-header:hover .gv-folder-actions-btn {
  opacity: 1;
}
```

### 3.7 拖拽手柄光标

```css
/* 可拖拽时显示抓手光标 */
.gv-folder-item-header[draggable='true'] {
  cursor: grab;
}

.gv-folder-item-header[draggable='true']:active {
  cursor: grabbing;
}

.gv-folder-conversation[draggable='true'] {
  cursor: grab;
}

.gv-folder-conversation[draggable='true']:active {
  cursor: grabbing;
}
```

### 3.8 CoAI 动效实现建议

对于 CoAI，推荐使用 **Framer Motion** 实现更流畅的动效：

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// 文件夹内容展开/折叠
function FolderContent({ isExpanded, children }: Props) {
  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 对话项进入动画
function ConversationItem({ conversation }: Props) {
  return (
    <motion.div
      layout                          // 自动处理排序动画
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.15 }}
    >
      {conversation.title}
    </motion.div>
  );
}
```

---

## 4. 多选模式

### 4.1 触发方式

Gemini Voyager 支持两种触发多选的方式：

1. **长按触发**（500ms）：长按对话项进入多选模式
2. **点击触发**：进入多选模式后，点击对话项切换选中状态

```typescript
// 长按检测
element.addEventListener('mousedown', () => {
  longPressTimeout = window.setTimeout(() => {
    longPressTriggered = true;
    this.enterMultiSelectMode('folder', folderId);
    this.selectConversation(conversationId);
  }, 500);
});

element.addEventListener('mouseup', () => {
  if (longPressTimeout) clearTimeout(longPressTimeout);
});
```

### 4.2 跨文件夹选择限制

**不允许跨文件夹多选**，尝试时触发抖动动画：

```typescript
element.addEventListener('click', () => {
  if (!this.isMultiSelectMode) return;
  if (this.multiSelectFolderId && elFolderId !== this.multiSelectFolderId) {
    this.showInvalidSelectionFeedback(element);  // 抖动
    return;
  }
  this.toggleConversationSelection(conversationId);
});
```

### 4.3 最大选择数量

```typescript
const MAX_BATCH_DELETE_COUNT = 50;

if (this.selectedConversations.size >= MAX_BATCH_DELETE_COUNT) {
  this.showNotification('最多选择 50 个', 'info');
  return;
}
```

### 4.4 多选指示器 UI

多选模式下显示固定在顶部的指示条：

```
┌─────────────────────────────────────┐
│  ☑  3 selected    [🗑 删除] [✕ 退出] │
└─────────────────────────────────────┘
```

```css
.gv-multi-select-indicator { display: none; }
.gv-multi-select-mode .gv-multi-select-indicator { display: flex; }

.gv-multi-select-delete-btn { color: #ef4444; }
.gv-multi-select-delete-btn:hover { background-color: rgba(239, 68, 68, 0.12); }
.gv-multi-select-action-btn:active { transform: scale(0.95); }
```

### 4.5 CoAI 多选实现

```tsx
// useMultiSelect.ts
export function useMultiSelect() {
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sourceFolderId, setSourceFolderId] = useState<string | null>(null);

  const toggleSelect = (id: string, folderId: string) => {
    if (!isMultiSelect) return;
    if (folderId !== sourceFolderId) {
      // 触发抖动动画（通过 ref 或 CSS class）
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsMultiSelect(false);
      } else {
        if (next.size < 50) next.add(id);
      }
      return next;
    });
  };

  return { isMultiSelect, selectedIds, toggleSelect,
    enterMultiSelect: (folderId: string) => { setIsMultiSelect(true); setSourceFolderId(folderId); },
    exitMultiSelect: () => { setIsMultiSelect(false); setSelectedIds(new Set()); setSourceFolderId(null); }
  };
}

---

## 5. 颜色系统

### 5.1 Gemini Voyager 的颜色设计

**文件**: [`src/pages/content/folder/folderColors.ts`](src/pages/content/folder/folderColors.ts)

设计原则：
- **限制 8 种颜色**，避免选择困难
- 每种颜色有**语义含义**（优先级/紧急程度）
- 支持亮色/暗色双模式
- WCAG AA 无障碍合规

```typescript
export const FOLDER_COLORS: FolderColorConfig[] = [
  { id: 'default', lightColor: '#6b7280', darkColor: '#9ca3af', priority: 'neutral' },
  { id: 'red',     lightColor: '#ef4444', darkColor: '#f87171', priority: 'critical' },
  { id: 'orange',  lightColor: '#f97316', darkColor: '#fb923c', priority: 'high' },
  { id: 'yellow',  lightColor: '#eab308', darkColor: '#fbbf24', priority: 'high' },
  { id: 'green',   lightColor: '#22c55e', darkColor: '#4ade80', priority: 'medium' },
  { id: 'blue',    lightColor: '#3b82f6', darkColor: '#60a5fa', priority: 'medium' },
  { id: 'purple',  lightColor: '#a855f7', darkColor: '#c084fc', priority: 'low' },
];
```

颜色获取函数（支持自定义 hex 颜色）：

```typescript
export function getFolderColor(colorId: string | undefined, isDarkMode: boolean): string {
  if (!colorId || colorId === 'default') return isDarkMode ? '#9ca3af' : '#6b7280';
  if (colorId.startsWith('#')) return colorId;  // 支持自定义 hex
  const config = FOLDER_COLORS.find((c) => c.id === colorId);
  return config ? (isDarkMode ? config.darkColor : config.lightColor) : '#6b7280';
}
```

### 5.2 颜色选择器 UI

颜色选择器以圆形色块展示，点击选中：

```tsx
// FolderColorPicker.tsx
export function FolderColorPicker({ value, onChange }: Props) {
  return (
    <div className="color-picker-grid">
      {FOLDER_COLORS.map((color) => (
        <button
          key={color.id}
          className={`color-swatch ${value === color.id ? 'selected' : ''}`}
          style={{ backgroundColor: color.lightColor }}
          onClick={() => onChange(color.id)}
          title={color.id}
        />
      ))}
    </div>
  );
}
```

```css
.color-picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.1s ease;
}

.color-swatch:hover {
  transform: scale(1.2);
}

.color-swatch.selected {
  border-color: white;
  box-shadow: 0 0 0 2px currentColor;
  transform: scale(1.1);
}
```

---

## 6. 右键菜单与内联重命名

### 6.1 右键菜单结构

Gemini Voyager 的文件夹右键菜单包含以下操作：

```
📁 文件夹名称
─────────────
✏️  重命名
📌  固定到顶部 / 取消固定
🎨  更改颜色
📂  新建子文件夹
─────────────
🗑️  删除文件夹
```

CSS 样式：

```css
.gv-folder-menu {
  background-color: var(--folder-menu-bg);
  border: 1px solid var(--folder-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 160px;
  padding: 4px 0;
  z-index: 10000;
}

.gv-folder-menu-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  text-align: left;
  font-size: 14px;
  cursor: pointer;
  border: none;
  background: none;
  color: var(--folder-text);
}

.gv-folder-menu-item:hover {
  background-color: var(--folder-hover-bg);
}
```

### 6.2 内联重命名

点击"重命名"后，文件夹名称原地变为输入框：

```
[📁] [___工作项目___] [✓] [✕]
```

```css
.gv-folder-rename-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.gv-folder-rename-input {
  flex: 1;
  background: transparent;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 14px;
  outline: none;
}

.gv-folder-rename-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
```

### 6.3 CoAI 实现（Radix UI DropdownMenu）

CoAI 已有 Radix UI，直接复用：

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';

export function FolderContextMenu({ folder, onRename, onDelete, onPin }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="folder-more-btn opacity-0 group-hover:opacity-100">
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onRename}>
          <Pencil size={14} className="mr-2" /> 重命名
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPin}>
          <Pin size={14} className="mr-2" />
          {folder.pinned ? '取消固定' : '固定到顶部'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-red-500">
          <Trash2 size={14} className="mr-2" /> 删除文件夹
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

内联重命名组件：

```tsx
export function InlineRename({ value, onSave, onCancel }: Props) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave(text);
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="inline-rename flex items-center gap-1 flex-1">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(text)}
        className="flex-1 bg-transparent border border-blue-500 rounded px-1 py-0.5 text-sm outline-none"
        onClick={(e) => e.stopPropagation()}
      />
      <button onClick={() => onSave(text)} className="text-green-500 hover:text-green-600">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="text-red-500 hover:text-red-600">
        <X size={14} />
      </button>
    </div>
  );
}
```

---
```

---

## 7. 通知 Toast 系统

### 7.1 Gemini Voyager 的实现

三种类型（success/error/info），从右下角滑入，3 秒后自动消失：

```typescript
private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const notification = document.createElement('div');
  notification.className = `gv-notification gv-notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // 触发进入动画（需要一帧延迟）
  setTimeout(() => notification.classList.add('show'), 10);

  // 3 秒后退出动画，再 300ms 后移除 DOM
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
```

```css
.gv-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  z-index: 99999;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  max-width: 320px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.gv-notification.show {
  opacity: 1;
  transform: translateY(0);
}

.gv-notification-success {
  background: linear-gradient(135deg, #34a853 0%, #0d652d 100%);
}

.gv-notification-error {
  background: linear-gradient(135deg, #ea4335 0%, #c5221f 100%);
}

.gv-notification-info {
  background: linear-gradient(135deg, #1a73e8 0%, #1765cc 100%);
}
```

### 7.2 CoAI 实现建议

CoAI 可以使用 `sonner` 或 `react-hot-toast`（更轻量）：

```bash
npm install sonner
```

```tsx
// 在 App.tsx 根组件添加
import { Toaster } from 'sonner';
<Toaster position="bottom-right" richColors />

// 在任意组件中使用
import { toast } from 'sonner';
toast.success('文件夹创建成功');
toast.error('操作失败，请重试');
toast.info('已移动 3 个对话');
```

---

## 8. 深色模式适配

### 8.1 CSS 变量方案

Gemini Voyager 使用 CSS 变量统一管理颜色，通过多个选择器覆盖深色模式：

```css
/* 亮色模式默认值 */
:root {
  --folder-bg: #ffffff;
  --folder-text: #1f2937;
  --folder-border: #e5e7eb;
  --folder-hover-bg: rgba(0, 0, 0, 0.05);
  --folder-menu-bg: #ffffff;
  --folder-dragover-bg: rgba(66, 133, 244, 0.08);
  --folder-dragover-border: rgba(66, 133, 244, 0.4);
}

/* 深色模式（多选择器兼容不同框架） */
html.dark,
body.dark-theme,
[data-theme='dark'],
[data-color-scheme='dark'] {
  --folder-bg: #1e1e1e;
  --folder-text: #e8eaed;
  --folder-border: #3c4043;
  --folder-hover-bg: rgba(255, 255, 255, 0.08);
  --folder-menu-bg: #2d2e30;
  --folder-dragover-bg: rgba(138, 180, 248, 0.12);
  --folder-dragover-border: rgba(138, 180, 248, 0.5);
}
```

### 8.2 深色模式检测

```typescript
export function isDarkMode(): boolean {
  // 1. 检查 document root class
  if (document.documentElement.classList.contains('dark-mode')) return true;
  // 2. 检查 data 属性
  if (document.documentElement.getAttribute('data-theme') === 'dark') return true;
  // 3. 系统偏好
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return true;
  return false;
}
```

### 8.3 CoAI 深色模式

CoAI 使用 Tailwind CSS，深色模式通过 `dark:` 前缀实现：

```tsx
<div className="
  bg-white dark:bg-gray-900
  text-gray-900 dark:text-gray-100
  border-gray-200 dark:border-gray-700
">
```

---

## 9. CoAI React 实现方案

### 9.1 完整组件树

```
FolderSidebar
├── DndContext (拖拽上下文)
│   ├── FolderList
│   │   ├── SortableContext (文件夹排序)
│   │   │   └── FolderItem (可拖拽文件夹)
│   │   │       ├── FolderHeader
│   │   │       │   ├── ExpandButton
│   │   │       │   ├── FolderIcon (带颜色)
│   │   │       │   ├── FolderName / InlineRename
│   │   │       │   ├── PinButton
│   │   │       │   └── FolderContextMenu (Radix DropdownMenu)
│   │   │       └── FolderContent (AnimatePresence 展开/折叠)
│   │   │           ├── SubFolderList (子文件夹)
│   │   │           └── SortableContext (对话排序)
│   │   │               └── DraggableConversation
│   │   └── UnfiledConversations (未分类对话)
│   └── DragOverlay (拖拽预览)
│
├── MultiSelectBar (多选模式指示条)
└── FolderColorPicker (颜色选择器弹窗)
```

### 9.2 Redux Store 设计

```typescript
// store/folderSlice.ts
interface FolderState {
  folders: Folder[];
  loading: boolean;
  dragOverFolderId: string | null;
  multiSelect: {
    active: boolean;
    selectedIds: string[];
    sourceFolderId: string | null;
  };
}

const folderSlice = createSlice({
  name: 'folder',
  initialState,
  reducers: {
    setFolders: (state, action) => { state.folders = action.payload; },
    addFolder: (state, action) => { state.folders.push(action.payload); },
    updateFolder: (state, action) => {
      const idx = state.folders.findIndex((f) => f.id === action.payload.id);
      if (idx !== -1) state.folders[idx] = { ...state.folders[idx], ...action.payload };
    },
    removeFolder: (state, action) => {
      state.folders = state.folders.filter((f) => f.id !== action.payload);
    },
    reorderFolders: (state, action) => {
      const { activeId, overId } = action.payload;
      const oldIndex = state.folders.findIndex((f) => f.id === activeId);
      const newIndex = state.folders.findIndex((f) => f.id === overId);
      state.folders = arrayMove(state.folders, oldIndex, newIndex);
    },
    setDragOverFolder: (state, action) => { state.dragOverFolderId = action.payload; },
  },
});
```

### 9.3 依赖清单

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x",
  "framer-motion": "^11.x",
  "sonner": "^1.x",
  "lucide-react": "已有",
  "@radix-ui/react-dropdown-menu": "已有"
}
```

---

## 10. 完整 CSS 参考

以下是 CoAI 文件夹管理所需的完整 CSS（基于 Gemini Voyager 提炼，适配 Tailwind 项目）：

```css
/* ===== 文件夹容器 ===== */
.folder-container { margin-bottom: 16px; }

/* ===== 文件夹头部 ===== */
.folder-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}
.folder-header:hover { background-color: var(--folder-hover-bg); }
.folder-header.drag-over {
  background-color: var(--folder-dragover-bg);
  outline: 2px dashed var(--folder-dragover-border);
}

/* ===== 操作按钮（悬停显示） ===== */
.folder-action-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.folder-header:hover .folder-action-btn { opacity: 1; }

/* ===== 拖拽光标 ===== */
.draggable { cursor: grab; }
.draggable:active { cursor: grabbing; }

/* ===== 拖拽预览 ===== */
.drag-preview {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.9;
  transform: rotate(2deg);  /* 轻微旋转，更自然 */
}

/* ===== 选中状态 ===== */
.conversation-selected {
  position: relative;
  background: linear-gradient(to right, rgba(66, 133, 244, 0.08) 0%, transparent 100%);
  border-radius: 8px;
}
.conversation-selected::before {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 60%;
  background: #4285f4;
  border-radius: 0 2px 2px 0;
}

/* ===== 收藏状态 ===== */
.conversation-starred {
  background: linear-gradient(to right, rgba(251, 191, 36, 0.08) 0%, transparent 100%);
}
.conversation-starred::before {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 60%;
  background: #fbbf24;
  border-radius: 0 2px 2px 0;
}

/* ===== 抖动动画 ===== */
.invalid-shake {
  animation: invalidShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
@keyframes invalidShake {
  0%, 100% { transform: translateX(0); }
  10%, 50%, 90% { transform: translateX(-4px); }
  30%, 70% { transform: translateX(4px); }
}

/* ===== 颜色选择器 ===== */
.color-swatch {
  width: 24px; height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.1s ease;
}
.color-swatch:hover { transform: scale(1.2); }
.color-swatch.selected {
  border-color: white;
  box-shadow: 0 0 0 2px currentColor;
  transform: scale(1.1);
}

/* ===== 多选指示条 ===== */
.multi-select-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--folder-bg);
  border-bottom: 1px solid var(--folder-border);
  font-size: 14px;
}
.multi-select-delete-btn { color: #ef4444; }
.multi-select-delete-btn:hover { background-color: rgba(239, 68, 68, 0.12); }
.multi-select-action-btn:active { transform: scale(0.95); }
```

---

*本报告基于 Gemini Voyager v1.2.8 源码深度分析，日期 2026-02-26。*
