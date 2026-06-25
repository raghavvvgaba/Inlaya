import type { ReactNode } from "react";
import { Bot, CheckCircle2, Sparkles, TriangleAlert, User2 } from "lucide-react";

import { cn } from "~/lib/utils";

export type AIChatMessage = {
  body: string;
  id: string;
  isThinking?: boolean;
  role: "assistant" | "system" | "user";
  tone?: "default" | "error" | "success" | "warning";
};

type AIChatProps = {
  children: ReactNode;
  className?: string;
  fullBleed?: boolean;
  messages: AIChatMessage[];
};

const toneStyles: Record<NonNullable<AIChatMessage["tone"]>, string> = {
  default: "border-white/10 bg-white/[0.03] text-white",
  success: "border-white/10 bg-white/[0.03] text-white",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-50",
  error: "border-red-500/20 bg-red-500/10 text-red-50",
};

const toneIcons: Record<NonNullable<AIChatMessage["tone"]>, React.ReactNode> = {
  default: <Sparkles className="h-3.5 w-3.5" />,
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
  warning: <TriangleAlert className="h-3.5 w-3.5" />,
  error: <TriangleAlert className="h-3.5 w-3.5" />,
};

function getMessageLabel(message: AIChatMessage) {
  if (message.isThinking) {
    return "Devin";
  }

  if (message.role === "user") {
    return "You";
  }

  if (message.role === "assistant") {
    return "Devin";
  }

  if (message.tone === "error") {
    return "Error";
  }

  if (message.tone === "warning") {
    return "Notice";
  }

  return "System";
}

export function AIChat({
  children,
  className,
  fullBleed = false,
  messages,
}: AIChatProps) {
  return (
    <section
      className={cn(
        "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_28%),linear-gradient(180deg,_rgba(12,12,14,0.98),_rgba(6,6,8,1))] shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.06]" />

      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <div
          className={cn(
            "flex w-full flex-col gap-4",
            fullBleed ? "max-w-none" : "mx-auto max-w-4xl",
          )}
        >
          {messages.map((message) => {
            const isUser = message.role === "user";
            const tone = message.tone ?? "default";

            return (
              <article
                key={message.id}
                className={cn(
                  "flex w-full gap-3",
                  isUser ? "justify-end" : "justify-start",
                )}
              >
                {!isUser ? (
                  <div
                    className={cn(
                      "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                      message.role === "system"
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
                        : "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
                    )}
                  >
                    {message.role === "system" ? (
                      toneIcons[tone]
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                ) : null}

                <div
                  className={cn(
                    "max-w-[min(42rem,92%)] rounded-[1.75rem] border px-4 py-4 sm:px-5",
                    isUser
                      ? "border-white/10 bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.08)]"
                      : toneStyles[tone],
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {isUser ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-black/5 text-black">
                            <User2 className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                        <p
                          className={cn(
                            "text-[11px] font-semibold uppercase tracking-[0.22em]",
                            isUser ? "text-black/55" : "text-white/55",
                          )}
                        >
                          {getMessageLabel(message)}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "whitespace-pre-wrap text-sm leading-7",
                          isUser ? "text-black/90" : "text-white/90",
                        )}
                      >
                        {message.isThinking ? (
                          <span className="flex items-center gap-2">
                            <span>{message.body}</span>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                            </span>
                          </span>
                        ) : (
                          message.body
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-black/40 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className={cn("w-full", fullBleed ? "max-w-none" : "mx-auto max-w-4xl")}>
          {children}
        </div>
      </div>
    </section>
  );
}
