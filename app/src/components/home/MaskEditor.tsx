import { CustomMask, initialCustomMask } from "@/masks/types.ts";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthenticated } from "@/store/auth.ts";
import { themeSelector } from "@/store/globals.ts";
import React, { useMemo, useState } from "react";
import { saveMask } from "@/api/mask.ts";
import { withNotify } from "@/api/common.ts";
import { updateMasks, selectSupportModels } from "@/store/chat.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import EditorProvider from "@/components/EditorProvider.tsx";
import Tips from "@/components/Tips.tsx";
import { Button } from "@/components/ui/button.tsx";
import Emoji, { getEmojiSource } from "@/components/Emoji.tsx";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Input } from "@/components/ui/input.tsx";
import { FlexibleTextarea } from "@/components/ui/textarea.tsx";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash,
  BotIcon,
  ServerIcon,
  UserIcon,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/components/ui/lib/utils.ts";
import { Roles, UserRole, AssistantRole, SystemRole } from "@/api/types.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import ModelAvatar from "@/components/ModelAvatar.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

// ─── Reducer ────────────────────────────────────────────────────────────────

export function maskEditorReducer(state: CustomMask, action: any): CustomMask {
  switch (action.type) {
    case "update-avatar":
      return { ...state, avatar: action.payload };
    case "update-name":
      return { ...state, name: action.payload };
    case "update-description": {
      // Keep description and context[0] (system role) in sync.
      const newDesc = action.payload as string;
      const ctx = [...state.context];
      if (ctx[0]?.role === SystemRole) {
        ctx[0] = { ...ctx[0], content: newDesc };
      } else if (newDesc.trim()) {
        ctx.unshift({ role: SystemRole, content: newDesc });
      }
      return { ...state, description: newDesc, context: ctx };
    }
    case "update-model":
      return { ...state, model: action.payload };
    case "update-temperature":
      return { ...state, temperature: action.payload };
    case "update-top-p":
      return { ...state, top_p: action.payload };
    case "update-max-tokens":
      return { ...state, max_tokens: action.payload };
    case "update-history":
      return { ...state, history: action.payload };
    case "update-stream":
      return { ...state, stream: action.payload };
    case "reset-model-settings":
      return {
        ...state,
        model: undefined,
        temperature: undefined,
        top_p: undefined,
        max_tokens: undefined,
        history: undefined,
        stream: undefined,
      };
    case "set-conversation":
      return { ...state, context: action.payload };
    case "new-message":
      return {
        ...state,
        context: [...state.context, { role: UserRole, content: "" }],
      };
    case "new-message-below":
      return {
        ...state,
        context: [
          ...state.context.slice(0, action.index + 1),
          { role: UserRole, content: "" },
          ...state.context.slice(action.index + 1),
        ],
      };
    case "update-message-role":
      return {
        ...state,
        context: state.context.map((item, idx) => {
          if (idx === action.index) return { ...item, role: action.payload };
          return item;
        }),
      };
    case "update-message-content": {
      const newContext = state.context.map((item, idx) => {
        if (idx === action.index) return { ...item, content: action.payload };
        return item;
      });
      // If editing the first system message, keep description in sync too
      const syncedDesc =
        action.index === 0 && state.context[0]?.role === SystemRole
          ? action.payload
          : state.description;
      return { ...state, context: newContext, description: syncedDesc };
    }
    case "change-index": {
      const { from, to } = action.payload;
      const context = [...state.context];
      const [removed] = context.splice(from, 1);
      context.splice(to, 0, removed);
      return { ...state, context };
    }
    case "remove-message":
      return {
        ...state,
        context: state.context.filter((_, idx) => idx !== action.index),
      };
    case "reset":
      return { ...initialCustomMask };
    case "set-mask": {
      const m = action.payload as CustomMask;
      // If description is empty but context[0] is a system message, extract it
      if (!m.description?.trim() && m.context[0]?.role === SystemRole) {
        return { ...m, description: m.context[0].content };
      }
      // If description exists but context[0] is not a system message, insert one
      if (m.description?.trim() && m.context[0]?.role !== SystemRole) {
        return {
          ...m,
          context: [{ role: SystemRole, content: m.description }, ...m.context],
        };
      }
      return { ...m };
    }
    case "import-mask": {
      const m = action.payload;
      const description =
        m.description?.trim() ||
        (m.context[0]?.role === SystemRole ? m.context[0].content : "");
      // If we extracted description from context[0], keep context[0] so the
      // conversation list still shows it (they stay in sync via update-description)
      return { ...m, description, id: -1 };
    }
    default:
      return state;
  }
}

