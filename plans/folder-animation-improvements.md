# Folder System Animation & UX Improvements

## Gap Analysis Summary

### Animations (main focus)
- Folder expand/collapse: plain `{expanded && <div>}` → needs Framer Motion AnimatePresence
- Drag-over highlight: basic ring → needs dashed border outline
- Conversation items in folders: no enter/exit animation
- Shake animation for invalid ops: not implemented
- Drag preview: react-beautiful-dnd default, no custom styling

### Functional gaps
- `handleColorPick` in FolderTree.tsx is a no-op TODO
- No FolderColorPicker component
- No FOLDER_COLORS constant

### UX gaps
- Inline rename: no Save/Cancel buttons, Enter only calls blur()
- Folder ops (create/rename/delete) have no toast feedback
- Hardcoded English strings: "Drag conversations here", "New folder", "Folders", "Save", "Cancel"

### Redux store gap
- Missing `dragOverFolderId: number | null` state in store/folder.ts

---

## Files to Change

| File | Change |
|------|--------|
| `app/src/components/folder/FolderItem.tsx` | AnimatePresence expand/collapse; motion.div on conv items; dashed drag-over via store; Save/Cancel rename buttons |
| `app/src/components/folder/FolderTree.tsx` | Toast notifications; wire color picker; i18n strings |
| `app/src/components/folder/FolderContextMenu.tsx` | Replace color callback with Popover + FolderColorPicker |
| `app/src/store/folder.ts` | Add `dragOverFolderId` + `setDragOverFolder` reducer |
| `app/src/components/home/SideBar.tsx` | `onDragUpdate` → dispatch setDragOverFolder; clear on end |
| `app/src/assets/pages/home.less` | `.folder-header.drag-over` dashed border; `@keyframes invalidShake` |
| `app/src/components/folder/FolderColorPicker.tsx` | NEW — color swatch grid |
| i18n files (cn/en/tw/ja/ru) | Add `folder.drag-here`, `folder.new-folder`, `folder.section-title`, `folder.save`, `folder.cancel` |

---

## Implementation Details

### 1. FolderItem.tsx — AnimatePresence expand/collapse

```tsx
import { motion, AnimatePresence } from "framer-motion";

// Replace {expanded && <div className="ml-4">...}  with:
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
      {/* sub-folders + conversations */}
    </motion.div>
  )}
</AnimatePresence>
```

### 2. FolderItem.tsx — drag-over dashed border

Read `dragOverFolderId` from Redux store. Apply class when `dragOverFolderId === folder.id`.

```tsx
const dragOverFolderId = useSelector((s: RootState) => s.folder.dragOverFolderId);
const isDragOver = dragOverFolderId === folder.id;

<div className={cn("folder-header", isDragOver && "drag-over")} ...>
```

### 3. FolderItem.tsx — conversation item animations

```tsx
<motion.div
  layout
  initial={{ opacity: 0, x: -8 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -8 }}
  transition={{ duration: 0.15 }}
>
  {/* conversation content */}
</motion.div>
```

### 4. FolderItem.tsx — inline rename Save/Cancel

```tsx
{renaming ? (
  <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
    <input
      ref={renameInputRef}
      autoFocus
      defaultValue={folder.name}
      className="flex-1 bg-transparent outline-none text-sm border-b border-primary min-w-0"
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSaveRename(e.currentTarget.value);
        if (e.key === "Escape") setRenaming(false);
      }}
    />
    <button onClick={() => handleSaveRename(renameInputRef.current?.value || "")}
      className="text-green-500 hover:text-green-600 shrink-0">
      <Check className="h-3 w-3" />
    </button>
    <button onClick={() => setRenaming(false)}
      className="text-red-500 hover:text-red-600 shrink-0">
      <X className="h-3 w-3" />
    </button>
  </div>
) : (
  <span className="flex-1 truncate">{folder.name}</span>
)}
```

### 5. store/folder.ts — dragOverFolderId

```typescript
interface FolderState {
  folders: Folder[];
  loading: boolean;
  dragOverFolderId: number | null;
}

// reducer:
setDragOverFolder: (state, action: PayloadAction<number | null>) => {
  state.dragOverFolderId = action.payload;
},
```

### 6. SideBar.tsx — onDragUpdate

```tsx
const handleDragUpdate = (update: DragUpdate) => {
  const { destination } = update;
  if (destination?.droppableId.startsWith("folder-")) {
    const folderId = parseInt(destination.droppableId.replace("folder-", ""));
    dispatch(setDragOverFolder(folderId));
  } else {
    dispatch(setDragOverFolder(null));
  }
};

<DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
```

### 7. home.less — CSS additions

```css
/* Drag-over dashed border */
.folder-header.drag-over {
  background-color: hsl(var(--primary) / 0.06);
  outline: 2px dashed hsl(var(--primary) / 0.4);
  border-radius: 8px;
}

/* Shake animation */
@keyframes invalidShake {
  0%, 100% { transform: translateX(0); }
  10%, 50%, 90% { transform: translateX(-4px); }
  30%, 70% { transform: translateX(4px); }
}
.folder-shake {
  animation: invalidShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
```

### 8. FolderColorPicker.tsx — new component

```tsx
export const FOLDER_COLORS = [
  { id: "default", color: "#6b7280" },
  { id: "red",     color: "#ef4444" },
  { id: "orange",  color: "#f97316" },
  { id: "yellow",  color: "#eab308" },
  { id: "green",   color: "#22c55e" },
  { id: "blue",    color: "#3b82f6" },
  { id: "purple",  color: "#a855f7" },
];

export function FolderColorPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {FOLDER_COLORS.map((c) => (
        <button
          key={c.id}
          className={cn(
            "w-6 h-6 rounded-full border-2 transition-transform hover:scale-125",
            value === c.id ? "border-white shadow-[0_0_0_2px_currentColor]" : "border-transparent"
          )}
          style={{ backgroundColor: c.color, color: c.color }}
          onClick={() => onChange(c.id === "default" ? "" : c.color)}
        />
      ))}
    </div>
  );
}
```

### 9. i18n keys to add

```json
"folder.drag-here": "将对话拖到这里",
"folder.new-folder": "新建文件夹",
"folder.section-title": "文件夹",
"folder.save": "保存",
"folder.cancel": "取消",
"folder.create-success": "文件夹已创建",
"folder.create-failed": "创建文件夹失败",
"folder.rename-success": "文件夹已重命名",
"folder.rename-failed": "重命名失败",
"folder.delete-success": "文件夹已删除",
"folder.delete-failed": "删除文件夹失败"
```
