"use client";

import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

import { AuthShell } from "~/components/auth-shell";

export default function SignUpPage() {
  const { resolvedTheme } = useTheme();

  return (
    <AuthShell
      description="Create an account to enter the MVP workspace and begin the GitHub onboarding flow."
      eyebrow="Phase 1"
      title="Create your Devin workspace"
    >
      <SignUp
        appearance={{
          baseTheme: resolvedTheme === "dark" ? dark : undefined,
          elements: {
            card: "shadow-none",
            rootBox: "w-full",
          },
        }}
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
      />
    </AuthShell>
  );
}
