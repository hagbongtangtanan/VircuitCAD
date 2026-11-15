import { defaultCapabilities, unavailableReason, type Capabilities } from '@vircuitcad/core';
import { useEffect, useRef, useState } from 'react';

import { withLineEnding, type LineEnding, type SerialLine } from './buffer';

export type SerialMonitorProps = {
  lines: SerialLine[];
  onSend?: (text: string) => void;
  onClear?: () => void;
  capabilities?: Capabilities;
};

export function SerialMonitor({
  lines,
  onSend,
  onClear,
  capabilities = defaultCapabilities(),
}: SerialMonitorProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [ending, setEnding] = useState<LineEnding>('lf');
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const canSend = capabilities.serialSend && onSend !== undefined;
  const sendReason = capabilities.serialSend
    ? 'Serial sending is not connected in this build'
    : unavailableReason('serialSend');

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [lines, autoScroll]);

  return (
    <div className="serial-monitor">
      <div className="serial-lines" data-testid="serial-lines">
        {lines.map((line, index) => (
          <div key={index}>
            <span className="serial-ts">{(line.timestamp / 1000).toFixed(3)}</span> {line.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="serial-controls">
        <div className="serial-control-row" data-testid="serial-control-row">
          <label className="serial-auto-scroll">
            <input
              type="checkbox"
              aria-label="Auto-scroll"
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.target.checked)}
            />
            Auto-scroll
          </label>
          <select
            aria-label="Line ending"
            value={ending}
            onChange={(event) => setEnding(event.target.value as LineEnding)}
          >
            <option value="none">none</option>
            <option value="lf">LF</option>
            <option value="crlf">CRLF</option>
          </select>
          <button
            type="button"
            onClick={onClear}
            disabled={!onClear}
            title={onClear ? 'Clear serial output' : 'Serial output cannot be cleared'}
          >
            Clear
          </button>
        </div>
        <form
          className="serial-send-row"
          data-testid="serial-send-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend && draft) {
              onSend(withLineEnding(draft, ending));
              setDraft('');
            }
          }}
        >
          <input
            aria-label="Send"
            value={draft}
            disabled={!canSend}
            title={sendReason}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" disabled={!canSend} title={sendReason}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
