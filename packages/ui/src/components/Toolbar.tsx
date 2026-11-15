import { ICONS, type IconName } from '../icons';

export type ToolbarTool = 'select' | 'place' | 'wire';

export type ToolbarProps = {
  tool: ToolbarTool;
  onTool: (tool: ToolbarTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  netColoring?: boolean;
  onToggleNetColoring?: () => void;
};

function ToolButton({
  icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  shortcut: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = ICONS[icon];
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={label}
      aria-pressed={active}
      title={`${label} (${shortcut})`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon />
    </button>
  );
}

export function Toolbar({
  tool,
  onTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRotate,
  onDelete,
  onDuplicate,
  netColoring = false,
  onToggleNetColoring,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      <span className="toolbar-group">
        <ToolButton
          icon="select"
          label="Select"
          shortcut="V"
          active={tool === 'select'}
          onClick={() => onTool('select')}
        />
        <ToolButton
          icon="wire"
          label="Wire"
          shortcut="W"
          active={tool === 'wire'}
          onClick={() => onTool('wire')}
        />
      </span>
      <span className="toolbar-group">
        <ToolButton icon="rotate" label="Rotate" shortcut="R" onClick={onRotate} />
        <ToolButton icon="duplicate" label="Duplicate" shortcut="Ctrl+D" onClick={onDuplicate} />
        <ToolButton icon="delete" label="Delete" shortcut="Del" onClick={onDelete} />
      </span>
      <span className="toolbar-group">
        <ToolButton
          icon="undo"
          label="Undo"
          shortcut="Ctrl+Z"
          disabled={!canUndo}
          onClick={onUndo}
        />
        <ToolButton
          icon="redo"
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          disabled={!canRedo}
          onClick={onRedo}
        />
      </span>
      {onToggleNetColoring ? (
        <span className="toolbar-group">
          <ToolButton
            icon="nets"
            label="Net colours"
            shortcut="N"
            active={netColoring}
            onClick={onToggleNetColoring}
          />
        </span>
      ) : null}
    </div>
  );
}
