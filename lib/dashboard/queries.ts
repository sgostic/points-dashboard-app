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
  OnboardingDropoffStep,
  OnboardingEmails,
  OnboardingEmailLead,
  OnboardingQuestionBreakdown,
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

function distinctActorExpr(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `coalesce(${prefix}session_id::text, ${prefix}visitor_id::text)`;
}

const ONBOARDING_QUESTIONS: Record<Project, Array<{ id: string; label: string; options: string[] }>> = {
  guide: [
    { id: "frequency", label: "How many times do you travel a year?", options: ["1 – 2", "3 – 5", "6+"] },
    { id: "companions", label: "Who do you travel with?", options: ["Alone", "Partner", "Family"] },
    {
      id: "rewards",
      label: "Which rewards do you currently have?",
      options: ["Chase", "Amex", "Capital One", "Citi", "Airline miles", "Hotel points", "Not sure", "Other"],
    },
    {
      id: "balance",
      label: "About how many points or miles do you have?",
      options: ["Under 50,000", "50,000 – 150,000", "150,000 – 300,000", "300,000+"],
    },
    { id: "priority", label: "What is your priority?", options: ["Flights", "Hotels", "Cashback", "All above"] },
    {
      id: "challenge",
      label: "What's the hardest part about using your points?",
      options: [
        "Knowing if points are worth using",
        "Choosing cash vs. points",
        "Figuring out where to transfer",
        "Finding the best trip / redemption",
        "Picking the right card to use",
        "Tracking everything",
        "Knowing whether to save points for later",
      ],
    },
  ],
  butler: [
    { id: "travel_frequency", label: "How many times do you travel a year?", options: ["1 – 2", "3 – 5", "6+"] },
    { id: "travel_companions", label: "Who do you travel with?", options: ["Alone", "Partner", "Family"] },
    {
      id: "rewards_held",
      label: "Which rewards do you currently have?",
      options: ["Chase", "Amex", "Capital One", "Citi", "Airline miles", "Hotel points", "Not sure", "Other"],
    },
    {
      id: "points_balance",
      label: "About how many points or miles do you have?",
      options: ["Under 50,000", "50,000 – 150,000", "150,000 – 300,000", "300,000+"],
    },
    { id: "priority", label: "What is your priority?", options: ["Flights", "Hotels", "Cashback", "All above"] },
    {
      id: "hardest_part",
      label: "What's the hardest part about using your points?",
      options: [
        "Knowing if points are worth using",
        "Choosing cash vs. points",
        "Figuring out where to transfer",
        "Finding the best trip / redemption",
        "Picking the right card to use",
        "Tracking everything",
        "Knowing whether to save points for later",
      ],
    },
  ],
};

function normalizeAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("Other:")) return "Other";
  return trimmed;
}

function otherInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("Other:")) return null;

  const input = trimmed.slice("Other:".length).trim();
  return input || null;
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

/**
 * The /start onboarding flows are project-scoped and do not persist the
 * landing-page A/B variant on either the raw events or the normalized email
 * rows. These queries intentionally ignore the dashboard's variant filter.
 */
