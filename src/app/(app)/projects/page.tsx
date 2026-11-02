import Link from "next/link";
import {
  ArrowUpRight,
  FolderGit2,
  Github,
  MessageSquare,
  Plus,
} from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { GithubConnectionToast } from "~/components/github-connection-toast";
import { GithubDisconnectDialog } from "~/components/github-disconnect-dialog";
import { GithubDisconnectToast } from "~/components/github-disconnect-toast";
import { NewImportModal } from "~/components/new-import-modal";
import { Button } from "~/components/ui/button";
import { env } from "~/env";
import { getAuth } from "~/server/auth/session";
import { getProjectsPageData } from "~/server/projects";

type ProjectsPageProps = {
  searchParams: Promise<{
    error?: string;
    newImport?: string;
    success?: string;
  }>;
};

function formatImportedDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function formatRelative(value: Date) {
  const minutes = Math.round((value.getTime() - Date.now()) / 60_000);

  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeTime.format(days, "day");

  return formatImportedDate(value);
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const { userId } = await getAuth();
  const params = await searchParams;
  const { githubStatus, projects } = await getProjectsPageData(userId!);

  const defaultOpen =
    !!params.newImport ||
    params.success === "import_session_ready" ||
    !!params.error;
  const projectCount = projects.length;
  const importButtonClassName = "h-11 rounded-none px-5 text-sm font-semibold";
  const connectGithubButton = (
    <Button asChild className={importButtonClassName}>
      <Link href="/onboarding/github">
        <Github className="h-4 w-4" />
        Connect GitHub
      </Link>
    </Button>
  );

  return (
    <AppShell compactHeader description="" title="Projects">
      <GithubConnectionToast
        didConnect={params.success === "github_connected"}
      />
      <GithubDisconnectToast
        didDisconnect={params.success === "disconnected"}
      />

      <div className="space-y-8 pb-8">
        <section className="flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="inlaya-display text-5xl font-medium tracking-[-0.055em] sm:text-6xl">
              Projects
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span>
                {projectCount}{" "}
                {projectCount === 1 ? "repository" : "repositories"}
              </span>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    githubStatus.connected ? "bg-emerald-500" : "bg-[#f04f2f]"
                  }`}
                />
                <span className="truncate">
                  {githubStatus.connected && githubStatus.githubUsername
                    ? `GitHub @${githubStatus.githubUsername}`
                    : "GitHub not connected"}
                </span>
              </span>
              {githubStatus.connected && githubStatus.githubUsername ? (
                <>
                  <span aria-hidden="true" className="text-border">
                    ·
                  </span>
                  <GithubDisconnectDialog
                    githubUsername={githubStatus.githubUsername}
                    projectCount={projectCount}
                  />
                </>
              ) : null}
            </div>
          </div>

          {githubStatus.connected ? (
            <NewImportModal
              defaultOpen={defaultOpen}
              githubAppInstallUrl={env.GITHUB_APP_INSTALL_URL}
              trigger={
                <Button className={importButtonClassName}>
                  <Plus className="h-4 w-4" />
                  Import repository
                </Button>
              }
            />
          ) : (
            connectGithubButton
          )}
        </section>

        {projects.length === 0 ? (
          <section className="flex min-h-[340px] flex-col items-center justify-center border border-dashed border-border bg-card/60 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center bg-muted text-muted-foreground">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <h2 className="inlaya-display mt-5 text-2xl font-medium tracking-[-0.035em]">
              No repositories yet
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {githubStatus.connected
                ? "Import a GitHub repository to see its open issues and work on them in a live sandbox."
                : "Connect GitHub first, then import a repository to work on its issues in a live sandbox."}
            </p>
            <div className="mt-6">
              {githubStatus.connected ? (
                <NewImportModal
                  defaultOpen={false}
                  githubAppInstallUrl={env.GITHUB_APP_INSTALL_URL}
                  trigger={
                    <Button className={importButtonClassName}>
                      <Plus className="h-4 w-4" />
                      Import your first repository
                    </Button>
                  }
                />
              ) : (
                connectGithubButton
              )}
            </div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <article
                className="group border border-border bg-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[7px_7px_0_rgba(240,79,47,0.13)]"
                key={project.id}
              >
                <Link
                  className="flex h-full flex-col"
                  href={`/projects/${project.id}`}
                >
                  <div className="flex items-start gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#171713] text-[#fffaf0] transition-colors group-hover:bg-[#f04f2f] dark:bg-[#fffaf0] dark:text-[#171713]">
                      <Github className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">
                        {project.repoOwner}
                      </p>
                      <h2 className="inlaya-display mt-0.5 truncate text-2xl font-medium tracking-[-0.035em]">
                        {project.repoName}
                      </h2>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
                    {project.lastRun ? (
                      <p className="min-w-0 truncate">
                        <span className="text-foreground">
                          #{project.lastRun.issueNumber}
                          {project.lastRun.issueTitle
                            ? ` ${project.lastRun.issueTitle}`
                            : ""}
                        </span>
                        {" · "}
                        {formatRelative(project.lastRun.startedAt)}
                      </p>
                    ) : (
                      <p className="truncate">
                        No runs yet · Imported{" "}
                        {formatImportedDate(project.createdAt)}
                      </p>
                    )}
                    {project.issuesWorkedOn > 0 ? (
                      <p className="flex shrink-0 items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {project.issuesWorkedOn}{" "}
                        {project.issuesWorkedOn === 1 ? "issue" : "issues"}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
