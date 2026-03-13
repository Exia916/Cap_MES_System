"use client";

import { Fragment } from "react";
import type { MasterColumn } from "@/app/admin/master-data/registry";
import MasterDataForm from "./MasterDataForm";

type Row = Record<string, any>;
type SelectOption = { value: string; label: string };

function renderCell(col: MasterColumn, row: Row) {
  const value = row[col.key];

  if (col.type === "boolean") return value ? "Yes" : "No";

  if (col.type === "select") {
    const displayValue = col.displayKey ? row[col.displayKey] : value;
    if (displayValue === null || displayValue === undefined || displayValue === "") return "-";
    return String(displayValue);
  }

  if (value === null || value === undefined || value === "") return "-";
  if (col.type === "time") return String(value).slice(0, 5);

  return String(value);
}

export default function MasterDataTable({
  columns,
  rows,
  editingId,
  editValues,
  optionsByKey,
  supportsInactive,
  allowDelete,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  getRowId,
}: {
  columns: MasterColumn[];
  rows: Row[];
  editingId: string | null;
  editValues: Record<string, any>;
  optionsByKey: Record<string, SelectOption[]>;
  supportsInactive: boolean;
  allowDelete: boolean;
  onStartEdit: (row: Row) => void;
  onEditChange: (col: MasterColumn, value: any) => void;
  onSaveEdit: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
  onRemove: (id: string) => void;
  getRowId: (row: Row) => string;
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="table-clean table-lines-strong">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const rid = getRowId(r);

              return (
                <Fragment key={rid}>
                  <tr className="dt-row">
                    {columns.map((c) => (
                      <td key={c.key}>{renderCell(c, r)}</td>
                    ))}

                    <td>
                      <div className="master-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onStartEdit(r)}
                        >
                          Edit
                        </button>

                        {supportsInactive || allowDelete ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => onRemove(rid)}
                          >
                            {supportsInactive ? "Deactivate" : "Delete"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {editingId === rid ? (
                    <tr className="dt-row">
                      <td colSpan={columns.length + 1} className="master-edit-cell">
                        <div className="muted-box">
                          <div className="master-inline-edit-header">
                            <div className="master-inline-edit-title">
                              Edit: <span className="master-card-key">{String(r.code || rid)}</span>
                            </div>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={onCancelEdit}
                            >
                              Close
                            </button>
                          </div>

                          <MasterDataForm
                            title="Update Entry"
                            columns={columns}
                            values={editValues}
                            optionsByKey={optionsByKey}
                            submitLabel="Save"
                            onChange={onEditChange}
                            onSubmit={onSaveEdit}
                            onCancel={onCancelEdit}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}

            {rows.length === 0 ? (
              <tr className="dt-row">
                <td colSpan={columns.length + 1}>No active entries.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}