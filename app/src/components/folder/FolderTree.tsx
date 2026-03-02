import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useFolders, setFolders, removeFolder, updateFolderInStore } from "@/store/folder";
import { updateConversationFolder } from "@/store/chat";
import { FolderItem } from "./FolderItem";
import { ConversationInstance } from "@/api/types.tsx";
import {
  listFolders,
  createFolder,
  updateFolder as apiUpdateFolder,
  deleteFolder as apiDeleteFolder,
  exportFolder as apiExportFolder,
  moveConversation,
} from "@/api/folder";
import { saveAsFile } from "@/utils/dom";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderColorPicker } from "./FolderColorPicker";

export type FolderTreeRef = {
  create: () => void;
};

type FolderTreeProps = {
  conversations: ConversationInstance[];
  currentConversation: number;
  onConversationClick: (id: number) => void;
  innerRef?: React.Ref<FolderTreeRef>;
};

export function FolderTree({
  conversations,
  currentConversation,
  onConversationClick,
  innerRef,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const folders = useFolders();
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editBackground, setEditBackground] = useState("");
  const [editColor, setEditColor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  React.useImperativeHandle(innerRef, () => ({
    create: handleStartCreating,
  }));

  useEffect(() => {
    listFolders().then((data) => dispatch(setFolders(data)));
  }, [dispatch]);

  const rootFolders = folders.filter((f) => !f.parent_id);

  const handleCreate = async (name: string) => {
    if (!name.trim()) {
      setCreating(false);
      setNewFolderName("");
      return;
    }
    try {
      const folder = await createFolder(name.trim());
      if (folder) {
        const allFolders = await listFolders();
        dispatch(setFolders(allFolders));
        toast.success(t("folder.create-success"));
      } else {
        toast.error(t("folder.create-failed"));
      }
    } catch {
      toast.error(t("folder.create-failed"));
    } finally {
      setCreating(false);
      setNewFolderName("");
    }
  };

  const handleStartCreating = () => {
    setNewFolderName("");
    setCreating(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRename = async (id: number, name: string) => {
    if (!name.trim()) return;
    const folder = folders.find((f) => f.id === id);
    const ok = await apiUpdateFolder(
      id,
      name.trim(),
      folder?.color,
      folder?.avatar,
      folder?.background,
    );
    if (ok) {
      if (folder) dispatch(updateFolderInStore({ ...folder, name: name.trim() }));
      toast.success(t("folder.rename-success"));
    } else {
      toast.error(t("folder.rename-failed"));
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await apiDeleteFolder(id);
    if (ok) {
      dispatch(removeFolder(id));
      toast.success(t("folder.delete-success"));
    } else {
      toast.error(t("folder.delete-failed"));
    }
  };

  const handleColorChange = async (id: number, color: string) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const ok = await apiUpdateFolder(
      id,
      folder.name,
      color,
      folder.avatar,
      folder.background,
    );
    if (ok) dispatch(updateFolderInStore({ ...folder, color }));
  };

  const openEditDialog = (id: number) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;

    setEditingFolderId(id);
    setEditName(folder.name || "");
    setEditAvatar(folder.avatar || "");
    setEditBackground(folder.background || "");
    setEditColor(folder.color || "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingFolderId) return;
    const name = editName.trim();
    if (!name) return;

    const ok = await apiUpdateFolder(
      editingFolderId,
      name,
      editColor,
      editAvatar,
      editBackground,
    );
    if (!ok) {
      toast.error(t("folder.rename-failed"));
      return;
    }

    const folder = folders.find((f) => f.id === editingFolderId);
    if (folder) {
      dispatch(updateFolderInStore({
        ...folder,
        name,
        color: editColor || undefined,
        avatar: editAvatar || undefined,
        background: editBackground || undefined,
      }));
    }

    toast.success(t("folder.update-success"));
    setEditOpen(false);
    setEditingFolderId(null);
  };

  const handleMoveOut = async (conversationId: number) => {
    const ok = await moveConversation(conversationId, null);
    if (ok) dispatch(updateConversationFolder({ id: conversationId, folderId: null }));
  };

  const handleExport = async (id: number) => {
    const data = await apiExportFolder(id);
    if (!data) {
      toast.error(t("folder.export-failed"));
      return;
    }

    const filename = `${(data.folder.name || `folder-${id}`).replace(/[\\/:*?"<>|]/g, "_")}.json`;
    saveAsFile(filename, JSON.stringify(data, null, 2));
    toast.success(t("folder.export-success"));
  };

  if (folders.length === 0 && !creating) {
    return null;
  }

  return (
    <div className="folder-tree px-1 py-1 mb-1">
      {rootFolders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          allFolders={folders}
          conversations={conversations}
          onRename={handleRename}
          onEdit={openEditDialog}
          onExport={handleExport}
          onDelete={handleDelete}
          onColorChange={handleColorChange}
          onConversationClick={onConversationClick}
          onMoveOut={handleMoveOut}
          currentConversation={currentConversation}
        />
      ))}

      {creating && (
        <div className="px-1 py-1">
          <input
            ref={inputRef}
            autoFocus
            placeholder={t("folder.new-folder")}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-muted rounded outline-none border border-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate(newFolderName);
              if (e.key === "Escape") {
                setCreating(false);
                setNewFolderName("");
              }
            }}
          />
          <div className="flex gap-1 mt-1">
            <button
              className="flex-1 flex items-center justify-center gap-1 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => handleCreate(newFolderName)}
            >
              <Check className="h-3 w-3" /> {t("folder.save")}
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 py-0.5 text-xs rounded bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => {
                setCreating(false);
                setNewFolderName("");
              }}
            >
              <X className="h-3 w-3" /> {t("folder.cancel")}
            </button>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("folder.edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("folder.name")}</div>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("folder.icon")}</div>
              <Input
                value={editAvatar}
                onChange={(e) => setEditAvatar(e.target.value)}
                placeholder={t("folder.icon-placeholder")}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("folder.background")}</div>
              <Input
                value={editBackground}
                onChange={(e) => setEditBackground(e.target.value)}
                placeholder={t("folder.background-placeholder")}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("folder.color")}</div>
              <FolderColorPicker value={editColor} onChange={setEditColor} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("folder.cancel")}
            </Button>
            <Button onClick={handleEditSave}>{t("folder.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
