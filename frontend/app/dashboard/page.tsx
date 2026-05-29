"use client";

import { useEffect, useState } from "react";
import { scansApi } from "@/lib/api";
import { Scan } from "@/types";
import { SecurityOverviewCard } from "@/components/dashboard/SecurityOverviewCard";
import { VulnerabilityTrendsChart } from "@/components/dashboard/VulnerabilityTrendsChart";
import { RecentScansTable } from "@/components/dashboard/RecentScansTable";
import { AiInsightsCard } from "@/components/dashboard/AiInsightsCard";
import { RecentAlertsCard } from "@/components/dashboard/RecentAlertsCard";
import { InfrastructureCard } from "@/components/dashboard/InfrastructureCard";
import { ShieldCheck } from "lucide-react";

export default function DashboardPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scansApi
      .list(0)
      .then((res) => setScans(res.content))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#6366f1", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Page title */}
      <div className="flex items-center gap-3 pb-1">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: "#818cf8" }} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white leading-none">Dashboard</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>
            Real-time vulnerability intelligence
          </p>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left column — 2/3 */}
        <div className="xl:col-span-2 space-y-5">
          <SecurityOverviewCard scans={scans} />
          <VulnerabilityTrendsChart scans={scans} />
          <RecentScansTable scans={scans.slice(0, 8)} />
        </div>

        {/* Right column — 1/3 */}
        <div className="xl:col-span-1 space-y-5">
          <AiInsightsCard scans={scans} />
          <RecentAlertsCard scans={scans} />
          <InfrastructureCard scans={scans} />
        </div>
      </div>
    </div>
  );
}
