"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

type RepositoryOwnerFilterProps = {
  onOwnerChange: (owner: string) => void;
  owners: string[];
  selectedOwner: string;
};

export function RepositoryOwnerFilter({
  onOwnerChange,
  owners,
  selectedOwner,
}: RepositoryOwnerFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Repository owner: ${selectedOwner}`}
          className="h-10 w-full justify-between rounded-none border-border bg-card px-3 text-sm font-medium sm:w-52"
          variant="outline"
        >
          <span className="truncate">{selectedOwner}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52 rounded-none">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Repository owner
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={onOwnerChange}
          value={selectedOwner}
        >
          {owners.map((owner) => (
            <DropdownMenuRadioItem
              className="rounded-none"
              key={owner}
              value={owner}
            >
              {owner}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
