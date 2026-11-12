export {
  AppShell,
  clampPanel,
  PANEL_MAX,
  PANEL_MIN,
  PANEL_STEP,
  type AppShellProps,
} from './components/AppShell';
export {
  CanvasControls,
  type CanvasControlsProps,
  type CanvasViewport,
} from './components/CanvasControls';
export {
  WireColorPicker,
  WIRE_COLORS,
  type WireColorPickerProps,
} from './components/WireColorPicker';
export { PartsBin, type PartsBinProps } from './components/PartsBin';
export {
  Inspector,
  type InspectorProps,
  type DocumentSummary,
} from './components/Inspector';
export { Toolbar, type ToolbarProps, type ToolbarTool } from './components/Toolbar';
export {
  StatusBar,
  type StatusBarProps,
  type StatusBarViewport,
} from './components/StatusBar';
export { RunControls, type RunControlsProps, type SimRunState } from './components/RunControls';
export { Toast, type ToastProps } from './components/Toast';
export { SerialBuffer, withLineEnding, type LineEnding, type SerialLine } from './serial/buffer';
export { ProblemsPanel, type Problem, type ProblemsPanelProps } from './components/ProblemsPanel';
export { SerialMonitor, type SerialMonitorProps } from './serial/SerialMonitor';
export {
  InstrumentPanel,
  type InstrumentPanelProps,
  type MeterReading,
} from './components/InstrumentPanel';

export { CodeEditor, type CodeEditorProps } from './code/CodeEditor';
export {
  ScopeBuffer,
  decimate,
  findTrigger,
  type ScopeBucket,
  type ScopeSample,
  type TriggerEdge,
} from './scope/buffer';
export {
  ARDUINO_CONSTANTS,
  ARDUINO_FUNCTIONS,
  ARDUINO_KEYWORDS,
  arduinoCompletions,
  type ArduinoCompletion,
} from './code/arduino-keywords';

export { THEMES, DEFAULT_THEME, type ThemeName } from './theme';
export { ICONS, CATEGORY_ICONS, type IconName, type IconProps } from './icons';
export { formatQuantity } from './format/quantity';

export const packageName = '@vircuitcad/ui';
