"use client";

import { HelpCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function ImportGuidePopup() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="How importing works"
          className="h-8 w-8 rounded-none border-border p-0"
          size="icon"
          variant="outline"
        >
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 rounded-none p-5"
        sideOffset={8}
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              How importing works
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              Repositories marked Ready to import can be imported now. For one
              that needs access, give Inlaya access on GitHub, then refresh.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-foreground">
              What you see here
            </h3>
            <ul className="mt-2 space-y-1.5">
              {[
                "Your account repositories are shown by default.",
                "Use the owner dropdown to view organization repositories.",
                "Repositories that need access can't be imported until you give it.",
              ].map((item) => (
                <li
                  className="text-xs leading-relaxed text-foreground/80 flex gap-2"
                  key={item}
                >
                  <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Next
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              Import a ready repository, or give access to one that needs it.
            </p>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
