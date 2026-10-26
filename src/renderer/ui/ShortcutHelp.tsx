import { useEffect, useRef, type JSX } from 'react'
import { Icon } from './Icon'

interface ShortcutHelpProps {
  readonly onClose: () => void
}

interface Shortcut {
  readonly keys: readonly string[]
  readonly label: string
}

interface ShortcutGroup {
  readonly title: string
  readonly items: readonly Shortcut[]
}

const GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Project',
    items: [
      { keys: ['Ctrl', 'N'], label: 'New circuit' },
      { keys: ['Ctrl', 'O'], label: 'Open project' },
      { keys: ['Ctrl', 'S'], label: 'Save project' },
      { keys: ['Ctrl', 'B'], label: 'Build sketch' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { keys: ['Ctrl', 'Z'], label: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo' },
      { keys: ['Ctrl', 'Y'], label: 'Redo (alternative)' },
      { keys: ['Ctrl', 'C'], label: 'Copy selection' },
      { keys: ['Ctrl', 'V'], label: 'Paste selection' },
      { keys: ['Ctrl', 'D'], label: 'Duplicate selection' },
      { keys: ['Ctrl', 'A'], label: 'Select all parts' },
      { keys: ['Delete'], label: 'Delete selection' },
    ],
  },
  {
    title: 'Canvas',
    items: [
      { keys: ['R'], label: 'Rotate selection 90°' },
      { keys: ['Shift', 'F'], label: 'Flip horizontally' },
      { keys: ['Shift', 'V'], label: 'Flip vertically' },
      { keys: ['N'], label: 'Add a note' },
      { keys: ['F'], label: 'Fit circuit to view' },
    ],
  },
  {
    title: 'Help',
    items: [
      { keys: ['?'], label: 'Show this shortcut guide' },
      { keys: ['Esc'], label: 'Close menus and dialogs' },
    ],
  },
]

export function ShortcutHelp({ onClose }: ShortcutHelpProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const modal = root.querySelector('.cb-shortcuts')
    if (modal) {
      const el = modal as HTMLElement
      el.style.opacity = '0'
      el.style.transform = 'translateY(16px) scale(0.98)'
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.24s ease-out, transform 0.24s ease-out'
        el.style.opacity = '1'
        el.style.transform = 'translateY(0) scale(1)'
      })
    }
    const groups = root.querySelectorAll('.cb-shortcut-group')
    groups.forEach((group, index) => {
      const el = group as HTMLElement
      el.style.opacity = '0'
      el.style.transform = 'translateY(10px)'
      requestAnimationFrame(() => {
        el.style.transition = `opacity 0.28s ease-out ${0.06 + index * 0.05}s, transform 0.28s ease-out ${0.06 + index * 0.05}s`
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      })
    })
  }, [])

  return (
    <div
      className="cb-modal-backdrop"
      data-testid="shortcut-help"
      ref={rootRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="cb-shortcuts"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <header className="cb-shortcuts-header">
          <div>
            <span className="cb-eyebrow">Keyboard</span>
            <h2 id="shortcuts-title">Work faster</h2>
            <p>Use Ctrl on Windows and Linux, or Cmd on macOS.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="cb-icon-button"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="cb-shortcut-groups">
          {GROUPS.map((group) => (
            <section key={group.title} className="cb-shortcut-group">
              <h3>{group.title}</h3>
              <dl>
                {group.items.map((item) => (
                  <div key={`${group.title}-${item.label}`} className="cb-shortcut-row">
                    <dt>{item.label}</dt>
                    <dd>
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <footer className="cb-shortcuts-footer">
          Press <kbd>?</kbd> at any time to reopen this guide.
        </footer>
      </section>
    </div>
  )
}
