# 时间轴导航 + 文件夹管理 — 可行性分析与适配方案

> 基于对 CoAI 项目实际代码的深入分析，对照 `临时/coai-timeline-folder-implementation-guide.md` 的设计

---

## 1. 指南假设 vs 项目实际 — 关键差异

| 维度 | 指南假设 | 项目实际 | 影响 |
|------|---------|---------|------|
| ORM | GORM | 原生 `database/sql` | 所有 Go model 代码需重写 |
| 用户表 | `users` | `auth` | 外键引用需改为 `auth(id)` |
| 消息存储 | 独立 `messages` 表，每条消息有 ID | JSON blob 存在 `conversation.data` (MEDIUMTEXT) | **最大障碍** — 无法直接给消息加 `starred` 字段 |
| 对话 ID | UUID (VARCHAR 36) | 自增 INT (`conversation_id`) | 文件夹关联字段类型需调整 |
| 拖拽库 | `@dnd-kit/core` | 已有 `react-beautiful-dnd` | 可复用现有依赖 |
| 状态管理 | 建议新增 slice | Redux Toolkit `createSlice` | 兼容，可直接新增 |

---

## 2. 结论：可以实现，但需要适配

两个功能都可以实现，但指南中的代码不能直接复制粘贴，需要针对以下核心差异做适配：

### 2.1 消息收藏（时间轴 Phase 1 的核心难点）

项目没有独立的 `messages` 表。消息以 JSON 数组存储在 `conversation.data` 中，每条消息通过数组索引（而非 ID）标识。

**推荐方案：新建 `starred_messages` 表**

```sql
CREATE TABLE IF NOT EXISTS starred_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  conversation_id INT NOT NULL,
  message_index INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth(id) ON DELETE CASCADE,
  UNIQUE KEY (user_id, conversation_id, message_index)
);
```

这样不需要改动现有的消息存储结构，只需要一张关联表记录"哪个用户收藏了哪个对话的第几条消息"。

### 2.2 文件夹管理（Phase 2）

相对直接，主要调整：
- 外键引用 `auth(id)` 而非 `users(id)`
- `conversation` 表的 `folder_id` 类型用 INT（与现有 conversation_id 风格一致）
- Go 代码用原生 SQL 而非 GORM
- 前端拖拽用已有的 `react-beautiful-dnd` 而非 `@dnd-kit`

---

## 3. 适配后的数据库设计

### 3.1 文件夹表（新建）

```sql
CREATE TABLE IF NOT EXISTS folders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NULL,
  parent_id INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);
```

### 3.2 对话表扩展

```sql
ALTER TABLE conversation
  ADD COLUMN folder_id INT NULL,
  ADD COLUMN folder_order INT NOT NULL DEFAULT 0;
```

### 3.3 收藏消息表（新建）

```sql
CREATE TABLE IF NOT EXISTS starred_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  conversation_id INT NOT NULL,
  message_index INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth(id) ON DELETE CASCADE,
  UNIQUE KEY (user_id, conversation_id, message_index)
);
```

---

## 4. 适配后的后端 API 设计

### 4.1 文件夹 API（新建 `folder/` 包）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/conversation/folders` | 获取当前用户所有文件夹 |
| POST | `/conversation/folder` | 创建文件夹 |
| POST | `/conversation/folder/update` | 更新文件夹（名称/颜色） |
| GET | `/conversation/folder/delete` | 删除文件夹 |
| POST | `/conversation/folder/reorder` | 批量更新排序 |
| POST | `/conversation/move` | 将对话移入/移出文件夹 |

> 路由风格与现有 `/conversation/rename`、`/conversation/delete` 保持一致

### 4.2 收藏 API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/conversation/star` | 收藏消息 (body: conversation_id + message_index) |
| POST | `/conversation/unstar` | 取消收藏 |
| GET | `/conversation/starred` | 获取某对话的收藏消息索引列表 |

### 4.3 Go 代码风格适配

