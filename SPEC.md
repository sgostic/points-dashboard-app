# SPEC.md — Unified Analytics Dashboard

## Goal

Build a **single dashboard page** that visualizes the analytics events emitted by two
sibling projects: **My Points Guide** and **My Points Butler**. Both projects share an
almost-identical event taxonomy (see `POINTS_BUTLER_ANALYTICS.md` / `POINTS_GUIDE_ANALYTICS.md`, `POINTS_GUIDE_EVENT_LIST.md`, `POINTS_BUTLER_EVENT_LIST.md`) but write to **two
separate Supabase/Postgres databases**.

The page lets the operator switch between the two projects and inspect the data that
actually matters: funnel/conversion health, engagement, monetization intent, and a
**chat-session explorer** (the headline feature).

---

## Tech stack

- **Next.js (App Router)** — single route `app/dashboard/page.tsx` (matches existing `app/` structure). Server Components for data fetching, Client Components for interactivity.
- **Supabase JS client** (`@supabase/supabase-js`), **service-role key**, server-side only. Reuse the pattern in `lib/supabase/admin.ts`. RLS stays locked; all reads go through server actions / route handlers, never the browser.
- **TanStack Query** (`@tanstack/react-query`) — client-side caching, pagination, and request dedup for the chat list and lazy panels.
- **Recharts** — all charts (bar, line, area, funnel via stacked bars, pie/donut). Lightweight, declarative, plays well with React.
- **shadcn/ui + Tailwind** — layout primitives (Tabs, Card, Table, Sheet/Drawer, Skeleton, Badge, ScrollArea, Pagination, Button).
- **date-fns** — timestamp formatting / bucketing.
- **lucide-react** — icons.

> Do **not** add a heavy BI/dashboard framework. Compose with the above.

---

## Two-database architecture

Create **two configured Supabase admin clients**, one per project. Read connection details from env (server-only, no `NEXT_PUBLIC_`):

```
GUIDE_SUPABASE_URL / GUIDE_SUPABASE_SERVICE_ROLE_KEY
BUTLER_SUPABASE_URL / BUTLER_SUPABASE_SERVICE_ROLE_KEY
```

- `lib/dashboard/clients.ts` → `getClient(project: "guide" | "butler")` returns the right admin client.
- Every query function takes `project` as its first arg. The currently selected project is held in URL state (`?project=guide`) so it survives refresh and is shareable.
- Both DBs have the **same schema** (`events` stream + normalized `chat_messages`, `feedback_submissions`, `email_subscriptions`, etc.), so query code is shared; only the client differs.

---

## Page layout

### 1. Project switcher (top of page)

Two **large buttons** side by side: **My Points Guide** and **My Points Butler**.

- Active project is visually highlighted; clicking swaps the whole dashboard's data source (updates `?project=` and refetches via TanStack Query keyed on `project`).
- Show each project's name + a small live stat (e.g. total events last 7d) under the label so the buttons feel alive.

### 2. KPI summary row (cards)

Small stat cards across the top, scoped to a selectable date range (7d / 30d / all — a segmented control):

- **Unique visitors** (`distinct visitor_id`) and **sessions** (`session_start`).
- **Signups** (`signup_completed` + `signin_completed` split).
- **Conversions / monetization**: `pay_intent` count, `feedback_submitted` count, `alert_created`, `email_subscribed`.
- **Avg session duration** (mean `durationMs` from `session_end`).
- **Chat sessions** count (distinct `conversationId` from `chat_messages`).

### 3. Charts grid

The following charts are genuinely valuable and should all be implemented:

- **Conversion funnel** (stacked/funnel bar): `session_start` → `points_entered` → `gate_unlock_clicked` → `signup_completed` → `pay_intent`. Shows drop-off at each step.
- **Events over time** (line/area): daily event volume, with a toggle to break out by top event types.
- **Top events** (horizontal bar): event counts by `event_name`.
- **Engagement depth** (bar): `scroll_depth` distribution (25/50/75/100) and session-duration histogram.
- **Monetization intent** (donut): `pay_intent.wouldPay` breakdown + a small `monthlyPrice` distribution bar.
- **Discovery signals** (bar): top `interest_toggled` tags / `map_pin_clicked` by `destId` / `trip_modal_opened` by `destId`.

