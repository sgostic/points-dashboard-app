# Analytics & activity-event tracking

How My Points Butler records what visitors do on the landing-page A/B test, so
the next person (or model) picking this up has the full picture without
re-reading the whole tree.

## TL;DR

- Every meaningful action becomes a row in the Postgres `events` table (one
  append-only stream). High-value records are _also_ written to a normalized
  table (`feedback_submissions`, `email_subscriptions`, `contact_messages`,
  `donations`, `chat_messages`).
- The browser **never** writes to Supabase directly. It buffers events and
  POSTs batches to `app/api/track/route.ts`, which writes with the
  **service-role** key. RLS is locked down (no public read/write).
- Anonymous visitors are identified by a durable `pb_vid` cookie; once they
  sign in, the visitor row is linked to `auth.users`.

## Pieces

| Concern                                                            | File                                            |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| Schema (tables, enums, RLS)                                        | `supabase/migrations/0001_analytics.sql`        |
| Canonical event names + types                                      | `lib/analytics/events.ts`                       |
| Browser `track()` + batching + helpers                             | `lib/analytics/client.ts`                       |
| Auto-capture provider (page view, scroll, time-on-page, auth link) | `lib/analytics/provider.tsx`                    |
| Public re-exports                                                  | `lib/analytics/index.ts`                        |
| Ingest endpoint (service-role writes)                              | `app/api/track/route.ts`                        |
| Service-role Supabase client                                       | `lib/supabase/admin.ts`                         |
| Service-role key getter                                            | `lib/supabase/config.ts` (`getServiceRoleKey`)  |
| Visitor cookie minting                                             | `lib/supabase/proxy.ts` (`ensureVisitorCookie`) |
| Provider mount                                                     | `app/layout.tsx`                                |

> **Keep in sync:** the `event_name` enum in the SQL migration and the `EVENTS`
> map in `lib/analytics/events.ts` are two halves of the same contract. Add an
> event to **both** or ingest will reject it (or the insert will fail the enum).

## Identity & sessions

- **`visitor_id`** — minted in `lib/supabase/proxy.ts` middleware on first
  request. Stored twice: `pb_vid` (HTTP-only, authoritative, read server-side
  by the route) and `pb_vid_pub` (JS-readable mirror the client echoes).
  ~2-year lifetime → returning-visitor analysis.
- **`session_id`** — minted client-side in `sessionStorage` (`pb_sid`) via
  `ensureSession()`. Scopes to a tab/session; clears on tab close. Drives
  time-on-page (`session_start` → `session_end` with `durationMs`).
- **`user_id`** — resolved server-side in the route from the Supabase session
  cookie and back-filled onto the visitor + every event. The provider flushes
  on `SIGNED_IN`/`SIGNED_OUT` so the link happens promptly.

## Ingest flow

1. A component calls `track(EVENTS.X, { ... })` (or a typed helper).
2. The client buffers it. It flushes when: the 5s timer fires, the buffer hits
   20 events, the event is "important" (conversions — immediate), or the page
   is hidden/unloaded (via `navigator.sendBeacon`).
3. `POST /api/track` validates the batch, resolves `user_id`, upserts the
   visitor + session rollups, bulk-inserts the raw `events`, and routes
   high-value events into their normalized table. Always responds `204`
   (best-effort; never surfaces errors to the client).

## Event taxonomy

`event_name` — where it fires — payload. Auto = emitted by the provider.

### Auto-captured (provider)

| Event           | Payload                            |
| --------------- | ---------------------------------- |
| `page_view`     | `{ variant }`                      |
| `session_start` | `{ variant, referrer, userAgent }` |
| `session_end`   | `{ durationMs, maxScrollPct }`     |
| `scroll_depth`  | `{ pct: 25\|50\|75\|100 }`         |

### Wired into existing UI

