import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  Clock,
  ExternalLink,
  Github,
  MessageSquare,
  ShieldAlert,
  Terminal,
} from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { env } from "~/env";
import { fetchProjectOpenIssues } from "~/server/github/issues";
import { getOwnedProject } from "~/server/projects";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

const successMessages: Record<string, string> = {
  already_imported:
    "Repository already indexed. Redirected to existing project record.",
};

function formatProjectDate(value: Date) {
  return value.toLocaleString().toUpperCase();
}

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
  const successMessage = query.success
    ? (successMessages[query.success] ?? null)
    : null;

  return (
    <AppShell
      description="Project workspace online. Review the imported repository and open one issue to prepare a dedicated change."
      title="Project Terminal"
    >
      <div className="space-y-8">
        {successMessage ? (
          <Alert className="rounded-none border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
            <Activity className="h-4 w-4 text-emerald-500" />
            <AlertTitle className="text-[10px] font-bold uppercase tracking-widest">
              System Notice
            </AlertTitle>
            <AlertDescription className="mt-1 text-xs font-medium uppercase">
              {successMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-none border-border shadow-none bg-card">
            <CardHeader className="border-b border-border pb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Resource
                </p>
                <CardTitle className="text-xl uppercase tracking-tight">
                  Managed Repository
                </CardTitle>
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
                      Issue-first workflow enabled
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Open one issue to enter the execution flow. File preparation,
                  branch creation, and commit creation now happen inside the
                  issue workspace so every change is clearly tied back to a
                  specific GitHub issue.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="border-border font-bold uppercase text-[10px] tracking-widest h-10 rounded-none px-4"
                  >
                    <Link href="/dashboard">
                      <ChevronLeft className="mr-2 h-3.5 w-3.5" />
                      Return to Dashboard
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-border font-bold uppercase text-[10px] tracking-widest h-10 rounded-none px-4"
                  >
                    <a
                      href={`https://github.com/${project.repoOwner}/${project.repoName}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Repository
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-none bg-card">
            <CardHeader className="border-b border-border pb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Snapshot
                </p>
                <CardTitle className="text-xl uppercase tracking-tight">
                  Metadata
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1 border-b border-border pb-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Internal ID
                  </span>
                  <span className="text-xs font-bold font-mono truncate uppercase">
                    {project.id}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border pb-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Indexed On
                  </span>
                  <span className="text-xs font-bold font-mono">
                    {formatProjectDate(project.createdAt)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Open Issues Loaded
                  </span>
                  <span className="text-xs font-bold font-mono">
                    {issuesResult.status === "ok" ? issuesResult.issues.length : 0} / 10
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
              <h3 className="text-xl font-bold uppercase tracking-tight">
                Repository Issues
              </h3>
            </div>
          </div>

          {issuesResult.status === "missing_access" ? (
            <Alert
              variant="destructive"
              className="rounded-none border-amber-500/20 bg-amber-500/10 text-amber-500"
            >
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-[10px] font-bold uppercase tracking-widest">
                Access Required
              </AlertTitle>
              <AlertDescription className="mt-4 space-y-4">
                <p className="text-xs font-medium uppercase leading-relaxed">
                  GitHub App installation missing or revoked for this repository.
                </p>
                <Button
                  asChild
                  className="bg-amber-500 text-amber-950 font-bold uppercase text-[10px] tracking-widest h-10 rounded-none hover:bg-amber-400"
                >
                  <a href={env.GITHUB_APP_INSTALL_URL} rel="noreferrer" target="_blank">
                    Grant Resource Access
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {issuesResult.status === "error" ? (
            <Alert
              variant="destructive"
              className="rounded-none border-destructive/20 bg-destructive/10"
            >
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-[10px] font-bold uppercase tracking-widest text-destructive">
                API Sync Failure
              </AlertTitle>
              <AlertDescription className="mt-2 text-xs font-medium uppercase leading-relaxed text-destructive">
                GitHub API responded with an error. Metadata is preserved, but the issue feed
                is unavailable.
              </AlertDescription>
            </Alert>
          ) : null}

          {issuesResult.status === "ok" && issuesResult.issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-border bg-muted/10 py-16 text-center">
              <Terminal className="mb-4 h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Clean Exit: 0 Issues
              </p>
              <p className="mt-2 max-w-[240px] text-[10px] uppercase text-muted-foreground">
                No open issues were detected for this repository in the current session.
              </p>
            </div>
          ) : null}

          {issuesResult.status === "ok" && issuesResult.issues.length > 0 ? (
            <div className="grid gap-px border border-border bg-border">
              {issuesResult.issues.map((issue) => (
                <div
                  className="flex flex-col gap-4 bg-card p-6 md:flex-row md:items-start md:justify-between"
                  key={issue.id}
                >
                  <Link
                    className="group flex-1 space-y-4"
                    href={`/projects/${project.id}/issues/${issue.number}`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 rounded-none text-[10px] font-bold uppercase tracking-widest">
                        OPEN
                      </Badge>
                      <span className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-widest">
                        LOG_{issue.number}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-tight transition-colors group-hover:text-primary">
                        {issue.title}
                      </h4>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          {issue.author}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {issue.comments} REPLIES
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          UPDATED {new Date(issue.updatedAt).toLocaleDateString().toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      asChild
                      className="rounded-none font-bold uppercase text-[10px] tracking-widest h-10 px-4"
                    >
                      <Link href={`/projects/${project.id}/issues/${issue.number}`}>
                        Open Issue Workspace
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-none font-bold uppercase text-[10px] tracking-widest h-10 px-4"
                    >
                      <a href={issue.url} rel="noreferrer" target="_blank">
                        GitHub
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
