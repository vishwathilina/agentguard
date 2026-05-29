"use client";

import { useEffect, useState } from "react";
import { scansApi } from "@/lib/api";
import { Scan } from "@/types";
import { RecentScansTable } from "@/components/dashboard/RecentScansTable";
import { ScanLine } from "lucide-react";

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    setLoading(true);
    scansApi
      .list(page)
      .then((res) => {
        setScans(res.content);
        setTotalPages(res.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 pb-1">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
        >
          <ScanLine className="h-4 w-4" style={{ color: "#818cf8" }} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white leading-none">Scans</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>
            Full scan history across all targets
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#6366f1", borderTopColor: "transparent" }}
          />
        </div>
      ) : (
        <>
          <RecentScansTable scans={scans} />
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                style={{ background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9" }}
              >
                Previous
              </button>
              <span className="text-xs" style={{ color: "#6e7681" }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                style={{ background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9" }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
