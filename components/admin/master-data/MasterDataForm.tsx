"use client";

import type { MasterColumn } from "@/app/admin/master-data/registry";

type SelectOption = { value: string; label: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function EditorInput({
  col,
  value,
  options,
  onValueChange,
}: {
  col: MasterColumn;
  value: any;
  options: SelectOption[];
  onValueChange: (value: any) => void;
}) {
  if (col.type === "boolean") {
    return (
      <label className="master-checkbox-row">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onValueChange(e.target.checked)}
        />
        <span>{value ? "Yes" : "No"}</span>
      </label>
    );
  }

  if (col.type === "number") {
    return (
      <input
        className="input"
        type="number"
        value={value ?? 0}
        onChange={(e) => onValueChange(e.target.value)}
      />
    );
  }

  if (col.type === "time") {
    const v = typeof value === "string" ? value.slice(0, 5) : "";
    return (
      <input
        className="input"
        type="time"
        value={v}
        onChange={(e) => onValueChange(e.target.value)}
      />
    );
  }

  if (col.type === "select") {
    return (
      <select
        className="select"
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="input"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    />
  );
}

export default function MasterDataForm({
  title,
  columns,
  values,
  optionsByKey,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  columns: MasterColumn[];
  values: Record<string, any>;
  optionsByKey: Record<string, SelectOption[]>;
  submitLabel: string;
  onChange: (col: MasterColumn, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>

      <form onSubmit={onSubmit} className="form-grid">
        {columns.map((c) => (
          <Field key={c.key} label={`${c.label}${c.required ? " *" : ""}`}>
            <EditorInput
              col={c}
              value={values[c.key]}
              options={optionsByKey[c.key] || []}
              onValueChange={(value) => onChange(c, value)}
            />
          </Field>
        ))}

        <div className="master-form-actions">
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>

          {onCancel ? (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}