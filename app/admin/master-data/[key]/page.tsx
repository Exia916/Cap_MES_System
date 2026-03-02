// app/admin/master-data/[key]/page.tsx
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isMasterKey, MASTER_UI, type MasterColumn, type MasterKey } from "../registry";

type Row = Record<string, any>;

function normalizeBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return Boolean(v);
}

function getRowId(r: Row): string {
  // supports tables with id PK or code PK
  return String(r.id ?? r.code ?? "");
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

  // Resolve dynamic params safely (Next 16+ passes params as Promise)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await params;
      const keyParam = String(p?.key || "");
      const resolved = isMasterKey(keyParam) ? (keyParam as MasterKey) : null;

      if (!cancelled) {
        setKey(resolved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const cfg = key ? MASTER_UI[key] : null;

  useEffect(() => {
    if (!cfg) return;

    // initialize new form defaults from column types
    const defaults: Record<string, any> = {};
    for (const c of cfg.columns) {
      if (c.type === "boolean") defaults[c.key] = true;
      else defaults[c.key] = "";
    }
    if (cfg.columns.some((c) => c.key === "sort_order")) defaults.sort_order = 0;
    if (cfg.columns.some((c) => c.key === "is_active")) defaults.is_active = true;
    setNewForm(defaults);
  }, [cfg?.key]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.key, key]);

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

  const activeRows = useMemo(
    () => filtered.filter((r) => normalizeBool(r.is_active)),
    [filtered]
  );

  const inactiveRows = useMemo(
    () => filtered.filter((r) => !normalizeBool(r.is_active)),
    [filtered]
  );

  const onNewChange = (col: MasterColumn, e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setNewForm((p) => ({
      ...p,
      [col.key]:
        col.type === "boolean"
          ? checked
          : col.type === "number"
          ? value
          : col.type === "time"
          ? value
          : value,
    }));
  };

  const onEditChange = (col: MasterColumn, e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setEditForm((p) => ({
      ...p,
      [col.key]:
        col.type === "boolean"
          ? checked
          : col.type === "number"
          ? value
          : col.type === "time"
          ? value
          : value,
    }));
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
      else payload[c.key] = v === "" ? null : String(v);
    }

    // normalize common fields
    if (typeof payload.code === "string") payload.code = payload.code.trim().toUpperCase();
    if (typeof payload.name === "string") payload.name = payload.name.trim();
    if (typeof payload.label === "string") payload.label = payload.label.trim();

    return payload;
  };

  const createRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key || !cfg) return;

    const msg = validate(newForm);
    if (msg) return setError(msg);

    const payload = coercePayload(newForm);

    const res = await fetch(`/api/admin/master-data/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError((json as any)?.error || "Failed to create");

    // reset
    const defaults: Record<string, any> = {};
    for (const c of cfg.columns) {
      if (c.type === "boolean") defaults[c.key] = true;
      else defaults[c.key] = "";
    }
    if (cfg.columns.some((c) => c.key === "sort_order")) defaults.sort_order = 0;
    if (cfg.columns.some((c) => c.key === "is_active")) defaults.is_active = true;
    setNewForm(defaults);

    await loadRows();
  };

  const startEditing = (r: Row) => {
    if (!cfg) return;

    const rid = getRowId(r);
    setEditingId(rid);

    if (r.code) setSearch(String(r.code));

    const f: Record<string, any> = {};
    for (const c of cfg.columns) {
      const v = r[c.key];
      if (c.type === "boolean") f[c.key] = normalizeBool(v);
      else if (c.type === "number") f[c.key] = v ?? 0;
      else if (c.type === "time") f[c.key] = typeof v === "string" ? v.slice(0, 5) : "";
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
    if (msg) return setError(msg);

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
    if (!res.ok) return setError((json as any)?.error || "Failed to update");

    await loadRows();
  };

  const deactivateRow = async (id: string) => {
    if (!key) return;
    if (!confirm("Deactivate this entry? It will no longer appear in dropdowns.")) return;

    setError("");

    const res = await fetch(
      `/api/admin/master-data/${encodeURIComponent(key)}/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError((json as any)?.error || "Failed to deactivate");

    if (editingId === id) cancelEditing();
    await loadRows();
  };

  // --- rendering ---

  // While key is resolving, avoid mismatched SSR/CSR trees:
  if (!key) return <div className="p-6">Loading…</div>;

  if (!cfg) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xl font-semibold">Master Data</div>
          <div className="mt-2 text-sm text-red-700">Unknown master data key.</div>
          <button
            className="mt-3 rounded-full border px-4 py-2 text-sm"
            onClick={() => router.push("/admin/master-data")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading {cfg.title}…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Admin – {cfg.title}</h1>
            <p className="text-sm text-gray-600">{cfg.description || ""}</p>
            <div className="mt-2 text-xs text-gray-500">
              Key: <span className="font-mono">{cfg.key}</span>
            </div>
          </div>

          <Link href="/admin/master-data" className="rounded-full border px-4 py-2 text-sm">
            Back
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Add */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-semibold mb-3">
          Add {cfg.title.endsWith("s") ? cfg.title.slice(0, -1) : cfg.title}
        </h2>

        <form onSubmit={createRow} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cfg.columns.map((c) => (
            <Field key={c.key} label={`${c.label}${c.required ? " *" : ""}`}>
              <EditorInput col={c} value={newForm[c.key]} onChange={(e) => onNewChange(c, e)} />
            </Field>
          ))}

          <div className="flex items-end gap-2">
            <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Add
            </button>
          </div>
        </form>
      </div>

      {/* Search + Table */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 w-full">
            <input
              className="input w-full"
              placeholder={`Search ${cfg.title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="rounded-full border px-3 py-2 text-sm whitespace-nowrap"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="text-sm text-gray-600 whitespace-nowrap">
            Showing <strong>{activeRows.length}</strong> active
            {inactiveRows.length ? (
              <>
                {" "}
                / <strong>{inactiveRows.length}</strong> inactive
              </>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                {cfg.columns.map((c) => (
                  <th key={c.key} className={`py-2 pr-3 ${c.widthClass || ""}`}>
                    {c.label}
                  </th>
                ))}
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {activeRows.map((r) => {
                const rid = getRowId(r);

                return (
                  <Fragment key={rid}>
                    <tr className="border-b">
                      {cfg.columns.map((c) => (
                        <td key={c.key} className="py-2 pr-3">
                          {renderCell(c, r[c.key])}
                        </td>
                      ))}
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border px-3 py-1 text-xs"
                            onClick={() => startEditing(r)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-red-600 px-3 py-1 text-xs text-white"
                            onClick={() => deactivateRow(rid)}
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>

                    {editingId === rid ? (
                      <tr className="border-b">
                        <td colSpan={cfg.columns.length + 1} className="py-3">
                          <div className="rounded-lg border bg-gray-50 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-sm font-semibold">
                                Edit: <span className="font-mono">{String(r.code || rid)}</span>
                              </div>
                              <button
                                type="button"
                                className="rounded-full border px-3 py-1 text-xs"
                                onClick={cancelEditing}
                              >
                                Close
                              </button>
                            </div>

                            <form
                              onSubmit={saveEdit}
                              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                            >
                              {cfg.columns.map((c) => (
                                <Field key={c.key} label={`${c.label}${c.required ? " *" : ""}`}>
                                  <EditorInput
                                    col={c}
                                    value={editForm[c.key]}
                                    onChange={(e) => onEditChange(c, e)}
                                  />
                                </Field>
                              ))}

                              <div className="flex items-end gap-2">
                                <button className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full border px-4 py-2 text-sm"
                                  onClick={cancelEditing}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}

              {activeRows.length === 0 ? (
                <tr>
                  <td className="py-3 text-gray-500" colSpan={cfg.columns.length + 1}>
                    No active entries.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Inactive list */}
        {inactiveRows.length ? (
          <div className="mt-4 rounded-lg border bg-gray-50 p-3">
            <div className="text-sm font-semibold mb-2">Inactive</div>
            <div className="text-sm text-gray-700 space-y-1">
              {inactiveRows.map((r) => (
                <div key={getRowId(r)}>
                  <span className="font-mono">{String(r.code || getRowId(r))}</span>
                  {" — "}
                  {String(r.name || r.label || "")}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          height: 36px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 10px;
          font-size: 14px;
          background: white;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function EditorInput({
  col,
  value,
  onChange,
}: {
  col: MasterColumn;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (col.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700 h-9">
        <input type="checkbox" checked={!!value} onChange={onChange} />
        {value ? "Yes" : "No"}
      </label>
    );
  }

  if (col.type === "number") {
    return <input className="input" type="number" value={value ?? 0} onChange={onChange} />;
  }

  if (col.type === "time") {
    const v = typeof value === "string" ? value.slice(0, 5) : "";
    return <input className="input" type="time" value={v} onChange={onChange} />;
  }

  return <input className="input" value={value ?? ""} onChange={onChange} />;
}

function renderCell(col: MasterColumn, value: any) {
  if (col.type === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  if (col.type === "time") return String(value).slice(0, 5);
  return String(value);
}