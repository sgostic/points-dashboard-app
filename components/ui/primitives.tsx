import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-edge bg-surface-elevated shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold tracking-tight text-brand-ink", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-secondary",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "ghost" | "outline" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none px-3 py-1.5",
        variant === "default" && "bg-cta text-cta-text hover:bg-[#2c1e18]",
        variant === "outline" && "border border-edge-strong text-brand-ink hover:bg-surface-muted",
        variant === "ghost" && "text-brand-ink hover:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
