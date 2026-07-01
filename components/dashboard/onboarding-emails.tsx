"use client";

import { format } from "date-fns";
import { PanelCard } from "@/components/dashboard/panel-card";
import { EmptyState } from "@/components/dashboard/charts/chart-kit";
import type { OnboardingEmails, Project, Range, Variant } from "@/lib/dashboard/types";

export function OnboardingEmailsPanel({
  project,
  range,
  variant,
}: {
  project: Project;
  range: Range;
  variant: Variant;
}) {
  return (
    <PanelCard<OnboardingEmails>
      fn="onboarding-emails"
      title="Onboarding email leads"
      project={project}
      range={range}
      variant={variant}
      bodyClassName="h-80"
    >
      {(data) => {
        if (!data.total) {
          return <EmptyState label="No onboarding emails for this range" />;
        }

        return (
          <div className="flex h-full flex-col gap-4">
            <div className="rounded-xl border border-edge bg-surface-muted px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-ink-secondary">
                Emails Captured
              </div>
              <div className="mt-1 text-3xl font-semibold tracking-tight text-brand-ink">
                {data.total.toLocaleString()}
              </div>
            </div>

            <div className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-xl border border-edge">
              <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-edge bg-surface-muted px-3 py-2 text-xs font-medium text-ink-secondary">
                <span>Email</span>
                <span>Captured</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {data.rows.map((row) => (
                  <div
                    key={`${row.email}-${row.createdAt}`}
                    className="grid grid-cols-[1fr_auto] gap-3 border-b border-edge/70 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="truncate font-mono text-brand-ink">{row.email}</span>
                    <span className="whitespace-nowrap text-ink-secondary">
                      {format(new Date(row.createdAt), "MMM d")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }}
    </PanelCard>
  );
}
