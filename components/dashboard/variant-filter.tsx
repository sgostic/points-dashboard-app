"use client";

import { cn } from "@/lib/utils";
import { VARIANTS, VARIANT_LABELS, type Variant } from "@/lib/dashboard/types";

export function VariantFilter({
  value,
  onChange,
}: {
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink-secondary">Variant</span>
      <div className="inline-flex rounded-lg border border-edge p-0.5">
        {VARIANTS.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              value === v ? "bg-cta text-cta-text" : "hover:bg-surface-muted",
            )}
          >
            {VARIANT_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  );
}
