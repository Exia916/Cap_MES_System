export type DailyProductionRow = {
  id: string;
  entry_ts?: string;     // or timestamp
  entry_date?: string;   // if you store separate date
  name?: string;
  employee_number?: number | string;
  sales_order?: number | string;
  detail_number?: number | string;
  stitches?: number | string;
  pieces?: number | string;
  notes?: string;
  // add fields your API returns (shift_date, machine, etc.)
};
