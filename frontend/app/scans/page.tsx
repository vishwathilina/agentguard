"use client";

import { useEffect, useState } from "react";
import { scansApi } from "@/lib/api";
import { Scan } from "@/types";
import { RecentScansTable } from "@/components/dashboard/RecentScansTable";
import { PageHeader } from "@/components/layout/PageHeader";

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
      <PageHeader
        icon="shield-warning"
        tone="primary"
        title="Findings"
        subtitle="Full scan history across all targets"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 animate-spin ag-spinner" />
        </div>
      ) : (
        <>
          <RecentScansTable scans={scans} />
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="ag-btn-secondary disabled:opacity-40"
              >
                Previous
              </button>
              <span className="ag-text-body">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="ag-btn-secondary disabled:opacity-40"
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
