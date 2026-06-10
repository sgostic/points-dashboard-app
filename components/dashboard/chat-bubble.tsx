"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/dashboard/types";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-0.5", isUser ? "items-end" : "items-start")}>
      <div className="flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wide text-ink-tertiary">
        <span>{message.role}</span>
        <span>·</span>
        <span>{format(new Date(message.createdAt), "MMM d, HH:mm")}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "rounded-br-sm bg-cta text-cta-text"
            : "rounded-bl-sm bg-surface-muted",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
