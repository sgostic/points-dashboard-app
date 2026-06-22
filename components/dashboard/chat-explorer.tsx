"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Search, X, MessageSquare, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Skeleton, Badge } from "@/components/ui/primitives";
import { ChatBubble } from "./chat-bubble";
import { fetchPanel, panelKey, isApiError } from "@/lib/dashboard/api-client";
import { cn } from "@/lib/utils";
import { useDateRangeBounds } from "./date-range-context";
import type { Project, Range, Variant, ChatSessionsPage, ChatSessionRow, ChatMessage } from "@/lib/dashboard/types";

export function ChatExplorer({
  project,
  range,
  variant,
  page,
  search,
  conversationId,
  onSetParams,
}: {
  project: Project;
  range: Range;
  variant: Variant;
  page: number;
  search: string;
  conversationId: string | null;
  onSetParams: (u: Record<string, string | number | null>) => void;
}) {
  const { from, to } = useDateRangeBounds();
  const [searchInput, setSearchInput] = useState(search);
  const pageSize = 25;

  const list = useQuery({
    queryKey: panelKey("chat-sessions", project, range, { variant, page, search, from, to }),
    queryFn: () =>
      fetchPanel<ChatSessionsPage>("chat-sessions", {
        project,
        range,
        variant,
        page,
        pageSize,
        search,
        from,
        to,
      }),
    placeholderData: keepPreviousData,
  });

  const data = list.data && !isApiError(list.data) ? list.data : null;
  const notConfigured = list.data && isApiError(list.data);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    onSetParams({ search: searchInput || null, page: 1 });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Chat sessions
          {data && <Badge>{data.total.toLocaleString()} total</Badge>}
        </CardTitle>
        <form onSubmit={submitSearch} className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-tertiary" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by user / visitor id"
              className="h-8 w-56 rounded-md border border-edge bg-transparent pl-7 pr-2 text-sm outline-none focus:border-edge-strong"
            />
          </div>
          <Button type="submit" variant="outline" className="h-8">Search</Button>
        </form>
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
                <SessionRow
                  key={row.conversationId}
                  row={row}
                  active={row.conversationId === conversationId}
                  onClick={() => onSetParams({ conversationId: row.conversationId })}
                />
              ))
            ) : (
              <div className="py-16 text-center text-sm text-ink-secondary">No chat sessions found.</div>
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
              <Button variant="outline" className="h-8" disabled={page <= 1} onClick={() => onSetParams({ page: page - 1 })}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" className="h-8" disabled={page >= totalPages} onClick={() => onSetParams({ page: page + 1 })}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {conversationId && (
        <TranscriptSheet
          project={project}
          conversationId={conversationId}
          onClose={() => onSetParams({ conversationId: null })}
        />
      )}
    </Card>
  );
}

function SessionRow({ row, active, onClick }: { row: ChatSessionRow; active: boolean; onClick: () => void }) {
  const label = row.userId
    ? row.userId
    : `Anonymous · ${(row.visitorId ?? "unknown").slice(0, 8)}`;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-surface-muted",
        active && "bg-surface-muted",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          <Badge>{row.messageCount} msgs</Badge>
        </div>
        {row.lastSnippet && (
          <p className="truncate text-xs text-ink-secondary mt-0.5">{row.lastSnippet}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-ink-tertiary">
        {formatDistanceToNow(new Date(row.lastMessageAt), { addSuffix: true })}
      </span>
    </button>
  );
}

function TranscriptSheet({
  project,
  conversationId,
  onClose,
}: {
  project: Project;
  conversationId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: panelKey("chat-transcript", project, null, { conversationId }),
    queryFn: () => fetchPanel<ChatMessage[]>("chat-transcript", { project, conversationId }),
  });
  const messages = data && !isApiError(data) ? data : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-brand-ink/40" onClick={onClose} aria-hidden />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-edge bg-surface-elevated shadow-xl">
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Transcript</h3>
            <p className="truncate text-xs text-ink-secondary">{conversationId}</p>
          </div>
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-12", i % 2 ? "w-2/3" : "ml-auto w-1/2")} />
            ))
          ) : isError ? (
            <p className="text-sm text-accent">Failed to load transcript.</p>
          ) : messages.length ? (
            messages.map((m) => <ChatBubble key={m.id} message={m} />)
          ) : (
            <p className="py-12 text-center text-sm text-ink-secondary">No recoverable messages for this session.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