Each chart lives in a `Card` with a title, the active date range, and a loading skeleton. Lazy-load panels with TanStack Query so the page paints fast.

### 4. Chat-session explorer (headline feature)

Master/detail layout. **This is the most important section** for both projects.

#### Left — paginated session list

- Query the normalized `chat_messages` table, **grouped by `conversationId`**, listed **by `user_id`** (fall back to `visitor_id` when anonymous).
- Each row shows: `user_id` (or "Anonymous · {short visitor_id}"), message count, first/last message time (relative), and a snippet of the last message.
- **Server-side pagination** (page size ~25). Use keyset/offset pagination via a Postgres view or RPC that returns one row per `conversationId` with aggregates — don't pull all messages to the client. Wire a `Pagination` control + page-state in the URL.
- Optional: search box filtering by `user_id`.

#### Right — chat transcript (Sheet/side panel)

- Clicking a session opens a side panel (shadcn `Sheet`, or an inline detail column on wide screens).
- Fetch all `chat_messages` for that `conversationId`, ordered by timestamp, and render as **chat bubbles**: `role: "user"` right-aligned, `role: "assistant"` left-aligned, with timestamps. Use `ScrollArea`, auto-scroll to top, show sender + time per bubble.
- Loading skeleton while fetching; empty state if a session has no recoverable messages.

---

## Data access layer

Put all query functions in `lib/dashboard/queries.ts`, each accepting `(project, params)`:

- `getKpis(project, range)`
- `getEventsOverTime(project, range)`
- `getTopEvents(project, range)`
- `getFunnel(project, range)`
- `getEngagement(project, range)` — scroll depth + durations
- `getMonetization(project, range)` — pay_intent / feedback aggregates
- `getDiscovery(project, range)` — interest tags, pin/trip destinations
- `getChatSessions(project, { page, pageSize, search })` → one row per `conversationId`
- `getChatTranscript(project, conversationId)` → ordered messages

Prefer SQL aggregation (Postgres `count`, `date_trunc`, `jsonb` extraction on the `payload` column) over fetching raw rows and aggregating in JS. For the session list specifically, create a DB view or `rpc` returning grouped aggregates.

> Reminder: event payloads live in a JSON column. Extract typed fields with `payload->>'field'` and cast as needed (e.g. `(payload->>'monthlyPrice')::numeric`).

Expose these through **server actions** or a `route.ts` handler under `app/dashboard/api/`, so the service-role key never reaches the browser. The client components call those endpoints via TanStack Query.

---

## File structure

```
app/dashboard/page.tsx                    # shell: project switcher + range + grid
app/dashboard/api/[...]/route.ts          # service-role reads (or server actions)
components/dashboard/project-switcher.tsx
components/dashboard/kpi-cards.tsx
components/dashboard/charts/funnel.tsx
components/dashboard/charts/events-over-time.tsx
components/dashboard/charts/top-events.tsx
components/dashboard/charts/engagement.tsx
components/dashboard/charts/monetization.tsx
components/dashboard/charts/discovery.tsx
components/dashboard/chat-explorer.tsx    # list + side panel
components/dashboard/chat-bubble.tsx
lib/dashboard/clients.ts                  # two admin clients
lib/dashboard/queries.ts
lib/dashboard/types.ts
```

---

## Behavior / quality notes

- **URL is the source of truth** for `project`, date `range`, chat `page`, and selected `conversationId` — refresh-safe and shareable.
- Graceful empty/loading/error states everywhere (skeletons, not spinners where possible). A failing query for one panel must not blank the whole page.
- Date range applies to KPIs + charts; chat explorer can ignore it (show all sessions, newest first) unless trivially cheap to scope.
- Keep both projects rendering through the same components — only the client/env differs.
- No writes from this dashboard; reads only.

---

## Out of scope

Auth/login for the dashboard itself, real-time subscriptions, CSV export. Build only the single read-only page described above.
