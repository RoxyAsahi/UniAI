import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { matchSorter } from "match-sorter";
import { Check, ChevronDown, Minus, Plus, Search } from "lucide-react";

import { Model } from "@/api/types.tsx";
import ModelAvatar from "@/components/ModelAvatar.tsx";
import { cn } from "@/components/ui/lib/utils.ts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { selectAuthenticated } from "@/store/auth.ts";
import { goAuth } from "@/utils/app.ts";
import { selectModel, selectSupportModels, setModel } from "@/store/chat.ts";
import { toast } from "sonner";

type ModelSource = "all" | "local" | "external" | "direct";

const MAX_MODEL_SLOTS = 3;

function getModelSource(model: Model): Exclude<ModelSource, "all"> {
  const tags = new Set(model.tag ?? []);
  if (tags.has("local") || tags.has("open-source") || model.id.includes("ollama")) {
    return "local";
  }
  if (model.auth || tags.has("high-price")) {
    return "external";
  }
  return "direct";
}

function modelSubtitle(model: Model): string {
  const source = getModelSource(model);
  if (source === "local") return "本地模型 • 已下载";
  if (source === "external") return "外部模型 • API";
  return "直连模型 • 可用";
}

function filterModels(
  models: Model[],
  search: string,
  source: ModelSource,
): Model[] {
  const scoped = source === "all"
    ? models
    : models.filter((model) => getModelSource(model) === source);

  if (!search.trim()) return scoped;

  return matchSorter(scoped, search, {
    keys: [
      "name",
      "id",
      "description",
      (model) => (model.tag ?? []).join(" "),
    ],
  });
}

export default function TopModelSelector() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentModel = useSelector(selectModel);
  const supportModels = useSelector(selectSupportModels);
  const authenticated = useSelector(selectAuthenticated);

  const [selectedModels, setSelectedModels] = useState<string[]>([currentModel]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<ModelSource>("all");

  useEffect(() => {
    setSelectedModels((prev) => {
      const next = [...prev];
      if (next.length === 0) return [currentModel];
      next[0] = currentModel;
      return next;
    });
  }, [currentModel]);

  const filteredModels = useMemo(
    () => filterModels(supportModels, search, source),
    [supportModels, search, source],
  );

  const rows = useMemo(
    () =>
      selectedModels.map((modelId) => {
        const selected = supportModels.find((model) => model.id === modelId);
        return selected ?? supportModels[0];
      }),
    [selectedModels, supportModels],
  );

  function handleSelect(modelId: string) {
    const pickedModel = supportModels.find((item) => item.id === modelId);
    if (pickedModel?.auth && !authenticated) {
      toast(t("login-require"), {
        action: {
          label: t("login"),
          onClick: goAuth,
        },
      });
      return;
    }

    setSelectedModels((prev) => {
      const next = [...prev];
      next[activeIndex] = modelId;
      return next;
    });

    if (activeIndex === 0) {
      dispatch(setModel(modelId));
    }

    setOpen(false);
  }

  function handleAddModelSlot() {
    if (selectedModels.length >= MAX_MODEL_SLOTS || supportModels.length === 0) return;
    setSelectedModels((prev) => [...prev, prev[0] || supportModels[0].id]);
  }

  function handleRemoveModelSlot() {
    if (selectedModels.length <= 1) return;
    const nextLength = selectedModels.length - 1;
    setSelectedModels((prev) => prev.slice(0, nextLength));
    setActiveIndex((prev) => Math.min(prev, nextLength - 1));
  }

  if (supportModels.length === 0) return null;

  return (
    <div className="top-model-selector-root">
      <div className="top-model-selector-list">
        {rows.map((selected, idx) => (
          <button
            key={`${idx}-${selected?.id ?? "default"}`}
            className={cn(
              "top-model-selector-trigger",
              idx === activeIndex && "active",
            )}
            onClick={() => {
              setActiveIndex(idx);
              setOpen(true);
            }}
            type="button"
          >
            <div className="top-model-selector-trigger-label">
              {selected?.name ?? selected?.id ?? "Select model"}
            </div>
            <ChevronDown className="top-model-selector-trigger-chevron" />
          </button>
        ))}
      </div>

      <div className="top-model-selector-actions">
        <button
          className="top-model-selector-icon-btn"
          onClick={handleAddModelSlot}
          type="button"
          disabled={selectedModels.length >= MAX_MODEL_SLOTS}
          aria-label="Add model selector"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          className="top-model-selector-icon-btn"
          onClick={handleRemoveModelSlot}
          type="button"
          disabled={selectedModels.length <= 1}
          aria-label="Remove model selector"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearch("");
            setSource("all");
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="top-model-selector-anchor"
            aria-hidden
            tabIndex={-1}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={10}
          className="top-model-selector-menu"
        >
          <div className="top-model-selector-search">
            <Search className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            <input
              id="model-search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索模型..."
              className="top-model-selector-search-input"
            />
          </div>

          <div className="top-model-selector-filters">
            {([
              ["all", "All"],
              ["local", "Local"],
              ["external", "External"],
              ["direct", "Direct"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "top-model-selector-filter-btn",
                  source === value && "active",
                )}
                onClick={() => setSource(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="top-model-selector-options thin-scrollbar">
            {filteredModels.length === 0 && (
              <div className="top-model-selector-empty">未找到匹配模型</div>
            )}
            {filteredModels.map((model) => {
              const active = selectedModels[activeIndex] === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  className={cn("top-model-selector-option", active && "active")}
                  onClick={() => handleSelect(model.id)}
                >
                  <div className="top-model-selector-option-main">
                    <ModelAvatar size={26} model={model} />
                    <div className="top-model-selector-option-text">
                      <div className="top-model-selector-option-title">
                        {model.name || model.id}
                      </div>
                      <div className="top-model-selector-option-subtitle">
                        {modelSubtitle(model)}
                      </div>
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
