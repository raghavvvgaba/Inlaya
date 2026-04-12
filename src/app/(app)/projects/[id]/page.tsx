import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { 
  Github, 
  MessageSquare, 
  Clock, 
  ChevronLeft, 
  ExternalLink,
  ShieldAlert,
  Terminal,
  Activity
} from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { env } from "~/env";
import { fetchProjectOpenIssues } from "~/server/github/issues";
import { getOwnedProject } from "~/server/projects";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
};

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { userId } = await auth();
  const { id } = await params;
  const query = await searchParams;
  const project = await getOwnedProject(id, userId!);

  if (!project) {
    notFound();
  }

  const issuesResult = await fetchProjectOpenIssues(
    project.repoOwner,
    project.repoName,
  );

  return (
    <AppShell
      description="Live repository stream initialized. Viewing current open issues and project metadata."
      title="Project Terminal"
    >
      <div className="space-y-8">
        {query.success === "already_imported" && (
          <Alert className="rounded-none border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
            <Activity className="h-4 w-4 text-emerald-500" />
            <AlertTitle className="text-[10px] font-bold uppercase tracking-widest">System Notice</AlertTitle>
            <AlertDescription className="text-xs font-medium uppercase mt-1">
              Repository already indexed. Redirected to existing project record.
            </AlertDescription>
          </Alert>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-none border-border shadow-none bg-card">
            <CardHeader className="border-b border-border pb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Resource
                </p>
                <CardTitle className="text-xl uppercase tracking-tight">Managed Repository</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex items-center gap-4 border border-border bg-muted/30 p-4">
                  <div className="flex h-12 w-12 items-center justify-center bg-background border border-border">
                    <Github className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-tight">
                      {project.repoOwner}/{project.repoName}
                    </h2>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      GitHub Handle: {project.repoOwner}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Repository sync is active. Issue data is fetched on-demand from the GitHub 
                  API, ensuring your workspace remains synchronized with the upstream source 
                  without redundant local storage.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-none bg-card">
            <CardHeader className="border-b border-border pb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Snapshot
                </p>
                <CardTitle className="text-xl uppercase tracking-tight">Metadata</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1 border-b border-border pb-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Internal ID</span>
                  <span className="text-xs font-bold font-mono truncate uppercase">{project.id}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border pb-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Indexed On</span>
                  <span className="text-xs font-bold font-mono">{project.createdAt.toLocaleString().toUpperCase()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Sync Capacity</span>
                  <span className="text-xs font-bold font-mono">
                    {issuesResult.status === "ok" ? issuesResult.issues.length : 0} / 10 LOADED
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Live Feed
              </p>
              <h3 className="text-xl font-bold uppercase tracking-tight">Repository Issues</h3>
            </div>
            <Button asChild variant="outline" className="border-border font-bold uppercase text-[10px] tracking-widest h-10 rounded-none px-4">
              <Link href="/dashboard">
                <ChevronLeft className="mr-2 h-3.5 w-3.5" />
                Return to Dashboard
              </Link>
            </Button>
          </div>

          {issuesResult.status === "missing_access" && (
            <Alert variant="destructive" className="rounded-none border-amber-500/20 bg-amber-500/10 text-amber-500">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-[10px] font-bold uppercase tracking-widest">Access Required</AlertTitle>
              <AlertDescription className="mt-4 space-y-4">
                <p className="text-xs font-medium uppercase leading-relaxed">
                  GitHub App installation missing or revoked for this repository. 
                  Synchronization halted.
                </p>
                <Button asChild className="bg-amber-500 text-amber-950 font-bold uppercase text-[10px] tracking-widest h-10 rounded-none hover:bg-amber-400">
                  <a href={env.GITHUB_APP_INSTALL_URL} rel="noreferrer" target="_blank">
                    Grant Resource Access
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {issuesResult.status === "error" && (
            <Alert variant="destructive" className="rounded-none border-destructive/20 bg-destructive/10">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-[10px] font-bold uppercase tracking-widest text-destructive">API Sync Failure</AlertTitle>
              <AlertDescription className="text-xs font-medium uppercase mt-2 leading-relaxed text-destructive">
                GitHub API responded with an error. Metadata is preserved, but live feed is unavailable.
              </AlertDescription>
            </Alert>
          )}

          {issuesResult.status === "ok" && issuesResult.issues.length === 0 && (
            <div className="flex flex-col items-center justify-center border border-dashed border-border bg-muted/10 py-16 text-center">
              <Terminal className="h-8 w-8 text-muted-foreground/30 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Clean Exit: 0 Issues
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground uppercase max-w-[240px]">
                No open issues were detected for this repository in the current session.
              </p>
            </div>
          )}

          {issuesResult.status === "ok" && issuesResult.issues.length > 0 && (
            <div className="grid gap-px bg-border border border-border">
              {issuesResult.issues.map((issue) => (
                <a
                  className="flex flex-col gap-4 bg-card p-6 transition hover:bg-muted/50 md:flex-row md:items-start md:justify-between group"
                  href={issue.url}
                  key={issue.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 rounded-none text-[10px] font-bold uppercase tracking-widest">
                        OPEN
                      </Badge>
                      <span className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-widest">
                        LOG_{issue.number}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-tight group-hover:text-primary transition-colors">
                        {issue.title}
                      </h4>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          {issue.author}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {issue.comments} COMMITS/REPLIES
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          UPDATED {new Date(issue.updatedAt).toLocaleDateString().toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground">
                    RESOURCE_VIEW
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
