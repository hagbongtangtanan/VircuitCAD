import { useEffect, useRef, type JSX } from 'react'
import { useSerialStore } from './serialStore'
import { useSimStore } from '../store/simStore'

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200] as const

/** Terminal-style view of the bytes the emulated AVR writes to its UART. */
export function SerialMonitor(): JSX.Element {
  const buffer = useSerialStore((state) => state.buffer)
  const baudRate = useSerialStore((state) => state.baudRate)
  const setBaudRate = useSerialStore((state) => state.setBaudRate)
  const clear = useSerialStore((state) => state.clear)
  const simStatus = useSimStore((state) => state.status)
  const endRef = useRef<HTMLDivElement | null>(null)

  const lineCount = buffer.lines.length
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [lineCount, buffer.pending])

  const isEmpty = lineCount === 0 && buffer.pending === ''

  return (
    <section className="serial-monitor" aria-label="Serial monitor">
      <header className="serial-header">
        <h2 className="app-panel-title">Serial monitor</h2>
        <select
          className="serial-baud"
          value={baudRate}
          aria-label="Baud rate"
          onChange={(event) => setBaudRate(Number(event.target.value))}
        >
          {BAUD_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate} baud
            </option>
          ))}
        </select>
        <button type="button" onClick={clear} disabled={isEmpty}>
          Clear
        </button>
      </header>
      <div className="serial-lines" data-testid="serial-monitor">
        {isEmpty && (
          <p className="app-placeholder">
            {simStatus === 'running'
              ? 'Simulation running — waiting for the sketch to print.'
              : 'No serial output yet. Run the simulation to see what the sketch prints.'}
          </p>
        )}
        {buffer.lines.map((line, index) => (
          <p key={`${index}-${line}`} className="serial-line">
            {line}
          </p>
        ))}
        {buffer.pending !== '' && <p className="serial-line serial-pending">{buffer.pending}</p>}
        <div ref={endRef} />
      </div>
    </section>
  )
}
