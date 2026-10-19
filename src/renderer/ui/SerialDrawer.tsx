import { useEffect, useState, type JSX } from 'react'
import { SerialMonitor } from '../serial/SerialMonitor'
import { useSerialStore } from '../serial/serialStore'
import { Icon } from './Icon'

/**
 * Bottom drawer for the serial monitor. It opens itself the first time the
 * sketch prints, so output is never hidden from someone who is not looking at
 * the panel, and can be collapsed again afterwards.
 */
export function SerialDrawer(): JSX.Element {
  const [open, setOpen] = useState(false)
  const lineCount = useSerialStore((state) => state.buffer.lines.length)
  const pending = useSerialStore((state) => state.buffer.pending)
  const hasOutput = lineCount > 0 || pending !== ''

  useEffect(() => {
    if (hasOutput) setOpen(true)
  }, [hasOutput])

  return (
    <section className="cb-serial-drawer" data-testid="serial-drawer" aria-label="Serial output">
      <button
        type="button"
        className="cb-serial-bar"
        data-testid="serial-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={open ? 'cb-chevron is-open' : 'cb-chevron'}>
          <Icon name="chevron" />
        </span>
        Serial monitor
        <span className="cb-serial-badge">{lineCount}</span>
      </button>
      <div className="cb-serial-body" hidden={!open}>
        <SerialMonitor />
      </div>
    </section>
  )
}
