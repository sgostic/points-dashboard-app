"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Badge } from "@/components/ui/primitives";
import { fetchPanel, panelKey, isNotConfigured, type ApiResult } from "@/lib/dashboard/api-client";
import type { Project, Range } from "@/lib/dashboard/types";

const RANGE_LABEL: Record<Range, string> = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

export function PanelCard<T>({
  fn,
  title,
  project,
  range,
  children,
  className,
  bodyClassName = "h-64",
}: {
  fn: string;
  title: string;
  project: Project;
  range: Range;
  children: (data: T) => React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const query = useQuery({
    queryKey: panelKey(fn, project, range),
    queryFn: () => fetchPanel<T>(fn, { project, range }),
  });

  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>{title}</CardTitle>
        <Badge>{RANGE_LABEL[range]}</Badge>
      </CardHeader>
      <CardContent className={bodyClassName}>
        <PanelBody query={query}>{children}</PanelBody>
      </CardContent>
    </Card>
  );
}

export function PanelBody<T>({
  query,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; data: ApiResult<T> | undefined };
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div className="space-y-2 h-full">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-accent">
        <AlertCircle className="h-5 w-5" />
        <span>{query.error instanceof Error ? query.error.message : "Failed to load"}</span>
      </div>
    );
  }
  const data = query.data;
  if (isNotConfigured(data)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-ink-secondary">
        <Database className="h-5 w-5" />
        <span>This project is not configured yet.</span>
      </div>
    );
  }
  return <>{children(data as T)}</>;
}
