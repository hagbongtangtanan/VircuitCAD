import {
  DocumentStore,
  createDefaultPartRegistry,
  createEmptyCircuit,
  deserializeCircuit,
  extractNetlist,
  serializeCircuit,
  sketchOf,
  type ParamValue,
  type PartInstance,
} from '@vircuitcad/core';
import { Editor, McuCircuit, RunController, SimulationHost, type RunState } from '@vircuitcad/editor';
import {
  CodeEditor,
  Inspector,
  InstrumentPanel,
  PartsBin,
  ProblemsPanel,
  RunControls,
  SerialBuffer,
  SerialMonitor,
  StatusBar,
  Toast,
  Toolbar,
  type MeterReading,
  type Problem,
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
  const [sketch, setSketch] = useState(() => sketchOf(store.getCircuit()).files['sketch.ino'] ?? '');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [runState, setRunState] = useState<RunState>('idle');
  const [codeOpen, setCodeOpen] = useState(false);
  const [, setSerialVersion] = useState(0);
  const sketchRef = useRef(sketch);
  sketchRef.current = sketch;
  const serialRef = useRef(new SerialBuffer());
  const mcuRef = useRef<McuCircuit | undefined>(undefined);
  const mcuTimer = useRef<number | undefined>(undefined);

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

  const stopMcu = (): void => {
    if (mcuTimer.current !== undefined) window.clearInterval(mcuTimer.current);
    mcuTimer.current = undefined;
    mcuRef.current = undefined;
  };

  const startMcu = (hex: string): void => {
    stopMcu();
    const mcu = new McuCircuit(store.getCircuit(), registry, hex);
    mcuRef.current = mcu;
    mcu.onSerial((byte) => {
      serialRef.current.append(String.fromCharCode(byte), mcu.cycles / 16);
      setSerialVersion((version) => version + 1);
    });
    mcuTimer.current = window.setInterval(() => {
      mcu.runMicros(16_000);
      const leds = store
        .getCircuit()
        .parts.filter((part) => registry.get(part.partId)?.simModel === 'led')
        .map((part) => ({ partId: part.id, current: mcu.ledCurrent(part.id), burnedOut: false }));
      editorRef.current?.getScene()?.setSimulation({ leds });
    }, 1000 / 60);
  };

  const build = (): void => {
    stopMcu();
    const controller = new RunController({
      compile: async () => {
        const result = await client.compile.compile({
          source: sketchRef.current,
          fqbn: 'arduino:avr:uno',
        });
        setProblems(
          result.diagnostics.map((diagnostic) => ({
            file: 'sketch.ino',
            line: diagnostic.line ?? 1,
            column: diagnostic.column ?? 1,
            severity: diagnostic.severity,
            message: diagnostic.message,
          })),
        );
        return {
          ok: result.ok,
          ...(result.hex ? { hex: result.hex } : {}),
          diagnostics: result.diagnostics,
        };
      },
      onStart: startMcu,
      onStop: stopMcu,
    });
    controller.onChange = (state) => {
      setRunState(state);
      if (state === 'error') setToast('Build failed — see Problems');
    };
    void controller.build();
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
      stopMcu();
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
    <main className="app-shell">
      <header className="app-header">
        <strong>VircuitCAD</strong>
        <span className="version" data-testid="version">
          v{version}
        </span>
        <button type="button" onClick={() => setCodeOpen((open) => !open)}>
          Code
        </button>
      </header>
      <div className="app-body">
        <aside className="panel panel--left">
          <PartsBin
            registry={registry}
            onPick={(partId) => {
              controller()?.setTool('place', partId);
              setTool('place');
            }}
          />
        </aside>
        <section className="main-column">
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
          <div ref={hostRef} data-testid="canvas-host" className="canvas-host" />
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
        <aside className={codeOpen ? 'panel panel--right is-wide' : 'panel panel--right'}>
          <Inspector
            registry={registry}
            part={selected}
            onChange={(key: string, value: ParamValue) => {
              if (selected) store.setParam(selected.id, key, value);
            }}
          />
          <InstrumentPanel readings={meters} />
          {codeOpen ? (
            <>
              <div className="row">
                <button type="button" onClick={build}>
                  Build
                </button>
                <button type="button" onClick={stopMcu}>
                  Stop
                </button>
                <span data-testid="run-state">{runState}</span>
              </div>
              <div className="code-editor-host">
                <CodeEditor
                  value={sketch}
                  onChange={(text) => {
                    setSketch(text);
                    store.setSketchFile('sketch.ino', text);
                  }}
                />
              </div>
              <ProblemsPanel problems={problems} />
              <div className="serial-host">
                <SerialMonitor
                  lines={serialRef.current.toArray()}
                  onClear={() => {
                    serialRef.current.clear();
                    setSerialVersion((version) => version + 1);
                  }}
                />
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
