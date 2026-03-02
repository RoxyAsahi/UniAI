import { useRef, useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  ChevronDown,
  FolderOpen,
  Folder as FolderIcon,
  FolderOutput,
  MessageSquare,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/components/ui/lib/utils";
import { Folder } from "@/api/folder";
import { FolderContextMenu } from "./FolderContextMenu";
import { ConversationInstance } from "@/api/types.tsx";
import Emoji from "@/components/Emoji.tsx";
import { RootState } from "@/store";
import { useTranslation } from "react-i18next";
import { getBooleanMemory, setBooleanMemory } from "@/utils/memory";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  toConversationDndId,
  toFolderDndId,
} from "@/components/home/sidebarDnd";

type FolderItemProps = {
  folder: Folder;
  allFolders: Folder[];
  conversations: ConversationInstance[];
  onRename: (id: number, name: string) => void;
  onEdit: (id: number) => void;
  onExport: (id: number) => void;
  onDelete: (id: number) => void;
  onColorChange: (id: number, color: string) => void;
  onConversationClick: (id: number) => void;
  onMoveOut: (conversationId: number) => void;
  currentConversation: number;
};

type SortableFolderConversationItemProps = {
  conversation: ConversationInstance;
  currentConversation: number;
  onConversationClick: (id: number) => void;
  onMoveOut: (id: number) => void;
};

function SortableFolderConversationItem({
  conversation,
  currentConversation,
  onConversationClick,
  onMoveOut,
}: SortableFolderConversationItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: toConversationDndId(conversation.id),
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        userSelect: "none",
        opacity: isDragging ? 0.68 : 1,
      }}
      className={cn(
        "conversation conversation-nested flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm cursor-grab active:cursor-grabbing transition-colors group",
        conversation.id === currentConversation ? "active" : "",
      )}
      onClick={() => !isDragging && onConversationClick(conversation.id)}
    >
      {conversation.titling ? (
        <div className="conversation-icon h-4 w-4 flex items-center justify-center shrink-0">
          <Loader2 className="h-3 w-3 animate-spin text-secondary" />
        </div>
      ) : conversation.avatar ? (
        <div className="conversation-icon h-4 w-4 flex items-center justify-center shrink-0 text-xs">
          <Emoji emoji={conversation.avatar} />
        </div>
      ) : (
        <MessageSquare className="conversation-icon h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      )}
      <span className="title flex-1 truncate">
        {conversation.name || `Conversation #${conversation.id}`}
      </span>
      <button
        className="id opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded-md hover:bg-muted-foreground/20"
        title={t("folder.move-out")}
        onClick={(e) => {
          e.stopPropagation();
          onMoveOut(conversation.id);
        }}
      >
        <FolderOutput className="h-3 w-3" />
      </button>
    </div>
  );
}

export function FolderItem({
  folder,
  allFolders,
  conversations,
  onRename,
  onEdit,
  onExport,
  onDelete,
  onColorChange,
  onConversationClick,
  onMoveOut,
  currentConversation,
}: FolderItemProps) {
  const { t } = useTranslation();
  const expandedKey = `folder_expanded_${folder.id}`;
  const [expanded, setExpanded] = useState(getBooleanMemory(expandedKey, true));
  const [renaming, setRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: toFolderDndId(folder.id),
  });

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    setBooleanMemory(expandedKey, next);
  };

  const dragOverFolderId = useSelector((s: RootState) => s.folder.dragOverFolderId);
  const isDragOver = dragOverFolderId === folder.id;

  useEffect(() => {
    let timer: any;
    if (isDragOver && !expanded) {
      timer = setTimeout(() => {
        setExpanded(true);
        setBooleanMemory(expandedKey, true);
      }, 500);
    }
    return () => clearTimeout(timer);
  }, [isDragOver, expanded, expandedKey]);

  const folderConversations = useMemo(
    () => conversations.filter((c) => c.folder_id === folder.id),
    [conversations, folder.id],
  );
  const folderConversationIds = useMemo(
    () => folderConversations.map((c) => toConversationDndId(c.id)),
    [folderConversations],
  );
  const subFolders = useMemo(
    () => allFolders.filter((f) => f.parent_id === folder.id),
    [allFolders, folder.id],
  );

  const handleSaveRename = (name: string) => {
    if (name.trim()) onRename(folder.id, name.trim());
    setRenaming(false);
  };

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        "folder-shell relative z-10 rounded-lg transition-colors min-h-[36px]",
        isOver && "bg-primary/5",
      )}
    >
      <div
        className={cn(
          "folder-header flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/70 cursor-pointer group text-sm transition-all duration-150",
          isDragOver && "drag-over",
        )}
        style={
          folder.background
            ? {
                backgroundImage: `linear-gradient(rgba(15,15,15,0.18), rgba(15,15,15,0.18)), url(${folder.background})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
        onClick={() => !renaming && toggleExpanded()}
      >
        <motion.span
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          className="shrink-0"
        >
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </motion.span>

        <span className="h-4 w-4 shrink-0 flex items-center justify-center overflow-hidden folder-header-icon">
          {folder.avatar ? (
            <span className="text-[13px] leading-none">
              <Emoji emoji={folder.avatar} />
            </span>
          ) : expanded ? (
            <FolderOpen
              className="h-4 w-4"
              style={{ color: folder.color || undefined }}
            />
          ) : (
            <FolderIcon
              className="h-4 w-4"
              style={{ color: folder.color || undefined }}
            />
          )}
        </span>

        {renaming ? (
          <div
            className="flex items-center gap-1 flex-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={renameInputRef}
              autoFocus
              defaultValue={folder.name}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm border-b border-primary folder-rename-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename(e.currentTarget.value);
                if (e.key === "Escape") setRenaming(false);
              }}
            />
            <button
              className="text-green-500 hover:text-green-600 shrink-0 p-0.5"
              onClick={() => handleSaveRename(renameInputRef.current?.value || "")}
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              className="text-destructive hover:text-destructive/80 shrink-0 p-0.5"
              onClick={() => setRenaming(false)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="flex-1 truncate folder-header-title">{folder.name}</span>
        )}

        <FolderContextMenu
          currentColor={folder.color}
          onEdit={() => onEdit(folder.id)}
          onRename={() => {
            setRenaming(true);
            setTimeout(() => renameInputRef.current?.focus(), 0);
          }}
          onExport={() => onExport(folder.id)}
          onDelete={() => onDelete(folder.id)}
          onColorChange={(color) => onColorChange(folder.id, color)}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
            className="folder-children ml-4"
          >
            {subFolders.map((sub) => (
              <FolderItem
                key={sub.id}
                folder={sub}
                allFolders={allFolders}
                conversations={conversations}
                onRename={onRename}
                onEdit={onEdit}
                onExport={onExport}
                onDelete={onDelete}
                onColorChange={onColorChange}
                onConversationClick={onConversationClick}
                onMoveOut={onMoveOut}
                currentConversation={currentConversation}
              />
            ))}

            <SortableContext
              items={folderConversationIds}
              strategy={verticalListSortingStrategy}
            >
              {folderConversations.map((conversation) => (
                <SortableFolderConversationItem
                  key={conversation.clientKey ?? String(conversation.id)}
                  conversation={conversation}
                  currentConversation={currentConversation}
                  onConversationClick={onConversationClick}
                  onMoveOut={onMoveOut}
                />
              ))}
            </SortableContext>

            {folderConversations.length === 0 && subFolders.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground/50 italic folder-empty">
                {t("folder.drag-here")}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
