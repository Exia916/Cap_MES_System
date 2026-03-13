"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/DataTable";

type Opt = { id: number; name: string };

// ✅ Match your /api/me shape (supports both styles)
type Me = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: string | number | null;
  role?: string | null;

  // older/alt shapes (safe)
  display_name?: string | null;
  employee_number?: number | null;
};

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// ✅ normalize API shapes: [] OR {rows:[]} OR {data:[]}
function normalizeOptions(data: any): Opt[] {
  if (Array.isArray(data)) return data as Opt[];
  if (Array.isArray(data?.rows)) return data.rows as Opt[];
  if (Array.isArray(data?.data)) return data.data as Opt[];
  return [];
}

function pickLabel(list: Opt[], idStr: string) {
  const id = String(idStr || "");
  return list.find((x) => String(x.id) === id)?.name || "";
}

function toCreatedId(data: any): number | null {
  // cover common API shapes
  const candidates = [
    data?.workOrderId,
    data?.work_order_id,
    data?.id,
    data?.row?.workOrderId,
    data?.row?.work_order_id,
    data?.row?.id,
    data?.data?.workOrderId,
    data?.data?.work_order_id,
    data?.data?.id,
    data?.created?.workOrderId,
    data?.created?.id,
    data?.result?.workOrderId,
    data?.result?.id,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function meName(me: Me | null): string {
  const name =
    (me?.displayName || me?.display_name || "").trim() ||
    (me?.username || "").trim() ||
    "";
  return name || "Unknown";
}

function meEmp(me: Me | null): string {
  const raw = me?.employeeNumber ?? me?.employee_number;
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  return s;
}

export default function AddRepairRequestPage() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);

  const [departments, setDepartments] = useState<Opt[]>([]);
  const [assets, setAssets] = useState<Opt[]>([]);
  const [priorities, setPriorities] = useState<Opt[]>([]);
  const [issues, setIssues] = useState<Opt[]>([]);

  const [loadingLookups, setLoadingLookups] = useState(true);

  const [departmentId, setDepartmentId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [operatorInitials, setOperatorInitials] = useState("");
  const [commonIssueId, setCommonIssueId] = useState("");
  const [issueDialogue, setIssueDialogue] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ non-blocking warning if email fails
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  // ✅ show validation errors only after submit attempt (like screenshot)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Load lookups
  useEffect(() => {
    (async () => {
      try {
        setLoadingLookups(true);
        setError(null);

        const [meRes, deptRes, priRes, issRes] = await Promise.all([
          fetchJson("/api/me"),
          fetchJson("/api/cmms/lookups/departments"),
          fetchJson("/api/cmms/lookups/priorities"),
          fetchJson("/api/cmms/lookups/issues"),
        ]);

        setMe(meRes as Me);
        setDepartments(normalizeOptions(deptRes));
        setPriorities(normalizeOptions(priRes));
        setIssues(normalizeOptions(issRes));
      } catch (e: any) {
        setError(e?.message || "Failed to load form data");
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, []);

  // Load assets filtered by department
  useEffect(() => {
    (async () => {
      try {
        if (!departmentId) {
          setAssets([]);
          setAssetId("");
          return;
        }

        const res = await fetchJson(`/api/cmms/lookups/assets?departmentId=${encodeURIComponent(departmentId)}`);
        const list = normalizeOptions(res);
        setAssets(list);

        // If current asset no longer valid, clear it
        if (assetId && !list.some((a) => String(a.id) === String(assetId))) {
          setAssetId("");
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load assets");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const canSubmit = useMemo(() => {
    return !!departmentId && !!assetId && !!priorityId && !!commonIssueId && issueDialogue.trim().length > 0;
  }, [departmentId, assetId, priorityId, commonIssueId, issueDialogue]);

  // ✅ validation messages (only show after attempted submit)
  const v = useMemo(() => {
    const issueOk = issueDialogue.trim().length > 0;

    return {
      department: !departmentId ? "Department is required." : "",
      asset: !assetId ? "Asset is required." : "",
      priority: !priorityId ? "Priority is required." : "",
      commonIssue: !commonIssueId ? "Common Issue is required." : "",
      issueDialogue: !issueOk ? "Issue Dialogue is required." : "",
    };
  }, [departmentId, assetId, priorityId, commonIssueId, issueDialogue]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailWarning(null);
    setAttemptedSubmit(true);

    if (!canSubmit) return;

    setSaving(true);
    try {
      // 1) Create work order
      const payload = {
        departmentId: Number(departmentId),
        assetId: Number(assetId),
        priorityId: Number(priorityId),
        operatorInitials: operatorInitials.trim(),
        commonIssueId: Number(commonIssueId),
        issueDialogue: issueDialogue.trim(),
      };

      const res = await fetch("/api/cmms/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || `Create failed (HTTP ${res.status})`);

      const createdId = toCreatedId(data);

      // 2) Send email (non-blocking)
      const departmentLabel = pickLabel(departments, departmentId) || "(Unknown)";
      const assetLabel = pickLabel(assets, assetId) || "(Unknown)";
      const priorityLabel = pickLabel(priorities, priorityId) || "(Unknown)";
      const issueLabel = pickLabel(issues, commonIssueId) || "(Unknown)";

      const requestedByName = meName(me);
      const requestedByEmployee = meEmp(me);

      try {
        const emailRes = await fetch("/api/cmms/notifications/work-order-created", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            workOrder: {
              workOrderId: createdId,
              requestedByName,
              requestedByEmployee,
              department: departmentLabel,
              asset: assetLabel,
              priority: priorityLabel,
              commonIssue: issueLabel,
              operatorInitials: operatorInitials.trim(),
              issueDialogue: issueDialogue.trim(),
            },
          }),
        });

        const emailData = await emailRes.json().catch(() => ({}));
        if (!emailRes.ok) {
          setEmailWarning((emailData as any).error || "Repair request created, but email notification failed.");
        }
      } catch {
        setEmailWarning("Repair request created, but email notification failed.");
      }

      router.push("/cmms/repair-requests");
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  function fieldStyle(isInvalid: boolean): React.CSSProperties {
    if (!attemptedSubmit || !isInvalid) return input;
    return { ...input, border: "1px solid #dc2626" };
  }

  function FieldError({ msg }: { msg: string }) {
    if (!attemptedSubmit || !msg) return null;
    return <div style={fieldError}>{msg}</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0 }}>Add Repair Request</h1>

      {error ? <div style={{ color: "crimson", marginTop: 8 }}>{error}</div> : null}
      {emailWarning ? <div style={{ ...warnBanner, marginTop: 8 }}>{emailWarning}</div> : null}

      <form onSubmit={onSubmit} style={{ maxWidth: 720, marginTop: 12 }}>
        <label style={label}>
          Department <span style={reqStar}>*</span>
        </label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          style={fieldStyle(!!v.department)}
          disabled={saving || loadingLookups}
        >
          <option value="">Select…</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
        <FieldError msg={v.department} />

        <label style={label}>
          Asset <span style={reqStar}>*</span>
        </label>
        <select
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          style={fieldStyle(!!v.asset)}
          disabled={saving || loadingLookups || !departmentId}
        >
          <option value="">{departmentId ? "Select…" : "Select department first…"}</option>
          {assets.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.name}
            </option>
          ))}
        </select>
        <FieldError msg={v.asset} />

        <label style={label}>
          Priority <span style={reqStar}>*</span>
        </label>
        <select
          value={priorityId}
          onChange={(e) => setPriorityId(e.target.value)}
          style={fieldStyle(!!v.priority)}
          disabled={saving || loadingLookups}
        >
          <option value="">Select…</option>
          {priorities.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
        <FieldError msg={v.priority} />

        <label style={label}>Operator Name</label>
        <input
          value={operatorInitials}
          onChange={(e) => setOperatorInitials(e.target.value)}
          placeholder="e.g. John Doe"
          style={input}
          disabled={saving}
        />

        <label style={label}>
          Common Issue <span style={reqStar}>*</span>
        </label>
        <select
          value={commonIssueId}
          onChange={(e) => setCommonIssueId(e.target.value)}
          style={fieldStyle(!!v.commonIssue)}
          disabled={saving || loadingLookups}
        >
          <option value="">Select…</option>
          {issues.map((i) => (
            <option key={i.id} value={String(i.id)}>
              {i.name}
            </option>
          ))}
        </select>
        <FieldError msg={v.commonIssue} />

        <label style={label}>
          Issue Dialogue <span style={reqStar}>*</span>
        </label>
        <textarea
          value={issueDialogue}
          onChange={(e) => setIssueDialogue(e.target.value)}
          placeholder="Describe the problem…"
          style={{ ...fieldStyle(!!v.issueDialogue), height: 140 }}
          disabled={saving}
        />
        <FieldError msg={v.issueDialogue} />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="submit" style={btnSecondary} disabled={saving}>
            {saving ? "Creating…" : "Create Request"}
          </button>

          <button type="button" style={btnSecondary} onClick={() => router.push("/cmms/repair-requests")} disabled={saving}>
            Cancel
          </button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
          Logged in as: {meName(me)}
          {meEmp(me) ? ` (Emp #: ${meEmp(me)})` : ""}
        </div>
      </form>
    </div>
  );
}

const label: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  marginBottom: 6,
  fontWeight: 600,
};

const reqStar: React.CSSProperties = {
  color: "#dc2626",
  fontWeight: 900,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 8,
  fontSize: 14,
};

const fieldError: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#dc2626",
  fontWeight: 600,
};

const warnBanner: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #f59e0b",
  background: "#fffbeb",
  borderRadius: 8,
  color: "#92400e",
  fontSize: 13,
};