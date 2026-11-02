"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ExternalLink,
  FolderGit2,
  Github,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  fetchImportModalData,
  type ImportModalData,
} from "~/app/(app)/projects/actions";
import { ImportGuidePopup } from "~/components/import-guide-popup";
import { RepositoryOwnerFilter } from "~/components/repository-owner-filter";
import { RepositorySearchBar } from "~/components/repository-search-bar";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";

type NewImportModalProps = {
  defaultOpen?: boolean;
  githubAppInstallUrl: string;
  trigger: React.ReactNode;
};

export function NewImportModal({
  defaultOpen = false,
  githubAppInstallUrl,
  trigger,
}: NewImportModalProps) {
  const [data, setData] = useState<ImportModalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedOwner, setSelectedOwner] = useState("");
  const importAccessOpenedRef = useRef(false);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const wasOpenRef = useRef(false);
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");

  const loadData = useCallback(async (refresh = false) => {
    if (loadPromiseRef.current) {
      return loadPromiseRef.current;
    }

    setIsLoading(true);

    const loadPromise = fetchImportModalData({ refresh })
      .then((result) => {
        setData(result);

        if (result.status === "ready") {
          const owners = Array.from(
            new Set(result.repositories.map((repository) => repository.owner)),
          );
          const preferredOwner =
            owners.find(
              (owner) =>
                owner.toLowerCase() === result.viewerLogin.toLowerCase(),
            ) ??
            owners[0] ??
            "";

          setSelectedOwner((currentOwner) =>
            owners.some(
              (owner) =>
                owner.toLowerCase() === currentOwner.toLowerCase(),
            )
              ? currentOwner
              : preferredOwner,
          );
        }
      })
      .catch(() => {
        setData({
          message:
            "Repositories could not be loaded. Check your connection and try again.",
          status: "error",
        });
      })
      .finally(() => {
        loadPromiseRef.current = null;
        setIsLoading(false);
      });

    loadPromiseRef.current = loadPromise;
    return loadPromise;
  }, []);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      void loadData(
        successParam === "github_connected" ||
          successParam === "import_session_ready",
      );
    }

    wasOpenRef.current = isOpen;
  }, [isOpen, loadData, successParam]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (successParam === "import_session_ready") {
      toast.success(
        "Repository access refreshed. You can import any repo marked Ready.",
        { id: "github-import-session-ready" },
      );
    }

    const url = new URL(window.location.href);
    const shouldReplace =
      url.searchParams.has("error") ||
      url.searchParams.has("newImport") ||
      url.searchParams.has("owner") ||
      successParam === "import_session_ready";

    if (shouldReplace) {
      url.searchParams.delete("error");
      url.searchParams.delete("newImport");
      url.searchParams.delete("owner");

      if (successParam === "import_session_ready") {
        url.searchParams.delete("success");
      }

      window.history.replaceState({}, "", url.toString());
    }
  }, [isOpen, successParam]);

  useEffect(() => {
    function refreshAfterGitHubAccess() {
      if (!isOpen || !importAccessOpenedRef.current) {
        return;
      }

      importAccessOpenedRef.current = false;
      void loadData(true);
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refreshAfterGitHubAccess();
      }
    }

    window.addEventListener("focus", refreshAfterGitHubAccess);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshAfterGitHubAccess);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isOpen, loadData]);

  const readyData = data?.status === "ready" ? data : null;
  const ownerOptions = useMemo(() => {
    if (!readyData) {
      return [];
    }

    return Array.from(
      new Set(readyData.repositories.map((repository) => repository.owner)),
    ).sort((firstOwner, secondOwner) => {
      if (
        firstOwner.toLowerCase() === readyData.viewerLogin.toLowerCase()
      ) {
        return -1;
      }

      if (
        secondOwner.toLowerCase() === readyData.viewerLogin.toLowerCase()
      ) {
        return 1;
      }

      return firstOwner.localeCompare(secondOwner);
    });
  }, [readyData]);
  const filteredRepositories = useMemo(
    () =>
      readyData?.repositories.filter(
        (repository) =>
          repository.owner.toLowerCase() === selectedOwner.toLowerCase(),
      ) ?? [],
    [readyData, selectedOwner],
  );

  function markGitHubAccessOpened() {
    importAccessOpenedRef.current = true;
  }

  const primaryButtonClassName =
    "h-11 rounded-none px-5 text-sm font-semibold hover:bg-[#f04f2f] hover:text-white";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden rounded-none border-border bg-background p-0 sm:max-w-3xl"
        showCloseButton={false}
      >
        <div className="relative flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 pb-5 pt-6">
          <div>
            <DialogTitle className="inlaya-display text-3xl font-medium tracking-[-0.045em]">
              Import a repository
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Pick a repository to work on its open issues.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-[#f04f2f]"
              type="button"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogClose>
          <div className="absolute bottom-[-1px] left-6 h-px w-14 bg-[#f04f2f]" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {!data && isLoading ? (
            <LoadingRepositories />
          ) : data?.status === "github_disconnected" ? (
            <ImportState
              action={
                <Button asChild className={primaryButtonClassName}>
                  <Link href="/onboarding/github">
                    <Github className="h-4 w-4" />
                    Connect GitHub
                  </Link>
                </Button>
              }
              description="Connect your GitHub account before importing repositories."
              title="GitHub isn't connected"
            />
          ) : data?.status === "session_required" ? (
            <ImportState
              action={
                <Button asChild className={primaryButtonClassName}>
                  <a href="/api/github/import-session/start">
                    <Github className="h-4 w-4" />
                    Continue with GitHub
                  </a>
                </Button>
              }
              description="GitHub needs to confirm which repositories Inlaya can list. This access lasts ten minutes."
              title="Confirm repository access"
            />
          ) : data?.status === "error" ? (
            <ImportState
              action={
                <Button
                  className={primaryButtonClassName}
                  disabled={isLoading}
                  onClick={() => void loadData(true)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Try again
                </Button>
              }
              description={data.message}
              icon={<ShieldAlert className="h-5 w-5" />}
              title="Couldn't load repositories"
            />
          ) : readyData ? (
            readyData.repositories.length === 0 ? (
              <ImportState
                description="GitHub didn't return any repositories. Give Inlaya access to a repository, then refresh."
                title="No repositories found"
              />
            ) : (
              <RepositorySearchBar
                disabled={isLoading || filteredRepositories.length === 0}
                githubAppInstallUrl={githubAppInstallUrl}
                importedProjects={readyData.importedProjects}
                key={selectedOwner}
                leading={
                  <RepositoryOwnerFilter
                    onOwnerChange={setSelectedOwner}
                    owners={ownerOptions}
                    selectedOwner={selectedOwner}
                  />
                }
                onGrantAccess={markGitHubAccessOpened}
                repositories={filteredRepositories}
              />
            )
          ) : (
            <LoadingRepositories />
          )}
        </div>

        {readyData ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-6 py-3 text-xs text-muted-foreground">
            <p>
              Missing a repository?{" "}
              <a
                className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 transition-colors hover:text-[#f04f2f] hover:underline"
                href={githubAppInstallUrl}
                onClick={markGitHubAccessOpened}
                rel="noreferrer"
                target="_blank"
              >
                Give Inlaya access on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="flex items-center gap-2">
              <Button
                className="h-8 rounded-none px-3 text-xs font-medium"
                disabled={isLoading}
                onClick={() => void loadData(true)}
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {isLoading ? "Refreshing…" : "Refresh"}
              </Button>
              <ImportGuidePopup />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LoadingRepositories() {
  return (
    <div className="space-y-4" aria-label="Loading repositories">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-48 rounded-none" />
        <Skeleton className="h-10 flex-1 rounded-none" />
      </div>
      <div className="grid gap-px border border-border bg-border">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="flex items-center justify-between gap-4 bg-card px-4 py-3.5"
            key={`repo-loading-${index}`}
          >
            <Skeleton className="h-4 w-1/2 rounded-none" />
            <Skeleton className="h-9 w-24 rounded-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportState({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center bg-muted text-muted-foreground">
        {icon ?? <FolderGit2 className="h-5 w-5" />}
      </div>
      <h3 className="inlaya-display mt-5 text-2xl font-medium tracking-[-0.035em]">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
