import { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder as FolderIcon,
  FolderOutput,
  MessageSquare,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Droppable, Draggable } from "react-beautiful-dnd";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/components/ui/lib/utils";
import { Folder } from "@/api/folder";
import { FolderContextMenu } from "./FolderContextMenu";
import { ConversationInstance } from "@/api/types.tsx";
import Emoji from "@/components/Emoji.tsx";
import { RootState } from "@/store";
import { useTranslation } from "react-i18next";

type FolderItemProps = {
  folder: Folder;
  subFolders: Folder[];
  conversations: ConversationInstance[];
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onColorChange: (id: number, color: string) => void;
  onConversationClick: (id: number) => void;
  onMoveOut: (conversationId: number) => void;
  currentConversation: number;
};

export function FolderItem({
  folder,
  subFolders,
  conversations,
  onRename,
  onDelete,
  onColorChange,
  onConversationClick,
  onMoveOut,
  currentConversation,
}: FolderItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Reactive drag-over highlight driven by Redux store
  const dragOverFolderId = useSelector(
    (s: RootState) => s.folder.dragOverFolderId,
  );
  const isDragOver = dragOverFolderId === folder.id;

  // Auto-expand folder when dragging over it for more than 500ms
  useEffect(() => {
    let timer: any;
    if (isDragOver && !expanded) {
      timer = setTimeout(() => setExpanded(true), 500);
    }
    return () => clearTimeout(timer);
  }, [isDragOver, expanded]);

  const folderConversations = conversations.filter(
    (c) => c.folder_id === folder.id,
  );

  const handleSaveRename = (name: string) => {
    if (name.trim()) onRename(folder.id, name.trim());
    setRenaming(false);
  };

  return (
    <Droppable droppableId={`folder-${folder.id}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            "relative z-10 rounded-lg transition-colors min-h-[36px]",
            snapshot.isDraggingOver && "bg-primary/5",
          )}
        >
          {/* Folder header */}
          <div
            className={cn(
              "folder-header flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted cursor-pointer group text-sm transition-all duration-150",
              isDragOver && "drag-over",
            )}
            onClick={() => !renaming && setExpanded(!expanded)}
          >
            <motion.span
              animate={{ rotate: expanded ? 0 : -90 }}
              transition={{ duration: 0.15 }}
              className="shrink-0"
            >
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </motion.span>

            <span className="h-4 w-4 shrink-0 flex items-center justify-center overflow-hidden">
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
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm border-b border-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleSaveRename(e.currentTarget.value);
                    if (e.key === "Escape") setRenaming(false);
                  }}
                />
                <button
                  className="text-green-500 hover:text-green-600 shrink-0 p-0.5"
                  onClick={() =>
                    handleSaveRename(renameInputRef.current?.value || "")
                  }
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
              <span className="flex-1 truncate">{folder.name}</span>
            )}

            <FolderContextMenu
              currentColor={folder.color}
              onRename={() => {
                setRenaming(true);
                setTimeout(() => renameInputRef.current?.focus(), 0);
              }}
              onDelete={() => onDelete(folder.id)}
              onColorChange={(color) => onColorChange(folder.id, color)}
            />
          </div>

          {/* Animated expanded content */}
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
                {/* Sub-folders */}
                {subFolders.map((sub) => (
                  <FolderItem
                    key={sub.id}
                    folder={sub}
                    subFolders={[]}
                    conversations={conversations}
                    onRename={onRename}
                    onDelete={onDelete}
                    onColorChange={onColorChange}
                    onConversationClick={onConversationClick}
                    onMoveOut={onMoveOut}
                    currentConversation={currentConversation}
                  />
                ))}

                {/* Conversations in this folder */}
                {folderConversations.map((conv, i) => (
                  <Draggable
                    key={conv.clientKey ?? String(conv.id)}
                    draggableId={String(conv.id)}
                    index={i}
                  >
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        style={{
                          ...dragProvided.draggableProps.style,
                          userSelect: "none",
                        }}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-grab active:cursor-grabbing transition-colors group",
                          conv.id === currentConversation
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-muted-foreground",
                        )}
                        onClick={() =>
                          !dragSnapshot.isDragging &&
                          onConversationClick(conv.id)
                        }
                      >
                        {conv.titling ? (
                          <div className="h-4 w-4 flex items-center justify-center shrink-0">
                            <Loader2 className="h-3 w-3 animate-spin text-secondary" />
                          </div>
                        ) : conv.avatar ? (
                          <div className="h-4 w-4 flex items-center justify-center shrink-0 text-xs">
                            <Emoji emoji={conv.avatar} />
                          </div>
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        )}
                        <span className="flex-1 truncate">
                          {conv.name || `Conversation #${conv.id}`}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-muted-foreground/20"
                          title={t("folder.move-out")}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveOut(conv.id);
                          }}
                        >
                          <FolderOutput className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}


                {/* Empty state */}
                {folderConversations.length === 0 &&
                  subFolders.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground/50 italic">
                      {t("folder.drag-here")}
                    </div>
                  )}
              </motion.div>
            )}
          </AnimatePresence>

          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
