import { Suspense } from "react";
import { Providers } from "@/components/dashboard/providers";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata = {
  title: "Analytics Dashboard",
};

export default function DashboardPage() {
  return (
    <Providers>
      <Suspense fallback={<div className="p-6 text-sm text-ink-secondary">Loading dashboard…</div>}>
        <DashboardClient />
      </Suspense>
    </Providers>
  );
}
