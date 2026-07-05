import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { IssueChatWorkspace } from "~/components/issue-chat-workspace";
import { IssueDetailsModal } from "~/components/issue-details-modal";
import { IssueSandboxStatusPanel } from "~/components/issue-sandbox-status-panel";
import { Button } from "~/components/ui/button";
import { getAuth } from "~/server/auth/session";
import { getIssueWorkspacePageData } from "~/server/projects";

type IssuePageProps = {
  params: Promise<{ id: string; issueNumber: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function ProjectIssuePage({
  params,
  searchParams,
}: IssuePageProps) {
  const { userId } = await getAuth();
  const { id, issueNumber: rawIssueNumber } = await params;
  const { error, success } = await searchParams;
  const issueNumber = Number(rawIssueNumber);
  const issueWorkspaceData = await getIssueWorkspacePageData(
    userId!,
    id,
    issueNumber,
    { error, success },
  );

  if (issueWorkspaceData.notFound) {
    notFound();
  }

  const {
    accessBlocked,
    issueResult,
    issueTitle,
    messages,
    project,
  } = issueWorkspaceData;
  const sandboxBaseAction = `/api/projects/${project.id}/issues/${issueNumber}/sandbox`;
  const agentAction = `${sandboxBaseAction}/agent`;
  const submitAction = `${sandboxBaseAction}/submit`;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground text-sm">
      {/* Left Pane - Chat Workspace */}
      <div className="flex w-[400px] min-w-[350px] max-w-[500px] flex-col border-r border-border">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
          <Button
            asChild
            variant="ghost"
            className="h-8 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <Link href={`/projects/${project.id}`}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-1">
            <IssueDetailsModal
              author={issueResult.status === "ok" ? issueResult.issue.author : undefined}
              body={issueResult.status === "ok" ? issueResult.issue.body : null}
              comments={issueResult.status === "ok" ? issueResult.issue.comments : undefined}
              createdAt={issueResult.status === "ok" ? issueResult.issue.createdAt : undefined}
              issueNumber={issueNumber}
              state={issueResult.status === "ok" ? issueResult.issue.state : undefined}
              title={issueTitle}
              updatedAt={issueResult.status === "ok" ? issueResult.issue.updatedAt : undefined}
            />
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <a
                href={`https://github.com/${project.repoOwner}/${project.repoName}/issues/${issueNumber}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">On GitHub</span>
              </a>
            </Button>
          </div>
        </header>

        {/* Chat / Body */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <IssueChatWorkspace
            accessBlocked={accessBlocked}
            agentAction={agentAction}
            initialInstruction=""
            initialMessages={messages}
            issueNumber={issueNumber}
            issueTitle={issueTitle}
            projectId={project.id}
            sessionAction={`${sandboxBaseAction}/session`}
            submitAction={submitAction}
          />
        </div>
      </div>

      {/* Right Pane - Preview */}
      <div className="flex min-w-0 flex-1 flex-col bg-muted/20">
        {/* Status Panel Header */}
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4 bg-background">
          <IssueSandboxStatusPanel
            heartbeatAction={`${sandboxBaseAction}/heartbeat`}
            projectId={project.id}
            restartPreviewAction={`${sandboxBaseAction}/restart-preview`}
            sessionAction={`${sandboxBaseAction}/session`}
            startAction={`${sandboxBaseAction}/start`}
            stopAction={`${sandboxBaseAction}/stop`}
          />
        </header>

        {/* Preview Placeholder */}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Preview</p>
            <p className="text-sm">Preview functionality will be implemented later.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
