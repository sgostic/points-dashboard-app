"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { MessageSquareHeart, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Skeleton, Badge } from "@/components/ui/primitives";
import { fetchPanel, panelKey, isApiError } from "@/lib/dashboard/api-client";
import type { Project, Range, Variant, FeedbackSubmissionsPage, FeedbackSubmission } from "@/lib/dashboard/types";

/** Human-readable question for each feedback input, in display order. */
const QUESTIONS: { key: keyof FeedbackSubmission; question: string }[] = [
  { key: "context", question: "Where in the app was this submitted?" },
  { key: "liked", question: "What did you like?" },
  { key: "disliked", question: "What didn't work or felt missing?" },
  { key: "helps", question: "How would this help you?" },
  { key: "wouldPay", question: "Would you pay for this?" },
  { key: "monthlyPrice", question: "What monthly price feels fair?" },
];

export function FeedbackExplorer({
  project,
  range,
  variant,
}: {
  project: Project;
  range: Range;
  variant: Variant;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FeedbackSubmission | null>(null);
  const pageSize = 25;

  const list = useQuery({
    queryKey: panelKey("feedback-submissions", project, range, { variant, page }),
    queryFn: () =>
      fetchPanel<FeedbackSubmissionsPage>("feedback-submissions", { project, range, variant, page, pageSize }),
    placeholderData: keepPreviousData,
  });

  const data = list.data && !isApiError(list.data) ? list.data : null;
  const notConfigured = list.data && isApiError(list.data);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle className="flex items-center gap-2">
          <MessageSquareHeart className="h-4 w-4" /> Feedback submissions
          {data && <Badge>{data.total.toLocaleString()} total</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notConfigured ? (
          <div className="py-16 text-center text-sm text-ink-secondary">This project is not configured yet.</div>
        ) : (
          <div className="divide-y divide-edge">
            {list.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="my-2 h-12 w-full" />)
            ) : data && data.rows.length ? (
              data.rows.map((row) => (
                <FeedbackRow key={row.id} row={row} onClick={() => setSelected(row)} />
              ))
            ) : (
              <div className="py-16 text-center text-sm text-ink-secondary">No feedback submissions found.</div>
            )}
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-ink-secondary">
              Page {page} of {totalPages}
              {list.isFetching && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {selected && <FeedbackModal submission={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
}

function preview(row: FeedbackSubmission): string | null {
  return row.liked || row.disliked || row.helps || null;
}

function FeedbackRow({ row, onClick }: { row: FeedbackSubmission; onClick: () => void }) {
  const label = row.visitorId ? `Visitor · ${row.visitorId.slice(0, 8)}` : "Anonymous";
  const snippet = preview(row);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-surface-muted"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          {row.variant && <Badge>Variant {row.variant.toUpperCase()}</Badge>}
          {row.context && <Badge>{row.context}</Badge>}
          {row.wouldPay && row.wouldPay !== "no" && <Badge>would pay</Badge>}
        </div>
        {snippet && <p className="truncate text-xs text-ink-secondary mt-0.5">{snippet}</p>}
      </div>
      <span className="shrink-0 text-xs text-ink-tertiary">
        {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
      </span>
    </button>
  );
}

function FeedbackModal({ submission, onClose }: { submission: FeedbackSubmission; onClose: () => void }) {
  const answered = QUESTIONS.filter((q) => {
    const v = submission[q.key];
    return v != null && String(v).trim() !== "";
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-edge bg-surface-elevated shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-edge px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Feedback submission</h3>
            <p className="truncate text-xs text-ink-secondary">
              {format(new Date(submission.createdAt), "MMM d, yyyy · HH:mm")}
              {submission.visitorId ? ` · ${submission.visitorId.slice(0, 12)}` : " · anonymous"}
              {submission.variant ? ` · Variant ${submission.variant.toUpperCase()}` : ""}
            </p>
          </div>
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {answered.length ? (
            answered.map((q) => (
              <div key={q.key} className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">{q.question}</p>
                <p className="whitespace-pre-wrap rounded-lg bg-surface-muted px-3 py-2 text-sm text-brand-ink">
                  {String(submission[q.key])}
                </p>
              </div>
            ))
          ) : (
            <p className="py-12 text-center text-sm text-ink-secondary">
              This submission has no recorded answers.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
