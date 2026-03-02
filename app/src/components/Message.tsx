import { Message, UserRole } from "@/api/types.tsx";
import Markdown from "@/components/Markdown.tsx";
import {
  CalendarCheck2,
  CircleSlash,
  Cloud,
  CloudCog,
  Copy,
  File,
  Loader2,
  SquareMousePointer,
  PencilLine,
  Power,
  RotateCcw,
  Trash,
} from "lucide-react";
import { filterMessage } from "@/utils/processor.ts";
import {
  copyClipboard,
  isContainDom,
  saveAsFile,
} from "@/utils/dom.ts";
import { useTranslation } from "react-i18next";
import React, { Ref, useRef, useState } from "react";
import { cn } from "@/components/ui/lib/utils.ts";
import EditorProvider from "@/components/EditorProvider.tsx";
import Avatar from "@/components/Avatar.tsx";
import { useSelector } from "react-redux";
import { selectUsername } from "@/store/auth.ts";
import { appLogo } from "@/conf/env.ts";
import { motion } from "framer-motion";
import { ThinkContent } from "@/components/ThinkContent";
import { chatBubbleSelector } from "@/store/settings.ts";

type MessageProps = {
  index: number;
  message: Message;
  end?: boolean;
  username?: string;
  onEvent?: (event: string, index?: number, message?: string) => void;
  ref?: Ref<HTMLElement>;
  sharing?: boolean;

  selected?: boolean;
  onFocus?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onFocusLeave?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  chatBubble?: boolean;
};

function MessageSegment(props: MessageProps) {
  const ref = useRef(null);
  const { message } = props;
  const chatBubble = useSelector(chatBubbleSelector);

  return (
    <div
      className={cn(
        "message",
        message.role,
        chatBubble ? "bubble-layout" : "list-layout",
      )}
      ref={ref}
      data-message-index={props.index}
      onClick={props.onFocus}
      onMouseEnter={props.onFocus}
      onMouseLeave={(event) => {
        try {
          if (isContainDom(ref.current, event.relatedTarget as HTMLElement))
            return;
          props.onFocusLeave && props.onFocusLeave(event);
        } catch (e) {
          console.debug(`[message] cannot leave focus: ${e}`);
        }
      }}
    >
      <MessageContent {...props} chatBubble={chatBubble} />
      <MessageQuota message={message} />
    </div>
  );
}

type MessageQuotaProps = {
  message: Message;
};

function MessageQuota({ message }: MessageQuotaProps) {
  const [detail, setDetail] = useState(false);

  if (message.role === UserRole) return null;

  return (
    message.quota &&
    message.quota !== 0 && (
      <motion.div
        className={cn("message-quota", message.plan && "subscription")}
        onClick={() => setDetail(!detail)}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: detail ? 360 : 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {message.plan ? (
            <CalendarCheck2 className={`h-4 w-4 icon`} />
          ) : detail ? (
            <CloudCog className={`h-4 w-4 icon`} />
          ) : (
            <Cloud className={`h-4 w-4 icon`} />
          )}
        </motion.div>
        <motion.span
          className={`quota`}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {(message.quota < 0 ? 0 : message.quota).toFixed(detail ? 6 : 2)}
        </motion.span>
      </motion.div>
    )
  );
}

