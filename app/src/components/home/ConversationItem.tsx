import { mobile } from "@/utils/device.ts";
import { filterMessage } from "@/utils/processor.ts";
import { setMenu } from "@/store/menu.ts";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  FileJson,
  FileText,
  FolderInput,
  Loader2,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  PencilLine,
  Pin,
  PinOff,
  Share2,
  Trash2,
} from "lucide-react";
import Emoji from "@/components/Emoji.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { ConversationInstance } from "@/api/types.tsx";
import { useEffect, useState } from "react";
import { useConversationActions, updateConversationFolder } from "@/store/chat.ts";
import { cn } from "@/components/ui/lib/utils.ts";
import PopupDialog, { popupTypes } from "@/components/PopupDialog.tsx";
import { withNotify } from "@/api/common.ts";
import Clickable from "@/components/ui/clickable.tsx";
import { Folder, moveConversation } from "@/api/folder.ts";
import {
  archiveConversation,
  cloneConversation,
  loadConversation,
  pinConversation,
} from "@/api/history.ts";
import { saveAsFile } from "@/utils/dom.ts";

type ConversationItemProps = {
  conversation: ConversationInstance;
  current: number;
  folders?: Folder[];
  operate: (conversation: {
    target: ConversationInstance;
    type: string;
  }) => void;
};

function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFilename(name: string, fallback: string) {
  const trimmed = name.trim();
  const base = trimmed.length > 0 ? trimmed : fallback;
  return base.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function buildConversationText(conversation: ConversationInstance): string {
  const lines: string[] = [
    `# ${conversation.name || `Conversation #${conversation.id}`}`,
    "",
  ];
  for (const [index, message] of (conversation.message || []).entries()) {
    lines.push(`[${index + 1}] ${message.role}`);
    lines.push(message.content || "");
    lines.push("");
  }
  return lines.join("\n");
}

function exportConversationPdf(title: string, body: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: sans-serif; padding: 24px; line-height: 1.6; }
          pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(title)}</h2>
        <pre>${escapeHtml(body)}</pre>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
  return true;
}

