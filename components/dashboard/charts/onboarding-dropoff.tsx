"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelCard } from "@/components/dashboard/panel-card";
import { CHART_COLORS, EmptyState, axisProps } from "./chart-kit";
import type { OnboardingDropoffStep, Project, Range, Variant } from "@/lib/dashboard/types";

export function OnboardingDropoffChart({
  project,
  range,
  variant,
}: {
  project: Project;
  range: Range;
  variant: Variant;
}) {
  return (
    <PanelCard<OnboardingDropoffStep[]>
      fn="onboarding-dropoff"
      title="Onboarding step completions"
      project={project}
      range={range}
      variant={variant}
    >
      {(data) => {
        if (!data.length || data.every((step) => step.completed === 0)) {
          return <EmptyState />;
        }

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 4, right: 28 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stepLabel" width={56} {...axisProps} />
              <Tooltip content={<DropoffTooltip />} />
              <Bar dataKey="completed" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="completed" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }}
    </PanelCard>
  );
}

function DropoffTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: OnboardingDropoffStep }>;
}) {
  if (!active || !payload?.length) return null;

  const step = payload[0].payload;

  return (
    <div className="rounded-lg border border-edge bg-surface-elevated px-3 py-2 text-xs text-brand-ink shadow-sm">
      <div className="font-semibold">{step.stepLabel}</div>
      {step.detail ? <div className="mt-1 text-ink-secondary">{step.detail}</div> : null}
      <div className="mt-2">Completed: {step.completed.toLocaleString()}</div>
      {step.exits > 0 ? <div>Explicit exits: {step.exits.toLocaleString()}</div> : null}
    </div>
  );
}