function MessageContent({
  message,
  end,
  index,
  onEvent,
  selected,
  username,
  sharing,
  chatBubble = true,
}: MessageProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const hasContent = message.content.length > 0;
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";
  const isOutput = message.end === false;
  const notInOutput = message.end !== false;
  const disableDelete = isAssistant && end && !notInOutput;
  const shouldRenderActionRow = !!onEvent && !sharing;
  const actionRowVisible = !!end || !!selected;
  const user = useSelector(selectUsername);

  const [open, setOpen] = useState(false);
  const [editedMessage, setEditedMessage] = useState<string | undefined>("");
  const showAvatar = !(isUser && chatBubble);
  const messageLabel = isAssistant
    ? t("chat.assistant-name", "助手")
    : isSystem
    ? t("chat.system-name", "系统")
    : null;

  // parse think content
  const parseThinkContent = (content: string) => {
    // check if there is a start tag

    const startMatch = content.match(/<think>\n?(.*?)(?:<\/think>|$)/s);
    if (startMatch) {
      const thinkContent = startMatch[1];
      // if there is an end tag, remove the whole matching part;
      // if not, keep the remaining content
      const hasEndTag = content.includes('</think>');
      const restContent = hasEndTag ? 
        content.replace(startMatch[0], "").trim() :
        content.substring(content.indexOf('<think>') + 7).trim();
      
      return {
        thinkContent,
        restContent: hasEndTag ? restContent : '',
        isComplete: hasEndTag
      };
    }
    return null;
  };

  const parsedContent = message.content.length ? parseThinkContent(message.content) : null;
  const openEditDialog = () => {
    editedMessage?.length === 0 && setEditedMessage(message.content);
    setOpen(true);
  };

  const useMessageAsInput = () => {
    const input = document.getElementById("input") as HTMLInputElement;
    if (input) {
      input.value = filterMessage(message.content);
      input.focus();
    }
  };

  return (
    <div className={cn("content-wrapper", isUser && chatBubble && "bubble-user-wrapper")}>
      <EditorProvider
        submittable={true}
        onSubmit={(value) => onEvent && onEvent("edit", index, value)}
        open={open}
        setOpen={setOpen}
        value={editedMessage ?? ""}
        onChange={setEditedMessage}
      />
      {showAvatar && (
        <div className={`message-avatar-wrapper`}>
          {isUser ? (
            <Avatar
              className={`message-avatar animate-fade-in`}
              username={username ?? user}
            />
          ) : (
            <img
              src={appLogo}
              alt={``}
              className={`message-avatar animate-fade-in`}
            />
          )}
        </div>
      )}
      <div className="message-main">
        {chatBubble && messageLabel && (
          <div className="message-name">{messageLabel}</div>
        )}
        <div
          className={cn(
            "relative message-content dark:bg-muted/40 border dark:border-transparent hover:border-border",
            isUser && chatBubble && "user-bubble-content",
            isUser && !chatBubble && "user-list-content",
            (isAssistant || isSystem) && chatBubble && "assistant-bubble-content",
          )}
        >
          {hasContent ? (
            <>
              {parsedContent ? (
                <>
                  <ThinkContent 
                    content={parsedContent.thinkContent} 
                    isComplete={parsedContent.isComplete}
                  />
                  {parsedContent.restContent && (
                    <Markdown
                      loading={message.end === false}
                      children={message.content}
                      acceptHtml={false}
                    />
                  )}
                </>
              ) : (
                <Markdown
                  loading={message.end === false}
                  children={message.content}
                  acceptHtml={false}
                />
              )}
            </>
          ) : message.end === true ? (
            <CircleSlash className={`h-5 w-5 m-1`} />
          ) : (
            <Loader2 className={`h-5 w-5 m-1 animate-spin`} />
          )}

          {isAssistant && hasContent && isOutput && (
            <Loader2
              className={`absolute right-0 bottom-0 h-3.5 w-3.5 m-1 animate-spin`}
            />
          )}
        </div>
        {shouldRenderActionRow && (
          <div
            className={cn(
              "message-actions-wrapper",
              isUser && "user",
              actionRowVisible ? "visible" : "hidden",
            )}
          >
            {isAssistant ? (
              <>
                {end ? (
                  <button
                    type="button"
                    className="message-action-btn"
                    title={notInOutput ? t("message.restart") : t("message.stop")}
                    aria-label={notInOutput ? t("message.restart") : t("message.stop")}
                    onClick={() =>
                      onEvent && onEvent(notInOutput ? "restart" : "stop", index)
                    }
                  >
                    {notInOutput ? (
                      <RotateCcw className={`h-4 w-4`} />
                    ) : (
                      <Power className={`h-4 w-4`} />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.copy")}
                  aria-label={t("message.copy")}
                  onClick={() => copyClipboard(filterMessage(message.content))}
                >
                  <Copy className={`h-4 w-4`} />
                </button>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.use")}
                  aria-label={t("message.use")}
                  onClick={useMessageAsInput}
                >
                  <SquareMousePointer className={`h-4 w-4`} />
                </button>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.edit")}
                  aria-label={t("message.edit")}
                  onClick={openEditDialog}
                  disabled={disableDelete}
                >
                  <PencilLine className={`h-4 w-4`} />
                </button>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.remove")}
                  aria-label={t("message.remove")}
                  onClick={() => onEvent && onEvent("remove", index)}
                  disabled={disableDelete}
                >
                  <Trash className={`h-4 w-4`} />
                </button>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.save")}
                  aria-label={t("message.save")}
                  onClick={() =>
                    saveAsFile(
                      `message-${message.role}.txt`,
                      filterMessage(message.content),
                    )
                  }
                >
                  <File className={`h-4 w-4`} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.edit")}
                  aria-label={t("message.edit")}
                  onClick={openEditDialog}
                >
                  <PencilLine className={`h-4 w-4`} />
                </button>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.copy")}
                  aria-label={t("message.copy")}
                  onClick={() => copyClipboard(filterMessage(message.content))}
                >
                  <Copy className={`h-4 w-4`} />
                </button>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.remove")}
                  aria-label={t("message.remove")}
                  onClick={() => onEvent && onEvent("remove", index)}
                >
                  <Trash className={`h-4 w-4`} />
                </button>
                <button
                  type="button"
                  className="message-action-btn"
                  title={t("message.save")}
                  aria-label={t("message.save")}
                  onClick={() =>
                    saveAsFile(
                      `message-${message.role}.txt`,
                      filterMessage(message.content),
                    )
                  }
                >
                  <File className={`h-4 w-4`} />
                </button>
              </>
            )}
          </div>
        )}
        {isAssistant && message.end === true && (message.follow_ups?.length || 0) > 0 && (
          <motion.div
            className="followups-wrapper"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="followups-title">{t("chat.followups", "追问建议")}</div>
            <div className="followups-list">
              {message.follow_ups!.map((item, idx) => (
                <button
                  key={`${index}-follow-up-${idx}`}
                  type="button"
                  className="followup-item"
                  title={item}
                  onClick={() => onEvent && onEvent("follow-up", index, item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default MessageSegment;
