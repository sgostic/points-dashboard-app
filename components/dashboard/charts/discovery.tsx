"use client";

import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelCard } from "@/components/dashboard/panel-card";
import { Button } from "@/components/ui/primitives";
import { CHART_COLORS, EmptyState, axisProps, tooltipStyle, countFormatter } from "./chart-kit";
import type { Discovery, NameCount, Project, Range } from "@/lib/dashboard/types";

type Tab = "interests" | "mapPins" | "tripModals";
const TABS: { key: Tab; label: string }[] = [
  { key: "interests", label: "Interests" },
  { key: "mapPins", label: "Map pins" },
  { key: "tripModals", label: "Trip modals" },
];

export function DiscoveryChart({ project, range }: { project: Project; range: Range }) {
  const [tab, setTab] = useState<Tab>("interests");
  return (
    <PanelCard<Discovery> fn="discovery" title="Discovery signals" project={project} range={range}>
      {(data) => {
        const series: NameCount[] = data[tab];
        return (
          <div className="flex flex-col h-full">
            <div className="flex gap-1 mb-2">
              {TABS.map((t) => (
                <Button
                  key={t.key}
                  variant={tab === t.key ? "default" : "outline"}
                  className="h-6 px-2 text-xs"
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <div className="flex-1">
              {series.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} {...axisProps} />
                    <Tooltip {...tooltipStyle} formatter={countFormatter} />
                    <Bar dataKey="count" fill={CHART_COLORS[5]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </div>
          </div>
        );
      }}
    </PanelCard>
  );
}
