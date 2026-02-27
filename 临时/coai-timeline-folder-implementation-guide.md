# CoAI 时间轴导航 + 文件夹管理 实现指南

> **目标项目**: CoAI (ChatNio)  
> **参考来源**: Gemini Voyager 功能设计  
> **技术栈**: Golang (Gin) + React + MySQL + Redis  
> **报告日期**: 2026-02-26

---

## 目录

1. [整体规划](#1-整体规划)
2. [Phase 1：时间轴导航](#2-phase-1时间轴导航)
3. [Phase 2：文件夹管理](#3-phase-2文件夹管理)
4. [数据库设计](#4-数据库设计)
5. [后端 API 设计](#5-后端-api-设计)
6. [前端组件设计](#6-前端组件设计)
7. [状态管理方案](#7-状态管理方案)
8. [实施检查清单](#8-实施检查清单)

---

## 1. 整体规划

### 1.1 两个功能的依赖关系

```
时间轴导航（独立，无依赖）
    ↓ 可单独上线
文件夹管理（依赖对话列表重构）
    ↓ 需要侧边栏改造
```

建议**先上时间轴，再上文件夹**，降低风险。

### 1.2 与 Gemini Voyager 的核心差异

| 问题 | Gemini Voyager 的解法 | CoAI 的解法 |
|------|----------------------|-------------|
| 获取消息列表 | 逆向解析 Gemini DOM | 直接查数据库 |
| 数据持久化 | chrome.storage | MySQL |
| 跨设备同步 | Google Drive OAuth2 | 天然支持（服务端数据） |
| 多用户隔离 | 账户 ID hash | user_id 外键 |
| 收藏消息 | Background SW 串行队列 | 普通 REST API |

---

## 3. Phase 2：文件夹管理

### 3.1 功能定义

在侧边栏对话列表上方增加文件夹树，支持：
- 创建/重命名/删除文件夹（两级层级）
- 将对话拖入文件夹
- 文件夹内拖拽排序
- 自定义文件夹颜色
- 文件夹展开/折叠

### 3.2 数据库设计

```sql
-- 文件夹表
CREATE TABLE folders (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
    user_id     INT          NOT NULL,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(20)  NULL,
    parent_id   VARCHAR(36)  NULL,           -- NULL = 顶级文件夹
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL,
    INDEX idx_folders_user (user_id),
    INDEX idx_folders_parent (parent_id)
);

-- 对话表新增 folder_id 字段
ALTER TABLE conversations ADD COLUMN folder_id VARCHAR(36) NULL;
ALTER TABLE conversations ADD COLUMN folder_order INT NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD INDEX idx_conversations_folder (folder_id);
```

### 3.3 后端 API 设计

```
GET    /api/folder              # 获取当前用户所有文件夹
POST   /api/folder              # 创建文件夹
PUT    /api/folder/:id          # 更新文件夹（名称/颜色）
DELETE /api/folder/:id          # 删除文件夹（对话移出，不删除对话）
PUT    /api/folder/reorder      # 批量更新排序

POST   /api/conversation/:id/move   # 将对话移入/移出文件夹
```

**Golang Model**：

```go
// model/folder.go
type Folder struct {
    Id        string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
    UserId    int       `json:"user_id" gorm:"not null"`
    Name      string    `json:"name" gorm:"not null;size:100"`
    Color     string    `json:"color" gorm:"size:20"`
    ParentId  *string   `json:"parent_id" gorm:"type:varchar(36)"`
    SortOrder int       `json:"sort_order" gorm:"not null;default:0"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

**创建文件夹 Controller**：

```go
func CreateFolder(c *gin.Context) {
    userId := c.GetInt("id")
    var req struct {
        Name     string  `json:"name" binding:"required,max=100"`
        Color    string  `json:"color"`
        ParentId *string `json:"parent_id"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"success": false, "message": err.Error()})
        return
    }

    // 限制最多两级（parent 不能再有 parent）
    if req.ParentId != nil {
        var parent model.Folder
        if err := model.DB.Where("id = ? AND user_id = ? AND parent_id IS NULL",
            *req.ParentId, userId).First(&parent).Error; err != nil {
            c.JSON(400, gin.H{"success": false, "message": "只支持两级文件夹"})
            return
        }
    }

    folder := model.Folder{
        Id:       uuid.New().String(),
        UserId:   userId,
        Name:     req.Name,
        Color:    req.Color,
        ParentId: req.ParentId,
    }
    model.DB.Create(&folder)
    c.JSON(200, gin.H{"success": true, "data": folder})
}
```

**移动对话 Controller**：

```go
func MoveConversation(c *gin.Context) {
    convId := c.Param("id")
    userId := c.GetInt("id")
    var req struct {
        FolderId *string `json:"folder_id"` // null = 移出文件夹
    }
    c.ShouldBindJSON(&req)

    // 验证对话属于当前用户
    result := model.DB.Model(&model.Conversation{}).
        Where("id = ? AND user_id = ?", convId, userId).
        Update("folder_id", req.FolderId)

    if result.RowsAffected == 0 {
        c.JSON(403, gin.H{"success": false, "message": "无权操作"})
        return
    }
    c.JSON(200, gin.H{"success": true})
}
```

### 3.4 前端组件结构

```
src/components/Folder/
├── FolderTree.tsx         # 文件夹树（侧边栏集成）
├── FolderItem.tsx         # 单个文件夹节点
├── FolderColorPicker.tsx  # 颜色选择器
├── FolderContextMenu.tsx  # 右键菜单（重命名/删除）
└── useFolderDnd.ts        # 拖拽逻辑（基于 @dnd-kit/core）
```

### 3.5 FolderTree 核心实现

```tsx
// FolderTree.tsx
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function FolderTree() {
  const { folders, conversations, moveConversation, reorderFolders } = useFolderStore();

  // 构建树形结构
  const rootFolders = folders.filter((f) => !f.parent_id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    // 对话拖入文件夹
    if (active.data.current?.type === 'conversation') {
      moveConversation(active.id as string, over.id as string);
    }
    // 文件夹排序
    else if (active.data.current?.type === 'folder') {
      reorderFolders(active.id as string, over.id as string);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="folder-tree px-2 py-1">
        {rootFolders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            subFolders={folders.filter((f) => f.parent_id === folder.id)}
            conversations={conversations.filter((c) => c.folder_id === folder.id)}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

### 3.6 FolderItem 实现

```tsx
// FolderItem.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function FolderItem({ folder, subFolders, conversations }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: folder.id,
    data: { type: 'folder' },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* 文件夹头部 */}
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {/* 拖拽手柄 */}
        <span {...listeners} className="opacity-0 group-hover:opacity-100 cursor-grab">⠿</span>

        {/* 文件夹图标（带颜色） */}
        <span style={{ color: folder.color || '#6b7280' }}>
          {expanded ? '📂' : '📁'}
        </span>

        {/* 名称（支持内联重命名） */}
        {renaming ? (
          <input
            autoFocus
            defaultValue={folder.name}
            onBlur={(e) => { renameFolder(folder.id, e.target.value); setRenaming(false); }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="flex-1 bg-transparent outline-none text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate">{folder.name}</span>
        )}

        {/* 右键菜单触发 */}
        <FolderContextMenu
          folder={folder}
          onRename={() => setRenaming(true)}
          onDelete={() => deleteFolder(folder.id)}
        />
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="ml-4">
          {subFolders.map((sub) => (
            <FolderItem key={sub.id} folder={sub} subFolders={[]} conversations={
              conversations.filter((c) => c.folder_id === sub.id)
            } />
          ))}
          {conversations.map((conv) => (
            <ConversationItem key={conv.id} conversation={conv} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 4. 数据库设计（汇总）

```sql
-- 完整 migration 文件

-- 1. 文件夹表
CREATE TABLE IF NOT EXISTS folders (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    user_id     INT          NOT NULL,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(20)  NULL,
    parent_id   VARCHAR(36)  NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- 2. 对话表扩展
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS folder_id    VARCHAR(36) NULL,
    ADD COLUMN IF NOT EXISTS folder_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS starred      BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. 消息表扩展
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_folders_user   ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_conv_folder    ON conversations(folder_id);
CREATE INDEX IF NOT EXISTS idx_msg_starred    ON messages(conversation_id, starred);
```

---

## 5. 后端 API 设计（汇总）

### 5.1 文件夹 API

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/folder` | 获取当前用户所有文件夹（含子文件夹） |
| `POST` | `/api/folder` | 创建文件夹 |
| `PUT` | `/api/folder/:id` | 更新文件夹（名称/颜色） |
| `DELETE` | `/api/folder/:id` | 删除文件夹（对话移出，不删除） |
| `PUT` | `/api/folder/reorder` | 批量更新排序 |

### 5.2 对话 API（新增）

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/api/conversation/:id/move` | 移入/移出文件夹 |

### 5.3 消息 API（新增）

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/api/message/:id/star` | 收藏消息 |
| `DELETE` | `/api/message/:id/star` | 取消收藏 |
| `GET` | `/api/conversation/:id/starred` | 获取对话的收藏消息 |

### 5.4 响应格式（统一）

```json
// 成功
{ "success": true, "data": { ... } }

// 失败
{ "success": false, "message": "错误描述" }
```

---

## 6. 前端组件设计（汇总）

### 6.1 组件树

```
App
├── Sidebar
│   ├── FolderTree          ← 新增
│   │   ├── FolderItem
│   │   │   ├── FolderContextMenu
│   │   │   └── ConversationItem（文件夹内）
│   │   └── UnfiledConversations（未分类对话）
│   └── ...（原有侧边栏内容）
│
└── ChatPage
    ├── MessageList
    │   └── MessageItem     ← 加 data-message-id 属性
    └── TimelinePanel       ← 新增（浮动定位）
        └── TimelineNode
```

### 6.2 依赖安装

```bash
# 拖拽库（比原生 HTML5 DnD 更好用）
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# 颜色选择器（可选）
npm install react-colorful
```

---

## 7. 状态管理方案

CoAI 使用 Redux，建议新增两个 slice：

### 7.1 folderSlice

```typescript
// store/folderSlice.ts
interface FolderState {
  folders: Folder[];
  loading: boolean;
}

const folderSlice = createSlice({
  name: 'folder',
  initialState: { folders: [], loading: false } as FolderState,
  reducers: {
    setFolders: (state, action) => { state.folders = action.payload; },
    addFolder:  (state, action) => { state.folders.push(action.payload); },
    updateFolder: (state, action) => {
      const idx = state.folders.findIndex((f) => f.id === action.payload.id);
      if (idx !== -1) state.folders[idx] = action.payload;
    },
    removeFolder: (state, action) => {
      state.folders = state.folders.filter((f) => f.id !== action.payload);
    },
  },
});
```

### 7.2 timelineSlice

```typescript
// store/timelineSlice.ts
interface TimelineState {
  visible: boolean;
  activeMessageId: string | null;
}

const timelineSlice = createSlice({
  name: 'timeline',
  initialState: { visible: true, activeMessageId: null } as TimelineState,
  reducers: {
    toggleTimeline: (state) => { state.visible = !state.visible; },
    setActiveMessage: (state, action) => { state.activeMessageId = action.payload; },
  },
});
```

---

## 8. 实施检查清单

### Phase 1：时间轴导航

- [ ] 数据库：`messages` 表加 `starred` 字段
- [ ] 后端：实现 `POST/DELETE /api/message/:id/star`
- [ ] 后端：实现 `GET /api/conversation/:id/starred`
- [ ] 前端：消息组件加 `data-message-id` 属性
- [ ] 前端：实现 `useTimeline` Hook（滚动 + 键盘 + IntersectionObserver）
- [ ] 前端：实现 `TimelinePanel` 组件（浮动面板）
- [ ] 前端：实现 `TimelineNode` 组件（节点 + 收藏按钮）
- [ ] 前端：Redux `timelineSlice` 状态管理
- [ ] 前端：在 `ChatPage` 中集成 `TimelinePanel`
- [ ] 测试：键盘导航 `j`/`k` 在输入框聚焦时不触发

### Phase 2：文件夹管理

- [ ] 数据库：创建 `folders` 表
- [ ] 数据库：`conversations` 表加 `folder_id`、`folder_order` 字段
- [ ] 后端：实现文件夹 CRUD API（5 个接口）
- [ ] 后端：实现 `POST /api/conversation/:id/move`
- [ ] 后端：两级层级限制校验
- [ ] 前端：安装 `@dnd-kit/core` 等依赖
- [ ] 前端：实现 `FolderTree` 组件
- [ ] 前端：实现 `FolderItem` 组件（含拖拽、重命名、颜色）
- [ ] 前端：实现 `FolderContextMenu` 右键菜单
- [ ] 前端：实现 `useFolderDnd` 拖拽逻辑
- [ ] 前端：Redux `folderSlice` 状态管理
- [ ] 前端：侧边栏集成 `FolderTree`
- [ ] 测试：拖拽对话到文件夹
- [ ] 测试：删除文件夹后对话不丢失

---

*本指南基于 CoAI (ChatNio) 架构分析 + Gemini Voyager 功能设计，日期 2026-02-26。*


### 2.1 功能定义

在对话页面右侧注入一个浮动面板，展示当前对话的所有消息节点，支持：
- 点击节点跳转到对应消息
- 对消息打星收藏
- `j`/`k` 键盘导航
- 面板可折叠/展开

### 2.2 后端改动

#### 新增字段：消息收藏

在现有 `messages` 表加一个字段：

```sql
ALTER TABLE messages ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD INDEX idx_messages_starred (conversation_id, starred);
```

#### 新增 API 接口

```
POST   /api/message/:id/star          # 收藏消息
DELETE /api/message/:id/star          # 取消收藏
GET    /api/conversation/:id/starred  # 获取某对话的所有收藏消息
```

**Golang 实现示例**：

```go
// router/api.go
messageGroup := router.Group("/api/message")
{
    messageGroup.POST("/:id/star",   middleware.Auth(), StarMessage)
    messageGroup.DELETE("/:id/star", middleware.Auth(), UnstarMessage)
}
conversationGroup.GET("/:id/starred", middleware.Auth(), GetStarredMessages)
```

```go
// controller/message.go
func StarMessage(c *gin.Context) {
    messageId := c.Param("id")
    userId := c.GetInt("id") // 从 JWT 中间件获取

    var msg model.Message
    if err := model.DB.Where("id = ? AND user_id = ?", messageId, userId).First(&msg).Error; err != nil {
        c.JSON(403, gin.H{"success": false, "message": "无权操作"})
        return
    }
    model.DB.Model(&msg).Update("starred", true)
    c.JSON(200, gin.H{"success": true})
}
```

### 2.3 前端组件结构

```
src/components/Timeline/
├── TimelinePanel.tsx      # 主面板容器（浮动定位）
├── TimelineNode.tsx       # 单个消息节点
├── TimelineStarButton.tsx # 收藏按钮
└── useTimeline.ts         # 核心 Hook（滚动、键盘、数据）
```

### 2.4 TimelinePanel 核心实现

```tsx
// TimelinePanel.tsx
export function TimelinePanel({ conversationId, messages }: Props) {
  const { activeIndex, scrollToMessage, starMessage } = useTimeline(messages);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`fixed right-4 top-1/2 -translate-y-1/2 z-50
      bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
      rounded-xl shadow-lg transition-all ${collapsed ? 'w-8' : 'w-48'}`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100"
      >
        {collapsed ? '›' : '‹'}
      </button>

      {!collapsed && (
        <div className="p-2 max-h-[70vh] overflow-y-auto">
          {messages.map((msg, index) => (
            <TimelineNode
              key={msg.id}
              message={msg}
              isActive={index === activeIndex}
              onClick={() => scrollToMessage(index)}
              onStar={() => starMessage(msg.id, !msg.starred)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 2.5 useTimeline Hook

```typescript
// useTimeline.ts
export function useTimeline(messages: Message[]) {
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToMessage = useCallback((index: number) => {
    const el = document.querySelector(`[data-message-id="${messages[index].id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setActiveIndex(index);
  }, [messages]);

  // j/k 键盘导航（输入框聚焦时不触发）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag)) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === 'j') scrollToMessage(Math.min(activeIndex + 1, messages.length - 1));
      else if (e.key === 'k') scrollToMessage(Math.max(activeIndex - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIndex, messages, scrollToMessage]);

  // IntersectionObserver 自动更新 activeIndex
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-message-id');
            const idx = messages.findIndex((m) => m.id === id);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll('[data-message-id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [messages]);

  const starMessage = useCallback(async (messageId: string, starred: boolean) => {
    const method = starred ? 'POST' : 'DELETE';
    await fetch(`/api/message/${messageId}/star`, { method });
    // 触发消息列表刷新（Redux dispatch 或 React Query invalidate）
  }, []);

  return { activeIndex, scrollToMessage, starMessage };
}
```

### 2.6 消息组件改造

在现有消息渲染组件上加 `data-message-id` 属性：

```tsx
// 改造前
<div className="message-item">...</div>

// 改造后
<div className="message-item" data-message-id={message.id}>...</div>
```

---
