"use client";

import { format } from "date-fns";
import type { Project, Range } from "./types";

/** Short, human-readable label for a range — including a custom from–to span. */
export function rangeLabel(range: Range, from?: string, to?: string): string {
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  if (range === "all") return "All time";
  // custom — `from`/`to` are YYYY-MM-DD; parse as local dates for display.
  const fmt = (d: string) => format(new Date(`${d}T00:00:00`), "MMM d, yyyy");
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  if (to) return `Until ${fmt(to)}`;
  return "Custom range";
}

export type ApiResult<T> = T | { error: string; message?: string };

export function isNotConfigured(v: unknown): v is { error: "not_configured"; message?: string } {
  return Boolean(v) && typeof v === "object" && (v as { error?: string }).error === "not_configured";
}

export function isApiError(v: unknown): v is { error: string; message?: string } {
  return Boolean(v) && typeof v === "object" && "error" in (v as object);
}

export async function fetchPanel<T>(
  fn: string,
  params: Record<string, string | number | undefined>,
): Promise<ApiResult<T>> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const res = await fetch(`/dashboard/api/${fn}?${sp.toString()}`);
  const json = await res.json();
  if (!res.ok && !isNotConfigured(json)) {
    throw new Error(json?.message || json?.error || `Request failed (${res.status})`);
  }
  return json as ApiResult<T>;
}

export function panelKey(
  fn: string,
  project: Project,
  range: Range | null,
  extra?: Record<string, unknown>,
) {
  return ["panel", fn, project, range, extra ?? null];
}
