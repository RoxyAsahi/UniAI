import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthenticated } from "@/store/auth.ts";
import {
  clearMaskItem,
  removePreflight,
  resetNewConversation,
  selectCurrent,
  selectHistory,
  selectMaskItem,
  updateConversationFolder,
  reorderHistory,
  useConversationActions,
} from "@/store/chat.ts";
import { DragDropContext, Droppable, Draggable, DropResult, DragUpdate } from "react-beautiful-dnd";
import { moveConversation, reorderConversations } from "@/api/folder.ts";
import { setDragOverFolder } from "@/store/folder";
import React, { useMemo, useRef, useState } from "react";
import { ConversationInstance } from "@/api/types.tsx";
import { extractMessage, filterMessage } from "@/utils/processor.ts";
import { copyClipboard } from "@/utils/dom.ts";
import { useEffectAsync } from "@/utils/hook.ts";
import { mobile, openWindow } from "@/utils/device.ts";
import { Button } from "@/components/ui/button.tsx";
import { selectMenu, setMenu } from "@/store/menu.ts";
import {
  ChevronRight,
  Copy,
  PanelLeft,
  Paintbrush,
  Plus,
  Search,
  SquarePen,
  User,
} from "lucide-react";
import ConversationItem from "./ConversationItem.tsx";
import { FolderTree, FolderTreeRef } from "@/components/folder/FolderTree";
import { useFolders } from "@/store/folder";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { getSharedLink, shareConversation } from "@/api/sharing.ts";
import { Input } from "@/components/ui/input.tsx";
import { goAuth } from "@/utils/app.ts";
import { cn } from "@/components/ui/lib/utils.ts";
import { getBooleanMemory, getNumberMemory, setBooleanMemory } from "@/utils/memory.ts";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { appLogo } from "@/conf/env.ts";
import { selectLogoText } from "@/store/info.ts";
import router from "@/router.tsx";

type Operation = {
  target: ConversationInstance | null;
  type: string;
};

type SidebarActionProps = {
  search: string;
  setSearch: (search: string) => void;
};

type ConversationListProps = {
  search: string;
  operateConversation: Operation;
  setOperateConversation: (operation: Operation) => void;
};


function SidebarSectionHeader({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sidebar-section-header flex items-center justify-between px-2.5 py-1.5 cursor-pointer transition-colors group select-none",
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-1.5 overflow-hidden">
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground/60 transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
        <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-[0.14em] truncate">
          {title}
        </span>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
        {children}
      </div>
    </div>
  );
}


function SidebarAction({
  search,
  setSearch,
}: SidebarActionProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { toggle } = useConversationActions();

  const current = useSelector(selectCurrent);
  const mask = useSelector(selectMaskItem);

  return (
    <motion.div
      className={`sidebar-action-wrapper flex flex-col w-full h-fit`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div whileTap={{ scale: 0.98 }}>
        <Button
          variant={`ghost`}
          className={`sidebar-primary-entry w-full justify-start`}
          onClick={async () => {
            if (current === -1 && mask) {
              dispatch(clearMaskItem());
              dispatch(removePreflight());
              dispatch(resetNewConversation());
            } else {
              await toggle(-1);
            }
            if (mobile) dispatch(setMenu(false));
          }}
        >
          <span className="sidebar-entry-leading">
          {current === -1 && mask ? (
            <Paintbrush className={`sidebar-entry-icon`} />
          ) : (
            <SquarePen className={`sidebar-entry-icon`} />
          )}
          </span>
          <span className="sidebar-entry-label">{t("new-chat")}</span>
        </Button>
      </motion.div>
      <motion.div
        className={`sidebar-search-entry w-full`}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <span className="sidebar-entry-leading">
          <Search className={`sidebar-entry-icon shrink-0`} />
        </span>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("conversation.search")}
          className={`sidebar-search-input sidebar-search-field w-full`}
        />
      </motion.div>
    </motion.div>
  );
}

