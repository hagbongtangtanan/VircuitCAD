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
};

function ToolButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" aria-pressed={active ?? false} onClick={onClick}>
      {children}
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
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      <ToolButton active={tool === 'select'} onClick={() => onTool('select')}>
        Select
      </ToolButton>
      <ToolButton active={tool === 'wire'} onClick={() => onTool('wire')}>
        Wire
      </ToolButton>
      <ToolButton onClick={onRotate}>Rotate</ToolButton>
      <ToolButton onClick={onDuplicate}>Duplicate</ToolButton>
      <ToolButton onClick={onDelete}>Delete</ToolButton>
      <ToolButton onClick={onUndo}>Undo</ToolButton>
      <ToolButton onClick={onRedo}>Redo</ToolButton>
      <span className="toolbar-state">
        {canUndo ? 'undo:yes' : 'undo:no'} {canRedo ? 'redo:yes' : 'redo:no'}
      </span>
    </div>
  );
}
