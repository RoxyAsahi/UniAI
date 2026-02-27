import { cn } from "@/components/ui/lib/utils";

export const FOLDER_COLORS = [
  { id: "default", color: "#6b7280" },
  { id: "red",     color: "#ef4444" },
  { id: "orange",  color: "#f97316" },
  { id: "yellow",  color: "#eab308" },
  { id: "green",   color: "#22c55e" },
  { id: "blue",    color: "#3b82f6" },
  { id: "purple",  color: "#a855f7" },
];

type FolderColorPickerProps = {
  value?: string;
  onChange: (color: string) => void;
};

export function FolderColorPicker({ value, onChange }: FolderColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {FOLDER_COLORS.map((c) => {
        const isSelected = value === c.color || (c.id === "default" && !value);
        return (
          <button
            key={c.id}
            title={c.id}
            className={cn(
              "w-6 h-6 rounded-full border-2 transition-transform duration-100 hover:scale-125 focus:outline-none",
              isSelected
                ? "border-white scale-110"
                : "border-transparent",
            )}
            style={{
              backgroundColor: c.color,
              boxShadow: isSelected ? `0 0 0 2px ${c.color}` : undefined,
            }}
            onClick={() => onChange(c.id === "default" ? "" : c.color)}
          />
        );
      })}
    </div>
  );
}
