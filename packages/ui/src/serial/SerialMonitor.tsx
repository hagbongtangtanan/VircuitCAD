import { useEffect, useRef, useState } from 'react';

import { withLineEnding, type LineEnding, type SerialLine } from './buffer';

export type SerialMonitorProps = {
  lines: SerialLine[];
  onSend?: (text: string) => void;
  onClear?: () => void;
};

export function SerialMonitor({ lines, onSend, onClear }: SerialMonitorProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [ending, setEnding] = useState<LineEnding>('lf');
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

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
        <label>
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
        <button type="button" onClick={onClear}>
          Clear
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (draft) {
              onSend?.(withLineEnding(draft, ending));
              setDraft('');
            }
          }}
        >
          <input
            aria-label="Send"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
