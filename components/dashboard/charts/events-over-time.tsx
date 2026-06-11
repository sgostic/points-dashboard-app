"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { PanelBody } from "@/components/dashboard/panel-card";
import { fetchPanel, panelKey, type ApiResult } from "@/lib/dashboard/api-client";
import { CHART_COLORS, EmptyState, axisProps, tooltipStyle } from "./chart-kit";
import type { EventsOverTime, Project, Range, Variant } from "@/lib/dashboard/types";

export function EventsOverTimeChart({ project, range, variant }: { project: Project; range: Range; variant: Variant }) {
  const [breakout, setBreakout] = useState(false);
  const query = useQuery({
    queryKey: panelKey("events-over-time", project, range, { variant }),
    queryFn: () => fetchPanel<EventsOverTime>("events-over-time", { project, range, variant }),
  });

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>Events over time</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant={breakout ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setBreakout((b) => !b)}>
            Break out
          </Button>
          <Badge>{range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "All time"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="h-64">
        <PanelBody<EventsOverTime> query={query as { isLoading: boolean; isError: boolean; error: unknown; data: ApiResult<EventsOverTime> | undefined }}>
          {(data) => {
            if (!data.points.length) return <EmptyState />;
            return (
              <ResponsiveContainer width="100%" height="100%">
                {breakout ? (
                  <LineChart data={data.points} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} width={40} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {data.topEvents.map((e, i) => (
                      <Line key={e} type="monotone" dataKey={e} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
                    ))}
                  </LineChart>
                ) : (
                  <AreaChart data={data.points} margin={{ left: -10, right: 8 }}>
                    <defs>
                      <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} width={40} />
                    <Tooltip {...tooltipStyle} />
                    <Area type="monotone" dataKey="total" stroke={CHART_COLORS[0]} fill="url(#evGrad)" strokeWidth={2} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            );
          }}
        </PanelBody>
      </CardContent>
    </Card>
  );
}
