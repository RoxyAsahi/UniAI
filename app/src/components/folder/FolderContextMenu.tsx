import { MoreHorizontal, Pencil, Trash2, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FolderColorPicker } from "./FolderColorPicker";

type FolderContextMenuProps = {
  currentColor?: string;
  onRename: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
};

export function FolderContextMenu({
  currentColor,
  onRename,
  onDelete,
  onColorChange,
}: FolderContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="folder-menu-trigger opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-accent transition-opacity"
          onClick={(e) => e.stopPropagation()}
          aria-label="Folder options"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Rename
        </DropdownMenuItem>

        {/* Color picker — nested Popover inside DropdownMenu */}
        <Popover>
          <PopoverTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="cursor-pointer"
            >
              <Palette className="h-3.5 w-3.5 mr-1.5" />
              Color
              {currentColor && (
                <span
                  className="ml-auto w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: currentColor }}
                />
              )}
            </DropdownMenuItem>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            className="w-auto p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <FolderColorPicker value={currentColor} onChange={onColorChange} />
          </PopoverContent>
        </Popover>

        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
