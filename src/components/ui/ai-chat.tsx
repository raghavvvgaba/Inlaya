import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  default: "border-border bg-muted/50 text-foreground",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-50",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-50",
  error: "border-red-500/20 bg-red-500/10 text-red-900 dark:text-red-50",
};

function MarkdownMessageBody({
  body,
  isUser,
}: {
  body: string;
  isUser: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 break-words text-xs leading-relaxed",
        isUser ? "text-primary-foreground" : "text-foreground",
        "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4",
        isUser
          ? "[&_a]:text-primary-foreground [&_code]:bg-primary-foreground/20 [&_pre]:bg-primary-foreground/20"
          : "[&_a]:text-primary [&_code]:bg-muted-foreground/20 [&_pre]:bg-muted-foreground/10",
        "[&_code]:rounded-none [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em]",
        "[&_code]:break-words",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:leading-relaxed",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:leading-relaxed",
        "[&_hr]:my-4 [&_hr]:border-border",
        "[&_li]:mb-1 [&_li]:break-words [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_p]:break-words [&_p]:whitespace-pre-wrap [&_p:not(:first-child)]:mt-2",
        "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:rounded-none [&_pre]:border [&_pre]:border-border [&_pre]:p-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-words",
        "[&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
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
        "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-border bg-background dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_28%),linear-gradient(180deg,_rgba(12,12,14,0.98),_rgba(6,6,8,1))] shadow-sm dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-100 dark:opacity-[0.06]" />

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
                <div
                  className={cn(
                    "max-w-[min(42rem,92%)]",
                    isUser
                      ? "rounded-none border border-border bg-primary px-3 py-3 text-primary-foreground shadow-sm sm:px-4"
                      : cn("py-2", tone !== "default" && toneStyles[tone] && "px-3 py-3 border"),
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-full min-w-0 space-y-1">
                      <div>
                        {message.isThinking ? (
                          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                            {message.body.split("\n").filter(Boolean).map((line, index) => (
                              <div key={`${index}-${line}`} className="flex items-center gap-2">
                                <span className="h-1 w-1 shrink-0 rounded-none bg-current opacity-60" />
                                <span>{line}</span>
                              </div>
                            ))}
                            <span className="flex items-center gap-1 pt-1 text-foreground">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-none bg-current [animation-delay:-0.2s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-none bg-current [animation-delay:-0.1s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-none bg-current" />
                            </span>
                          </div>
                        ) : (
                          <MarkdownMessageBody body={message.body} isUser={isUser} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="relative border-t border-border bg-background/80 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className={cn("w-full", fullBleed ? "max-w-none" : "mx-auto max-w-4xl")}>
          {children}
        </div>
      </div>
    </section>
  );
}
