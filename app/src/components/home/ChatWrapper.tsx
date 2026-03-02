import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import FileAction from "@/components/FileProvider.tsx";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthenticated, selectInit } from "@/store/auth.ts";
import {
  listenMessageEvent,
  selectCurrent,
  selectModel,
  selectSupportModels,
  useMessages,
  useMessageActions,
  useWorking,
} from "@/store/chat.ts";
import { formatMessage } from "@/utils/processor.ts";
import ChatInterface from "@/components/home/ChatInterface.tsx";
import { clearHistoryState, getQueryParam } from "@/utils/path.ts";
import { forgetMemory, popMemory } from "@/utils/memory.ts";
import { FileArray } from "@/api/file.ts";
import {
  NewConversationAction,
  TimelineAction,
  WebAction,
} from "@/components/home/assemblies/ChatAction.tsx";
import ChatPlaceholder from "@/components/home/ChatPlaceholder.tsx";
import ActionButton from "@/components/home/assemblies/ActionButton.tsx";
import ChatInput from "@/components/home/assemblies/ChatInput.tsx";
import ScrollAction from "@/components/home/assemblies/ScrollAction.tsx";
import { cn } from "@/components/ui/lib/utils.ts";
import { goAuth } from "@/utils/app.ts";
import { getModelFromId } from "@/conf/model.ts";
import { ModelArea } from "@/components/home/ModelArea.tsx";
import { toast } from "sonner";
import { VoiceAction } from "@/components/VoiceProvider.tsx";
import NavActions from "@/components/app/NavActions.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Menu } from "lucide-react";
import { selectMenu, toggleMenu } from "@/store/menu.ts";
import {
  chatBubbleSelector,
  homePageModeSelector,
  widescreenModeSelector,
} from "@/store/settings.ts";
import { ChatPlaceholderMode } from "@/components/home/ChatPlaceholder.tsx";
import { ReactNode } from "react";

type InterfaceProps = {
  hasMessages: boolean;
  mode: ChatPlaceholderMode;
  scrollable: boolean;
  setTarget: (instance: HTMLElement | null) => void;
  input: string;
  onSuggestionPick: (suggestion: string) => void;
  inputPanel?: ReactNode;
};

function Interface({
  hasMessages,
  mode,
  input,
  onSuggestionPick,
  scrollable,
  setTarget,
  inputPanel,
}: InterfaceProps) {
  return hasMessages ? (
    <ChatInterface scrollable={scrollable} setTarget={setTarget} />
  ) : (
    <ChatPlaceholder
      mode={mode}
      input={input}
      onSuggestionPick={onSuggestionPick}
      inputPanel={inputPanel}
    />
  );
}

function fileReducer(state: FileArray, action: Record<string, any>): FileArray {
  switch (action.type) {
    case "add":
      return [...state, action.payload];
    case "remove":
      return state.filter((_, i) => i !== action.payload);
    case "clear":
      return [];
    default:
      return state;
  }
}

