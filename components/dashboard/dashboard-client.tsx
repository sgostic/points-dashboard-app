"use client";

import { useDashboardUrl } from "./use-dashboard-url";
import { ProjectSwitcher } from "./project-switcher";
import { RangeControl } from "./range-control";
import { KpiCards } from "./kpi-cards";
import { ChatExplorer } from "./chat-explorer";
import { FunnelChart } from "./charts/funnel";
import { EventsOverTimeChart } from "./charts/events-over-time";
import { TopEventsChart } from "./charts/top-events";
import { EngagementChart } from "./charts/engagement";
import { MonetizationChart } from "./charts/monetization";
import { DiscoveryChart } from "./charts/discovery";
import { PROJECT_LABELS } from "@/lib/dashboard/types";

export function DashboardClient() {
  const { project, range, page, search, conversationId, setParams } = useDashboardUrl();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-sm text-ink-secondary">
          Viewing <span className="font-medium">{PROJECT_LABELS[project]}</span>
        </p>
      </header>

      <ProjectSwitcher active={project} onSelect={(p) => setParams({ project: p, page: 1, conversationId: null })} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-secondary">Overview</h2>
        <RangeControl value={range} onChange={(r) => setParams({ range: r })} />
      </div>

      <KpiCards project={project} range={range} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart project={project} range={range} />
        <EventsOverTimeChart project={project} range={range} />
        <TopEventsChart project={project} range={range} />
        <EngagementChart project={project} range={range} />
        <MonetizationChart project={project} range={range} />
        <DiscoveryChart project={project} range={range} />
      </div>

      <ChatExplorer
        project={project}
        page={page}
        search={search}
        conversationId={conversationId}
        onSetParams={setParams}
      />
    </div>
  );
}
