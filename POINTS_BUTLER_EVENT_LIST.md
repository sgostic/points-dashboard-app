# Event List — my-points-butler

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

### Points / wallet

| Event            | Where                                                      | Payload                     |
| ---------------- | ---------------------------------------------------------- | --------------------------- |
| `points_entered` | A balance, C balance + monthly spend, D points (debounced) | `{ field, value, variant }` |
| `card_added`     | B wallet builder add                                       | `{ type, program, points }` |
| `card_removed`   | B wallet chip remove                                       | `{ id, program, type }`     |

### Goals (variant C)

| Event            | Where                | Payload                           |
| ---------------- | -------------------- | --------------------------------- |
| `goal_added`     | map pin toggle (add) | `{ destId, totalGoals }`          |
| `goal_removed`   | toggle/card ×        | `{ destId, totalGoals }`          |
| `goal_reordered` | up/down arrows       | `{ destId, direction, newIndex }` |

### Discovery / filtering

| Event                 | Where                       | Payload                                 |
| --------------------- | --------------------------- | --------------------------------------- |
| `result_tab_switched` | A & B flights/hotels tabs   | `{ variant, tab, destId }`              |
| `interest_toggled`    | D taste chips               | `{ tag, on, selected }`                 |
| `fits_only_toggled`   | D "only what fits"          | `{ on }`                                |
| `result_filtered`     | D after filters settle      | `{ selected, fitsOnly, resultCount }`   |
| `map_pin_clicked`     | A/B/C world-map pins        | `{ variant, destId, action }`           |
| `trip_modal_opened`   | D trip card open            | `{ destId, cost, affordable, vibePct }` |
| `verdict_viewed`      | A verdict (per destination) | `{ variant, destId, tone, netPct }`     |

### Auth / gating

| Event                 | Where                                                                        | Payload                    |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------- |
| `auth_modal_opened`   | `openAuthModal`                                                              | `{ mode }`                 |
| `gate_unlock_clicked` | PBSignupGate + A locked rows/verdict, B alert gate/locked rows, D deal modal | `{ gateContext, variant }` |
| `signup_completed`    | email sign-up w/ session                                                     | `{ method:"email" }`       |
| `signin_completed`    | email sign-in                                                                | `{ method:"email" }`       |
| `signout_completed`   | sign out                                                                     | `{}`                       |

### Feedback / monetization

| Event                | Where                                   | Payload                                                       |
| -------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `feedback_submitted` | feedback modal → `feedback_submissions` | `{ context, liked, disliked, helps, wouldPay, monthlyPrice }` |
| `pay_intent`         | feedback modal when `wouldPay !== "no"` | `{ wouldPay, monthlyPrice, context }`                         |
| `alert_created`      | B deal-alert CTA                        | `{ destId, email, watching }`                                 |
| `email_subscribed`   | B alert CTA → `email_subscriptions`     | `{ email, source:"alert_cta", variant }`                      |

### Chatbot

| Event               | Where                                         | Payload                             |
| ------------------- | --------------------------------------------- | ----------------------------------- |
| `chat_opened`       | chat launcher open                            | `{ variant }`                       |
| `chat_message_sent` | chat send + assistant reply → `chat_messages` | `{ conversationId, content, role }` |

## Defined but NOT yet wired

Tables, ingest routing, and `track*` helpers exist; no fire site yet:
`cta_clicked`, `variant_switched`, `share_clicked`, `contact_submitted`,
`donate_clicked`.
