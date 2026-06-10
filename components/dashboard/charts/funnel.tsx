"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { PanelCard } from "@/components/dashboard/panel-card";
import { CHART_COLORS, EmptyState, axisProps, tooltipStyle } from "./chart-kit";
import type { FunnelStep, Project, Range } from "@/lib/dashboard/types";

export function FunnelChart({ project, range }: { project: Project; range: Range }) {
  return (
    <PanelCard<FunnelStep[]> fn="funnel" title="Conversion funnel" project={project} range={range}>
      {(data) => {
        if (!data.length || data.every((d) => d.count === 0)) return <EmptyState />;
        const top = data[0]?.count || 1;
        const withPct = data.map((d) => ({ ...d, pct: Math.round((d.count / top) * 100) }));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={withPct} layout="vertical" margin={{ left: 10, right: 40 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="step" width={100} {...axisProps} />
              <Tooltip
                {...tooltipStyle}
                formatter={((v: number, _n: unknown, p: { payload?: { pct?: number } }) => [
                  `${Number(v).toLocaleString()} (${p?.payload?.pct ?? 0}%)`,
                  "Count",
                ]) as never}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {withPct.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }}
    </PanelCard>
  );
}
