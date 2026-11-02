"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ExternalLink,
  Github,
  Loader2,
  Lock,
  Plus,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { RepoImportItem } from "~/lib/github-types";
import { Button } from "~/components/ui/button";

type RepositorySearchBarProps = {
  disabled: boolean;
  githubAppInstallUrl: string;
  importedProjects: Record<string, string>;
  /** Rendered before the search input, e.g. an owner picker. */
  leading?: ReactNode;
  onGrantAccess: () => void;
  repositories: RepoImportItem[];
};

export function RepositorySearchBar({
  repositories,
  importedProjects,
  githubAppInstallUrl,
  leading,
  onGrantAccess,
  disabled,
}: RepositorySearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [importingRepo, setImportingRepo] = useState<string | null>(null);

  const handleImport = useCallback(
    async (repoOwner: string, repoName: string, repoFullName: string) => {
      setImportingRepo(repoFullName);

      try {
        const formData = new FormData();
        formData.set("repoOwner", repoOwner);
        formData.set("repoName", repoName);

        const response = await fetch("/api/projects", {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json",
          },
        });

        const result = (await response.json()) as {
          error?: string;
          projectUrl?: string;
        };

        if (!response.ok || result.error || !result.projectUrl) {
          const messages: Record<string, string> = {
            github_required: "Connect GitHub before importing.",
            github_repo_fetch_failed: "Could not fetch repository list.",
            missing_repo_selection: "Choose a repository.",
            refresh_import_session: "Session expired. Refresh access.",
            repo_needs_access: "Grant the GitHub App access first.",
            repo_not_in_session: "Repo not in current session.",
          };

          toast.error(
            result.error ? (messages[result.error] ?? "Import failed.") : "Import failed.",
          );
          setImportingRepo(null);
          return;
        }

        toast.success("Repository imported.");
        router.push(result.projectUrl);
      } catch {
        toast.error("Something went wrong.");
        setImportingRepo(null);
      }
    },
    [router],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const isImporting = importingRepo !== null;
  const filtered = normalizedQuery
    ? repositories.filter((repo) =>
        repo.fullName.toLowerCase().includes(normalizedQuery),
      )
    : repositories;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {leading}
        <label className="relative block flex-1">
          <span className="sr-only">Search repositories</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-none border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[#f04f2f] focus-visible:ring-1 focus-visible:ring-[#f04f2f] disabled:opacity-50 [&::-webkit-search-cancel-button]:appearance-none"
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              disabled ? "No repositories to search" : "Search repositories"
            }
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-[#f04f2f]"
              onClick={() => setQuery("")}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {normalizedQuery
          ? `${filtered.length} of ${repositories.length} repositories match`
          : `${repositories.length} ${repositories.length === 1 ? "repository" : "repositories"}`}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border bg-card py-12 text-center">
          <SearchX className="mb-4 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {normalizedQuery
              ? `No repositories match “${query.trim()}”`
              : "No repositories for this owner"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {normalizedQuery
              ? "Try a different name."
              : "Choose another owner, or give Inlaya access and refresh."}
          </p>
        </div>
      ) : (
        <div className="grid gap-px border border-border bg-border">
          {filtered.map((repo) => {
            const importedProjectId =
              importedProjects[repo.fullName.toLowerCase()];
            const isLocked = !importedProjectId && repo.status !== "ready";

            return (
              <div
                className="group flex items-center justify-between gap-4 bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                key={repo.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center transition-colors ${
                      isLocked
                        ? "bg-muted text-muted-foreground"
                        : "bg-[#171713] text-[#fffaf0] group-hover:bg-[#f04f2f] dark:bg-[#fffaf0] dark:text-[#171713] dark:group-hover:bg-[#f04f2f] dark:group-hover:text-white"
                    }`}
                  >
                    {isLocked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Github className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="text-muted-foreground">
                        {repo.owner}/
                      </span>
                      <span className="font-medium">{repo.name}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {importedProjectId ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          Imported
                        </>
                      ) : isLocked ? (
                        "Needs GitHub access"
                      ) : (
                        "Ready to import"
                      )}
                      {repo.private ? <span>· Private</span> : null}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0">
                  {importedProjectId ? (
                    <Button
                      asChild
                      className="h-9 rounded-none px-4 text-xs font-semibold"
                      variant="outline"
                    >
                      <Link href={`/projects/${importedProjectId}`}>
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : repo.status === "ready" ? (
                    <Button
                      className="h-9 rounded-none px-4 text-xs font-semibold hover:bg-[#f04f2f] hover:text-white"
                      disabled={disabled || isImporting}
                      onClick={() =>
                        handleImport(repo.owner, repo.name, repo.fullName)
                      }
                    >
                      {importingRepo === repo.fullName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {importingRepo === repo.fullName ? "Importing…" : "Import"}
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="h-9 rounded-none px-4 text-xs font-semibold"
                      variant="outline"
                    >
                      <a
                        href={githubAppInstallUrl}
                        onClick={onGrantAccess}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Give access
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
