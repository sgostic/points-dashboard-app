import "server-only";
import { query } from "./clients";
import type {
  Project,
  RangeParams,
  Variant,
  Kpis,
  EventsOverTime,
  TimePoint,
  NameCount,
  FunnelStep,
  Engagement,
  Monetization,
  Discovery,
  ChatSessionsPage,
  ChatSessionRow,
  ChatMessage,
  FeedbackSubmissionsPage,
  FeedbackSubmission,
} from "./types";

/**
 * SQL fragment limiting `events.occurred_at` to the selected range. For a
 * `"custom"` range the inclusive `from`/`to` bounds are validated as strict
 * `YYYY-MM-DD` dates upstream, so inlining them here is safe. `to` is treated
 * as inclusive of the whole day via `< to + 1 day`.
 */
function rangeClause(rp: RangeParams, col = "occurred_at"): string {
  if (rp.range === "custom") {
    const parts: string[] = [];
    if (rp.from) parts.push(`${col} >= '${rp.from}'::date`);
    if (rp.to) parts.push(`${col} < ('${rp.to}'::date + interval '1 day')`);
    return parts.length ? parts.join(" and ") : "true";
  }
  if (rp.range === "7d") return `${col} >= now() - interval '7 days'`;
  if (rp.range === "30d") return `${col} >= now() - interval '30 days'`;
  return "true";
}

/**
 * SQL fragment restricting to a single A/B/C/D variant. Returns `""` for
 * "all". Newer analytics rows store variant as a top-level column; keep the
 * JSON fallback so older rows that only carried it in properties still count.
 * `variant` is validated upstream to one of a/b/c/d, so inlining the literal
 * here is safe (no untrusted input reaches the query string).
 */
function variantClause(variant: Variant): string {
  if (variant === "all") return "";
  return ` and coalesce(variant::text, properties->>'variant') = '${variant}'`;
}

/**
 * `chat_messages` is a normalized table and does not carry the analytics
 * event's variant column. Attribute chat conversations to a variant through
 * the same visitor's event rows.
 */
