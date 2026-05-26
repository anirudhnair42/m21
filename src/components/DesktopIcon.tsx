type Props = {
  kind: "folder";
  label: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  selected?: boolean;
};

export function DesktopIcon({
  label,
  onClick,
  onDoubleClick,
  selected,
}: Props) {
  return (
    <div
      className={`desktop-icon ${selected ? "selected" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="icon-folder" />
      <div className="desktop-icon-label">{label}</div>
    </div>
  );
}