// ─── Role icon helper (non-hook version) ────────────────────────────────────

function getRoleIconStatic(role: string): React.ReactNode {
  switch (role) {
    case UserRole:
      return <UserIcon className="h-4 w-4" />;
    case AssistantRole:
      return <BotIcon className="h-4 w-4" />;
    case SystemRole:
      return <ServerIcon className="h-4 w-4" />;
    default:
      return <UserIcon className="h-4 w-4" />;
  }
}

// ─── RoleAction ──────────────────────────────────────────────────────────────

type RoleActionProps = {
  role: string;
  onClick: (role: string) => void;
};

function RoleAction({ role, onClick }: RoleActionProps) {
  const toggle = () => {
    const index = Roles.indexOf(role);
    const next = (index + 1) % Roles.length;
    onClick(Roles[next]);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className="shrink-0 h-10 w-10"
      onClick={toggle}
      title={role}
    >
      {getRoleIconStatic(role)}
    </Button>
  );
}

// ─── MaskAction ──────────────────────────────────────────────────────────────

type MaskActionProps = {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};

function MaskAction({ children, disabled, onClick }: MaskActionProps) {
  return (
    <div
      className={cn("mask-action", disabled && "disabled")}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </div>
  );
}

// ─── SettingRow ──────────────────────────────────────────────────────────────

type SettingRowProps = {
  label: string;
  tip?: string;
  children: React.ReactNode;
};

function SettingRow({ label, tip, children }: SettingRowProps) {
  return (
    <div className="mask-setting-row">
      <div className="mask-setting-label">
        {label}
        {tip && <Tips content={tip} />}
      </div>
      <div className="mask-setting-value">{children}</div>
    </div>
  );
}

// ─── ModelSettingsTab ────────────────────────────────────────────────────────

type ModelSettingsTabProps = {
  mask: CustomMask;
  dispatch: (action: any) => void;
};