function chatVariantClause(variant: Variant): string {
  if (variant === "all") return "";
  return `
    and exists (
      select 1
      from events e
      where e.visitor_id = cm.visitor_id
        and coalesce(e.variant::text, e.properties->>'variant') = '${variant}'
    )`;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getKpis(
  project: Project,
  rp: RangeParams,
  variant: Variant = "all",
): Promise<Kpis> {
  const where = rangeClause(rp) + variantClause(variant);
  const rows = await query<{
    unique_visitors: string;
    sessions: string;
    signups: string;
    signins: string;
    pay_intent: string;
    feedback_opened: string;
    feedback: string;
    alerts_created: string;
    email_subscribed: string;
    avg_duration: string | null;
  }>(
    project,
    `
    select
      count(distinct visitor_id)                                          as unique_visitors,
      count(*) filter (where event_name = 'session_start')                as sessions,
      count(*) filter (where event_name = 'signup_completed')             as signups,
      count(*) filter (where event_name = 'signin_completed')             as signins,
      count(*) filter (where event_name = 'pay_intent')                   as pay_intent,
      count(*) filter (where event_name = 'feedback_opened')              as feedback_opened,
      count(*) filter (where event_name = 'feedback_submitted')           as feedback,
      count(*) filter (where event_name = 'alert_created')                as alerts_created,
      count(*) filter (where event_name = 'email_subscribed')             as email_subscribed,
      avg((properties->>'durationMs')::numeric)
        filter (where event_name = 'session_end')                         as avg_duration
    from events
    where ${where}
    `,
  );

  const chatRows = await query<{ chat_sessions: string }>(
    project,
    `
    select count(distinct cm.conversation_id) as chat_sessions
    from chat_messages cm
    where ${rangeClause(rp, "cm.created_at")}${chatVariantClause(variant)}
    `,
  );

  const r = rows[0] ?? ({} as Record<string, string>);
  return {
    uniqueVisitors: num(r.unique_visitors),
    sessions: num(r.sessions),
    signups: num(r.signups),
    signins: num(r.signins),
    payIntent: num(r.pay_intent),
    feedbackOpened: num(r.feedback_opened),
    feedback: num(r.feedback),
    alertsCreated: num(r.alerts_created),
    emailSubscribed: num(r.email_subscribed),
    avgSessionDurationMs: r.avg_duration == null ? null : num(r.avg_duration),
    chatSessions: num(chatRows[0]?.chat_sessions),
  };
}

export async function getTopEvents(
  project: Project,
  rp: RangeParams,
  variant: Variant = "all",
): Promise<NameCount[]> {
  const rows = await query<{ event_name: string; count: string }>(
    project,
    `
    select event_name, count(*) as count
    from events
    where ${rangeClause(rp)}${variantClause(variant)}
    group by event_name
    order by count desc
    limit 15
    `,
  );
  return rows.map((r) => ({ name: r.event_name, count: num(r.count) }));
}

export async function getEventsOverTime(
  project: Project,
  rp: RangeParams,
  variant: Variant = "all",
): Promise<EventsOverTime> {
  const where = rangeClause(rp) + variantClause(variant);

  const topRows = await query<{ event_name: string }>(
    project,
    `
    select event_name from events
    where ${where}
    group by event_name order by count(*) desc limit 5
    `,
  );
  const topEvents = topRows.map((r) => r.event_name);

  const rows = await query<{
    day: string;
    event_name: string;
    count: string;
  }>(
    project,
    `
    select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as day,
           event_name,
           count(*) as count
    from events
    where ${where}
    group by 1, 2
    order by 1
    `,
  );

  const byDay = new Map<string, TimePoint>();
  for (const r of rows) {
    const day = r.day;
    let pt = byDay.get(day);
    if (!pt) {
      pt = { date: day, total: 0 };
      for (const e of topEvents) pt[e] = 0;
      byDay.set(day, pt);
    }
    const c = num(r.count);
    pt.total = num(pt.total) + c;
    if (topEvents.includes(r.event_name)) {
      pt[r.event_name] = num(pt[r.event_name]) + c;
    }
  }

  return {
    points: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    topEvents,
  };
}

export async function getFunnel(
  project: Project,
  rp: RangeParams,
  variant: Variant = "all",
): Promise<FunnelStep[]> {
  const steps: { key: string; label: string }[] = [
    { key: "session_start", label: "Session start" },
    { key: "points_entered", label: "Points entered" },
    { key: "gate_unlock_clicked", label: "Gate unlock" },
    { key: "signup_completed", label: "Signup" },
    { key: "pay_intent", label: "Pay intent" },
  ];
  const rows = await query<{ event_name: string; count: string }>(
    project,
    `
    select event_name, count(*) as count
    from events
    where ${rangeClause(rp)} and event_name = any($1)${variantClause(variant)}
    group by event_name
    `,
    [steps.map((s) => s.key)],
  );
  const counts = new Map(rows.map((r) => [r.event_name, num(r.count)]));
  return steps.map((s) => ({ step: s.label, count: counts.get(s.key) ?? 0 }));
}

export async function getEngagement(
  project: Project,
  rp: RangeParams,
  variant: Variant = "all",
): Promise<Engagement> {
  const where = rangeClause(rp) + variantClause(variant);

  const scroll = await query<{ pct: string; count: string }>(
    project,
    `
    select properties->>'pct' as pct, count(*) as count
    from events
    where ${where} and event_name = 'scroll_depth'
      and properties->>'pct' is not null
    group by 1 order by (properties->>'pct')::numeric
    `,
  );

  const durations = await query<{ bucket: string; count: string }>(
    project,
    `
    select case
        when ms < 10000 then '0-10s'
        when ms < 30000 then '10-30s'
        when ms < 60000 then '30-60s'
        when ms < 180000 then '1-3m'
        when ms < 600000 then '3-10m'
        else '10m+'
      end as bucket,
      count(*) as count
    from (
      select (properties->>'durationMs')::numeric as ms
      from events
      where ${where} and event_name = 'session_end'
        and properties->>'durationMs' is not null
    ) s
    group by 1
    `,
  );

  const order = ["0-10s", "10-30s", "30-60s", "1-3m", "3-10m", "10m+"];
  return {
    scrollDepth: scroll.map((r) => ({ name: `${r.pct}%`, count: num(r.count) })),
    durationBuckets: durations
      .map((r) => ({ name: r.bucket, count: num(r.count) }))
      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)),
  };
}

export async function getMonetization(
  project: Project,
  rp: RangeParams,
  variant: Variant = "all",
): Promise<Monetization> {
  const where = rangeClause(rp) + variantClause(variant);

  const wouldPay = await query<{ would_pay: string; count: string }>(
    project,
    `
    select coalesce(properties->>'wouldPay', 'unknown') as would_pay, count(*) as count
    from events
    where ${where} and event_name in ('pay_intent', 'feedback_submitted')
    group by 1 order by count desc
    `,
  );

  const price = await query<{ bucket: string; count: string }>(
    project,
    `
    select properties->>'monthlyPrice' as bucket, count(*) as count
    from events
    where ${where} and event_name in ('pay_intent', 'feedback_submitted')
      and properties->>'monthlyPrice' is not null
    group by 1 order by count desc limit 12
    `,
  );

  return {
    wouldPay: wouldPay.map((r) => ({ name: r.would_pay, count: num(r.count) })),
    monthlyPrice: price.map((r) => ({ name: r.bucket, count: num(r.count) })),
  };
}