function ChatWrapper() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { send: sendAction } = useMessageActions();
  const process = listenMessageEvent();
  const [files, fileDispatch] = useReducer(fileReducer, []);
  const [input, setInput] = useState("");
  const [visible, setVisibility] = useState(false);
  const init = useSelector(selectInit);
  const current = useSelector(selectCurrent);
  const auth = useSelector(selectAuthenticated);
  const model = useSelector(selectModel);
  const homePageMode = useSelector(homePageModeSelector);
  const menuOpen = useSelector(selectMenu);
  const chatBubble = useSelector(chatBubbleSelector);
  const widescreenMode = useSelector(widescreenModeSelector);
  const target = useRef<HTMLTextAreaElement>(null);

  const messages = useMessages();
  const working = useWorking();
  const supportModels = useSelector(selectSupportModels);
  const hasMessages = messages.length > 0;
  const isDefaultLanding = !hasMessages && homePageMode === "default";

  const requireAuth = useMemo(
    (): boolean => !!getModelFromId(supportModels, model)?.auth,
    [model, supportModels],
  );
  const showTopGradient = current > 0;

  const [instance, setInstance] = useState<HTMLElement | null>(null);

  function clearFile() {
    fileDispatch({ type: "clear" });
  }

  async function processSend(
    data: string,
    passAuth?: boolean,
  ): Promise<boolean> {
    if (requireAuth && !auth && !passAuth) {
      toast(t("login-require"), {
        description: t("login-require-prompt"),
        action: {
          label: t("login"),
          onClick: goAuth,
        },
      });
      return false;
    }

    if (working) return false;

    const message: string = formatMessage(files, data);
    if (message.length > 0 && data.trim().length > 0) {
      if (await sendAction(message)) {
        forgetMemory("history");
        clearFile();
        return true;
      }
    }
    return false;
  }

  async function handleSend() {
    // because of the function wrapper, we need to update the selector state using props.
    if (await processSend(input)) {
      setInput("");
    }
  }

  async function handleCancel() {
    process({ id: current, event: "stop" });
  }

  function renderInputPanel(inline = false) {
    return (
      <div
        className={cn(
          "chat-input chat-input-openwebui bg-muted/25",
          inline && "chat-input-inline",
        )}
      >
        <div className="chat-input-panel">
          <div className="chat-input-textarea-wrap">
            <ChatInput
              className={cn("chat-input-textarea")}
              target={target}
              value={input}
              onValueChange={setInput}
              onEnterPressed={handleSend}
            />
          </div>
          <div className="chat-input-toolbar">
            <div className="chat-input-toolbar-left">
              {!inline && <ModelArea />}
              {!inline && <NewConversationAction />}
              <WebAction />
              <FileAction files={files} dispatch={fileDispatch} />
              <VoiceAction />
              {!inline && <TimelineAction />}
              {!inline && (
                <ScrollAction
                  visible={visible}
                  setVisibility={setVisibility}
                  target={instance}
                />
              )}
            </div>
            <div className="chat-input-toolbar-right">
              <ActionButton
                working={working}
                disabled={!working && input.trim().length === 0}
                onClick={() => (working ? handleCancel() : handleSend())}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function handleSuggestionPick(suggestion: string) {
    setInput(suggestion);
    window.requestAnimationFrame(() => {
      target.current?.focus();
    });
  }

  useEffect(() => {
    window.addEventListener("load", () => {
      const el = document.getElementById("input");
      if (el) el.focus();
    });
  }, []);

  useEffect(() => {
    if (!init) return;
    const query = getQueryParam("q").trim();
    if (query.length > 0) processSend(query).then();
    clearHistoryState();
  }, [init]);

  useEffect(() => {
    const history: string = popMemory("history");
    if (history.length) {
      setInput(history);
      toast(t("chat.recall"), {
        description: t("chat.recall-desc"),
        action: {
          label: t("chat.recall-cancel"),
          onClick: () => {
            setInput("");
          },
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!hasMessages) {
      setInstance(null);
    }
  }, [hasMessages]);

  return (
    <div
      className={cn(
        "chat-container chat-openwebui-layout bg-muted/25 dark:bg-muted/10",
        chatBubble ? "chat-layout-bubble" : "chat-layout-list",
        widescreenMode && "chat-layout-widescreen",
      )}
    >
      <div className={`chat-wrapper`}>
        <div className="chat-floating-navbar">
          <div
            className={cn("chat-top-gradient", showTopGradient && "active")}
            aria-hidden
          />
          {!menuOpen && (
            <div className="chat-floating-sidebar-toggle">
              <Button
                size={`icon-md`}
                variant={`outline`}
                className="rounded-full overflow-hidden"
                onClick={() => dispatch(toggleMenu())}
              >
                <Menu className={`h-4 w-4`} />
              </Button>
            </div>
          )}
          <div className="chat-floating-model-selector">
            <ModelArea mode="inline" side="bottom" />
          </div>
          <div className="chat-floating-actions">
            <NavActions floating />
          </div>
        </div>
        <Interface
          hasMessages={hasMessages}
          mode={homePageMode}
          setTarget={setInstance}
          scrollable={!visible}
          input={input}
          onSuggestionPick={handleSuggestionPick}
          inputPanel={isDefaultLanding ? renderInputPanel(true) : undefined}
        />
        {!isDefaultLanding && renderInputPanel(false)}
      </div>
    </div>
  );
}

export default ChatWrapper;
