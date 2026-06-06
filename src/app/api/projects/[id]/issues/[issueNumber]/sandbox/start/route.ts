import {
  respondWithSandboxAction,
  sandboxJson,
  type IssueSandboxRouteContext,
  withOwnedIssueSandboxRoute,
} from "~/server/sandbox/route-helpers";
import { recordIssueSandboxOwner } from "~/server/sandbox/ownership";
import { sandboxProvider } from "~/server/sandbox/provider";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: IssueSandboxRouteContext,
) {
  return withOwnedIssueSandboxRoute(request, context, async (access) =>
    respondWithSandboxAction(
      () =>
        sandboxProvider.start({
          repoName: access.project.repoName,
          repoOwner: access.project.repoOwner,
        }),
      (session) => {
        recordIssueSandboxOwner(session.sessionId, {
          issueNumber: access.issueNumber,
          projectId: access.project.id,
          userId: access.userId,
        });
        return sandboxJson({ ok: true as const, session });
      },
      "Unable to start sandbox.",
    ),
  );
}
