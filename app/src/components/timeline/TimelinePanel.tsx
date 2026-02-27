import { useState } from "react";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { cn } from "@/components/ui/lib/utils";
import { Message } from "@/api/types.tsx";
import { useTimeline } from "./useTimeline";
import { TimelineNode } from "./TimelineNode";

type TimelinePanelProps = {
  conversationId: number;
  messages: Message[];
};

export function TimelinePanel({ conversationId, messages }: TimelinePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { activeIndex, starredIndices, scrollToMessage, toggleStar } =
    useTimeline(conversationId, messages);

  if (messages.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed right-4 top-1/2 -translate-y-1/2 z-50",
        "bg-background border border-border rounded-xl shadow-lg transition-all",
        collapsed ? "w-9" : "w-52",
      )}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-accent transition-colors"
        aria-label={collapsed ? "Expand timeline" : "Collapse timeline"}
      >
        {collapsed ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>

      {collapsed ? (
        <div className="flex items-center justify-center h-20">
          <List className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : (
        <div className="p-2 max-h-[70vh] overflow-y-auto">
          <div className="text-xs font-medium text-muted-foreground px-2 pb-1 mb-1 border-b border-border">
            Timeline ({messages.length})
          </div>
          {messages.map((msg, index) => (
            <TimelineNode
              key={index}
              index={index}
              message={msg}
              isActive={index === activeIndex}
              isStarred={starredIndices.includes(index)}
              onClick={() => scrollToMessage(index)}
              onToggleStar={() => toggleStar(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
