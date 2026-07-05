"use client";

import React, { createContext, useContext, useState } from "react";
import { PanelLeftOpen } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type SidebarContextType = {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  setIsOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function IssueWorkspaceLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="flex h-screen w-full overflow-hidden bg-background text-sm text-foreground">
        {/* Left Pane */}
        <div
          className={cn(
            "flex flex-col border-r border-border transition-all duration-300 ease-in-out",
            isOpen
              ? "w-[400px] min-w-[350px] max-w-[500px]"
              : "w-0 border-none opacity-0 pointer-events-none overflow-hidden",
          )}
        >
          <div className="flex h-full w-[400px] flex-col">
            {sidebar}
          </div>
        </div>

        {/* Right Pane */}
        <div className="flex min-w-0 flex-1 flex-col relative">
          {!isOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-[72px] z-10 h-6 w-6 shrink-0 rounded-none text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(true)}
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </Button>
          )}
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
