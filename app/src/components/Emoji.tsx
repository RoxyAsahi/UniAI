import { cn } from "@/components/ui/lib/utils.ts";
import { isUrl } from "@/utils/base.ts";

export function isAvatarImageSource(value: string): boolean {
  const source = (value || "").trim();
  if (!source) return false;
  if (source.startsWith("data:image/")) return true;
  if (source.startsWith("blob:")) return true;
  if (source.startsWith("/attachments/")) return true;
  if (source.startsWith("/api/attachments/")) return true;
  return isUrl(source);
}

export function getEmojiSource(emoji: string): string {
  if (isAvatarImageSource(emoji)) return emoji;
  return `https://registry.npmmirror.com/@lobehub/fluent-emoji-3d/latest/files/assets/${emoji}.webp`;
}

type EmojiProps = {
  emoji: string;
  className?: string;
};

function Emoji({ emoji, className }: EmojiProps) {
  const source = getEmojiSource((emoji || "").trim() || "1f9d0");
  return (
    <img
      className={cn("select-none w-full h-full object-cover", className)}
      src={source}
      alt={""}
      draggable={false}
    />
  );
}

export default Emoji;
