"use client";

import { Children, useMemo, useState, type ReactNode } from "react";
import { Search, SearchX, X } from "lucide-react";

import type { ProjectIssue } from "~/server/github/issues";

const SEARCH_THRESHOLD = 10;
const PAGE_SIZE = 20;

type ProjectIssueSearchProps = {
  /** One rendered card per issue, in the same order as `issues`. */
  children: ReactNode;
  className?: string;
  issues: Pick<ProjectIssue, "author" | "number" | "title">[];
};

function matchesQuery(
  issue: Pick<ProjectIssue, "author" | "number" | "title">,
  query: string,
) {
  const number = query.startsWith("#") ? query.slice(1) : query;

  return (
    issue.title.toLowerCase().includes(query) ||
    issue.author.toLowerCase().includes(query) ||
    (number.length > 0 && String(issue.number).startsWith(number))
  );
}

export function ProjectIssueSearch({
  children,
  className,
  issues,
}: ProjectIssueSearchProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const cards = Children.toArray(children);
  const showSearch = issues.length > SEARCH_THRESHOLD;
  const normalizedQuery = query.trim().toLowerCase();

  const visibleIndexes = useMemo(() => {
    if (!showSearch || !normalizedQuery) {
      return null;
    }

    return issues.flatMap((issue, index) =>
      matchesQuery(issue, normalizedQuery) ? [index] : [],
    );
  }, [issues, normalizedQuery, showSearch]);

  const matchingCards = visibleIndexes
    ? visibleIndexes.map((index) => cards[index])
    : cards;
  const visibleCards = matchingCards.slice(0, visibleCount);
  const remainingCount = matchingCards.length - visibleCards.length;

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="space-y-4">
      {showSearch ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search issues</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-none border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[#f04f2f] focus-visible:ring-1 focus-visible:ring-[#f04f2f] [&::-webkit-search-cancel-button]:appearance-none"
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search by title, number or author"
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-[#f04f2f]"
                onClick={() => updateQuery("")}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {visibleIndexes
              ? `${visibleIndexes.length} of ${issues.length} open issues match`
              : `${issues.length} open issues`}
          </p>
        </div>
      ) : null}

      {visibleCards.length > 0 ? (
        <div className="space-y-4">
          <div className={className}>{visibleCards}</div>
          {remainingCount > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <button
                className="h-10 border border-border bg-card px-5 text-xs font-semibold transition-colors hover:border-[#f04f2f] hover:text-[#f04f2f]"
                onClick={() =>
                  setVisibleCount((count) => count + PAGE_SIZE)
                }
                type="button"
              >
                Show {Math.min(PAGE_SIZE, remainingCount)} more
              </button>
              <p className="text-xs text-muted-foreground">
                Showing {visibleCards.length} of {matchingCards.length}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-dashed border-border bg-card py-14 text-center">
          <SearchX className="mb-4 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No issues match “{query.trim()}”</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different word, an issue number, or a GitHub username.
          </p>
          <button
            className="mt-4 text-xs font-medium text-[#f04f2f] underline-offset-4 hover:underline"
            onClick={() => updateQuery("")}
            type="button"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
