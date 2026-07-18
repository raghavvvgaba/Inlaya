"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark, shadcn } from "@clerk/themes";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

type ThemedClerkProviderProps = {
  children: ReactNode;
};

export function ThemedClerkProvider({
  children,
}: ThemedClerkProviderProps) {
  const { resolvedTheme } = useTheme();

  return (
    <ClerkProvider
      appearance={{
        baseTheme: resolvedTheme === "dark" ? [shadcn, dark] : shadcn,
      }}
      signInFallbackRedirectUrl="/projects"
      signUpFallbackRedirectUrl="/projects"
    >
      {children}
    </ClerkProvider>
  );
}
