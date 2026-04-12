import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { 
  Github, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ArrowUpRight, 
  Layers, 
  Activity 
} from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { db } from "~/server/db";
import { getGithubConnectionStatus } from "~/server/github/connection";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export default async function DashboardPage() {
  const { userId } = await auth();

  const [projects, githubStatus] = await Promise.all([
    db.project.findMany({
      where: { userId: userId! },
      orderBy: { createdAt: "desc" },
    }),
    getGithubConnectionStatus(userId!),
  ]);

  const projectCount = projects.length;

  return (
    <AppShell
      description="System initialization complete. Review your connection status and managed repositories below."
      title="Dashboard"
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-none border-border shadow-none bg-card">
          <CardHeader className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Integration Status
                </p>
                <CardTitle className="text-xl uppercase tracking-tight">GitHub Core</CardTitle>
              </div>
              {githubStatus.connected ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 rounded-none text-[10px] font-bold uppercase tracking-widest px-2 py-1">
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/10 rounded-none text-[10px] font-bold uppercase tracking-widest px-2 py-1">
                  Action Required
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4 p-4 border border-border bg-muted/30">
                {githubStatus.connected ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
                )}
                <div className="space-y-2">
                  <p className="text-sm font-bold uppercase tracking-tight">
                    {githubStatus.connected
                      ? `Access verified as @${githubStatus.githubUsername}`
                      : "Identity link pending"}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {githubStatus.connected
                      ? "The secure bridge between Clerk and GitHub is active. You can now perform repository operations and issue synchronization."
                      : "Repository import requires an active GitHub connection. Authorization is managed via secure OAuth 2.0 protocol."}
                  </p>
                </div>
              </div>
              
              {!githubStatus.connected && (
                <Button asChild className="w-full bg-primary text-primary-foreground font-bold uppercase text-[10px] tracking-widest h-12 rounded-none">
                  <Link href="/onboarding/github">
                    Establish Connection
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="rounded-none border-border shadow-none bg-primary text-primary-foreground overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
                Data Snap
              </p>
              <CardTitle className="text-sm uppercase tracking-widest">Active Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold tracking-tighter">{projectCount}</div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60">
                Total Managed Repositories
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-none bg-card">
            <CardHeader className="pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Session Log
              </p>
              <CardTitle className="text-sm uppercase tracking-widest">Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">GitHub User</span>
                <span className="text-xs font-bold font-mono">
                  {githubStatus.connected ? `@${githubStatus.githubUsername}` : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Sync State</span>
                <span className="text-xs font-bold font-mono">
                  {githubStatus.connected ? "ACTIVE" : "AWAITING"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Inventory
            </p>
            <h2 className="text-xl font-bold uppercase tracking-tight">Managed Repositories</h2>
          </div>
          <Button asChild variant="outline" className="border-border text-foreground font-bold uppercase text-[10px] tracking-widest h-10 rounded-none px-4">
            <Link href="/projects/new">
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Import
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-border bg-muted/10 py-12 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/30 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                No Repositories Indexed
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground uppercase max-w-[200px]">
                Connect GitHub and initialize your first project import.
              </p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                className="group flex items-center justify-between border border-border bg-card p-4 transition hover:bg-muted/50"
                key={project.id}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Github className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight uppercase">
                      {project.repoOwner}/{project.repoName}
                    </h3>
                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                      Indexed on {project.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button asChild variant="ghost" className="h-10 w-10 p-0 rounded-none border border-transparent hover:border-border hover:bg-background">
                  <Link href={`/projects/${project.id}`}>
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="sr-only">Open Project</span>
                  </Link>
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