export async function getOnboardingDropoff(
  project: Project,
  rp: RangeParams,
  _variant: Variant = "all",
): Promise<OnboardingDropoffStep[]> {
  void _variant;
  const where = rangeClause(rp);
  const identity = distinctActorExpr();

  const stepMeta = project === "guide"
    ? await query<{ step_number: string; detail: string | null }>(
        project,
        `
        select
          ((properties->>'stepIndex')::int + 1) as step_number,
          min(properties->>'stepId')            as detail
        from events
        where ${where}
          and event_name = 'onboarding_step_viewed'
          and properties->>'stepIndex' is not null
        group by 1
        order by 1
        `,
      )
    : await query<{ step_number: string; detail: string | null }>(
        project,
        `
        select
          (properties->>'step')::int                                  as step_number,
          min(coalesce(properties->>'questionId', properties->>'question')) as detail
        from events
        where ${where}
          and event_name = 'onboarding_step_viewed'
          and properties->>'step' is not null
        group by 1
        order by 1
        `,
      );

  const stepCompletions = project === "guide"
    ? await query<{ step_number: string; completed: string }>(
        project,
        `
        select
          ((properties->>'stepIndex')::int + 1) as step_number,
          count(distinct ${identity})           as completed
        from events
        where ${where}
          and event_name = 'onboarding_step_answered'
          and properties->>'stepIndex' is not null
        group by 1
        order by 1
        `,
      )
    : await query<{ step_number: string; completed: string }>(
        project,
        `
        select
          (properties->>'step')::int          as step_number,
          count(distinct ${identity})         as completed
        from events
        where ${where}
          and event_name = 'onboarding_question_answered'
          and properties->>'step' is not null
        group by 1
        order by 1
        `,
      );

  const exits = project === "guide"
    ? await query<{ step_number: string; exits: string }>(
        project,
        `
        select
          ((properties->>'stepIndex')::int + 1) as step_number,
          count(distinct ${identity})           as exits
        from events
        where ${where}
          and event_name = 'onboarding_exited'
          and properties->>'stepIndex' is not null
        group by 1
        `,
      )
    : await query<{ step_number: string; exits: string }>(
        project,
        `
        select
          (properties->>'step')::int        as step_number,
          count(distinct ${identity})       as exits
        from events
        where ${where}
          and event_name = 'onboarding_exited'
          and properties->>'step' is not null
        group by 1
        `,
      );

  const completion = await query<{ completed: string; emailed: string; skipped: string }>(
    project,
    `
    select
      count(distinct ${identity}) filter (where event_name = 'onboarding_completed') as completed,
      count(distinct ${identity}) filter (where event_name = 'onboarding_email_submitted') as emailed,
      count(distinct ${identity}) filter (where event_name = 'onboarding_skipped') as skipped
    from events
    where ${where}
      and event_name in ('onboarding_completed', 'onboarding_email_submitted', 'onboarding_skipped')
    `,
  );

  const questions = stepMeta.map((row) => ({
    stepNumber: num(row.step_number),
    detail: row.detail,
  }));
  const completedByStep = new Map(stepCompletions.map((row) => [num(row.step_number), num(row.completed)]));
  const exitsByStep = new Map(exits.map((row) => [num(row.step_number), num(row.exits)]));
  const questionnaireCompleted = num(completion[0]?.completed);
  const emailed = num(completion[0]?.emailed);
  const skipped = num(completion[0]?.skipped);

  const steps: OnboardingDropoffStep[] = questions.map((step) => ({
      stepNumber: step.stepNumber,
      stepLabel: `Step ${step.stepNumber}`,
      detail: step.detail,
      completed: completedByStep.get(step.stepNumber) ?? 0,
      exits: exitsByStep.get(step.stepNumber) ?? 0,
    }));

  if (questions.length > 0 || questionnaireCompleted > 0 || emailed > 0 || skipped > 0) {
    steps.push({
      stepNumber: (questions[questions.length - 1]?.stepNumber ?? 0) + 1,
      stepLabel: "Email",
      detail: "Email capture",
      completed: emailed + skipped,
      exits: 0,
    });
  }

  return steps;
}

