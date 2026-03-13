"use client";

type Row = Record<string, any>;

export default function MasterDataInactiveList({
  rows,
  getRowId,
  onEdit,
}: {
  rows: Row[];
  getRowId: (row: Row) => string;
  onEdit: (row: Row) => void;
}) {
  if (!rows.length) return null;

  return (
    <div className="card">
      <div className="section-card-header">
        <h3 style={{ margin: 0 }}>Inactive</h3>
      </div>

      <div className="section-stack">
        {rows.map((r) => (
          <div key={getRowId(r)} className="master-inactive-row">
            <div className="text-muted">
              <span className="master-card-key">{String(r.code || getRowId(r))}</span>
              {" — "}
              {String(r.name || r.label || r.description || r.department_name || "")}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onEdit(r)}
            >
              Edit / Reactivate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}