指南用 GORM，实际项目用原生 SQL。示例对比：

```go
// 指南写法（GORM）— 不适用
model.DB.Create(&folder)

// 适配写法（原生 SQL）— 与项目风格一致
func CreateFolder(db *sql.DB, userId int, name string, color string, parentId *int) (int64, error) {
    result, err := globals.ExecDb(db, `
        INSERT INTO folders (user_id, name, color, parent_id) VALUES (?, ?, ?, ?)
    `, userId, name, color, parentId)
    if err != nil {
        return 0, err
    }
    return result.LastInsertId()
}
```

---

## 5. 适配后的前端设计

### 5.1 时间轴导航

时间轴面板可以纯前端实现，因为消息数据已经在 Redux store 中（`conversations[current].messages`）。

关键适配点：
- 消息没有 `id`，用数组 `index` 作为标识
- `data-message-id` 改为 `data-message-index`
- `useTimeline` hook 中的 `scrollToMessage` 用 index 定位
- 收藏状态从 `starred_messages` API 获取，与本地消息数组合并

### 5.2 文件夹管理

- 用已有的 `react-beautiful-dnd` 替代 `@dnd-kit`
- 新增 `folderSlice` 到 Redux store
- 在 `SideBar.tsx` 中集成 `FolderTree` 组件
- `ConversationInstance` 类型扩展 `folder_id` 字段

### 5.3 组件结构

```
app/src/components/
├── home/
│   ├── SideBar.tsx          ← 集成 FolderTree
│   ├── ConversationItem.tsx ← 支持拖拽到文件夹
│   └── ...
├── folder/                  ← 新增
│   ├── FolderTree.tsx
│   ├── FolderItem.tsx
│   ├── FolderContextMenu.tsx
│   └── FolderColorPicker.tsx
└── timeline/                ← 新增
    ├── TimelinePanel.tsx
    ├── TimelineNode.tsx
    └── useTimeline.ts
```

### 5.4 Redux 新增

```
app/src/store/
├── folder.ts    ← 新增 folderSlice
├── timeline.ts  ← 新增 timelineSlice
└── index.ts     ← 注册新 reducer
```

---

## 6. 实施顺序建议

与指南一致，先时间轴后文件夹，降低风险。

### Phase 1：时间轴导航

1. 后端：在 `connection/database.go` 添加 `CreateStarredMessagesTable`
2. 后端：在 `connection/db_migration.go` 添加迁移逻辑
3. 后端：新建 `manager/conversation/star.go` 实现收藏 CRUD
4. 后端：在 `manager/conversation/router.go` 注册新路由
5. 前端：新建 `store/timeline.ts` (timelineSlice)
6. 前端：新建 `components/timeline/useTimeline.ts`
7. 前端：新建 `components/timeline/TimelinePanel.tsx`
8. 前端：新建 `components/timeline/TimelineNode.tsx`
9. 前端：消息渲染组件添加 `data-message-index` 属性
10. 前端：在聊天页面集成 TimelinePanel

### Phase 2：文件夹管理

1. 后端：在 `connection/database.go` 添加 `CreateFoldersTable`
2. 后端：在 `connection/db_migration.go` 添加 conversation 表扩展迁移
3. 后端：新建 `manager/conversation/folder.go` 实现文件夹 CRUD
4. 后端：在 `manager/conversation/router.go` 注册文件夹路由
5. 后端：修改 `LoadConversationList` 返回 `folder_id`
6. 前端：新建 `store/folder.ts` (folderSlice)
7. 前端：新建 `components/folder/FolderTree.tsx`
8. 前端：新建 `components/folder/FolderItem.tsx`
9. 前端：新建 `components/folder/FolderContextMenu.tsx`
10. 前端：修改 `SideBar.tsx` 集成文件夹树
11. 前端：修改 `ConversationItem.tsx` 支持拖拽
12. 前端：扩展 `ConversationInstance` 类型添加 `folder_id`
