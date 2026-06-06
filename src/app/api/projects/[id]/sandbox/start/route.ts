import {
  respondWithSandboxAction,
  sandboxJson,
  type ProjectSandboxRouteContext,
  withOwnedProjectSandboxRoute,
} from "~/server/sandbox/route-helpers";
import { recordProjectSandboxOwner } from "~/server/sandbox/ownership";
import { sandboxProvider } from "~/server/sandbox/provider";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: ProjectSandboxRouteContext,
) {
  return withOwnedProjectSandboxRoute(request, context, async (access) =>
    respondWithSandboxAction(
      () =>
        sandboxProvider.start({
          repoName: access.project.repoName,
          repoOwner: access.project.repoOwner,
        }),
      (session) => {
        recordProjectSandboxOwner(session.sessionId, {
          projectId: access.project.id,
          userId: access.userId,
        });
        return sandboxJson({ ok: true as const, session });
      },
      "Unable to start sandbox.",
    ),
  );
}
