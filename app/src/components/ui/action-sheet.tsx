import React, { useState } from "react";

export interface ActionSheetItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ActionSheetProps {
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

const ActionSheet: React.FC<ActionSheetProps> = ({ title, items, onClose }) => (
  <div className="action-sheet-overlay" onClick={onClose}>
    <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
      {title && <div className="action-sheet-title">{title}</div>}
      {items.map((item, i) => (
        <button
          key={i}
          className={`action-sheet-item${item.danger ? " danger" : ""}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
      <button className="action-sheet-cancel" onClick={onClose}>
        取消
      </button>
    </div>
  </div>
);

/**
 * Hook that returns a show function and the ActionSheet component to render.
 */
export function useActionSheet() {
  const [config, setConfig] = useState<{
    title?: string;
    items: ActionSheetItem[];
  } | null>(null);

  const show = (title: string | undefined, items: ActionSheetItem[]) => {
    setConfig({ title, items });
  };

  const ActionSheetComponent = config ? (
    <ActionSheet
      title={config.title}
      items={config.items}
      onClose={() => setConfig(null)}
    />
  ) : null;

  return { show, ActionSheetComponent };
}

export default ActionSheet;
