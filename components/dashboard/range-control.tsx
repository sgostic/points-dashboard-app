"use client";

import { cn } from "@/lib/utils";
import type { Range } from "@/lib/dashboard/types";

const OPTIONS: { value: Range; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

export function RangeControl({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-edge p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-cta text-cta-text"
              : "hover:bg-surface-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