export async function getOnboardingEmails(
  project: Project,
  rp: RangeParams,
  _variant: Variant = "all",
): Promise<OnboardingEmails> {
  void _variant;
  const where = `${rangeClause(rp, "created_at")} and source = 'onboarding'`;

  const totals = await query<{ total: string }>(
    project,
    `
    select count(*) as total
    from email_subscriptions
    where ${where}
    `,
  );

  const rows = await query<{ email: string; created_at: string }>(
    project,
    `
    select email, created_at
    from email_subscriptions
    where ${where}
    order by created_at desc, id desc
    `,
  );

  const mapped: OnboardingEmailLead[] = rows.map((row) => ({
    email: row.email,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return {
    total: num(totals[0]?.total),
    rows: mapped,
  };
}

export async function getOnboardingAnswerBreakdowns(
  project: Project,
  rp: RangeParams,
  _variant: Variant = "all",
): Promise<OnboardingQuestionBreakdown[]> {
  void _variant;

  const rows = project === "guide"
    ? await query<{
        actor_id: string;
        question_id: string | null;
        answers: unknown;
      }>(
        project,
        `
        select
          ${distinctActorExpr()} as actor_id,
          properties->>'stepId' as question_id,
          properties->'answers' as answers
        from events
        where ${rangeClause(rp)}
          and event_name = 'onboarding_step_answered'
        `,
      )
    : await query<{
        actor_id: string;
        question_id: string | null;
        answers: unknown;
      }>(
        project,
        `
        select
          ${distinctActorExpr()} as actor_id,
          properties->>'questionId' as question_id,
          properties->'answer' as answers
        from events
        where ${rangeClause(rp)}
          and event_name = 'onboarding_question_answered'
        `,
      );

  const questionDefs = ONBOARDING_QUESTIONS[project];
  const labelByQuestion = new Map(questionDefs.map((question) => [question.id, question.label]));
  const optionOrderByQuestion = new Map(questionDefs.map((question) => [question.id, question.options]));

  const questionRespondents = new Map<string, Set<string>>();
  const answerRespondents = new Map<string, Map<string, Set<string>>>();
  const otherInputRespondents = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    const questionId = row.question_id ?? "";
    if (!labelByQuestion.has(questionId) || !row.actor_id) continue;

    let selections: string[] = [];
    if (Array.isArray(row.answers)) {
      selections = row.answers.map(normalizeAnswer).filter((value): value is string => Boolean(value));
    } else {
      const normalized = normalizeAnswer(row.answers);
      if (normalized) selections = [normalized];
    }

    if (!selections.length) continue;

    const respondentSet = questionRespondents.get(questionId) ?? new Set<string>();
    respondentSet.add(row.actor_id);
    questionRespondents.set(questionId, respondentSet);

    const countsForQuestion = answerRespondents.get(questionId) ?? new Map<string, Set<string>>();
    for (const selection of new Set(selections)) {
      const selectedBy = countsForQuestion.get(selection) ?? new Set<string>();
      selectedBy.add(row.actor_id);
      countsForQuestion.set(selection, selectedBy);
    }
    answerRespondents.set(questionId, countsForQuestion);

    const rawAnswers = Array.isArray(row.answers) ? row.answers : [row.answers];
    const typedOtherInputs = rawAnswers.map(otherInput).filter((value): value is string => Boolean(value));
    if (typedOtherInputs.length) {
      const otherInputsForQuestion = otherInputRespondents.get(questionId) ?? new Map<string, Set<string>>();
      for (const input of new Set(typedOtherInputs)) {
        const enteredBy = otherInputsForQuestion.get(input) ?? new Set<string>();
        enteredBy.add(row.actor_id);
        otherInputsForQuestion.set(input, enteredBy);
      }
      otherInputRespondents.set(questionId, otherInputsForQuestion);
    }
  }

  return questionDefs.map((question) => {
    const respondents = questionRespondents.get(question.id)?.size ?? 0;
    const countsForQuestion = answerRespondents.get(question.id) ?? new Map<string, Set<string>>();
    const otherInputsForQuestion = otherInputRespondents.get(question.id) ?? new Map<string, Set<string>>();
    const optionOrder = optionOrderByQuestion.get(question.id) ?? [];

    const orderedAnswers = [...countsForQuestion.entries()]
      .sort((a, b) => {
        const aIndex = optionOrder.indexOf(a[0]);
        const bIndex = optionOrder.indexOf(b[0]);
        if (aIndex !== -1 || bIndex !== -1) {
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([answer, actors]) => ({
        answer,
        count: actors.size,
        percentage: respondents > 0 ? Math.round((actors.size / respondents) * 100) : 0,
        otherInputs: answer === "Other"
          ? [...otherInputsForQuestion.entries()]
              .map(([name, inputActors]) => ({ name, count: inputActors.size }))
              .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          : undefined,
      }));

    return {
      questionId: question.id,
      questionLabel: question.label,
      responses: respondents,
      answers: orderedAnswers,
    };
  });
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
