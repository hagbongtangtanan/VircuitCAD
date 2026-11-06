import { DocumentStore, createDefaultPartRegistry, createEmptyCircuit } from '@vircuitcad/core';
import { Editor } from '@vircuitcad/editor';
import { useEffect, useRef, useState } from 'react';

import { createClient } from './client';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState('…');

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const store = new DocumentStore(createEmptyCircuit({ board: 'full' }));
    const editor = new Editor({ store, registry: createDefaultPartRegistry() });
    window.__editor = editor;
    void editor.mount(element);

    return () => {
      editor.unmount();
      if (window.__editor === editor) window.__editor = undefined;
    };
  }, []);

  useEffect(() => {
    createClient()
      .app.info()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion('unavailable'));
  }, []);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          font: '14px system-ui, sans-serif',
          color: '#e2e8f0',
          background: '#111827',
        }}
      >
        <strong>VircuitCAD</strong>
        <span data-testid="version">v{version}</span>
      </header>
      <div ref={host} data-testid="canvas-host" style={{ flex: 1, minHeight: 0 }} />
    </main>
  );
}
