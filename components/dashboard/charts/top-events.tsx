"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelCard } from "@/components/dashboard/panel-card";
import { CHART_COLORS, EmptyState, axisProps, tooltipStyle, countFormatter } from "./chart-kit";
import type { NameCount, Project, Range, Variant } from "@/lib/dashboard/types";

export function TopEventsChart({ project, range, variant }: { project: Project; range: Range; variant: Variant }) {
  return (
    <PanelCard<NameCount[]> fn="top-events" title="Top events" project={project} range={range} variant={variant}>
      {(data) => {
        if (!data.length) return <EmptyState />;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={countFormatter} />
              <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }}
    </PanelCard>
  );
}
