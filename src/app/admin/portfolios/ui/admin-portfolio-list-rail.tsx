"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

import { buildAdminPortfolioSwitchHref } from "./admin-portfolio-nav-utils";

type PortfolioListRow = {
  _id: string;
  name: string;
  isDefault: boolean;
  userEmail: string | null;
  userDisplayName: string;
};

type AdminPortfolioListRailProps = {
  portfolioId: string;
};

export function AdminPortfolioListRail({ portfolioId }: AdminPortfolioListRailProps) {
  const pathname = usePathname();
  const activePid = decodeURIComponent(portfolioId);
  const [rows, setRows] = useState<PortfolioListRow[]>([]);
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const payload = await parseJson<{ data: PortfolioListRow[] }>(
        await fetch("/api/admin/portfolios", { cache: "no-store" })
      );
      setRows(payload.data);
      setStatus(`${payload.data.length} book(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <aside className="admin-portfolio-list-rail xf-widget" aria-label="Tenant portfolios">
      <div className="admin-portfolio-list-rail__head">
        <div>
          <p className="admin-portfolio-list-rail__title">Books</p>
          <p className="admin-portfolio-list-rail__sub">{status}</p>
        </div>
        <div className="admin-portfolio-list-rail__head-actions">
          <button
            type="button"
            className="admin-portfolio-list-rail__icon-btn"
            disabled={loading}
            onClick={() => void refresh()}
            aria-label="Refresh portfolio list"
            title="Refresh list"
          >
            <RefreshIcon className="crud-icon" />
          </button>
        </div>
      </div>
      <Link className="admin-portfolio-list-rail__hub-link" href="/admin/portfolios">
        Full list &amp; CRUD →
      </Link>
      <ul className="admin-portfolio-list-rail__list">
        {rows.map((row) => {
          const active = row._id === activePid;
          const href = buildAdminPortfolioSwitchHref(pathname, row._id);
          const primary = row.name?.trim() || "Untitled book";
          const sub = row.userEmail?.trim() || row.userDisplayName?.trim() || "—";
          return (
            <li key={row._id}>
              <Link
                className={`admin-portfolio-list-rail__item${active ? " admin-portfolio-list-rail__item--active" : ""}`}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                <span className="admin-portfolio-list-rail__item-name">
                  {primary}
                  {row.isDefault ? (
                    <span className="admin-portfolio-list-rail__badge" title="Default book for user">
                      Default
                    </span>
                  ) : null}
                </span>
                <span className="admin-portfolio-list-rail__item-meta">{sub}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
