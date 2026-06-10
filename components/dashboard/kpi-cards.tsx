"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Activity,
  UserPlus,
  LogIn,
  CreditCard,
  MessageSquareHeart,
  Bell,
  Mail,
  Timer,
  MessagesSquare,
} from "lucide-react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { fetchPanel, panelKey, isApiError } from "@/lib/dashboard/api-client";
import type { Project, Range, Kpis } from "@/lib/dashboard/types";

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function KpiCards({ project, range }: { project: Project; range: Range }) {
  const { data, isLoading } = useQuery({
    queryKey: panelKey("kpis", project, range),
    queryFn: () => fetchPanel<Kpis>("kpis", { project, range }),
  });

  const k = data && !isApiError(data) ? data : null;

  const cards: { label: string; value: string; icon: React.ElementType }[] = [
    { label: "Unique visitors", value: k ? k.uniqueVisitors.toLocaleString() : "—", icon: Users },
    { label: "Sessions", value: k ? k.sessions.toLocaleString() : "—", icon: Activity },
    { label: "Signups", value: k ? k.signups.toLocaleString() : "—", icon: UserPlus },
    { label: "Signins", value: k ? k.signins.toLocaleString() : "—", icon: LogIn },
    { label: "Pay intent", value: k ? k.payIntent.toLocaleString() : "—", icon: CreditCard },
    { label: "Feedback", value: k ? k.feedback.toLocaleString() : "—", icon: MessageSquareHeart },
    { label: "Alerts created", value: k ? k.alertsCreated.toLocaleString() : "—", icon: Bell },
    { label: "Email subs", value: k ? k.emailSubscribed.toLocaleString() : "—", icon: Mail },
    { label: "Avg session", value: k ? fmtDuration(k.avgSessionDurationMs) : "—", icon: Timer },
    { label: "Chat sessions", value: k ? k.chatSessions.toLocaleString() : "—", icon: MessagesSquare },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </div>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
          )}
        </Card>
      ))}
    </div>
  );
}
