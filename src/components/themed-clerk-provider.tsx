"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import type { ReactNode } from "react";

type ThemedClerkProviderProps = {
  children: ReactNode;
};

// The shadcn theme reads the app's CSS variables, which already switch with
// dark mode, so Clerk's own dark theme (hard-coded greys) isn't layered on.
export function ThemedClerkProvider({
  children,
}: ThemedClerkProviderProps) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: shadcn,
      }}
      signInFallbackRedirectUrl="/projects"
      signUpFallbackRedirectUrl="/projects"
    >
      {children}
    </ClerkProvider>
  );
}
