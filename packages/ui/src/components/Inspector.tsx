import { useState } from 'react';

import type { ParamSpec, ParamValue, PartInstance, PartRegistry } from '@vircuitcad/core';

export type InspectorProps = {
  registry: PartRegistry;
  part: PartInstance | undefined;
  onChange: (key: string, value: ParamValue) => void;
};

type ParamEditorProps = {
  param: ParamSpec;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
};

function ParamEditor({ param, value, onChange }: ParamEditorProps) {
  const [error, setError] = useState<string | undefined>(undefined);

  if (typeof param.default === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    const validate = (next: number): string | undefined => {
      if (Number.isNaN(next)) return 'Enter a number';
      if (param.min !== undefined && next < param.min) return `Minimum is ${param.min}`;
      if (param.max !== undefined && next > param.max) return `Maximum is ${param.max}`;
      return undefined;
    };
    return (
      <label className="param">
        <span>
          {param.label}
          {param.unit ? ` (${param.unit})` : ''}
        </span>
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

export function Inspector({ registry, part, onChange }: InspectorProps) {
  if (!part) return <p className="inspector-empty">No selection</p>;
  const manifest = registry.get(part.partId);
  if (!manifest) return <p className="inspector-empty">Unknown part</p>;

  return (
    <div className="inspector">
      <h3>{manifest.name}</h3>
      {manifest.params.map((param) => (
        <ParamEditor
          key={param.id}
          param={param}
          value={part.params[param.id] ?? param.default}
          onChange={(value) => onChange(param.id, value)}
        />
      ))}
    </div>
  );
}
