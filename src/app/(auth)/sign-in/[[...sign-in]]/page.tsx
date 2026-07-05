"use client";

import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

import { AuthShell } from "~/components/auth-shell";

export default function SignInPage() {
  const { resolvedTheme } = useTheme();

  return (
    <AuthShell
      description="Sign in to access your protected workspace and continue toward the GitHub onboarding flow."
      eyebrow="Authentication"
      title="Welcome back to Devin"
    >
      <SignIn
        appearance={{
          baseTheme: resolvedTheme === "dark" ? dark : undefined,
          elements: {
            card: "shadow-none",
            rootBox: "w-full",
          },
        }}
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
      />
    </AuthShell>
  );
}
