import { useState } from 'react';

import type { ParamSpec, ParamValue, PartInstance, PartRegistry } from '@vircuitcad/core';

import { formatQuantity } from '../format/quantity';
import { CATEGORY_ICONS, ICONS } from '../icons';

export type DocumentSummary = {
  parts: number;
  wires: number;
  board?: string;
};

export type InspectorProps = {
  registry: PartRegistry;
  part: PartInstance | undefined;
  onChange: (key: string, value: ParamValue) => void;
  summary?: DocumentSummary | undefined;
};

function describe(param: ParamSpec, value: ParamValue): string | undefined {
  if (typeof param.default !== 'number') return undefined;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return formatQuantity(numeric, param.unit ?? '');
}

function ParamEditor({
  param,
  value,
  onChange,
}: {
  param: ParamSpec;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
}) {
  const [error, setError] = useState<string | undefined>(undefined);

  if (param.options) {
    return (
      <label className="param">
        <span>{param.label}</span>
        <select
          className="param-select"
          aria-label={param.label}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {param.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (typeof param.default === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    const validate = (next: number): string | undefined => {
      if (Number.isNaN(next)) return 'Enter a number';
      if (param.min !== undefined && next < param.min) return `Minimum is ${param.min}`;
      if (param.max !== undefined && next > param.max) return `Maximum is ${param.max}`;
      return undefined;
    };
    const hint = describe(param, value);
    return (
      <label className="param">
        <span>
          {param.label}
          {param.unit ? ` (${param.unit})` : ''}
        </span>
        <span className="param-row">
          <input
            type="number"
            aria-label={param.label}
            value={Number.isNaN(numeric) ? '' : numeric}
            min={param.min}
            max={param.max}
            onChange={(event) => {
              const next = Number(event.target.value);
              const issue = validate(next);
              setError(issue);
              if (!issue) onChange(next);
            }}
          />
          {hint ? (
            <em className="param-hint" data-testid={`hint-${param.id}`}>
              {hint}
            </em>
          ) : null}
        </span>
        {error ? <em role="alert">{error}</em> : null}
      </label>
    );
  }

  if (typeof param.default === 'boolean') {
    return (
      <label className="param">
        <span>{param.label}</span>
        <input
          type="checkbox"
          aria-label={param.label}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    );
  }

  return (
    <label className="param">
      <span>{param.label}</span>
      <input
        type="text"
        aria-label={param.label}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Inspector({ registry, part, onChange, summary }: InspectorProps) {
  if (!part) {
    return (
      <div className="inspector inspector--empty" data-testid="inspector-summary">
        <h3>No selection</h3>
        {summary ? (
          <dl className="inspector-summary">
            <div>
              <dt>Parts</dt>
              <dd>{summary.parts}</dd>
            </div>
            <div>
              <dt>Wires</dt>
              <dd>{summary.wires}</dd>
            </div>
            {summary.board ? (
              <div>
                <dt>Board</dt>
                <dd>{summary.board}</dd>
              </div>
            ) : null}
            <div>
              <dt>Next step</dt>
              <dd>Select a part to edit its properties.</dd>
            </div>
          </dl>
        ) : null}
      </div>
    );
  }
  const manifest = registry.get(part.partId);
  if (!manifest) return <p className="inspector-empty">Unknown part</p>;

  const Icon = ICONS[CATEGORY_ICONS[manifest.category] ?? 'schematic'];

  return (
    <div className="inspector">
      <header className="inspector-header" data-testid="inspector-header">
        <Icon size={18} />
        <h3>{manifest.name}</h3>
      </header>
      <fieldset className="inspector-group">
        <legend>Properties</legend>
        {manifest.params.length === 0 ? (
          <p className="inspector-empty">This part has no adjustable properties.</p>
        ) : (
          manifest.params.map((param) => (
            <ParamEditor
              key={param.id}
              param={param}
              value={part.params[param.id] ?? param.default}
              onChange={(value) => onChange(param.id, value)}
            />
          ))
        )}
      </fieldset>
    </div>
  );
}
