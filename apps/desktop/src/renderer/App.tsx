import 'pixi.js/unsafe-eval';

import { Application } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

import { createClient } from './client';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState('…');

  useEffect(() => {
    const instance = new Application();
    let active = true;
    let mounted: Application | undefined;

    void instance
      .init({ background: '#0f172a', width: 640, height: 360, antialias: true })
      .then(() => {
        if (!active) {
          instance.destroy();
          return;
        }
        mounted = instance;
        host.current?.appendChild(instance.canvas);
      });

    return () => {
      active = false;
      mounted?.destroy();
    };
  }, []);

  useEffect(() => {
    createClient()
      .app.info()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion('unavailable'));
  }, []);

  return (
    <main>
      <h1>VircuitCAD</h1>
      <p data-testid="version">v{version}</p>
      <div ref={host} />
    </main>
  );
}
