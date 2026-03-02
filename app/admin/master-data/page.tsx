// app/admin/master-data/page.tsx
"use client";

import Link from "next/link";
import { MASTER_UI, MASTER_KEYS } from "./registry";

export default function MasterDataHomePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold">Admin – Master Data</h1>
        <p className="text-sm text-gray-600">
          Edit dropdown/list values used throughout the app (departments, shifts, roles, etc.).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MASTER_KEYS.map((key) => {
          const cfg = MASTER_UI[key];

          return (
            <Link
              key={key}
              href={`/admin/master-data/${key}`}
              className="rounded-xl border bg-white p-4 hover:bg-gray-50 transition"
            >
              <div className="font-semibold text-base mb-1">
                {cfg.title}
              </div>
              {cfg.description ? (
                <div className="text-sm text-gray-600 mb-2">
                  {cfg.description}
                </div>
              ) : null}
              <div className="text-xs text-gray-500">
                Key: <span className="font-mono">{key}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}