function ModelSettingsTab({ mask, dispatch }: ModelSettingsTabProps) {
  const { t } = useTranslation();
  const supportModels = useSelector(selectSupportModels);

  const tempEnabled = mask.temperature !== undefined;
  const topPEnabled = mask.top_p !== undefined;
  const maxTokensEnabled = mask.max_tokens !== undefined;
  const historyEnabled = mask.history !== undefined;
  const streamEnabled = mask.stream !== undefined;

  const temperature = mask.temperature ?? 0.6;
  const topP = mask.top_p ?? 1.0;
  const maxTokens = mask.max_tokens ?? 2000;
  const history = mask.history ?? 8;
  const stream = mask.stream ?? true;

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="mask-settings-content">
        {/* Default Model */}
        <SettingRow label={t("mask.settings.default-model", "默认模型")}>
          <div className="flex items-center gap-1.5">
            <Select
              value={mask.model || ""}
              onValueChange={(v) => dispatch({ type: "update-model", payload: v || undefined })}
            >
              <SelectTrigger
                className="h-8 text-sm w-[200px]"
                title={mask.model || ""}
              >
                <span className="truncate block max-w-[160px]">
                  <SelectValue placeholder={t("mask.settings.select-model", "选择模型")} />
                </span>
              </SelectTrigger>
              <SelectContent>
                {supportModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <ModelAvatar size={16} model={m} />
                      <span>{m.name || m.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mask.model && (
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title={t("mask.settings.clear-model", "清除")}
                onClick={() => dispatch({ type: "update-model", payload: undefined })}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </SettingRow>

        {/* Temperature */}
        <SettingRow
          label={t("settings.temperature", "模型温度")}
          tip={t("settings.temperature-tip", "控制输出的随机性")}
        >
          <div className="flex items-center gap-3">
            <Switch
              checked={tempEnabled}
              onCheckedChange={(v) =>
                dispatch({ type: "update-temperature", payload: v ? 0.6 : undefined })
              }
            />
            {tempEnabled && (
              <>
                <Slider
                  value={[temperature * 10]}
                  min={0}
                  max={20}
                  step={1}
                  className="w-28"
                  classNameThumb="h-4 w-4"
                  onValueChange={(v) =>
                    dispatch({ type: "update-temperature", payload: v[0] / 10 })
                  }
                />
                <span className="text-sm w-8 text-right">{temperature.toFixed(1)}</span>
              </>
            )}
          </div>
        </SettingRow>

        {/* Top-P */}
        <SettingRow
          label="Top-P"
          tip={t("settings.top-p-tip", "控制词汇多样性")}
        >
          <div className="flex items-center gap-3">
            <Switch
              checked={topPEnabled}
              onCheckedChange={(v) =>
                dispatch({ type: "update-top-p", payload: v ? 1.0 : undefined })
              }
            />
            {topPEnabled && (
              <>
                <Slider
                  value={[topP * 10]}
                  min={0}
                  max={10}
                  step={1}
                  className="w-28"
                  classNameThumb="h-4 w-4"
                  onValueChange={(v) =>
                    dispatch({ type: "update-top-p", payload: v[0] / 10 })
                  }
                />
                <span className="text-sm w-8 text-right">{topP.toFixed(1)}</span>
              </>
            )}
          </div>
        </SettingRow>

        {/* Context Count */}
        <SettingRow
          label={t("settings.history", "上下文数")}
          tip={t("settings.history-tip", "携带的历史消息数量")}
        >
          <div className="flex items-center gap-3">
            <Switch
              checked={historyEnabled}
              onCheckedChange={(v) =>
                dispatch({ type: "update-history", payload: v ? 8 : undefined })
              }
            />
            {historyEnabled && (
              <>
                <Slider
                  value={[history]}
                  min={0}
                  max={100}
                  step={1}
                  className="w-28"
                  classNameThumb="h-4 w-4"
                  onValueChange={(v) =>
                    dispatch({ type: "update-history", payload: v[0] })
                  }
                />
                <span className="text-sm w-8 text-right">{history}</span>
              </>
            )}
          </div>
        </SettingRow>

        {/* Max Tokens */}
        <SettingRow
          label={t("settings.max-tokens", "最大 Token 数")}
          tip={t("settings.max-tokens-tip", "单次回复的最大 token 数")}
        >
          <div className="flex items-center gap-3">
            <Switch
              checked={maxTokensEnabled}
              onCheckedChange={(v) =>
                dispatch({ type: "update-max-tokens", payload: v ? 2000 : undefined })
              }
            />
            {maxTokensEnabled && (
              <>
                <Slider
                  value={[maxTokens]}
                  min={256}
                  max={32000}
                  step={256}
                  className="w-28"
                  classNameThumb="h-4 w-4"
                  onValueChange={(v) =>
                    dispatch({ type: "update-max-tokens", payload: v[0] })
                  }
                />
                <span className="text-sm w-10 text-right">{maxTokens}</span>
              </>
            )}
          </div>
        </SettingRow>

        {/* Stream */}
        <SettingRow label={t("mask.settings.stream", "流式输出")}>
          <div className="flex items-center gap-3">
            <Switch
              checked={streamEnabled}
              onCheckedChange={(v) =>
                dispatch({ type: "update-stream", payload: v ? true : undefined })
              }
            />
            {streamEnabled && (
              <Switch
                checked={stream}
                onCheckedChange={(v) =>
                  dispatch({ type: "update-stream", payload: v })
                }
              />
            )}
          </div>
        </SettingRow>

        {/* Reset */}
        <div className="flex justify-end pt-2 pb-4 px-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => dispatch({ type: "reset-model-settings" })}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            {t("reset", "重置")}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── PromptSettingsTab ───────────────────────────────────────────────────────

type PromptSettingsTabProps = {
  mask: CustomMask;
  dispatch: (action: any) => void;
  theme: string;
};

function PromptSettingsTab({ mask, dispatch, theme }: PromptSettingsTabProps) {
  const { t } = useTranslation();
  const [picker, setPicker] = useState(false);

  const tokenCount = useMemo(() => {
    return Math.ceil((mask.description || "").length / 4);
  }, [mask.description]);

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="mask-settings-content">
        {/* Name + Avatar */}
        <div className="mask-prompt-name-row">
          <Tips
            trigger={
              <Button variant="outline" size="icon" className="shrink-0 h-10 w-10">
                <Emoji emoji={mask.avatar} className="h-6 w-6" />
              </Button>
            }
            open={picker}
            onOpenChange={setPicker}
            align="start"
            classNamePopup="mask-picker-dialog"
            notHide
          >
            <EmojiPicker
              className="picker"
              height={320}
              lazyLoadEmojis
              skinTonesDisabled
              theme={theme as Theme}
              open={true}
              searchPlaceHolder={t("mask.search-emoji")}
              getEmojiUrl={getEmojiSource}
              onEmojiClick={(emoji) => {
                setPicker(false);
                dispatch({ type: "update-avatar", payload: emoji.unified });
              }}
            />
          </Tips>
          <Input
            value={mask.name}
            placeholder={t("mask.name-placeholder", "助手名称")}
            className="flex-1"
            onChange={(e) => dispatch({ type: "update-name", payload: e.target.value })}
          />
        </div>

        {/* System Prompt / Description */}
        <div className="mask-prompt-section">
          <div className="mask-prompt-label">
            {t("mask.system-prompt", "系统提示词")}
            <Tips content={t("mask.system-prompt-tip", "发送给模型的系统提示词，将作为对话的第一条 system 消息")} />
          </div>
          <FlexibleTextarea
            value={mask.description || ""}
            placeholder={t("mask.description-placeholder", "输入系统提示词...")}
            className="mask-prompt-textarea"
            onChange={(e) =>
              dispatch({ type: "update-description", payload: e.target.value })
            }
          />
          <div className="mask-prompt-footer">
            <span className="text-xs text-muted-foreground">
              Tokens: {tokenCount}
            </span>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── ConversationTab ─────────────────────────────────────────────────────────

type ConversationTabProps = {
  mask: CustomMask;
  dispatch: (action: any) => void;
};

function ConversationTab({ mask, dispatch }: ConversationTabProps) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState(false);
  const [editorIndex, setEditorIndex] = useState(-1);

  const openEditor = (index: number) => {
    setEditorIndex(index);
    setEditor(true);
  };

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="mask-settings-content">
        <EditorProvider
          value={editor && editorIndex >= 0 ? mask.context[editorIndex]?.content ?? "" : ""}
          onChange={(content) =>
            dispatch({ type: "update-message-content", index: editorIndex, payload: content })
          }
          open={editor}
          setOpen={setEditor}
        />

        {/* Conversation messages — context[0] with role=system is the system prompt,
            kept in sync with the description field in the Prompt Settings tab */}
        <div className="mask-conversation-list">
          {mask.context.map((item, index) => (
            <div key={index} className="mask-conversation-wrapper">
              <div className="mask-conversation">
                <RoleAction
                  role={item.role}
                  onClick={(role) =>
                    dispatch({ type: "update-message-role", index, payload: role })
                  }
                />
                <FlexibleTextarea
                  className="ml-3 flex-1"
                  value={item.content}
                  placeholder={
                    item.role === SystemRole
                      ? t("mask.system-placeholder", "系统提示词...")
                      : item.role === AssistantRole
                      ? t("mask.assistant-placeholder", "助手回复...")
                      : t("mask.user-placeholder", "用户消息...")
                  }
                  onChange={(e) =>
                    dispatch({ type: "update-message-content", index, payload: e.target.value })
                  }
                />
              </div>
              <div className="mask-actions">
                <MaskAction onClick={() => dispatch({ type: "new-message-below", index })}>
                  <Plus />
                </MaskAction>
                <MaskAction onClick={() => openEditor(index)}>
                  <Pencil />
                </MaskAction>
                <MaskAction
                  disabled={index === 0}
                  onClick={() =>
                    dispatch({ type: "change-index", payload: { from: index, to: index - 1 } })
                  }
                >
                  <ChevronUp />
                </MaskAction>
                <MaskAction
                  disabled={index === mask.context.length - 1}
                  onClick={() =>
                    dispatch({ type: "change-index", payload: { from: index, to: index + 1 } })
                  }
                >
                  <ChevronDown />
                </MaskAction>
                <MaskAction
                  disabled={mask.context.length === 1}
                  onClick={() => dispatch({ type: "remove-message", index })}
                >
                  <Trash />
                </MaskAction>
              </div>
            </div>
          ))}
          <div className="flex justify-center mt-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "new-message" })}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("mask.add-message", "添加消息")}
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── MaskEditor (main Dialog) ────────────────────────────────────────────────

type CustomMaskDialogProps = {
  mask: CustomMask;
  dispatch: (action: any) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TabId = "model" | "prompt" | "conversation";

function MaskEditor({ mask, dispatch, open, onOpenChange }: CustomMaskDialogProps) {
  const { t } = useTranslation();
  const auth = useSelector(selectAuthenticated);
  const theme = useSelector(themeSelector);
  const global = useDispatch();

  const [activeTab, setActiveTab] = useState<TabId>("prompt");

  const tabs: { id: TabId; label: string }[] = [
    { id: "model", label: t("mask.tab.model", "模型设置") },
    { id: "prompt", label: t("mask.tab.prompt", "提示词设置") },
    { id: "conversation", label: t("mask.tab.conversation", "预设对话") },
  ];

  const post = async () => {
    const data = { ...mask };
    data.context = mask.context.filter((item) => item.content.trim().length > 0);
    if (data.name.trim().length === 0) return;
    // Allow saving with only a system prompt (description) and no preset conversation
    if (data.context.length === 0 && !data.description?.trim()) return;

    const resp = await saveMask(data);
    withNotify(t, resp, true);
    if (!resp.status) return;

    await updateMasks(global);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mask-editor-dialog flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">
            {mask.id !== -1 ? mask.name || t("mask.edit", "编辑助手") : t("mask.create", "创建助手")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar */}
          <div className="mask-editor-sidebar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={cn("mask-editor-tab", activeTab === tab.id && "active")}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            {activeTab === "model" && (
              <ModelSettingsTab mask={mask} dispatch={dispatch} />
            )}
            {activeTab === "prompt" && (
              <PromptSettingsTab mask={mask} dispatch={dispatch} theme={theme} />
            )}
            {activeTab === "conversation" && (
              <ConversationTab mask={mask} dispatch={dispatch} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel", "取消")}
          </Button>
          <Button unClickable loading={true} onClick={post} disabled={!auth}>
            {auth ? t("submit", "保存") : t("login-require", "请先登录")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MaskEditor;
