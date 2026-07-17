import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const LEGACY_RENDER_HOST = "inlaya.onrender.com";
const PRODUCTION_ORIGIN = "https://inlaya.raghavgaba.me";

const isProtectedRoute = createRouteMatcher([
  "/onboarding(.*)",
  "/projects(.*)",
]);

export default clerkMiddleware(
  async (auth, req) => {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const requestHost =
      forwardedHost?.split(",")[0]?.trim() ??
      req.headers.get("host")?.split(":")[0] ??
      req.nextUrl.hostname;

    if (requestHost === LEGACY_RENDER_HOST) {
      const destination = req.nextUrl.clone();
      destination.protocol = "https:";
      destination.hostname = "inlaya.raghavgaba.me";
      destination.port = "";

      return NextResponse.redirect(destination, 308);
    }

    if (isProtectedRoute(req)) {
      await auth.protect();
    }
  },
  {
    authorizedParties:
      process.env.NODE_ENV === "production"
        ? [PRODUCTION_ORIGIN]
        : ["http://localhost:3000", PRODUCTION_ORIGIN],
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:css|js(?!on)|jpg|jpeg|gif|png|svg|ico|ttf|woff2?|json|map|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};
