"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isMasterKey, MASTER_UI, type MasterColumn, type MasterKey } from "../registry";
import MasterDataForm from "@/components/admin/master-data/MasterDataForm";
import MasterDataTable from "@/components/admin/master-data/MasterDataTable";
import MasterDataInactiveList from "@/components/admin/master-data/MasterDataInactiveList";

type Row = Record<string, any>;
type SelectOption = { value: string; label: string };

function normalizeBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return Boolean(v);
}

function getRowId(r: Row): string {
  return String(r.id ?? r.code ?? "");
}

function buildDefaults(columns: MasterColumn[]) {
  const defaults: Record<string, any> = {};

  for (const c of columns) {
    if (c.type === "boolean") defaults[c.key] = true;
    else defaults[c.key] = "";
  }

  if (columns.some((c) => c.key === "sort_order")) defaults.sort_order = 0;
  if (columns.some((c) => c.key === "is_active")) defaults.is_active = true;

  return defaults;
}

export default function AdminMasterDataKeyPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const router = useRouter();

  const [key, setKey] = useState<MasterKey | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [newForm, setNewForm] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [supportsInactive, setSupportsInactive] = useState(false);
  const [allowDelete, setAllowDelete] = useState(false);
  const [selectOptions, setSelectOptions] = useState<Record<string, SelectOption[]>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const p = await params;
      const keyParam = String(p?.key || "");
      const resolved = isMasterKey(keyParam) ? (keyParam as MasterKey) : null;
      if (!cancelled) setKey(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const cfg = key ? MASTER_UI[key] : null;

  useEffect(() => {
    if (!cfg) return;
    setNewForm(buildDefaults(cfg.columns));
  }, [cfg?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!cfg) return;

      const selectCols = cfg.columns.filter((c) => c.type === "select" && c.optionsSource);
      if (!selectCols.length) {
        setSelectOptions({});
        return;
      }

      const next: Record<string, SelectOption[]> = {};

      for (const col of selectCols) {
        try {
          const res = await fetch(
            `/api/admin/master-data/options/${encodeURIComponent(String(col.optionsSource))}`,
            {
              cache: "no-store",
              credentials: "include",
            }
          );

          const json = await res.json().catch(() => ({}));
          if (res.ok && !cancelled) {
            next[col.key] = Array.isArray((json as any).options) ? (json as any).options : [];
          }
        } catch {
          if (!cancelled) next[col.key] = [];
        }
      }

      if (!cancelled) setSelectOptions(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [cfg]);

  async function loadRows() {
    if (!key) return;
    setError("");

    const res = await fetch(`/api/admin/master-data/${encodeURIComponent(key)}`, {
      cache: "no-store",
      credentials: "include",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || "Failed to load rows");

    setRows(((json as any).rows || []) as Row[]);
    setSupportsInactive(!!(json as any).supportsInactive);
    setAllowDelete(!!(json as any).allowDelete);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!cfg || !key) return;
      setLoading(true);

      try {
        await loadRows();
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load master data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cfg?.key, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedSearch) return rows;

    return rows.filter((r) => {
      const hay = Object.values(r)
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join(" ")
        .toLowerCase();

      return hay.includes(normalizedSearch);
    });
  }, [rows, normalizedSearch]);

  const activeRows = useMemo(() => {
    if (!supportsInactive) return filtered;
    return filtered.filter((r) => normalizeBool(r.is_active));
  }, [filtered, supportsInactive]);

  const inactiveRows = useMemo(() => {
    if (!supportsInactive) return [];
    return filtered.filter((r) => !normalizeBool(r.is_active));
  }, [filtered, supportsInactive]);

  const onNewChange = (col: MasterColumn, value: any) => {
    setNewForm((p) => ({ ...p, [col.key]: value }));
  };

  const onEditChange = (col: MasterColumn, value: any) => {
    setEditForm((p) => ({ ...p, [col.key]: value }));
  };

  const validate = (form: Record<string, any>) => {
    if (!cfg) return "Invalid config";

    for (const c of cfg.columns) {
      if (c.required) {
        const v = form[c.key];
        if (v === null || v === undefined || String(v).trim() === "") {
          return `${c.label} is required.`;
        }
      }
    }

    return "";
  };

  const coercePayload = (form: Record<string, any>) => {
    if (!cfg) return {};
    const payload: Record<string, any> = {};

    for (const c of cfg.columns) {
      const v = form[c.key];

      if (c.type === "boolean") payload[c.key] = normalizeBool(v);
      else if (c.type === "number") payload[c.key] = v === "" ? 0 : Number(v);
      else if (c.type === "time") payload[c.key] = v === "" ? null : String(v);
      else if (c.type === "select") payload[c.key] = v === "" ? null : Number(v);
      else payload[c.key] = v === "" ? null : String(v);
    }

    if (typeof payload.code === "string") payload.code = payload.code.trim().toUpperCase();
    if (typeof payload.name === "string") payload.name = payload.name.trim();
    if (typeof payload.label === "string") payload.label = payload.label.trim();
    if (typeof payload.item_code === "string") payload.item_code = payload.item_code.trim().toUpperCase();
    if (typeof payload.description === "string") payload.description = payload.description.trim();
    if (typeof payload.department === "string") payload.department = payload.department.trim();

    return payload;
  };

  const createRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key || !cfg) return;

    const msg = validate(newForm);
    if (msg) {
      setError(msg);
      return;
    }

    const payload = coercePayload(newForm);

    const res = await fetch(`/api/admin/master-data/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to create");
      return;
    }

    setNewForm(buildDefaults(cfg.columns));
    await loadRows();
  };

  const startEditing = (r: Row) => {
    if (!cfg) return;

    const rid = getRowId(r);
    setEditingId(rid);

    const f: Record<string, any> = {};
    for (const c of cfg.columns) {
      const v = r[c.key];
      if (c.type === "boolean") f[c.key] = normalizeBool(v);
      else if (c.type === "number") f[c.key] = v ?? 0;
      else if (c.type === "time") f[c.key] = typeof v === "string" ? v.slice(0, 5) : "";
      else if (c.type === "select") f[c.key] = v ?? "";
      else f[c.key] = v ?? "";
    }

    setEditForm(f);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key || !cfg || !editingId) return;

    const msg = validate(editForm);
    if (msg) {
      setError(msg);
      return;
    }

    const payload = coercePayload(editForm);

    const res = await fetch(
      `/api/admin/master-data/${encodeURIComponent(key)}/${encodeURIComponent(editingId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to update");
      return;
    }

    await loadRows();
    cancelEditing();
  };

  const removeRow = async (id: string) => {
    if (!key) return;

    const message = supportsInactive
      ? "Deactivate this entry? It will no longer appear in dropdowns."
      : "Delete this entry? This action cannot be undone.";

    if (!confirm(message)) return;

    setError("");

    const res = await fetch(
      `/api/admin/master-data/${encodeURIComponent(key)}/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to remove entry");
      return;
    }

    if (editingId === id) cancelEditing();
    await loadRows();
  };

  if (!key) return <div className="page-shell">Loading…</div>;

  if (!cfg) {
    return (
      <div className="page-shell">
        <div className="card">
          <h1 className="page-title">Master Data</h1>
          <div className="alert alert-danger">Unknown master data key.</div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/admin/master-data")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page-shell">Loading {cfg.title}…</div>;

  return (
    <div className="page-shell section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – {cfg.title}</h1>
            <p className="page-subtitle">{cfg.description || ""}</p>
            <div className="text-soft">
              Key: <span className="master-card-key">{cfg.key}</span>
            </div>
          </div>

          <Link href="/admin/master-data" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <MasterDataForm
        title={`Add ${cfg.title.endsWith("s") ? cfg.title.slice(0, -1) : cfg.title}`}
        columns={cfg.columns}
        values={newForm}
        optionsByKey={selectOptions}
        submitLabel="Add"
        onChange={onNewChange}
        onSubmit={createRow}
      />

      <div className="card">
        <div className="master-search-bar">
          <div className="master-search-left">
            <input
              className="input"
              placeholder={`Search ${cfg.title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="master-search-meta">
            Showing <strong>{activeRows.length}</strong> active
            {supportsInactive && inactiveRows.length ? (
              <>
                {" "}
                / <strong>{inactiveRows.length}</strong> inactive
              </>
            ) : null}
          </div>
        </div>

        <MasterDataTable
          columns={cfg.columns}
          rows={activeRows}
          editingId={editingId}
          editValues={editForm}
          optionsByKey={selectOptions}
          supportsInactive={supportsInactive}
          allowDelete={allowDelete}
          onStartEdit={startEditing}
          onEditChange={onEditChange}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEditing}
          onRemove={removeRow}
          getRowId={getRowId}
        />
      </div>

      {supportsInactive ? (
        <MasterDataInactiveList
          rows={inactiveRows}
          getRowId={getRowId}
          onEdit={startEditing}
        />
      ) : null}
    </div>
  );
}