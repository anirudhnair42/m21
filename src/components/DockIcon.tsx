import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  hasWindow?: boolean;
  badge?: number;
};

export function DockIcon({ icon, label, onClick, hasWindow, badge }: Props) {
  const showBadge = typeof badge === "number" && badge > 0;
  return (
    <div
      className={`dock-icon ${hasWindow ? "has-window" : ""}`}
      onClick={onClick}
    >
      {icon}
      {showBadge && (
        <span className="dock-badge" aria-label={`${badge} unread`}>
          {badge! > 99 ? "99+" : badge}
        </span>
      )}
      <span className="dock-tooltip">{label}</span>
    </div>
  );
}
