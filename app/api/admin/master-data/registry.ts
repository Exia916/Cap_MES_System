// app/api/admin/master-data/registry.ts

export type MasterKey =
  | "departments"
  | "shifts"
  | "roles"
  | "emb_type_locations" // legacy (optional)
  | "emb_locations"
  | "emb_types"
  | "emb_flat_3d_options"
  | "emb_type_location_rules"
  | "leather_styles";

export type MasterRegistryItem = {
  key: MasterKey;
  table: string;
  idCol: string;
  editable: Array<
    | "code"
    | "name"
    | "label"
    | "is_active"
    | "sort_order"
    | "start_time"
    | "location"
    | "emb_type"
    | "flat_or_3d"
    | "location_code"
    | "emb_type_code"
    | "flat_or_3d_code"
    | "style_color"
  >;
  selectCols: string[];
  orderBy: string;
  softDelete?: boolean;
};

export const MASTER_DATA: Record<MasterKey, MasterRegistryItem> = {
  departments: {
    key: "departments",
    table: "departments",
    idCol: "id",
    editable: ["code", "name", "is_active", "sort_order"],
    selectCols: ["id", "code", "name", "is_active", "sort_order", "created_at", "updated_at"],
    orderBy: "sort_order ASC, name ASC",
    softDelete: true,
  },

  shifts: {
    key: "shifts",
    table: "shifts",
    idCol: "id",
    editable: ["code", "name", "start_time", "is_active", "sort_order"],
    selectCols: ["id", "code", "name", "start_time", "is_active", "sort_order", "created_at", "updated_at"],
    orderBy: "sort_order ASC, name ASC",
    softDelete: true,
  },

  roles: {
    key: "roles",
    table: "roles_lookup",
    idCol: "code",
    editable: ["code", "label", "is_active", "sort_order"],
    selectCols: ["code", "label", "is_active", "sort_order", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    softDelete: true,
  },

  // Legacy table — can be removed later once migration is complete
  emb_type_locations: {
    key: "emb_type_locations",
    table: "emb_type_locations",
    idCol: "id",
    editable: ["location", "emb_type", "flat_or_3d", "is_active"],
    selectCols: ["id", "location", "emb_type", "flat_or_3d", "is_active", "created_at", "updated_at"],
    orderBy: "emb_type ASC, flat_or_3d ASC, location ASC",
    softDelete: true,
  },

  emb_locations: {
    key: "emb_locations",
    table: "emb_locations",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    softDelete: true,
  },

  emb_types: {
    key: "emb_types",
    table: "emb_types",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    softDelete: true,
  },

  emb_flat_3d_options: {
    key: "emb_flat_3d_options",
    table: "emb_flat_3d_options",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    softDelete: true,
  },

  emb_type_location_rules: {
    key: "emb_type_location_rules",
    table: "emb_type_location_rules",
    idCol: "id",
    editable: ["location_code", "emb_type_code", "flat_or_3d_code", "is_active"],
    selectCols: ["id", "location_code", "emb_type_code", "flat_or_3d_code", "is_active", "created_at", "updated_at"],
    orderBy: "emb_type_code ASC, flat_or_3d_code ASC, location_code ASC",
    softDelete: true,
  },

  leather_styles: {
    key: "leather_styles",
    table: "leather_styles",
    idCol: "id",
    editable: ["style_color", "is_active"],
    selectCols: ["id", "style_color", "is_active", "created_at", "updated_at"],
    orderBy: "style_color ASC",
    softDelete: true,
  },
};

export function isMasterKey(x: string): x is MasterKey {
  return (
    x === "departments" ||
    x === "shifts" ||
    x === "roles" ||
    x === "emb_type_locations" ||
    x === "emb_locations" ||
    x === "emb_types" ||
    x === "emb_flat_3d_options" ||
    x === "emb_type_location_rules" ||
    x === "leather_styles"
  );
}