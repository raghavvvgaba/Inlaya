import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  ChevronLeft,
  Clock,
  ExternalLink,
  Github,
  MessageSquare,
  ShieldAlert,
  Terminal,
  User,
} from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { CreateIssueDialog } from "~/components/create-issue-dialog";
import { ProjectIssueSearch } from "~/components/project-issue-search";
import { ProjectIssuesRefreshOnReturn } from "~/components/project-issues-refresh-on-return";
import { env } from "~/env";
import { getAuth } from "~/server/auth/session";
import { getProjectPageData } from "~/server/projects";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

function formatProjectDate(value: Date) {
  return value.toLocaleString("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

// First readable line of an issue's markdown body, for a one-line preview.
function getIssueSnippet(body: string | null) {
  if (!body) return null;

  for (const line of body.split("\n")) {
    // Template headings ("## Bug") say little about the issue itself.
    if (/^\s*#{1,6}\s/.test(line)) continue;

    const text = line
      .replace(/<!--.*?-->/g, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s*(>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/, "")
      .replace(/[*_`~]/g, "")
      .trim();

    if (text) return text;
  }

  return null;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { userId } = await getAuth();
  const { id } = await params;
  const projectData = await getProjectPageData(userId!, id);

  if (projectData.notFound) {
    notFound();
  }

  const { issuesResult, project } = projectData;
  const sandboxBaseAction = `/api/projects/${project.id}/sandbox`;

  return (
    <AppShell
      compactHeader
      description=""
      parent={{ href: "/projects", label: "Projects" }}
      title={project.repoName}
    >
      <ProjectIssuesRefreshOnReturn projectId={project.id} />
      <div className="space-y-8 pb-8">
        <section className="flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link
              className="mb-5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              href="/projects"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Projects
            </Link>
            <p className="text-xs text-muted-foreground">{project.repoOwner}</p>
            <h1 className="inlaya-display mt-1 truncate text-5xl font-medium tracking-[-0.055em] sm:text-6xl">
              {project.repoName}
            </h1>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Imported {formatProjectDate(project.createdAt)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-none px-4 text-sm font-semibold"
            >
              <a
                href={`https://github.com/${project.repoOwner}/${project.repoName}`}
                rel="noreferrer"
                target="_blank"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </Button>
            {issuesResult.status === "ok" ? (
              <CreateIssueDialog projectId={project.id} />
            ) : null}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="inlaya-display text-3xl font-medium tracking-[-0.04em]">
              Open issues
            </h2>
            {issuesResult.status === "ok" ? (
              <p className="text-sm text-muted-foreground">
                {issuesResult.issues.length}{" "}
                {issuesResult.issues.length === 1 ? "issue" : "issues"}
              </p>
            ) : null}
          </div>

      {issuesResult.status === "missing_access" ? (
        <Alert
          variant="destructive"
          className="rounded-none border-amber-500/20 bg-amber-500/10 text-amber-500"
        >
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-sm font-semibold">
            Inlaya can&apos;t see this repository
          </AlertTitle>
          <AlertDescription className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed">
              Inlaya&apos;s access to this repository on GitHub was removed or never
              finished. Give it access again to see and work on its issues.
            </p>
            <Button
              asChild
              className="h-9 rounded-none bg-amber-500 text-xs font-medium text-amber-950 hover:bg-amber-400"
            >
              <a href={env.GITHUB_APP_INSTALL_URL} rel="noreferrer" target="_blank">
                Give access on GitHub
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
          <AlertTitle className="text-sm font-semibold text-destructive">
            Couldn&apos;t load issues
          </AlertTitle>
          <AlertDescription className="mt-2 text-sm leading-relaxed text-destructive">
            GitHub didn&apos;t respond as expected. This is usually temporary, so try
            refreshing the page in a minute.
          </AlertDescription>
        </Alert>
      ) : null}

      {issuesResult.status === "ok" && issuesResult.issues.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center border border-dashed border-border bg-card/60 text-center">
          <div className="flex h-12 w-12 items-center justify-center bg-muted text-muted-foreground">
            <Terminal className="h-5 w-5" />
          </div>
          <h3 className="inlaya-display mt-5 text-2xl font-medium tracking-[-0.035em]">
            No open issues
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create one to start working on a change.
          </p>
        </div>
      ) : null}

      {issuesResult.status === "ok" && issuesResult.issues.length > 0 ? (
        <ProjectIssueSearch
          className="grid gap-3"
          issues={issuesResult.issues.map(({ author, number, title }) => ({
            author,
            number,
            title,
          }))}
        >
          {issuesResult.issues.map((issue) => (
            <article
              className="group/issue relative flex flex-col gap-4 border border-border bg-card p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[7px_7px_0_rgba(240,79,47,0.13)] md:flex-row md:items-center md:justify-between"
              key={issue.id}
            >
              <Link
                className="min-w-0 flex-1"
                href={`/projects/${project.id}/issues/${issue.number}`}
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="h-1.5 w-1.5 bg-emerald-500" />
                  Open · #{issue.number}
                </div>
                <h3 className="inlaya-display mt-2 text-2xl font-medium leading-tight tracking-[-0.035em] transition-colors group-hover/issue:text-[#f04f2f]">
                  {issue.title}
                </h3>
                {getIssueSnippet(issue.body) ? (
                  <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                    {getIssueSnippet(issue.body)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {issue.author}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {issue.comments} {issue.comments === 1 ? "reply" : "replies"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Updated {new Date(issue.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  asChild
                  className="h-10 rounded-none px-4 text-xs font-semibold hover:bg-[#f04f2f] hover:text-white"
                >
                  <Link href={`/projects/${project.id}/issues/${issue.number}`}>
                    Open workspace
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 w-10 rounded-none p-0"
                >
                  <a href={issue.url} rel="noreferrer" target="_blank" aria-label="View on GitHub">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </article>
          ))}
        </ProjectIssueSearch>
      ) : null}
        </section>
      </div>
    </AppShell>
  );
}
