import { NextResponse } from "next/server";
import { isProject, isRange, isVariant, type Project, type Range, type Variant } from "@/lib/dashboard/types";
import { isProjectConfigured, ProjectNotConfiguredError } from "@/lib/dashboard/clients";
import {
  getKpis,
  getTopEvents,
  getEventsOverTime,
  getFunnel,
  getEngagement,
  getMonetization,
  getDiscovery,
  getChatSessions,
  getChatTranscript,
  getFeedbackSubmissions,
} from "@/lib/dashboard/queries";

// Always run at request time — these are live DB reads.
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fn: string }> },
) {
  const { fn } = await params;
  const url = new URL(request.url);
  const sp = url.searchParams;

  const project = sp.get("project");
  if (!isProject(project)) {
    return NextResponse.json({ error: "Invalid or missing project" }, { status: 400 });
  }

  const rangeParam = sp.get("range") ?? "30d";
  const range: Range = isRange(rangeParam) ? rangeParam : "30d";

  const variantParam = sp.get("variant") ?? "all";
  const variant: Variant = isVariant(variantParam) ? variantParam : "all";

  // Project may not be configured (e.g. Guide credentials not yet set).
  if (!isProjectConfigured(project)) {
    return NextResponse.json(
      { error: "not_configured", message: `Project "${project}" is not configured.` },
      { status: 200 },
    );
  }

  try {
    const data = await dispatch(fn, project, range, variant, sp);
    if (data === undefined) {
      return NextResponse.json({ error: `Unknown endpoint "${fn}"` }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ProjectNotConfiguredError) {
      return NextResponse.json({ error: "not_configured", message: err.message }, { status: 200 });
    }
    console.error(`[dashboard/api/${fn}]`, err);
    return NextResponse.json(
      { error: "query_failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

async function dispatch(
  fn: string,
  project: Project,
  range: Range,
  variant: Variant,
  sp: URLSearchParams,
): Promise<unknown> {
  switch (fn) {
    case "kpis":
      return getKpis(project, range, variant);
    case "top-events":
      return getTopEvents(project, range, variant);
    case "events-over-time":
      return getEventsOverTime(project, range, variant);
    case "funnel":
      return getFunnel(project, range, variant);
    case "engagement":
      return getEngagement(project, range, variant);
    case "monetization":
      return getMonetization(project, range, variant);
    case "discovery":
      return getDiscovery(project, range, variant);
    case "chat-sessions": {
      const page = Math.max(1, Number(sp.get("page")) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 25));
      const search = sp.get("search") ?? undefined;
      return getChatSessions(project, { page, pageSize, search });
    }
    case "feedback-submissions": {
      const page = Math.max(1, Number(sp.get("page")) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 25));
      return getFeedbackSubmissions(project, range, variant, { page, pageSize });
    }
    case "chat-transcript": {
      const conversationId = sp.get("conversationId");
      if (!conversationId) return { error: "missing conversationId" };
      return getChatTranscript(project, conversationId);
    }
    default:
      return undefined;
  }
}
