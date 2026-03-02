// app/admin/master-data/registry.ts

export type MasterKey =
  | "departments"
  | "shifts"
  | "roles"
  | "emb_type_locations"
  | "emb_locations"
  | "emb_types"
  | "emb_flat_3d_options"
  | "emb_type_location_rules"
  | "leather_styles";

export type ColumnType = "text" | "number" | "time" | "boolean";

export type MasterColumn = {
  key: string;
  label: string;
  type: ColumnType;
  required?: boolean;
  readOnly?: boolean;
  widthClass?: string;
};

export type MasterConfig = {
  key: MasterKey;
  title: string;
  description?: string;
  columns: MasterColumn[];
  softDelete?: boolean;
};

export const MASTER_UI: Record<MasterKey, MasterConfig> = {
  departments: {
    key: "departments",
    title: "Departments",
    description: "Used for user and production dropdowns. Store department code in records (e.g. EMB, QC).",
    softDelete: true,
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-40" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  shifts: {
    key: "shifts",
    title: "Shifts",
    description: "Used for user and production dropdowns. Store shift code in records (e.g. DAY, NIGHT).",
    softDelete: true,
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-40" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "start_time", label: "Start", type: "time", widthClass: "w-32" },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  roles: {
    key: "roles",
    title: "Roles",
    description:
      "Admin UI labels/sort for roles. Valid values must match the Postgres enum type role (ADMIN, SUPERVISOR, USER, etc.).",
    softDelete: true,
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-40" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_type_locations: {
    key: "emb_type_locations",
    title: "Embroidery Type Locations (Legacy)",
    description:
      "Legacy table. Prefer using Emb Locations / Emb Types / Flat-3D Options + Rules moving forward.",
    softDelete: true,
    columns: [
      { key: "location", label: "Location", type: "text", required: true },
      { key: "emb_type", label: "Emb Type", type: "text", required: true, widthClass: "w-40" },
      { key: "flat_or_3d", label: "Flat/3D", type: "text", required: true, widthClass: "w-32" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_locations: {
    key: "emb_locations",
    title: "Embroidery Locations",
    description: "Manage location codes used in embroidery (LF, RF, ABS, etc.).",
    softDelete: true,
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-40" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_types: {
    key: "emb_types",
    title: "Emblem Types",
    description: "Manage embroidery type codes/labels (SEW, STICKER, HEAT_SEAL, etc.).",
    softDelete: true,
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-40" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_flat_3d_options: {
    key: "emb_flat_3d_options",
    title: "QC Flat / 3D Options",
    description: "Manage allowed flat/3D options (FLAT, 3D, etc.).",
    softDelete: true,
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-40" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_type_location_rules: {
    key: "emb_type_location_rules",
    title: "Emb Type → Location Rules",
    description: "Allowed combinations of (Emb Type, Flat/3D, Location).",
    softDelete: true,
    columns: [
      { key: "emb_type_code", label: "Emb Type", type: "text", required: true, widthClass: "w-40" },
      { key: "flat_or_3d_code", label: "Flat/3D", type: "text", required: true, widthClass: "w-32" },
      { key: "location_code", label: "Location", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  leather_styles: {
    key: "leather_styles",
    title: "Leather Styles",
    description: "Laser module dropdown values from leather_styles.style_color.",
    softDelete: true,
    columns: [
      { key: "style_color", label: "Style/Color", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },
};

export const MASTER_KEYS: MasterKey[] = [
  "departments",
  "shifts",
  "roles",
  "emb_locations",
  "emb_types",
  "emb_flat_3d_options",
  "emb_type_location_rules",
  "leather_styles",
  "emb_type_locations", // legacy (optional)
];

export function isMasterKey(x: string): x is MasterKey {
  return (
    x === "departments" ||
    x === "shifts" ||
    x === "roles" ||
    x === "emb_locations" ||
    x === "emb_types" ||
    x === "emb_flat_3d_options" ||
    x === "emb_type_location_rules" ||
    x === "leather_styles" ||
    x === "emb_type_locations"
  );
}