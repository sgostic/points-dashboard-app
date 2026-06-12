"use client";

import { useDashboardUrl } from "./use-dashboard-url";
import { DateRangeProvider } from "./date-range-context";
import { ProjectSwitcher } from "./project-switcher";
import { RangeControl } from "./range-control";
import { VariantFilter } from "./variant-filter";
import { Legend } from "./legend";
import { KpiCards } from "./kpi-cards";
import { ChatExplorer } from "./chat-explorer";
import { FeedbackExplorer } from "./feedback-explorer";
import { FunnelChart } from "./charts/funnel";
import { EventsOverTimeChart } from "./charts/events-over-time";
import { TopEventsChart } from "./charts/top-events";
import { EngagementChart } from "./charts/engagement";
import { MonetizationChart } from "./charts/monetization";
import { DiscoveryChart } from "./charts/discovery";
import { PROJECT_LABELS } from "@/lib/dashboard/types";

export function DashboardClient() {
  const { project, range, from, to, variant, page, search, conversationId, setParams } = useDashboardUrl();

  return (
    <DateRangeProvider from={from} to={to}>
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-ink-secondary">
            Viewing <span className="font-medium">{PROJECT_LABELS[project]}</span>
          </p>
        </header>

        <ProjectSwitcher active={project} onSelect={(p) => setParams({ project: p, page: 1, conversationId: null })} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <VariantFilter value={variant} onChange={(v) => setParams({ variant: v === "all" ? null : v })} />
          <RangeControl
            value={range}
            from={from}
            to={to}
            onChange={(sel) =>
              setParams({
                range: sel.range,
                from: sel.range === "custom" ? sel.from ?? null : null,
                to: sel.range === "custom" ? sel.to ?? null : null,
              })
            }
          />
        </div>

        <Legend />

        <KpiCards project={project} range={range} variant={variant} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FunnelChart project={project} range={range} variant={variant} />
          <EventsOverTimeChart project={project} range={range} variant={variant} />
          <TopEventsChart project={project} range={range} variant={variant} />
          <EngagementChart project={project} range={range} variant={variant} />
          <MonetizationChart project={project} range={range} variant={variant} />
          <DiscoveryChart project={project} range={range} variant={variant} />
        </div>

        <FeedbackExplorer project={project} range={range} variant={variant} />

        <ChatExplorer
          project={project}
          page={page}
          search={search}
          conversationId={conversationId}
          onSetParams={setParams}
        />
      </div>
    </DateRangeProvider>
  );
}