| Event                         | Fire site                                                                                     | Payload                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `points_entered`              | A `PBBalanceInput`; C `PBGoalsEngine` (balance + `monthly_spend`); D `PBTasteBar` (debounced) | `{ field, value, variant }`                                   |
| `card_added`                  | B `PBWalletBuilder.add()`                                                                     | `{ type, program, points }`                                   |
| `card_removed`                | B wallet chip ×                                                                               | `{ id, program, type }`                                       |
| `goal_added` / `goal_removed` | C `onToggle` / card ×                                                                         | `{ destId, totalGoals }`                                      |
| `goal_reordered`              | C `move()`                                                                                    | `{ destId, direction, newIndex }`                             |
| `interest_toggled`            | D `onToggle`                                                                                  | `{ tag, on, selected }`                                       |
| `fits_only_toggled`           | D `onFits`                                                                                    | `{ on }`                                                      |
| `result_filtered`             | D effect on `[selected, fitsOnly]`                                                            | `{ selected, fitsOnly, resultCount }`                         |
| `result_tab_switched`         | A `PBTable` / B `PBMatchTable`                                                                | `{ variant, tab, destId }`                                    |
| `map_pin_clicked`             | A/B `onSelect`, C `onToggle` (via `world-map.tsx`)                                            | `{ variant, destId, action }`                                 |
| `trip_modal_opened`           | D `onOpenTrip`                                                                                | `{ destId, cost, affordable, vibePct }`                       |
| `verdict_viewed`              | A `PBVerdict` effect                                                                          | `{ variant, destId, tone, netPct }`                           |
| `auth_modal_opened`           | `auth.tsx` `openAuthModal`                                                                    | `{ mode }`                                                    |
| `gate_unlock_clicked`         | `PBSignupGate` (generic) + A locked rows/verdict, B alert gate/locked rows, D deal modal      | `{ gateContext, variant }`                                    |
| `signup_completed`            | `auth.tsx` email sign-up w/ session                                                           | `{ method }`                                                  |
| `signin_completed`            | `auth.tsx` email sign-in                                                                      | `{ method }`                                                  |
| `signout_completed`           | `auth.tsx` `handleSignOut`                                                                    | `{}`                                                          |
| `feedback_submitted`          | `feedback-modal.tsx` `submit()` → `feedback_submissions`                                      | `{ context, liked, disliked, helps, wouldPay, monthlyPrice }` |
| `pay_intent`                  | same, when `wouldPay !== "no"`                                                                | `{ wouldPay, monthlyPrice, context }`                         |
| `alert_created`               | B `PBAlertCTA.setAlert()`                                                                     | `{ destId, email, watching }`                                 |
| `email_subscribed`            | B alert CTA (`source: alert_cta`) → `email_subscriptions`                                     | `{ email, source, variant }`                                  |

> Google OAuth sign-up/in completion is intentionally **not** emitted as a
> discrete `signup_completed`/`signin_completed` (would over-count on every
> session restore). The visitor→user link still happens via the provider's
> `SIGNED_IN` flush.

> `variant_switched` exists in the enum but has **no fire site yet** — the nav
> renders no variant-switch links. Wire it when those links are added.

## To wire when the feature is built

These events, tables, and ingest routing already exist. The UI doesn't. When
you build each feature, just call the matching helper from
`lib/analytics` — no schema or route changes needed.

| Feature                     | Helper                                            | Lands in                      |
| --------------------------- | ------------------------------------------------- | ----------------------------- |
| Share button                | `trackShare(method, variant)`                     | `events`                      |
| Email subscribe form        | `trackSubscribe(email, source, variant)`          | `email_subscriptions`         |
| "Email us" contact          | `trackContact(message, email, variant)`           | `contact_messages`            |
| Donate button (intent only) | `trackDonateIntent(amount?, variant)`             | `donations` (status `intent`) |
| Chatbot open                | `trackChatOpened(variant)`                        | `events`                      |
| Chatbot message             | `trackChatMessage(conversationId, content, role)` | `chat_messages`               |

Suggested home: shared client components under `components/pages/` (same
pattern as `feedback-modal.tsx` / `auth.tsx`), mounted per-variant in each
variant's nav/footer, with a `pb-`-prefixed stylesheet.

## Adding a new event

1. Add the name to the `event_name` enum in
   `supabase/migrations/0001_analytics.sql` (and apply it in Supabase).
2. Add it to `EVENTS` in `lib/analytics/events.ts`.
3. If it should land in a normalized table, add a case in `projectionFor()` in
   `app/api/track/route.ts`.
4. Call `track(EVENTS.NEW_ONE, { ... })` from the handler.

## Environment

The route needs a service-role key. Set **one** of (server-only, no
`NEXT_PUBLIC_`): `SUPABASE_SERVICE_ROLE_KEY` or
`STORAGE_SUPABASE_SERVICE_ROLE_KEY`. Without it, `/api/track` accepts and drops
batches (`204`) so the client degrades to a no-op.

## Applying the schema

Run `supabase/migrations/0001_analytics.sql` in the Supabase SQL editor, or
`supabase db push` if the CLI is linked. Verify RLS is on and no rows are
readable with the anon key.
