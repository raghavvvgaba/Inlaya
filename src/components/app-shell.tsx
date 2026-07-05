"use client"

import type { ReactNode } from "react";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

type AppShellProps = {
  title: string;
  description?: string;
  compactHeader?: boolean;
  contentWidth?: "default" | "full";
  children: ReactNode;
  fullHeight?: boolean;
};

export function AppShell({
  title,
  description,
  compactHeader = false,
  contentWidth = "default",
  children,
  fullHeight = false,
}: AppShellProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 transition-[width,height] ease-linear">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight uppercase">
              {title}
            </h1>
          </div>
        </div>
      </header>
      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col p-6 lg:p-8",
          !fullHeight && "overflow-y-auto",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 w-full flex-1 flex-col",
            !fullHeight && "space-y-8",
            contentWidth === "default" ? "mx-auto max-w-6xl" : "max-w-none",
          )}
        >
          {!compactHeader ? (
            <>
              {description ? (
                <div className="flex flex-col gap-2">
                  <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ) : null}
              <Separator className="bg-border/50" />
            </>
          ) : null}
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              fullHeight && "overflow-hidden",
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
