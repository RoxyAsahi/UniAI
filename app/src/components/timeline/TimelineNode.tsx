import { Star } from "lucide-react";
import { cn } from "@/components/ui/lib/utils";
import { Message } from "@/api/types.tsx";

type TimelineNodeProps = {
  index: number;
  message: Message;
  isActive: boolean;
  isStarred: boolean;
  onClick: () => void;
  onToggleStar: () => void;
};

export function TimelineNode({
  message,
  isActive,
  isStarred,
  onClick,
  onToggleStar,
}: TimelineNodeProps) {
  const isUser = message.role === "user";
  const preview = message.content.slice(0, 40).replace(/\n/g, " ");

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer group transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-muted-foreground",
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isUser ? "bg-blue-400" : "bg-green-400",
        )}
      />
      <span className="flex-1 truncate">{preview || "..."}</span>
      <button
        className={cn(
          "shrink-0 p-0.5 rounded transition-opacity",
          isStarred
            ? "text-yellow-500 opacity-100"
            : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        aria-label={isStarred ? "Unstar message" : "Star message"}
      >
        <Star className="h-3 w-3" fill={isStarred ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
