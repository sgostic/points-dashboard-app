"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { EventLegendEntry } from "@/lib/dashboard/types";

/**
 * Plain-language reference for every tracked event surfaced in the dashboard.
 * Sourced from POINTS_GUIDE_EVENT_LIST.md / POINTS_BUTLER_EVENT_LIST.md.
 */
const LEGEND: { group: string; entries: EventLegendEntry[] }[] = [
  {
    group: "Sessions & traffic",
    entries: [
      { event: "page_view", label: "Page view", description: "Fires on every page load, tagged with the active variant (A–D)." },
      { event: "session_start", label: "Session start", description: "First load of a tab session — a new visitor sitting." },
      { event: "session_end", label: "Session end", description: "Tab hidden or closed; carries the session's total duration." },
      { event: "scroll_depth", label: "Scroll depth", description: "Reader crossed a 25 / 50 / 75 / 100% scroll threshold on the page." },
    ],
  },
  {
    group: "Auth & gating",
    entries: [
      { event: "auth_modal_opened", label: "Auth modal opened", description: "The sign-in / sign-up modal was opened." },
      { event: "signup_completed", label: "Signup", description: "A visitor finished creating an account." },
      { event: "signin_completed", label: "Signin", description: "An existing user signed back in." },
      { event: "signout_completed", label: "Signout", description: "A user signed out." },
      { event: "gate_unlock_clicked", label: "Gate unlock", description: "Visitor clicked a locked feature (e.g. locked recommendations or deal modal) to unlock it." },
    ],
  },
  {
    group: "Feedback & monetization",
    entries: [
      { event: "feedback_submitted", label: "Feedback", description: "Feedback modal submitted — includes like/dislike, would-pay and price answers." },
      { event: "pay_intent", label: "Pay intent", description: "Feedback indicated willingness to pay (would-pay ≠ \"no\") — a monetization signal, not an actual charge." },
      { event: "email_subscribed", label: "Email subscribed", description: "Visitor subscribed via an alert / email CTA." },
      { event: "alert_created", label: "Alert created", description: "Visitor set up a price / availability alert." },
    ],
  },
  {
    group: "Discovery & filtering",
    entries: [
      { event: "points_entered", label: "Points entered", description: "Visitor typed a balance / points / spend value into an input (debounced)." },
      { event: "interest_toggled", label: "Interest toggled", description: "A discovery interest tag was switched on or off." },
      { event: "map_pin_clicked", label: "Map pin clicked", description: "A world-map destination pin was clicked." },
      { event: "trip_modal_opened", label: "Trip modal opened", description: "A destination's trip detail modal was opened." },
      { event: "verdict_viewed", label: "Verdict viewed", description: "A per-destination verdict (tone + net %) was shown." },
      { event: "result_tab_switched", label: "Result tab switched", description: "Visitor switched a results tab (e.g. flights/hotels, trip-type)." },
      { event: "result_filtered", label: "Result filtered", description: "Visitor changed a sort or filter control on the results." },
      { event: "fits_only_toggled", label: "Fits-only toggled", description: "Variant C's \"can book now\" filter was toggled." },
      { event: "cta_clicked", label: "CTA clicked", description: "A call-to-action (row action or hero submit) was clicked." },
      { event: "share_clicked", label: "Share clicked", description: "Visitor shared via the web share sheet or copy link." },
    ],
  },
  {
    group: "Chat",
    entries: [
      { event: "chat_opened", label: "Chat opened", description: "The chatbot launcher was opened." },
      { event: "chat_message", label: "Chat message", description: "A chat turn was persisted (user + assistant rows in chat_messages)." },
    ],
  },
];

export function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={open}
        >
          <CardTitle className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            Legend — what each event means
          </CardTitle>
          <ChevronDown className={cn("h-4 w-4 text-ink-secondary transition-transform", open && "rotate-180")} />
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-3 space-y-4">
          {LEGEND.map((section) => (
            <div key={section.group}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                {section.group}
              </h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {section.entries.map((e) => (
                  <div key={e.event} className="flex flex-col">
                    <dt className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-brand-ink">{e.label}</span>
                      <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px] text-ink-secondary">
                        {e.event}
                      </code>
                    </dt>
                    <dd className="text-xs text-ink-secondary">{e.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