function ConversationItem({
  conversation,
  current,
  folders = [],
  operate,
}: ConversationItemProps) {
  const dispatch = useDispatch();
  const { toggle, refresh, rename } = useConversationActions();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);

  const [editDialog, setEditDialog] = useState(false);

  const loading = false;

  const handleMoveToFolder = async (folderId: number) => {
    setOpen(false);
    const ok = await moveConversation(conversation.id, folderId);
    if (ok) dispatch(updateConversationFolder({ id: conversation.id, folderId }));
  };

  const handleClone = async () => {
    setOpen(false);
    const resp = await cloneConversation(conversation.id);
    withNotify(t, resp, true);
    if (!resp.status) return;

    const id = Number(resp.data?.id ?? -1);
    await refresh();
    if (id > 0) await toggle(id);
  };

  const handlePin = async () => {
    setOpen(false);
    const resp = await pinConversation(conversation.id, !conversation.pinned);
    withNotify(t, resp, true);
    if (!resp.status) return;

    await refresh();
  };

  const handleArchive = async () => {
    setOpen(false);
    const resp = await archiveConversation(conversation.id, !conversation.archived);
    withNotify(t, resp, true);
    if (!resp.status) return;

    await refresh();
  };

  const handleDownload = async (format: "json" | "txt" | "pdf") => {
    setOpen(false);
    const data = await loadConversation(conversation.id);
    const filename = sanitizeFilename(
      data.name || conversation.name,
      `conversation-${conversation.id}`,
    );

    if (format === "json") {
      saveAsFile(`${filename}.json`, JSON.stringify(data, null, 2));
      return;
    }

    const content = buildConversationText(data);
    if (format === "txt") {
      saveAsFile(`${filename}.txt`, content);
      return;
    }

    exportConversationPdf(filename, content);
  };

  useEffect(() => {
    if (!hovered || mobile) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) setShiftPressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) setShiftPressed(false);
    };
    const onBlur = () => setShiftPressed(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [hovered]);

  const showShiftQuickActions = hovered && shiftPressed && !mobile;

  return (
    <Clickable
      tapScale={0.975}
      tapDuration={0.01}
      className={cn("conversation", current === conversation.id && "active")}
      onClick={async (e) => {
        const target = e.target as HTMLElement;
        if (
          target.classList.contains("delete") ||
          target.parentElement?.classList.contains("delete")
        )
          return;
        await toggle(conversation.id);
        if (mobile) dispatch(setMenu(false));
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setShiftPressed(false);
      }}
    >
      {conversation.titling ? (
        <div className={`conversation-icon h-6 w-6 flex items-center justify-center mr-1 text-base shrink-0`}>
          <Loader2 className={`h-4 w-4 animate-spin text-secondary`} />
        </div>
      ) : conversation.avatar ? (
        <div className={`conversation-icon h-6 w-6 flex items-center justify-center mr-1 text-base shrink-0`}>
          <Emoji emoji={conversation.avatar} />
        </div>
      ) : (
        <MessageSquare
          className={`conversation-icon h-6 w-6 p-1 mr-1 text-secondary bg-input/20 rounded-md`}
        />
      )}
      <div className="flex min-w-0 items-center gap-1 flex-1">
        <div className={cn("title", conversation.archived && "opacity-70")}>
          {filterMessage(conversation.name)}
        </div>
        {conversation.pinned && !conversation.archived && (
          <Pin className="h-3 w-3 text-muted-foreground/75 shrink-0" />
        )}
        {conversation.archived && (
          <Archive className="h-3 w-3 text-muted-foreground/75 shrink-0" />
        )}
      </div>
      {showShiftQuickActions ? (
        <div className="flex items-center gap-1">
          <button
            className={cn("id delete", loading && "loading")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleArchive();
            }}
            title={conversation.archived ? t("conversation.unarchive") : t("conversation.archive")}
          >
            {conversation.archived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </button>
          <button
            className={cn("id delete")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              operate({ target: conversation, type: "delete" });
            }}
            title={t("conversation.delete-conversation")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <DropdownMenu
          open={open}
          onOpenChange={(state: boolean) => {
            setOpen(state);
            if (state) setOffset(new Date().getTime());
          }}
        >
          <DropdownMenuTrigger
            className={`flex flex-row outline-none`}
            asChild
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className={cn("id", loading && "loading")}>
              {loading ? (
                <Loader2 className={`mr-0.5 h-4 w-4 animate-spin`} />
              ) : (
                <MoreHorizontal className={`h-4 w-4 mr-0.5`} />
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={`end`}>
          <DropdownMenuLabel
            className={`inline-flex conversation-id text-left py-0.5 w-full`}
          >
            {conversation.id}

            <MessagesSquare
              className={`inline h-3.5 w-3.5 ml-auto translate-y-0.5 text-secondary`}
            />
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <PopupDialog
            title={t("conversation.edit-title")}
            open={editDialog}
            setOpen={setEditDialog}
            type={popupTypes.Text}
            name={t("title")}
            defaultValue={conversation.name}
            onSubmit={async (name) => {
              const resp = await rename(conversation.id, name);
              withNotify(t, resp, true);
              if (!resp.status) return false;

              setEditDialog(false);
              return true;
            }}
          />
          <DropdownMenuItem
            onClick={(e) => {
              if (offset + 500 > new Date().getTime()) return;

              e.preventDefault();
              e.stopPropagation();

              setEditDialog(true);
            }}
          >
            <PencilLine className={`h-4 w-4 mx-1`} />
            {t("conversation.edit-title")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download className={`h-4 w-4 mx-1`} />
              {t("download")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleDownload("json");
                }}
              >
                <FileJson className="h-4 w-4 mx-1" />
                JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleDownload("txt");
                }}
              >
                <FileText className="h-4 w-4 mx-1" />
                TXT
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleDownload("pdf");
                }}
              >
                <FileText className="h-4 w-4 mx-1" />
                PDF
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleClone();
            }}
          >
            <Copy className={`h-4 w-4 mx-1`} />
            {t("conversation.clone")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handlePin();
            }}
          >
            {conversation.pinned ? (
              <PinOff className={`h-4 w-4 mx-1`} />
            ) : (
              <Pin className={`h-4 w-4 mx-1`} />
            )}
            {conversation.pinned ? t("conversation.unpin") : t("conversation.pin")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleArchive();
            }}
          >
            {conversation.archived ? (
              <ArchiveRestore className={`h-4 w-4 mx-1`} />
            ) : (
              <Archive className={`h-4 w-4 mx-1`} />
            )}
            {conversation.archived
              ? t("conversation.unarchive")
              : t("conversation.archive")}
          </DropdownMenuItem>
          {folders.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className={`h-4 w-4 mx-1`} />
                {t("folder.move-to")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {folders.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleMoveToFolder(f.id);
                    }}
                  >
                    {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              operate({ target: conversation, type: "share" });

              setOpen(false);
            }}
          >
            <Share2 className={`h-4 w-4 mx-1`} />
            {t("share.share-conversation")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              operate({ target: conversation, type: "delete" });

              setOpen(false);
            }}
          >
            <Trash2 className={`h-4 w-4 mx-1`} />
            {t("conversation.delete-conversation")}
          </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Clickable>
  );
}

export default ConversationItem;
