"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelCard } from "@/components/dashboard/panel-card";
import { CHART_COLORS, EmptyState, axisProps, tooltipStyle, countFormatter } from "./chart-kit";
import type { Engagement, Project, Range } from "@/lib/dashboard/types";

export function EngagementChart({ project, range }: { project: Project; range: Range }) {
  return (
    <PanelCard<Engagement> fn="engagement" title="Engagement depth" project={project} range={range}>
      {(data) => {
        const hasScroll = data.scrollDepth.length > 0;
        const hasDur = data.durationBuckets.length > 0;
        if (!hasScroll && !hasDur) return <EmptyState />;
        return (
          <div className="grid grid-cols-2 gap-2 h-full">
            <MiniBar title="Scroll depth" data={data.scrollDepth} color={CHART_COLORS[4]} />
            <MiniBar title="Session duration" data={data.durationBuckets} color={CHART_COLORS[1]} />
          </div>
        );
      }}
    </PanelCard>
  );
}

function MiniBar({ title, data, color }: { title: string; data: { name: string; count: number }[]; color: string }) {
  return (
    <div className="flex flex-col h-full">
      <span className="text-xs text-ink-secondary mb-1">{title}</span>
      <div className="flex-1">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20, right: 4, top: 4 }}>
              <XAxis dataKey="name" {...axisProps} interval={0} />
              <YAxis {...axisProps} width={32} />
              <Tooltip {...tooltipStyle} formatter={countFormatter} />
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState label="No data" />
        )}
      </div>
    </div>
  );
}
