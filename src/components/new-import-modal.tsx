"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Database, ExternalLink, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { fetchImportModalData } from "~/app/(app)/dashboard/actions";
import { ImportGuidePopup } from "~/components/import-guide-popup";
import { ImportLoadButton } from "~/components/import-load-button";
import { RepositoryOwnerFilter } from "~/components/repository-owner-filter";
import { RepositorySearchBar } from "~/components/repository-search-bar";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

type NewImportModalProps = {
  trigger: React.ReactNode;
  githubAppInstallUrl: string;
  owner?: string;
  defaultOpen?: boolean;
};

export function NewImportModal({
  trigger,
  githubAppInstallUrl,
  owner,
  defaultOpen = false,
}: NewImportModalProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchImportModalData>> | null>(null);
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");

  const successMessage = successParam === "import_session_ready" 
    ? "Repository access refreshed. You can import any repo marked Ready." 
    : null;

  const loadData = () => {
    startTransition(async () => {
      try {
        const res = await fetchImportModalData(owner);
        setData(res);
      } catch (err) {
        console.error(err);
      }
    });
  };

  useEffect(() => {
    if (isOpen && successMessage) {
      toast.success(successMessage);
      
      // Remove success param from URL so it doesn't fire again on re-open
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("success");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [isOpen, successMessage]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-4xl max-w-4xl overflow-hidden p-0 rounded-none bg-background gap-0 border-border">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <DialogTitle className="text-sm font-bold tracking-tight uppercase">
            Import Repository
          </DialogTitle>
          <DialogClose asChild>
            <button className="text-muted-foreground transition hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogClose>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {isPending && !data ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border bg-muted/10">
              <Database className="h-8 w-8 text-muted-foreground/30 mb-4 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Loading Repositories...
              </p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border bg-muted/10">
              <Database className="h-8 w-8 text-muted-foreground/30 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Repositories Not Loaded
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground uppercase max-w-[240px] leading-relaxed mb-6">
                Click the button below to fetch your GitHub repositories.
              </p>
              <Button onClick={loadData} className="bg-primary text-primary-foreground font-bold uppercase text-[10px] tracking-widest h-12 rounded-none px-8">
                Load Repositories
              </Button>
            </div>
          ) : data ? (
            <>
              {data.error && (
                <Alert variant="destructive" className="rounded-none border-destructive/20 bg-destructive/10">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <AlertTitle className="text-[10px] font-bold uppercase tracking-widest">Session Error</AlertTitle>
                  <AlertDescription className="text-xs font-medium uppercase mt-2">
                    {data.error === "github_required" ? (
                      <div className="space-y-4">
                        <p>Connect GitHub before importing.</p>
                        <Button asChild variant="destructive" className="h-10 rounded-none px-6 text-[10px] font-bold uppercase tracking-widest">
                          <Link href="/onboarding/github">
                            Connect GitHub
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      data.error
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <ImportLoadButton
                  hasSession={!!data.hasSession}
                  href="/api/github/import-session/start"
                  onRefresh={loadData}
                />
                <Button asChild variant="outline" className="border-border font-bold uppercase text-[10px] tracking-widest h-12 rounded-none px-8">
                  <a href={githubAppInstallUrl} rel="noreferrer" target="_blank">
                    Grant Access
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </a>
                </Button>
                <ImportGuidePopup />
              </div>

              {!data.filteredRepos || data.filteredRepos.length === 0 && !data.ownerOptions?.length ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-border bg-muted/10 py-24 text-center">
                  <Database className="h-8 w-8 text-muted-foreground/30 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {data.hasSession ? "Repositories Unavailable" : "Repositories Not Loaded"}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground uppercase max-w-[240px] leading-relaxed">
                    {data.hasSession
                      ? "The current session could not return repository data. Refresh access and try again."
                      : "Load your GitHub repositories to choose one to import."}
                  </p>
                </div>
              ) : (
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      Repositories
                    </p>
                    {data.ownerOptions.length > 0 && (
                      <RepositoryOwnerFilter
                        owners={data.ownerOptions}
                        selectedOwner={data.selectedOwner}
                      />
                    )}
                  </div>

                  <RepositorySearchBar
                    disabled={data.filteredRepos.length === 0}
                    githubAppInstallUrl={githubAppInstallUrl}
                    importedProjects={data.importedProjectsRecord || {}}
                    repositories={data.filteredRepos}
                  />
                </section>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
