"use client";

import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelCard } from "@/components/dashboard/panel-card";
import { CHART_COLORS, EmptyState, axisProps, tooltipStyle, countFormatter } from "./chart-kit";
import type { Monetization, Project, Range } from "@/lib/dashboard/types";

export function MonetizationChart({ project, range }: { project: Project; range: Range }) {
  return (
    <PanelCard<Monetization> fn="monetization" title="Monetization intent" project={project} range={range}>
      {(data) => {
        const hasPay = data.wouldPay.length > 0;
        const hasPrice = data.monthlyPrice.length > 0;
        if (!hasPay && !hasPrice) return <EmptyState />;
        return (
          <div className="grid grid-cols-2 gap-2 h-full">
            <div className="flex flex-col h-full">
              <span className="text-xs text-ink-secondary mb-1">Would pay</span>
              <div className="flex-1">
                {hasPay ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.wouldPay} dataKey="count" nameKey="name" innerRadius="50%" outerRadius="80%">
                        {data.wouldPay.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState label="No data" />
                )}
              </div>
            </div>
            <div className="flex flex-col h-full">
              <span className="text-xs text-ink-secondary mb-1">Monthly price</span>
              <div className="flex-1">
                {hasPrice ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyPrice} margin={{ left: -20, right: 4, top: 4 }}>
                      <XAxis dataKey="name" {...axisProps} interval={0} />
                      <YAxis {...axisProps} width={32} />
                      <Tooltip {...tooltipStyle} formatter={countFormatter} />
                      <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState label="No data" />
                )}
              </div>
            </div>
          </div>
        );
      }}
    </PanelCard>
  );
}
