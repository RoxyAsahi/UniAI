# 预设自动创建文件夹 — 实现方案

## 目标

用户在预设市场点击"使用预设"时，自动为该预设创建（或复用）一个文件夹。该预设产生的所有对话都存放在这个文件夹中，文件夹名字 = 预设名字，图标 = 预设 emoji。

---

## 数据流

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
  → dispatch preflightHistory({ name: mask.name, avatar: mask.avatar, folder_id: folderId })
  → 侧边栏出现带 emoji 的条目（在文件夹内）

AI 回复，conversation 升级
  → receive()
  → dispatch upgradePreflight(realId)
  → moveConversation(realId, mask_folder_id)   ← API 调用
  → dispatch updateConversationFolder({ id: realId, folderId: mask_folder_id })
  → dispatch clearMaskFolderId()
```

---

## 修改文件汇总

### 后端（3 个文件）

| 文件 | 修改内容 |
|------|---------|
| `connection/db_migration.go` | MySQL + SQLite 两条路径各加一行：`ALTER TABLE folders ADD COLUMN avatar VARCHAR(100) NULL` |
| `manager/conversation/folder.go` | `Folder` struct 新增 `Avatar *string json:"avatar"`；`CreateFolder` 签名加 `avatar *string`；SQL INSERT 加 `avatar`；`ListFolders` SELECT 加 `avatar` |
| `manager/conversation/folder_api.go` | `CreateFolderForm` 加 `Avatar *string json:"avatar"`；`CreateFolderAPI` 将 `form.Avatar` 传给 `CreateFolder` |

### 前端（5 个文件）

| 文件 | 修改内容 |
|------|---------|
| `app/src/api/folder.ts` | `Folder` interface 加 `avatar?: string`；`createFolder(name, color?, avatar?, parentId?)` |
| `app/src/store/chat.ts` | state 加 `mask_folder_id: number \| null`；新增 `setMaskFolderId` / `clearMaskFolderId` reducer；`clearMaskItem` 同时清 `mask_folder_id`；`mask()` 接受 `folderId` 参数；`send()` 将 `folder_id` 写入 preflight；`receive()` 升级后调用 `moveConversation` |
| `app/src/routes/Preset.tsx` | `handleUseMask` 改为 async：先 find-or-create 文件夹，再调 `mask(mask, folderId)` |
| `app/src/components/folder/FolderItem.tsx` | 文件夹头部：若 `folder.avatar` 存在，渲染 `<Emoji emoji={folder.avatar} />` 替代 `<FolderIcon>` |
| `app/src/store/folder.ts` | （可选）无需改动，`Folder` 类型从 `api/folder.ts` 导入 |

---

## 关键实现细节

### find-or-create 逻辑（Preset.tsx）

```typescript
const handleUseMask = async (mask: Mask) => {
  if (auth) {
    // 1. 在已加载的 folders 中按名字查找
    let folder = folders.find(f => f.name === mask.name);
    if (!folder) {
      // 2. 不存在则创建，带 avatar
      const created = await createFolder(mask.name, undefined, mask.avatar);
      if (created) {
        dispatch(addFolder(created));
        folder = created;
      }
    }
    setMaskAction(mask, folder?.id);
  } else {
    setMaskAction(mask);
  }
  router.navigate("/");
};
```

### preflightHistory 携带 folder_id（chat.ts send()）

```typescript
if (mask) {
  dispatch(preflightHistory({ name: mask.name, avatar: mask.avatar, folder_id: maskFolderId ?? undefined }));
}
```

### receive() 自动移入文件夹

```typescript
if (maskAvatar && maskFolderId) {
  dispatch(upgradePreflight(target));
  moveConversation(target, maskFolderId);          // fire-and-forget
  dispatch(updateConversationFolder({ id: target, folderId: maskFolderId }));
  dispatch(clearMaskFolderId());
  refresh();
}
```

### FolderItem 显示 emoji

```tsx
<span className="shrink-0">
  {folder.avatar ? (
    <Emoji emoji={folder.avatar} />
  ) : expanded ? (
    <FolderOpen className="h-4 w-4" style={{ color: folder.color || undefined }} />
  ) : (
    <FolderIcon className="h-4 w-4" style={{ color: folder.color || undefined }} />
  )}
</span>
```

---

## 行为说明

| 操作 | 预期行为 |
|------|---------|
| 首次使用某预设 | 自动创建同名文件夹（带 emoji），`mask_folder_id` 写入 Redux |
| 再次使用同一预设 | 复用已有文件夹（按名字匹配） |
| 发送第一条消息 | 侧边栏文件夹内出现带 emoji 的对话条目 |
| AI 回复后 | 对话升级为真实 ID，自动移入预设文件夹，DB 持久化 |
| 刷新浏览器 | 文件夹 + emoji 从 DB 恢复，对话仍在文件夹内 |
| 未登录用户使用预设 | 跳过文件夹创建，行为与之前相同 |
