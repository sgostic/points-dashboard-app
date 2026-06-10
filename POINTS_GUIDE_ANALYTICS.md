# Analytics & activity-event tracking

How this app records what visitors do on the landing-page A/B test. Ported from
the sibling repo `my-points-butler`; the two share an **identical event
taxonomy** (keep them in sync).

## TL;DR

- Every meaningful action becomes a row in the Postgres `events` table
  (append-only). High-value records are also written to a normalized table
  (`feedback_submissions`, `email_subscriptions`, `contact_messages`,
  `donations`, `chat_messages`).
- The browser never writes Supabase directly. It buffers events and POSTs
  batches to `app/api/track/route.ts`, which writes with the **service-role**
  key. RLS is locked down (no public read/write).
- Anonymous visitors are identified by a durable `pb_vid` cookie; on sign-in the
  visitor row links to `auth.users`.

## Pieces

| Concern                                              | File                                     |
| ---------------------------------------------------- | ---------------------------------------- |
| Schema (tables, enums, RLS)                          | `supabase/migrations/0001_analytics.sql` |
| Canonical event names + types                        | `lib/analytics/events.ts`                |
| Browser `track()` + batching + helpers               | `lib/analytics/client.ts`                |
| Auto-capture provider                                | `lib/analytics/provider.tsx`             |
| Public re-exports                                    | `lib/analytics/index.ts`                 |
| Ingest endpoint (service-role)                       | `app/api/track/route.ts`                 |
| Service-role client                                  | `lib/supabase/admin.ts`                  |
| Config (`isSupabaseConfigured`, `getServiceRoleKey`) | `lib/supabase/config.ts`                 |
| Visitor cookie minting                               | `lib/supabase/proxy.ts`                  |
| Provider mount                                       | `app/layout.tsx`                         |

> **Keep in sync:** the `event_name` enum in the SQL migration and the `EVENTS`
> map in `lib/analytics/events.ts` are one contract — add an event in both (and
> keep it identical across both repos).

## Identity & sessions

- **`visitor_id`** — minted in `lib/supabase/proxy.ts`. `pb_vid` (HTTP-only,
  authoritative server-side) + `pb_vid_pub` (JS-readable mirror). ~2yr.
- **`session_id`** — minted client-side in `sessionStorage` (`pb_sid`). Drives
  time-on-page (`session_start` → `session_end`).
- **`user_id`** — resolved server-side from the session cookie and back-filled.

## Where events fire (this repo)

Components live in `components/subpages/` (`VariantA–D.tsx` + `shared.tsx`).

**Auto (provider):** `page_view`, `session_start`, `session_end`, `scroll_depth`.

**Wired into existing UI:**
| Event | Fire site (`components/subpages/`) | Payload |
| --- | --- | --- |
| `auth_modal_opened` | `shared.tsx` `useAuth.openAuthModal` | `{ mode }` |
| `signup_completed` / `signin_completed` | `shared.tsx` `handleEmailAuth` | `{ method:"email" }` |
| `signout_completed` | `shared.tsx` `handleSignOut` | `{}` |
| `gate_unlock_clicked` | `shared.tsx` `LockedRecommendations` button | `{ gateContext:"locked_recommendations" }` |
| `feedback_submitted` (+ `pay_intent`) | `shared.tsx` `FeedbackModal.submitFeedback` → `feedback_submissions` | `{ context, liked, disliked, helps, wouldPay, monthlyPrice }` |
| `share_clicked` | `shared.tsx` `ShareButton.handleShare` | `{ method:"web_share"\|"copy" }` |
| `cta_clicked` | row-action "Choose…/Track this perk" (all variants); VariantC hero submit | `{ variant, label, context }` |
| `result_tab_switched` | VariantA trip-type filter | `{ variant:"a", tab }` |
| `result_filtered` | A emphasis/sort; B category/goal; C destination/sort; D filter/sort | `{ variant, control, value }` |
| `fits_only_toggled` | VariantC "Can book now" | `{ variant:"c", on }` |
| `points_entered` | VariantC `handleBalanceChange` (debounced) | `{ field:"balance", value, variant:"c" }` |

**Chatbot (server-side):** `app/api/chat/route.ts` persists each turn (user
prompt + assistant reply, including refusals) into `chat_messages` via
`persistChatTurn()` — resolves `visitor_id` from the `pb_vid` cookie and
`user_id` from the session; `conversation_id` comes from `body.conversationId`
or a generated UUID. Best-effort; never breaks the chat response.

## Defined but unwired (ready for future features)

`card_added/removed`, `goal_added/removed/reordered`, `interest_toggled`,
`map_pin_clicked`, `trip_modal_opened`, `verdict_viewed`, `alert_created`,
`email_subscribed`, `contact_submitted`, `donate_clicked`, `chat_opened`,
`variant_switched` have no UI here yet. Tables, ingest routing, and `track*`
helpers (`trackSubscribe`, `trackContact`, `trackDonateIntent`,
`trackChatOpened`, etc.) already exist — just call the helper when the UI is
built. When `app/value-chat.tsx` is re-enabled, send a stable `conversationId`
and call `trackChatOpened()`.

## Adding a new event

1. Add the name to the `event_name` enum in `supabase/migrations/0001_analytics.sql`.
2. Add it to `EVENTS` in `lib/analytics/events.ts`.
3. If it needs a normalized table, add a case to `projectionFor()` in `app/api/track/route.ts`.
4. Call `track(EVENTS.NEW_ONE, { ... })` from the handler.

## Environment

The route needs a service-role key (server-only, no `NEXT_PUBLIC_`):
`SUPABASE_SERVICE_ROLE_KEY` (or `STORAGE_SUPABASE_SERVICE_ROLE_KEY`). Without it,
`/api/track` accepts and drops batches (`204`).

## Applying the schema

Run `supabase/migrations/0001_analytics.sql` in the Supabase SQL editor.
