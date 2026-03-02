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
import { moveConversation, reorderConversations } from "@/api/folder.ts";
import { setDragOverFolder } from "@/store/folder";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Loader2,
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
import { getBooleanMemory, getNumberMemory, setBooleanMemory, setNumberMemory } from "@/utils/memory.ts";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { appLogo } from "@/conf/env.ts";
import { selectLogoText } from "@/store/info.ts";
import router from "@/router.tsx";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  isConversationDndId,
  isFolderDndId,
  MAIN_LIST_DND_ID,
  parseConversationDndId,
  parseFolderDndId,
  toConversationDndId,
  toFolderDndId,
} from "@/components/home/sidebarDnd";

type Operation = {
  target: ConversationInstance | null;
  type: string;
};

type SidebarActionProps = {
  search: string;
  setSearch: (search: string) => void;
  onNewChat: () => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  newChatAsMask: boolean;
};

type ConversationListProps = {
  search: string;
  loadingMore: boolean;
  hasMore: boolean;
  operateConversation: Operation;
  setOperateConversation: (operation: Operation) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_SWIPE_EDGE_PX = 24;

function parseConversationDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getHistoryGroupLabel(item: ConversationInstance): string {
  if (item.archived) return "Archived";
  if (item.pinned) return "Pinned";

  const date = parseConversationDate(item.updated_at);
  if (!date) return "Older";

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startToday.getTime() - startDate.getTime()) / DAY_MS);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 days";
  if (diffDays <= 30) return "Previous 30 days";

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}


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
  onNewChat,
  searchInputRef,
  newChatAsMask,
}: SidebarActionProps) {
  const { t } = useTranslation();

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
          onClick={onNewChat}
        >
          <span className="sidebar-entry-leading">
          {newChatAsMask ? (
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
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("conversation.search")}
          className={`sidebar-search-input sidebar-search-field w-full`}
        />
      </motion.div>
    </motion.div>
  );
}

function SortableSidebarConversationItem({
  conversation,
  current,
  folders,
  setOperateConversation,
}: {
  conversation: ConversationInstance;
  current: number;
  folders: ReturnType<typeof useFolders>;
  setOperateConversation: (operation: Operation) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
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
        opacity: isDragging ? 0.7 : 1,
        userSelect: "none",
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
  );
}

