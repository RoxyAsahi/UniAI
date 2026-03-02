import { ReactNode, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { matchSorter } from "match-sorter";

import ModelAvatar from "@/components/ModelAvatar.tsx";
import { cn } from "@/components/ui/lib/utils.ts";
import {
  selectModel,
  selectModelList,
  selectSupportModels,
} from "@/store/chat.ts";
import version from "@/conf/version.json";

export type ChatPlaceholderMode = "default" | "chat";

type ChatPlaceholderProps = {
  mode: ChatPlaceholderMode;
  input: string;
  onSuggestionPick: (value: string) => void;
  inputPanel?: ReactNode;
};

const SUGGESTION_POOL = [
  "Summarize this topic into key conclusions and next actions.",
  "Draft a 7-day learning plan with daily milestones.",
  "Rewrite this content in a more professional tone.",
  "Explain this concept and give one practical example.",
  "Review this code and point out potential risks.",
  "Turn this long text into a concise executive summary.",
  "Create a product requirement outline from this idea.",
  "Give me five actionable growth ideas for this week.",
  "Translate this paragraph into natural English.",
  "Generate a talk outline with an opening hook.",
];

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function ChatPlaceholder({
  mode,
  input,
  onSuggestionPick,
  inputPanel,
}: ChatPlaceholderProps) {
  const { t } = useTranslation();
  const modelId = useSelector(selectModel);
  const modelList = useSelector(selectModelList);
  const supportModels = useSelector(selectSupportModels);

  const [seed, setSeed] = useState(0);

  const activeModel = useMemo(
    () => supportModels.find((model) => model.id === modelId),
    [supportModels, modelId],
  );

  const stackedModels = useMemo(() => {
    const favorites = modelList
      .map((id) => supportModels.find((model) => model.id === id))
      .filter((item): item is NonNullable<typeof item> => !!item);
    const composed = uniqueById(
      [activeModel, ...favorites, ...supportModels].filter(
        (item): item is NonNullable<typeof item> => !!item,
      ),
    );
    return composed.slice(0, mode === "default" ? 1 : 3);
  }, [activeModel, modelList, mode, supportModels]);

  const promptPool = useMemo(() => {
    const dynamic = [...SUGGESTION_POOL];
    if (activeModel?.vision_model) {
      dynamic.unshift("What analyses can you do if I upload an image?");
    }
    if (activeModel?.thinking_model) {
      dynamic.unshift("Break this complex problem into five executable steps.");
    }
    return dynamic;
  }, [activeModel?.thinking_model, activeModel?.vision_model]);

  const keyword = input.trim();
  const visibleSuggestions = useMemo(() => {
    if (promptPool.length === 0) return [];

    if (!keyword) {
      const start = seed % promptPool.length;
      const ordered = [...promptPool.slice(start), ...promptPool.slice(0, start)];
      return ordered.slice(0, mode === "default" ? 5 : 6);
    }

    const direct = promptPool.filter(
      (item) =>
        item.toLowerCase().includes(keyword.toLowerCase()) || item.includes(keyword),
    );
    const ranked = direct.length > 0 ? direct : matchSorter(promptPool, keyword);
    return ranked.slice(0, mode === "default" ? 5 : 6);
  }, [keyword, mode, promptPool, seed]);

  const description = activeModel?.description?.trim();
  const isDefaultMode = mode === "default";

  return (
    <div className={cn("chat-placeholder", isDefaultMode ? "mode-default" : "mode-chat")}>
      <div className="chat-placeholder-inner">
        <div className="chat-placeholder-model">
          <div className="chat-placeholder-avatars" aria-hidden>
            {stackedModels.map((model, index) => (
              <div
                key={model.id}
                className="chat-placeholder-avatar-item"
                style={{ zIndex: stackedModels.length - index }}
              >
                <ModelAvatar model={model} size={36} />
              </div>
            ))}
          </div>

          <div className="chat-placeholder-title">
            {activeModel?.name || "UniAI"}
          </div>

          {isDefaultMode ? (
            <p className="chat-placeholder-subtitle">How can I help you today?</p>
          ) : (
            description && (
              <p className="chat-placeholder-description" title={description}>
                {description}
              </p>
            )
          )}
        </div>

        {isDefaultMode && inputPanel && (
          <div className="chat-placeholder-inline-input">{inputPanel}</div>
        )}

        <div
          className={cn(
            "chat-placeholder-suggestions-wrap",
            isDefaultMode && "flat-list",
          )}
        >
          <div className="chat-placeholder-suggestions-header">
            <div className="chat-placeholder-suggestions-title">
              <Sparkles className="h-4 w-4" />
              <span>{t("assistant-suggest")}</span>
            </div>
            {keyword.length === 0 && promptPool.length > 6 && (
              <button
                type="button"
                className="chat-placeholder-suggestions-switch"
                onClick={() => setSeed((value) => value + 1)}
              >
                {t("change-suggest")}
              </button>
            )}
          </div>

          <div
            className={cn(
              "chat-placeholder-suggestions",
              isDefaultMode && "single-column",
            )}
          >
            {visibleSuggestions.map((suggestion, idx) => (
              <button
                key={suggestion}
                type="button"
                className={cn("chat-placeholder-suggestion", "waterfall")}
                style={{ animationDelay: `${idx * 45}ms` }}
                onClick={() => onSuggestionPick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!isDefaultMode && (
        <div className="chat-placeholder-version">UniAI v{version.version}</div>
      )}
    </div>
  );
}
