import {
  readJsonObject,
  readStringField,
  sandboxError,
  respondWithSandboxAction,
  sandboxJson,
  type IssueSandboxRouteContext,
  validateIssueSandboxSession,
  withOwnedIssueSandboxRoute,
} from "~/server/sandbox/route-helpers";
import {
  clearIssueSandboxOwner,
} from "~/server/sandbox/ownership";
import { sandboxProvider } from "~/server/sandbox/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: IssueSandboxRouteContext,
) {
  return withOwnedIssueSandboxRoute(request, context, async (access) => {
    const body = await readJsonObject(request);
    const sessionId = readStringField(body, "sessionId");
    const environmentId = readStringField(body, "environmentId") ?? undefined;
    const sessionError = validateIssueSandboxSession(access, sessionId);

    if (sessionError) {
      return sessionError;
    }

    if (!sessionId) {
      return sandboxError("missing_session_id");
    }

    return respondWithSandboxAction(
      () => sandboxProvider.stop({ environmentId, sessionId }),
      (session) => {
        clearIssueSandboxOwner(sessionId);
        return sandboxJson({ ok: true as const, session });
      },
      "Unable to stop sandbox.",
    );
  });
}
