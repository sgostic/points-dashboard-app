"use client";

import { useEffect } from "react";
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
import { OnboardingDropoffChart } from "./charts/onboarding-dropoff";
import { OnboardingEmailsPanel } from "./onboarding-emails";
import { OnboardingAnswerBreakdowns } from "./onboarding-answer-breakdowns";
import { PROJECT_LABELS } from "@/lib/dashboard/types";

export function DashboardClient() {
  const { project, range, from, to, variant, page, search, conversationId, setParams } = useDashboardUrl();
  const lockedVariant = project === "guide" ? "a" : "c";

  useEffect(() => {
    if (variant !== lockedVariant) {
      setParams({ variant: lockedVariant });
    }
  }, [lockedVariant, setParams, variant]);

  return (
    <DateRangeProvider from={from} to={to}>
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-ink-secondary">
            Viewing <span className="font-medium">{PROJECT_LABELS[project]}</span>
          </p>
        </header>

        <ProjectSwitcher
          active={project}
          onSelect={(p) =>
            setParams({
              project: p,
              variant: p === "guide" ? "a" : "c",
              page: 1,
              conversationId: null,
            })
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <VariantFilter value={lockedVariant} options={[lockedVariant]} onChange={(v) => setParams({ variant: v })} />
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

        <KpiCards project={project} range={range} variant={lockedVariant} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FunnelChart project={project} range={range} variant={lockedVariant} />
          <EventsOverTimeChart project={project} range={range} variant={lockedVariant} />
          <TopEventsChart project={project} range={range} variant={lockedVariant} />
          <EngagementChart project={project} range={range} variant={lockedVariant} />
          <MonetizationChart project={project} range={range} variant={lockedVariant} />
          <DiscoveryChart project={project} range={range} variant={lockedVariant} />
        </div>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Onboarding</h2>
            <p className="text-sm text-ink-secondary">
              Drop-off by step and captured emails from the <code>/start</code> flow.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OnboardingDropoffChart project={project} range={range} variant={lockedVariant} />
            <OnboardingEmailsPanel project={project} range={range} variant={lockedVariant} />
          </div>
          <OnboardingAnswerBreakdowns project={project} range={range} variant={lockedVariant} />
        </section>

        <FeedbackExplorer project={project} range={range} variant={lockedVariant} />

        <ChatExplorer
          project={project}
          range={range}
          variant={lockedVariant}
          page={page}
          search={search}
          conversationId={conversationId}
          onSetParams={setParams}
        />
      </div>
    </DateRangeProvider>
  );
}
