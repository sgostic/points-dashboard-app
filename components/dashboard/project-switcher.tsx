"use client";

import { useQuery } from "@tanstack/react-query";
import { Compass, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECTS, PROJECT_LABELS, type Project, type Kpis } from "@/lib/dashboard/types";
import { fetchPanel, panelKey, isApiError } from "@/lib/dashboard/api-client";

const ICONS: Record<Project, React.ElementType> = { guide: Compass, butler: Bot };

function LiveStat({ project }: { project: Project }) {
  const { data } = useQuery({
    queryKey: panelKey("kpis", project, "7d"),
    queryFn: () => fetchPanel<Kpis>("kpis", { project, range: "7d" }),
  });
  if (!data) return <span className="text-xs opacity-60">loading…</span>;
  if (isApiError(data)) return <span className="text-xs opacity-60">not configured</span>;
  return (
    <span className="text-xs opacity-70">
      {data.sessions.toLocaleString()} sessions · {data.uniqueVisitors.toLocaleString()} visitors (7d)
    </span>
  );
}

export function ProjectSwitcher({
  active,
  onSelect,
}: {
  active: Project;
  onSelect: (p: Project) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PROJECTS.map((p) => {
        const Icon = ICONS[p];
        const isActive = p === active;
        return (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
              isActive
                ? "border-cta bg-cta text-cta-text shadow-md"
                : "border-edge bg-surface-elevated hover:border-edge-strong",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                isActive ? "bg-cta-text/20" : "bg-surface-muted",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">{PROJECT_LABELS[p]}</span>
              <LiveStat project={p} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
