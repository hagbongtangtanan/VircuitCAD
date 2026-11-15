import type { ReactNode } from 'react';

export type BottomDockTab = 'code' | 'serial' | 'problems';

export type BottomDockProps = {
  open: boolean;
  activeTab: BottomDockTab;
  onTabChange: (tab: BottomDockTab) => void;
  onClose: () => void;
  code: ReactNode;
  serial: ReactNode;
  problems: ReactNode;
};

const TABS: ReadonlyArray<{ id: BottomDockTab; label: string }> = [
  { id: 'code', label: 'Code' },
  { id: 'serial', label: 'Serial' },
  { id: 'problems', label: 'Problems' },
];

export function BottomDock({
  open,
  activeTab,
  onTabChange,
  onClose,
  code,
  serial,
  problems,
}: BottomDockProps) {
  if (!open) return null;

  const content = activeTab === 'code' ? code : activeTab === 'serial' ? serial : problems;

  return (
    <section className="bottom-dock" id="bottom-dock" data-testid="bottom-dock" aria-label="Bottom dock">
      <div className="bottom-dock-header">
        <div className="bottom-dock-tabs" role="tablist" aria-label="Bottom dock tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`bottom-dock-tab-${tab.id}`}
              className="bottom-dock-tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`bottom-dock-panel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="bottom-dock-collapse"
          aria-label="Collapse bottom dock"
          onClick={onClose}
        >
          Hide
        </button>
      </div>
      <div
        className="bottom-dock-panel"
        role="tabpanel"
        id={`bottom-dock-panel-${activeTab}`}
        aria-labelledby={`bottom-dock-tab-${activeTab}`}
      >
        {content}
      </div>
    </section>
  );
}
