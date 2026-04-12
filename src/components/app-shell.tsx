"use client"

import type { ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";
import { Separator } from "~/components/ui/separator";

type AppShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AppShell({ title, description, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-col">
              <h1 className="text-sm font-bold tracking-tight uppercase">
                {title}
              </h1>
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-primary animate-pulse" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                  Session Terminal
                </p>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
            <Separator className="bg-border/50" />
            <div className="flex flex-1 flex-col gap-4">
              {children}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