export async function getDiscovery(
  project: Project,
  rp: RangeParams,
  variant: Variant = "all",
): Promise<Discovery> {
  const where = rangeClause(rp) + variantClause(variant);

  const interests = await query<{ tag: string; count: string }>(
    project,
    `
    select properties->>'tag' as tag, count(*) as count
    from events
    where ${where} and event_name = 'interest_toggled' and properties->>'tag' is not null
    group by 1 order by count desc limit 12
    `,
  );

  const pins = await query<{ dest: string; count: string }>(
    project,
    `
    select properties->>'destId' as dest, count(*) as count
    from events
    where ${where} and event_name = 'map_pin_clicked' and properties->>'destId' is not null
    group by 1 order by count desc limit 12
    `,
  );

  const trips = await query<{ dest: string; count: string }>(
    project,
    `
    select properties->>'destId' as dest, count(*) as count
    from events
    where ${where} and event_name = 'trip_modal_opened' and properties->>'destId' is not null
    group by 1 order by count desc limit 12
    `,
  );

  return {
    interests: interests.map((r) => ({ name: r.tag, count: num(r.count) })),
    mapPins: pins.map((r) => ({ name: r.dest, count: num(r.count) })),
    tripModals: trips.map((r) => ({ name: r.dest, count: num(r.count) })),
  };
}

export async function getChatSessions(
  project: Project,
  rp: RangeParams,
  variant: Variant,
  { page, pageSize, search }: { page: number; pageSize: number; search?: string },
): Promise<ChatSessionsPage> {
  const offset = Math.max(0, (page - 1) * pageSize);
  const hasSearch = Boolean(search?.trim());
  const params: unknown[] = [];
  let filter = `where ${rangeClause(rp, "cm.created_at")}${chatVariantClause(variant)}`;
  if (hasSearch) {
    params.push(`%${search!.trim()}%`);
    filter += ` and (cm.user_id::text ilike $${params.length} or cm.visitor_id::text ilike $${params.length})`;
  }

  const totalRows = await query<{ total: string }>(
    project,
    `select count(distinct cm.conversation_id) as total from chat_messages cm ${filter}`,
    params,
  );

  const limitParams = [...params, pageSize, offset];
  const rows = await query<{
    conversation_id: string;
    user_id: string | null;
    visitor_id: string | null;
    message_count: string;
    first_at: string;
    last_at: string;
    last_snippet: string | null;
  }>(
    project,
    `
    select
      cm.conversation_id,
      max(cm.user_id::text)    as user_id,
      max(cm.visitor_id::text) as visitor_id,
      count(*)              as message_count,
      min(cm.created_at)       as first_at,
      max(cm.created_at)       as last_at,
      (array_agg(cm.content order by cm.created_at desc))[1] as last_snippet
    from chat_messages cm
    ${filter}
    group by cm.conversation_id
    order by last_at desc
    limit $${limitParams.length - 1} offset $${limitParams.length}
    `,
    limitParams,
  );

  const mapped: ChatSessionRow[] = rows.map((r) => ({
    conversationId: r.conversation_id,
    userId: r.user_id,
    visitorId: r.visitor_id,
    messageCount: num(r.message_count),
    firstMessageAt: new Date(r.first_at).toISOString(),
    lastMessageAt: new Date(r.last_at).toISOString(),
    lastSnippet: r.last_snippet ? r.last_snippet.slice(0, 140) : null,
  }));

  return {
    rows: mapped,
    total: num(totalRows[0]?.total),
    page,
    pageSize,
  };
}

export async function getFeedbackSubmissions(
  project: Project,
  rp: RangeParams,
  variant: Variant,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<FeedbackSubmissionsPage> {
  const offset = Math.max(0, (page - 1) * pageSize);
  const where = rangeClause(rp) + variantClause(variant);

  const totalRows = await query<{ total: string }>(
    project,
    `select count(*) as total from events where ${where} and event_name = 'feedback_submitted'`,
  );

  const rows = await query<{
    occurred_at: string;
    visitor_id: string | null;
    variant: string | null;
    context: string | null;
    liked: string | null;
    disliked: string | null;
    helps: string | null;
    would_pay: string | null;
    monthly_price: string | null;
  }>(
    project,
    `
    select
      occurred_at,
      visitor_id::text                   as visitor_id,
      properties->>'variant'             as variant,
      properties->>'context'             as context,
      properties->>'liked'               as liked,
      properties->>'disliked'            as disliked,
      properties->>'helps'               as helps,
      properties->>'wouldPay'            as would_pay,
      properties->>'monthlyPrice'        as monthly_price
    from events
    where ${where} and event_name = 'feedback_submitted'
    order by occurred_at desc
    limit $1 offset $2
    `,
    [pageSize, offset],
  );

  const mapped: FeedbackSubmission[] = rows.map((r, i) => ({
    id: `${new Date(r.occurred_at).toISOString()}#${r.visitor_id ?? "anon"}#${offset + i}`,
    createdAt: new Date(r.occurred_at).toISOString(),
    visitorId: r.visitor_id,
    variant: r.variant,
    context: r.context,
    liked: r.liked,
    disliked: r.disliked,
    helps: r.helps,
    wouldPay: r.would_pay,
    monthlyPrice: r.monthly_price,
  }));

  return {
    rows: mapped,
    total: num(totalRows[0]?.total),
    page,
    pageSize,
  };
}

export async function getChatTranscript(
  project: Project,
  conversationId: string,
): Promise<ChatMessage[]> {
  const rows = await query<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>(
    project,
    `
    select id::text as id, role, content, created_at
    from chat_messages
    where conversation_id = $1
    order by created_at asc
    `,
    [conversationId],
  );
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