function SidebarConversationList({
  search,
  loadingMore,
  hasMore,
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

  const groupedHistory = useMemo(() => {
    const groups: Array<{
      label: string;
      items: Array<{ conversation: ConversationInstance }>;
    }> = [];

    filteredHistory.forEach((conversation) => {
      const label = getHistoryGroupLabel(conversation);
      const latest = groups[groups.length - 1];
      if (latest && latest.label === label) {
        latest.items.push({ conversation });
      } else {
        groups.push({
          label,
          items: [{ conversation }],
        });
      }
    });

    return groups;
  }, [filteredHistory]);

  const { setNodeRef: setMainListRef, isOver: isMainListOver } = useDroppable({
    id: MAIN_LIST_DND_ID,
  });
  const sortableConversationIds = useMemo(
    () =>
      filteredHistory
        .filter((conversation) => conversation.id > 0)
        .map((conversation) => toConversationDndId(conversation.id)),
    [filteredHistory],
  );

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
        <SortableContext
          items={sortableConversationIds}
          strategy={verticalListSortingStrategy}
        >
          <div
            className={cn("conversation-list", isMainListOver && "bg-primary/5 rounded-lg")}
            ref={setMainListRef}
          >
            {filteredHistory.length ? (
              groupedHistory.map((group, groupIdx) => (
                <div key={`${group.label}-${groupIdx}`} className="sidebar-history-group">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                    {group.label}
                  </div>
                  {group.items.map(({ conversation }) =>
                    conversation.id > 0 ? (
                      <SortableSidebarConversationItem
                        key={conversation.clientKey ?? `conv-${conversation.id}`}
                        conversation={conversation}
                        current={current}
                        folders={folders}
                        setOperateConversation={setOperateConversation}
                      />
                    ) : (
                      <ConversationItem
                        key={conversation.clientKey ?? `conv-${conversation.id}`}
                        operate={setOperateConversation}
                        conversation={conversation}
                        current={current}
                        folders={folders}
                      />
                    ),
                  )}
                </div>
              ))
            ) : (
              <div className={`empty text-center px-6`}>
                {auth
                  ? t("conversation.empty")
                  : t("conversation.empty-anonymous")}
              </div>
            )}
            {loadingMore && (
              <div className="flex items-center justify-center py-3 text-muted-foreground/80">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            )}
            {!hasMore && filteredHistory.length > 0 && (
              <div className="text-center py-2 text-[11px] text-muted-foreground/55">
                End
              </div>
            )}
          </div>
        </SortableContext>
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
  const HISTORY_PAGE_SIZE = 30;
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { refresh, toggle } = useConversationActions();
  const current = useSelector(selectCurrent);
  const mask = useSelector(selectMaskItem);
  const open = useSelector(selectMenu);
  const brandText = useSelector(selectLogoText);
  const auth = useSelector(selectAuthenticated);
  const history: ConversationInstance[] = useSelector(selectHistory);
  const [search, setSearch] = useState<string>("");
  const [operateConversation, setOperateConversation] = useState<Operation>({
    target: null,
    type: "",
  });
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = getNumberMemory("sidebar_width", SIDEBAR_DEFAULT_WIDTH);
    if (!Number.isFinite(stored)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, stored));
  });

  const [groupsExpanded, setGroupsExpanded] = useState(getBooleanMemory("sidebar_groups_expanded", true));
  const [historyExpanded, setHistoryExpanded] = useState(getBooleanMemory("sidebar_history_expanded", true));
  const folderTreeRef = useRef<FolderTreeRef>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resizingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; open: boolean } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

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

  const handleNewChat = useCallback(async () => {
    if (current === -1 && mask) {
      dispatch(clearMaskItem());
      dispatch(removePreflight());
      dispatch(resetNewConversation());
    } else {
      await toggle(-1);
    }
    if (mobile) dispatch(setMenu(false));
  }, [current, mask, dispatch, toggle]);

  const getLoadedHistoryCount = () => history.filter((item) => item.id > 0).length;

  const loadMoreHistory = async (append: boolean) => {
    if (historyLoadingMore) return;
    if (append && !historyHasMore) return;

    setHistoryLoadingMore(true);
    const page = await refresh({
      offset: append ? getLoadedHistoryCount() : 0,
      limit: HISTORY_PAGE_SIZE,
      append,
    });
    setHistoryHasMore(page.hasMore);
    setHistoryLoadingMore(false);
    return page;
  };

  useEffectAsync(async () => {
    const page = await loadMoreHistory(false);
    if (!page) {
      setHistoryHasMore(false);
      return;
    }

    const store = getNumberMemory("history_conversation", -1);
    if (current === store) return;
    if (store === -1) return;
    if (!page.items.some((item) => item.id === store)) return;
    await toggle(store);
  }, []);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || !open || !historyExpanded || historyLoadingMore || !historyHasMore) return;
    if (el.scrollHeight <= el.clientHeight + 12) {
      void loadMoreHistory(true);
    }
  }, [history, open, historyExpanded, historyLoadingMore, historyHasMore]);

  const handleSidebarScroll = () => {
    const el = scrollAreaRef.current;
    if (!el || !open || !historyExpanded || historyLoadingMore || !historyHasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 72) {
      void loadMoreHistory(true);
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current || mobile) return;
      const rect = sidebarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, e.clientX - rect.left),
      );
      setSidebarWidth(next);
    };

    const onMouseUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      setNumberMemory("sidebar_width", sidebarWidthRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (!mobile || e.touches.length !== 1) return;

      const touch = e.touches[0];
      if (!open && touch.clientX > SIDEBAR_SWIPE_EDGE_PX) return;
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        open,
      };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!mobile || e.changedTouches.length !== 1) return;
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const threshold = Math.max(Math.round(window.innerWidth / 8), 48);
      if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return;

      if (!start.open && start.x <= SIDEBAR_SWIPE_EDGE_PX && dx > 0) {
        dispatch(setMenu(true));
        return;
      }

      if (start.open && dx < 0) {
        dispatch(setMenu(false));
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [dispatch, open]);

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return (
        target.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select"
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const command = e.metaKey || e.ctrlKey;
      if (!command) return;

      if (key === "k") {
        e.preventDefault();
        if (!open) dispatch(setMenu(true));
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      if (key === "n" && e.shiftKey && !isEditable(e.target)) {
        e.preventDefault();
        void handleNewChat();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, handleNewChat, open]);

  const handleSidebarResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mobile || !open) return;
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resetSidebarWidth = () => {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    setNumberMemory("sidebar_width", SIDEBAR_DEFAULT_WIDTH);
  };

  const sidebarStyle = mobile
    ? undefined
    : ({ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties);

  const getConversationContainerId = useCallback(
    (conversationId: number): string | null => {
      const target = history.find((conversation) => conversation.id === conversationId);
      if (!target) return null;
      return target.folder_id ? toFolderDndId(target.folder_id) : MAIN_LIST_DND_ID;
    },
    [history],
  );

  const getContainerConversationIds = useCallback(
    (containerId: string, excludeId?: number): number[] => {
      const folderId = parseFolderDndId(containerId);
      return history
        .filter((conversation) => {
          if (conversation.id <= 0) return false;
          if (excludeId && conversation.id === excludeId) return false;
          if (folderId !== null) return conversation.folder_id === folderId;
          return !conversation.folder_id;
        })
        .map((conversation) => conversation.id);
    },
    [history],
  );

  const resolveDropTarget = useCallback(
    (
      overId: string | null,
    ): { containerId: string; overConversationId: number | null } | null => {
      if (!overId) return null;
      if (overId === MAIN_LIST_DND_ID || isFolderDndId(overId)) {
        return { containerId: overId, overConversationId: null };
      }
      if (!isConversationDndId(overId)) return null;

      const overConversationId = parseConversationDndId(overId);
      if (overConversationId === null) return null;
      const containerId = getConversationContainerId(overConversationId);
      if (!containerId) return null;

      return { containerId, overConversationId };
    },
    [getConversationContainerId],
  );

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    const target = resolveDropTarget(overId);
    if (!target) {
      dispatch(setDragOverFolder(null));
      return;
    }
    dispatch(setDragOverFolder(parseFolderDndId(target.containerId)));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    dispatch(setDragOverFolder(null));

    const activeConversationId = parseConversationDndId(String(event.active.id));
    if (activeConversationId === null) return;

    const sourceContainerId = getConversationContainerId(activeConversationId);
    if (!sourceContainerId) return;

    const overId = event.over ? String(event.over.id) : null;
    const target = resolveDropTarget(overId);
    if (!target) return;

    const { containerId: destinationContainerId, overConversationId } = target;
    if (
      sourceContainerId === destinationContainerId &&
      overConversationId === activeConversationId
    ) {
      return;
    }

    const sourceFolderId = parseFolderDndId(sourceContainerId);
    const destinationFolderId = parseFolderDndId(destinationContainerId);
    if (sourceFolderId !== destinationFolderId) {
      const ok = await moveConversation(activeConversationId, destinationFolderId);
      if (!ok) return;
      dispatch(updateConversationFolder({ id: activeConversationId, folderId: destinationFolderId }));
    }

    dispatch(
      reorderHistory({
        movedId: activeConversationId,
        insertBeforeId: overConversationId ?? null,
      }),
    );

    const reordered = getContainerConversationIds(
      destinationContainerId,
      activeConversationId,
    );
    if (overConversationId !== null) {
      const idx = reordered.indexOf(overConversationId);
      if (idx >= 0) reordered.splice(idx, 0, activeConversationId);
      else reordered.push(activeConversationId);
    } else {
      reordered.push(activeConversationId);
    }

    const orders: Record<number, number> = {};
    reordered.forEach((id, index) => {
      orders[id] = index;
    });
    await reorderConversations(orders);
  };

  return (
    <div
      ref={sidebarRef}
      className={cn("sidebar", open && "open")}
      style={sidebarStyle}
    >
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="sidebar-scroll-wrap">
            <div className="sidebar-scroll-gradient-mask" />
            <div
              ref={scrollAreaRef}
              className="sidebar-scroll-area"
              onScroll={handleSidebarScroll}
            >
              <SidebarAction
                search={search}
                setSearch={setSearch}
                onNewChat={() => void handleNewChat()}
                searchInputRef={searchInputRef}
                newChatAsMask={current === -1 && !!mask}
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
                        loadingMore={historyLoadingMore}
                        hasMore={historyHasMore}
                        operateConversation={operateConversation}
                        setOperateConversation={setOperateConversation}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </DndContext>
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
      {open && !mobile && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleSidebarResizeStart}
          onDoubleClick={resetSidebarWidth}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default SideBar;

