"use client";

import Link from "next/link";
import { MASTER_UI, MASTER_KEYS } from "./registry";

export default function MasterDataHomePage() {
  return (
    <div className="page-shell section-stack">
      <div className="card">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Admin – Master Data</h1>
          <p className="page-subtitle">
            Edit dropdown/list values used throughout the app (departments, shifts, roles, etc.).
          </p>
        </div>
      </div>

      <div className="master-grid">
        {MASTER_KEYS.map((key) => {
          const cfg = MASTER_UI[key];

          return (
            <Link
              key={key}
              href={`/admin/master-data/${key}`}
              className="master-card-link"
            >
              <div className="master-card-title">{cfg.title}</div>

              {cfg.description ? (
                <div className="master-card-description">{cfg.description}</div>
              ) : null}

              <div className="master-card-meta">
                Key: <span className="master-card-key">{key}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}