# Event List — travel-point-rewards

Events currently emitted to Supabase (the `events` stream, plus normalized
projection tables where noted). See `docs/ANALYTICS.md` for the full system.

## Implemented (wired & firing)

### Auto-captured (`lib/analytics/provider.tsx`)

| Event           | When                         | Payload                            |
| --------------- | ---------------------------- | ---------------------------------- |
| `page_view`     | every page load              | `{ variant }`                      |
| `session_start` | first load of a tab session  | `{ variant, referrer, userAgent }` |
| `session_end`   | tab hidden / unload (beacon) | `{ durationMs, maxScrollPct }`     |
| `scroll_depth`  | 25/50/75/100% thresholds     | `{ pct }`                          |

### Auth / gating (`components/subpages/shared.tsx`)

| Event                 | Where                                  | Payload                                    |
| --------------------- | -------------------------------------- | ------------------------------------------ |
| `auth_modal_opened`   | `openAuthModal`                        | `{ mode }`                                 |
| `signup_completed`    | email sign-up w/ session               | `{ method:"email" }`                       |
| `signin_completed`    | email sign-in                          | `{ method:"email" }`                       |
| `signout_completed`   | sign out                               | `{}`                                       |
| `gate_unlock_clicked` | `LockedRecommendations` Sign In button | `{ gateContext:"locked_recommendations" }` |

### Feedback / monetization (`components/subpages/shared.tsx`)

| Event                | Where                                   | Payload                                                       |
| -------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `feedback_submitted` | feedback modal → `feedback_submissions` | `{ context, liked, disliked, helps, wouldPay, monthlyPrice }` |
| `pay_intent`         | feedback modal when `wouldPay !== "no"` | `{ wouldPay, monthlyPrice, context }`                         |

### Sharing

| Event           | Where                     | Payload                          |
| --------------- | ------------------------- | -------------------------------- |
| `share_clicked` | `ShareButton.handleShare` | `{ method:"web_share"\|"copy" }` |

### Discovery / filtering / CTAs (`components/subpages/VariantA–D.tsx`)

| Event                 | Where                                                               | Payload                                   |
| --------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| `cta_clicked`         | row actions ("Choose…"/"Track this perk"), VariantC hero submit     | `{ variant, label, context }`             |
| `result_tab_switched` | VariantA trip-type filter                                           | `{ variant:"a", tab }`                    |
| `result_filtered`     | A emphasis/sort, B category/goal, C destination/sort, D filter/sort | `{ variant, control, value }`             |
| `fits_only_toggled`   | VariantC "Can book now"                                             | `{ variant:"c", on }`                     |
| `points_entered`      | VariantC balance input (debounced)                                  | `{ field:"balance", value, variant:"c" }` |

### Chatbot (server-side, `app/api/chat/route.ts`)

| What                | Where                                               | Notes                                                                                                                                             |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| chat turn persisted | `persistChatTurn()` on every reply (incl. refusals) | Writes **directly to `chat_messages`** (user + assistant rows), not via the `events` stream. Captures `visitor_id`, `user_id`, `conversation_id`. |

## Defined but NOT yet wired

Tables, ingest routing, and `track*` helpers exist; no fire site here yet:
`card_added`, `card_removed`, `goal_added`, `goal_removed`, `goal_reordered`,
`interest_toggled`, `map_pin_clicked`, `trip_modal_opened`, `verdict_viewed`,
`alert_created`, `email_subscribed`, `contact_submitted`, `donate_clicked`,
`chat_opened`, `chat_message_sent` (client event), `variant_switched`.
