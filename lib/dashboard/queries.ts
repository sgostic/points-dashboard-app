import "server-only";
import { query } from "./clients";
import type {
  Project,
  Range,
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
} from "./types";

/** SQL fragment limiting `events.occurred_at` to the selected range. */
function rangeClause(range: Range, col = "occurred_at"): string {
  if (range === "7d") return `${col} >= now() - interval '7 days'`;
  if (range === "30d") return `${col} >= now() - interval '30 days'`;
  return "true";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getKpis(project: Project, range: Range): Promise<Kpis> {
  const where = rangeClause(range);
  const rows = await query<{
    unique_visitors: string;
    sessions: string;
    signups: string;
    signins: string;
    pay_intent: string;
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
    `select count(distinct conversation_id) as chat_sessions from chat_messages`,
  );

  const r = rows[0] ?? ({} as Record<string, string>);
  return {
    uniqueVisitors: num(r.unique_visitors),
    sessions: num(r.sessions),
    signups: num(r.signups),
    signins: num(r.signins),
    payIntent: num(r.pay_intent),
    feedback: num(r.feedback),
    alertsCreated: num(r.alerts_created),
    emailSubscribed: num(r.email_subscribed),
    avgSessionDurationMs: r.avg_duration == null ? null : num(r.avg_duration),
    chatSessions: num(chatRows[0]?.chat_sessions),
  };
}

export async function getTopEvents(
  project: Project,
  range: Range,
): Promise<NameCount[]> {
  const rows = await query<{ event_name: string; count: string }>(
    project,
    `
    select event_name, count(*) as count
    from events
    where ${rangeClause(range)}
    group by event_name
    order by count desc
    limit 15
    `,
  );
  return rows.map((r) => ({ name: r.event_name, count: num(r.count) }));
}

export async function getEventsOverTime(
  project: Project,
  range: Range,
): Promise<EventsOverTime> {
  const where = rangeClause(range);

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
  range: Range,
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
    where ${rangeClause(range)} and event_name = any($1)
    group by event_name
    `,
    [steps.map((s) => s.key)],
  );
  const counts = new Map(rows.map((r) => [r.event_name, num(r.count)]));
  return steps.map((s) => ({ step: s.label, count: counts.get(s.key) ?? 0 }));
}

export async function getEngagement(
  project: Project,
  range: Range,
): Promise<Engagement> {
  const where = rangeClause(range);

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
  range: Range,
): Promise<Monetization> {
  const where = rangeClause(range);

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
  range: Range,
): Promise<Discovery> {
  const where = rangeClause(range);

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
  { page, pageSize, search }: { page: number; pageSize: number; search?: string },
): Promise<ChatSessionsPage> {
  const offset = Math.max(0, (page - 1) * pageSize);
  const hasSearch = Boolean(search?.trim());
  const params: unknown[] = [];
  let filter = "";
  if (hasSearch) {
    params.push(`%${search!.trim()}%`);
    filter = `where user_id::text ilike $${params.length} or visitor_id::text ilike $${params.length}`;
  }

  const totalRows = await query<{ total: string }>(
    project,
    `select count(distinct conversation_id) as total from chat_messages ${filter}`,
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
      conversation_id,
      max(user_id::text)    as user_id,
      max(visitor_id::text) as visitor_id,
      count(*)              as message_count,
      min(created_at)       as first_at,
      max(created_at)       as last_at,
      (array_agg(content order by created_at desc))[1] as last_snippet
    from chat_messages
    ${filter}
    group by conversation_id
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
