"use client";

import { createContext, useContext } from "react";

/**
 * Custom date bounds (`YYYY-MM-DD`) for the active filter. Provided once at the
 * dashboard root so panels can include them in their fetch params and query
 * keys without every chart having to thread `from`/`to` props. Both are
 * `undefined` unless the selected range is `"custom"`.
 */
export interface DateRangeBounds {
  from?: string;
  to?: string;
}

const DateRangeContext = createContext<DateRangeBounds>({});

export function DateRangeProvider({
  from,
  to,
  children,
}: DateRangeBounds & { children: React.ReactNode }) {
  return <DateRangeContext.Provider value={{ from, to }}>{children}</DateRangeContext.Provider>;
}

export function useDateRangeBounds(): DateRangeBounds {
  return useContext(DateRangeContext);
}
