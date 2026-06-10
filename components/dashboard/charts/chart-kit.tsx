"use client";

// Warm, editorial palette harmonized with My Points Guide (teal + coral leads).
export const CHART_COLORS = [
  "#0e5a4a", // deep teal
  "#f96a50", // coral accent
  "#c98a3a", // warm amber
  "#6b5147", // warm brown-grey
  "#4a8c7a", // muted teal
  "#a8516e", // mauve
  "#a89280", // warm light grey
];

export function EmptyState({ label = "No data for this range" }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-ink-tertiary">{label}</div>
  );
}

export const axisProps = {
  tick: { fontSize: 11, fill: "var(--ink-secondary)" },
  stroke: "var(--border)",
};

/** Tooltip value formatter typed loosely enough for Recharts v3's Formatter. */
export const countFormatter = (
  value: number | string | readonly (number | string)[] | undefined,
): [string, string] => {
  const v = Array.isArray(value) ? value[0] : value;
  return [Number(v).toLocaleString(), "Count"];
};

export const tooltipStyle = {
  contentStyle: {
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-elevated)",
    color: "var(--brand-ink)",
  },
  labelStyle: { color: "var(--ink-secondary)" },
};