function SidebarConversationList({
  search,
  operateConversation,
  setOperateConversation,
}: ConversationListProps) {
  const { t } = useTranslation();
  const { remove } = useConversationActions();
  const auth = useSelector(selectAuthenticated);
  const history: ConversationInstance[] = useSelector(selectHistory);
  const folders = useFolders();
  const [shared, setShared] = useState<string>("");
  const current = useSelector(selectCurrent);

  const filteredHistory = useMemo(() => {
    // Exclude conversations that belong to a folder — they're shown inside FolderTree
    // Also include -1 (temporary conversation) to show loading state correctly
    const noFolder = history.filter((c) => (c.id > 0 || c.id === -1) && !c.folder_id);
    if (search.trim().length === 0) return noFolder;

    const searchItems = search
      .trim()
      .toLowerCase()
      .split(" ")
      .filter((item) => item.length > 0);

    return noFolder.filter((conversation) => {
      const name = conversation.name.toLowerCase();
      const id = conversation.id.toString();
      return searchItems.every(
        (item) => name.includes(item) || id.includes(item),
      );
    });
  }, [history, search]);

  async function handleDelete(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (await remove(operateConversation?.target?.id || -1))
      toast.success(t("conversation.delete-success"), {
        description: t("conversation.delete-success-prompt"),
      });
    else
      toast.error(t("conversation.delete-failed"), {
        description: t("conversation.delete-failed-prompt"),
      });
    setOperateConversation({ target: null, type: "" });
  }

  async function handleShare(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    const resp = await shareConversation(operateConversation?.target?.id || -1);
    if (resp.status) setShared(getSharedLink(resp.data));
    else
      toast.error(t("share.failed"), {
        description: resp.message,
      });

    setOperateConversation({ target: null, type: "" });
  }

  return (
    <>
      <div className="sidebar-history-list">
      <Droppable droppableId="conversation-list">
        {(provided) => (
          <div
            className={`conversation-list`}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {filteredHistory.length ? (
              filteredHistory.map((conversation, i) => (
                <Draggable
                  key={conversation.clientKey ?? `conv-${conversation.id}`}
                  draggableId={String(conversation.id)}
                  index={i}
                >
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      style={{
                        ...dragProvided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.7 : 1,
                        userSelect: "none",
                        // Prevent framer-motion from fighting react-beautiful-dnd
                        // transforms while the item is being dragged.
                        transition: snapshot.isDragging
                          ? "opacity 0.1s"
                          : dragProvided.draggableProps.style?.transition,
                        willChange: "transform",
                      }}
                    >
                      <ConversationItem
                        operate={setOperateConversation}
                        conversation={conversation}
                        current={current}
                        folders={folders}
                      />
                    </div>
                  )}
                </Draggable>
              ))
            ) : (
              <div className={`empty text-center px-6`}>
                {auth
                  ? t("conversation.empty")
                  : t("conversation.empty-anonymous")}
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      </div>
      <AlertDialog
        open={
          operateConversation.type === "delete" && !!operateConversation.target
        }
        onOpenChange={(open) => {
          if (!open) setOperateConversation({ target: null, type: "" });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("conversation.remove-title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("conversation.remove-description")}
              <strong className={`conversation-name`}>
                {extractMessage(
                  filterMessage(operateConversation?.target?.name || ""),
                )}
              </strong>
              {t("end")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("conversation.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t("conversation.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={
          operateConversation.type === "share" && !!operateConversation.target
        }
        onOpenChange={(open) => {
          if (!open) setOperateConversation({ target: null, type: "" });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("share.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("share.description")}
              <strong className={`conversation-name`}>
                {extractMessage(
                  filterMessage(operateConversation?.target?.name || ""),
                )}
              </strong>
              {t("end")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("conversation.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleShare}>
              {t("share.title")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={shared.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setShared("");
            setOperateConversation({ target: null, type: "" });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("share.success")}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className={`share-wrapper mt-4 mb-2`}>
                <Input value={shared} />
                <Button
                  variant={`default`}
                  size={`icon`}
                  onClick={async () => {
                    await copyClipboard(shared);
                    toast.success(t("share.copied"), {
                      description: t("share.copied-description"),
                    });
                  }}
                >
                  <Copy className={`h-4 w-4`} />
                </Button>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("close")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                openWindow(shared, "_blank");
              }}
            >
              {t("share.view")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SideBar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { refresh, toggle } = useConversationActions();
  const current = useSelector(selectCurrent);
  const open = useSelector(selectMenu);
  const brandText = useSelector(selectLogoText);
  const auth = useSelector(selectAuthenticated);
  const history: ConversationInstance[] = useSelector(selectHistory);
  const [search, setSearch] = useState<string>("");
  const [operateConversation, setOperateConversation] = useState<Operation>({
    target: null,
    type: "",
  });

  const [groupsExpanded, setGroupsExpanded] = useState(getBooleanMemory("sidebar_groups_expanded", true));
  const [historyExpanded, setHistoryExpanded] = useState(getBooleanMemory("sidebar_history_expanded", true));
  const folderTreeRef = useRef<FolderTreeRef>(null);

  const toggleGroups = () => {
    const next = !groupsExpanded;
    setGroupsExpanded(next);
    setBooleanMemory("sidebar_groups_expanded", next);
  };

  const toggleHistory = () => {
    const next = !historyExpanded;
    setHistoryExpanded(next);
    setBooleanMemory("sidebar_history_expanded", next);
  };

  useEffectAsync(async () => {
    const resp = await refresh();

    const store = getNumberMemory("history_conversation", -1);
    if (current === store) return;
    if (store === -1) return;
    if (!resp.map((item) => item.id).includes(store)) return;
    await toggle(store);
  }, []);

  const handleDragUpdate = (update: DragUpdate) => {
    const { destination } = update;
    if (destination?.droppableId.startsWith("folder-")) {
      const folderId = parseInt(destination.droppableId.replace("folder-", ""));
      dispatch(setDragOverFolder(folderId));
    } else {
      dispatch(setDragOverFolder(null));
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    // Always clear the drag-over highlight when drag ends
    dispatch(setDragOverFolder(null));

    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const convId = parseInt(draggableId);
    const srcIsFolder = source.droppableId.startsWith("folder-");
    const dstIsFolder = destination.droppableId.startsWith("folder-");

    if (dstIsFolder) {
      const dstFolderId = parseInt(destination.droppableId.replace("folder-", ""));
      const srcFolderId = srcIsFolder
        ? parseInt(source.droppableId.replace("folder-", ""))
        : null;

      if (srcFolderId === dstFolderId) {
        // Intra-folder reorder — client-side then persist
        const folderConvs = history.filter(
          (c) => c.id > 0 && c.folder_id === dstFolderId,
        );
        const insertBeforeConv =
          destination.index > source.index
            ? folderConvs[destination.index + 1]
            : folderConvs[destination.index];

        dispatch(
          reorderHistory({
            movedId: convId,
            insertBeforeId: insertBeforeConv?.id ?? null,
          }),
        );

        // Persistent reorder
        const items = [...folderConvs];
        const [moved] = items.splice(source.index, 1);
        items.splice(destination.index, 0, moved);
        const orders: Record<number, number> = {};
        items.forEach((item, index) => {
          orders[item.id] = index;
        });
        await reorderConversations(orders);
      } else {
        // Cross-folder move OR main-list → folder
        const ok = await moveConversation(convId, dstFolderId);
        if (ok) {
          dispatch(updateConversationFolder({ id: convId, folderId: dstFolderId }));
          
          // Persistent reorder for the target folder: include the new item
          const targetFolderConvs = history.filter(
            (c) => c.id > 0 && c.folder_id === dstFolderId && c.id !== convId
          );
          const movedItem = history.find(c => c.id === convId);
          if (movedItem) {
            const items = [...targetFolderConvs];
            items.splice(destination.index, 0, movedItem);
            const orders: Record<number, number> = {};
            items.forEach((item, index) => {
              orders[item.id] = index;
            });
            await reorderConversations(orders);
          }
        }
      }
    } else if (destination.droppableId === "conversation-list") {
      if (srcIsFolder) {
        // Folder → main list: move out of folder
        const ok = await moveConversation(convId, null);
        if (ok) {
          dispatch(updateConversationFolder({ id: convId, folderId: null }));
          
          // Persistent reorder for the main list: include the new item
          const noFolderHistory = history.filter(
            (c) => c.id > 0 && !c.folder_id && c.id !== convId
          );
          const movedItem = history.find(c => c.id === convId);
          if (movedItem) {
            const items = [...noFolderHistory];
            items.splice(destination.index, 0, movedItem);
            const orders: Record<number, number> = {};
            items.forEach((item, index) => {
              orders[item.id] = index;
            });
            await reorderConversations(orders);
          }
        }
      } else {
        // Main list → main list: reorder
        const noFolderHistory = history.filter((c) => c.id > 0 && !c.folder_id);
        const insertBeforeConv =
          destination.index > source.index
            ? noFolderHistory[destination.index + 1]
            : noFolderHistory[destination.index];
        dispatch(
          reorderHistory({
            movedId: convId,
            insertBeforeId: insertBeforeConv?.id ?? null,
          }),
        );

        // Persistent reorder
        const items = [...noFolderHistory];
        const [moved] = items.splice(source.index, 1);
        items.splice(destination.index, 0, moved);
        const orders: Record<number, number> = {};
        items.forEach((item, index) => {
          orders[item.id] = index;
        });
        await reorderConversations(orders);
      }
    }
  };

  return (
    <div className={cn("sidebar", open && "open")}>
      <div className={`sidebar-content`}>
        <div className="sidebar-topbar">
          <div className="sidebar-brand" onClick={() => router.navigate("/")}>
            <img className="sidebar-brand-logo" src={appLogo} alt="" />
            {brandText.enabled && brandText.text && (
              <span
                className="sidebar-brand-text"
                style={{
                  fontFamily: brandText.font,
                  fontWeight: brandText.weight ?? 500,
                  fontSize: `${Math.max(brandText.size ?? 16, 16)}px`,
                  marginLeft:
                    typeof brandText.margin === "number"
                      ? `${brandText.margin}px`
                      : undefined,
                  letterSpacing: brandText.letter_spacing
                    ? `${brandText.letter_spacing}px`
                    : undefined,
                  transform: brandText.vertical_offset
                    ? `translateY(${brandText.vertical_offset}px)`
                    : undefined,
                }}
              >
                {brandText.text}
              </span>
            )}
          </div>
          <button
            className="sidebar-topbar-toggle"
            onClick={() => dispatch(setMenu(false))}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
        </div>
        <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
          <div className="sidebar-scroll-wrap">
            <div className="sidebar-scroll-gradient-mask" />
            <div className="sidebar-scroll-area">
              <SidebarAction
                search={search}
                setSearch={setSearch}
              />
              {auth && (
                <div className="sidebar-group-container flex flex-col min-h-0">
                  <SidebarSectionHeader
                    title={t("sidebar.groups")}
                    expanded={groupsExpanded}
                    onToggle={toggleGroups}
                  >
                    <button
                      className="p-1 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground/70 hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!groupsExpanded) toggleGroups();
                        setTimeout(() => folderTreeRef.current?.create(), 0);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </SidebarSectionHeader>
                  <AnimatePresence initial={false}>
                    {groupsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <FolderTree
                          innerRef={folderTreeRef}
                          conversations={history.filter((c) => c.id > 0)}
                          currentConversation={current}
                          onConversationClick={async (id) => await toggle(id)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="sidebar-history-container flex flex-col min-h-0">
                <SidebarSectionHeader
                  title={t("sidebar.conversations")}
                  expanded={historyExpanded}
                  onToggle={toggleHistory}
                />
                <AnimatePresence initial={false}>
                  {historyExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                      className="min-h-0"
                    >
                      <SidebarConversationList
                        search={search}
                        operateConversation={operateConversation}
                        setOperateConversation={setOperateConversation}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </DragDropContext>
        {!auth && (
          <Button
            className={`login-action min-h-10 h-max`}
            variant={`default`}
            onClick={goAuth}
          >
            <User className={`h-4 w-4 mr-1.5 shrink-0`} /> {t("login-action")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default SideBar;
