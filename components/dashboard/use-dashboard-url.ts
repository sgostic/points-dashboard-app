"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { isProject, isRange, isVariant, isIsoDate, type Project, type Range, type Variant } from "@/lib/dashboard/types";

export function useDashboardUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const projectParam = sp.get("project");
  const project: Project = isProject(projectParam) ? projectParam : "guide";
  const rangeParam = sp.get("range");
  let range: Range = isRange(rangeParam) ? rangeParam : "30d";
  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const from = isIsoDate(fromParam) ? fromParam : undefined;
  const to = isIsoDate(toParam) ? toParam : undefined;
  // A custom range with no valid bounds is meaningless — treat it as 30d.
  if (range === "custom" && !from && !to) range = "30d";
  const variantParam = sp.get("variant");
  const variant: Variant = isVariant(variantParam) ? variantParam : "all";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const search = sp.get("search") ?? "";
  const conversationId = sp.get("conversationId");

  const setParams = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  return { project, range, from, to, variant, page, search, conversationId, setParams };
}
