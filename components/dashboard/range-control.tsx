"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { rangeLabel } from "@/lib/dashboard/api-client";
import type { Range } from "@/lib/dashboard/types";

export interface RangeSelection {
  range: Range;
  from?: string;
  to?: string;
}

const PRESETS: { value: Range; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

/** Initial values for the custom picker, resolved when it opens. */
interface Draft {
  from: string;
  to: string;
  today: string;
}

export function RangeControl({
  value,
  from,
  to,
  onChange,
}: {
  value: Range;
  from?: string;
  to?: string;
  onChange: (next: RangeSelection) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const isCustom = value === "custom";

  // Resolve "today" and a default 30-day span here, in the click handler, so no
  // impure date call happens during render. Defaults to the current selection.
  function openPicker() {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    setDraft({
      from: from ?? format(new Date(now.getTime() - 29 * 86400000), "yyyy-MM-dd"),
      to: to ?? today,
      today,
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      <div className="inline-flex rounded-lg border border-edge p-0.5">
        {PRESETS.map((o) => (
          <button
            key={o.value}
            onClick={() => {
              setDraft(null);
              onChange({ range: o.value });
            }}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              value === o.value ? "bg-cta text-cta-text" : "hover:bg-surface-muted",
            )}
          >
            {o.label}
          </button>
        ))}
        <button
          onClick={() => (draft ? setDraft(null) : openPicker())}
          aria-expanded={draft != null}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-medium transition-colors",
            isCustom ? "bg-cta text-cta-text" : "hover:bg-surface-muted",
          )}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {isCustom ? rangeLabel(value, from, to) : "Custom"}
        </button>
      </div>

      {draft && (
        <CustomRangePopover
          draft={draft}
          onClose={() => setDraft(null)}
          onApply={(f, t) => {
            setDraft(null);
            onChange({ range: "custom", from: f, to: t });
          }}
        />
      )}
    </div>
  );
}

function CustomRangePopover({
  draft,
  onApply,
  onClose,
}: {
  draft: Draft;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(draft.from);
  const [end, setEnd] = useState(draft.to);
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside click or Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const invalid = !start || !end || start > end;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Select a custom date range"
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-edge bg-surface-elevated p-3 shadow-xl"
    >
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-secondary">From</span>
          <input
            type="date"
            value={start}
            max={end || draft.today}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-md border border-edge-strong bg-surface-elevated px-2 py-1.5 text-sm text-brand-ink"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-secondary">To</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            max={draft.today}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-md border border-edge-strong bg-surface-elevated px-2 py-1.5 text-sm text-brand-ink"
          />
        </label>
        {invalid && start && end && (
          <p className="text-xs text-accent">The start date must be on or before the end date.</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" className="h-8" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-8" disabled={invalid} onClick={() => onApply(start, end)}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
