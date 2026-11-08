import {
  DocumentStore,
  createDefaultPartRegistry,
  createEmptyCircuit,
  deserializeCircuit,
  extractNetlist,
  serializeCircuit,
  type ParamValue,
  type PartInstance,
} from '@vircuitcad/core';
import { Editor, SimulationHost } from '@vircuitcad/editor';
import {
  Inspector,
  InstrumentPanel,
  PartsBin,
  RunControls,
  StatusBar,
  Toast,
  Toolbar,
  type MeterReading,
  type SimRunState,
  type ToolbarTool,
} from '@vircuitcad/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from './client';

const JOURNAL_FILE = 'autosave.vcad';
const CIRCUIT_FILE = 'circuit.vcad';

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const simHostRef = useRef<SimulationHost | undefined>(undefined);
  const autosaveTimer = useRef<number | undefined>(undefined);
  const [store] = useState(() => new DocumentStore(createEmptyCircuit({ board: 'full' })));
  const registry = useMemo(() => createDefaultPartRegistry(), []);
  const client = useMemo(() => createClient(), []);

  const [version, setVersion] = useState('…');
  const [tool, setTool] = useState<ToolbarTool>('select');
  const [selected, setSelected] = useState<PartInstance | undefined>(undefined);
  const [counts, setCounts] = useState({ parts: 0, wires: 0 });
  const [history, setHistory] = useState({ undo: false, redo: false });
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [hint, setHint] = useState('Ready');
  const [simState, setSimState] = useState<SimRunState>('idle');
  const [simTime, setSimTime] = useState(0);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const [netColoring, setNetColoringState] = useState(false);
  const [meters, setMeters] = useState<MeterReading[]>([]);

  const toggleNetColoring = (): void => {
    setNetColoringState((previous) => {
      const next = !previous;
      editorRef.current?.setNetColoring(next);
      return next;
    });
  };

  const refresh = (): void => {
    const editor = editorRef.current;
    const circuit = store.getCircuit();
    const controller = editor?.getToolController();
    const selectedId = controller?.getSelectedPartId();
    setTool(controller?.getTool() ?? 'select');
    setSelected(selectedId ? circuit.parts.find((part) => part.id === selectedId) : undefined);
    setCounts({ parts: circuit.parts.length, wires: circuit.wires.length });
    const size = store.historySize();
    setHistory({ undo: size.undo > 0, redo: size.redo > 0 });
    setZoom(editor?.getViewport().scale ?? 1);
  };

  const circuitPath = async (): Promise<string> =>
    `${(await client.app.info()).paths.appData}/${CIRCUIT_FILE}`;

  const highlightError = (nets: readonly string[]): void => {
    const scene = editorRef.current?.getScene();
    if (!scene) return;
    if (nets.length === 0) {
      scene.setHighlight([]);
      return;
    }
    const netlist = extractNetlist(store.getCircuit(), registry);
    const partIds = new Set<string>();
    for (const net of netlist.nets) {
      if (nets.includes(net.name)) for (const pin of net.pins) partIds.add(pin.partId);
    }
    scene.setHighlight([...partIds]);
  };

  const runSim = (): void => simHostRef.current?.start(store.getCircuit());
  const stopSim = (): void => simHostRef.current?.stop();
  const togglePause = (): void => {
    if (simState === 'paused') simHostRef.current?.resume();
    else simHostRef.current?.pause();
  };

  const scheduleAutosave = (): void => {
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void (async () => {
        const info = await client.app.info();
        const text = serializeCircuit(store.getCircuit());
        await client.fs.writeFile(
          `${info.paths.appData}/${JOURNAL_FILE}`,
          new TextEncoder().encode(text),
        );
        setHint('Autosaved');
      })();
    }, 400);
  };

  const save = async (): Promise<void> => {
    const fallback = await circuitPath();
    const picked = await client.dialogs.saveFile({
      defaultPath: fallback,
      filters: [{ name: 'VircuitCAD', extensions: ['vcad'] }],
    });
    const path = picked ?? fallback;
    await client.fs.writeFile(path, new TextEncoder().encode(serializeCircuit(store.getCircuit())));
    setDirty(false);
    setHint(`Saved ${path.split('/').pop() ?? path}`);
  };

  const load = async (): Promise<void> => {
    const fallback = await circuitPath();
    const picked = await client.dialogs.openFile({
      defaultPath: fallback,
      filters: [{ name: 'VircuitCAD', extensions: ['vcad'] }],
    });
    const path = picked ?? fallback;
    const bytes = await client.fs.readFile(path);
    store.replace(deserializeCircuit(new TextDecoder().decode(bytes)));
    setDirty(false);
    setHint(`Loaded ${path.split('/').pop() ?? path}`);
  };

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return undefined;

    let disposed = false;
    const editor = new Editor({ store, registry });
    editorRef.current = editor;
    window.__editor = editor;
    const disposers: Array<() => void> = [];

    const host = new SimulationHost();
    simHostRef.current = host;
    host.onStatus = (status) => setSimState(status.state);
    host.onSnapshot = (snapshot) => {
      editor.getScene()?.setSimulation(snapshot);
      setSimTime(snapshot.time);
      setMeters(snapshot.meters ?? []);
    };
    host.onError = (event) => {
      setToast(event.message);
      highlightError(event.nets ?? []);
    };
    disposers.push(() => host.dispose());

    void editor.mount(element).then(() => {
      if (disposed) return;
      const controller = editor.getToolController();
      if (controller) disposers.push(controller.onStateChange(refresh));
      refresh();
    });

    disposers.push(
      store.onChange(() => {
        setDirty(true);
        refresh();
        scheduleAutosave();
      }),
    );
    disposers.push(editor.onViewportChange(refresh));

    void client.app.info().then((info) => setVersion(info.version)).catch(() => setVersion('unavailable'));

    window.__app = {
      store,
      getCircuit: () => store.getCircuit(),
      save,
      load,
      refresh,
      loadText: (text: string) => store.replace(deserializeCircuit(text)),
    };

    return () => {
      disposed = true;
      window.clearTimeout(autosaveTimer.current);
      for (const dispose of disposers) dispose();
      editor.unmount();
      editorRef.current = null;
      simHostRef.current = undefined;
      window.__editor = undefined;
      window.__app = undefined;
    };
  }, []);

  const controller = () => editorRef.current?.getToolController();

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#e2e8f0' }}>
      <header
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '8px 12px',
          background: '#111827',
          font: '14px system-ui, sans-serif',
        }}
      >
        <strong>VircuitCAD</strong>
        <span data-testid="version">v{version}</span>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 200, background: '#111827', overflow: 'auto', padding: 8 }}>
          <PartsBin
            registry={registry}
            onPick={(partId) => {
              controller()?.setTool('place', partId);
              setTool('place');
            }}
          />
        </aside>
        <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <Toolbar
            tool={tool}
            onTool={(next) => {
              controller()?.setTool(next);
              setTool(next);
            }}
            canUndo={history.undo}
            canRedo={history.redo}
            onUndo={() => store.undo()}
            onRedo={() => store.redo()}
            onRotate={() => controller()?.keyDown('r')}
            onDelete={() => controller()?.keyDown('Delete')}
            onDuplicate={() => controller()?.keyDown('d')}
            netColoring={netColoring}
            onToggleNetColoring={toggleNetColoring}
          />
          <RunControls
            state={simState}
            onRun={runSim}
            onTogglePause={togglePause}
            onStop={stopSim}
          />
          <div ref={hostRef} data-testid="canvas-host" style={{ flex: 1, minHeight: 0 }} />
          <StatusBar
            partCount={counts.parts}
            wireCount={counts.wires}
            zoom={zoom}
            hint={dirty ? 'Unsaved changes' : hint}
            simState={simState}
            simTime={simTime}
          />
          <Toast message={toast} onDismiss={() => setToast(undefined)} />
        </section>
        <aside style={{ width: 220, background: '#111827', overflow: 'auto', padding: 8 }}>
          <Inspector
            registry={registry}
            part={selected}
            onChange={(key: string, value: ParamValue) => {
              if (selected) store.setParam(selected.id, key, value);
            }}
          />
          <InstrumentPanel readings={meters} />
        </aside>
      </div>
    </main>
  );
}
