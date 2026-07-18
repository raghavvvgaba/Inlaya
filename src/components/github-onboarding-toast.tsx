"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type GithubOnboardingToastProps = {
  errorMessage: string | null;
  successMessage: string | null;
};

export function GithubOnboardingToast({
  errorMessage,
  successMessage,
}: GithubOnboardingToastProps) {
  useEffect(() => {
    if (!errorMessage && !successMessage) return;

    if (errorMessage) {
      toast.error(errorMessage, { id: "github-onboarding-error" });
    } else if (successMessage) {
      toast.success(successMessage, { id: "github-onboarding-success" });
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("success");
    window.history.replaceState({}, "", url.toString());
  }, [errorMessage, successMessage]);

  return null;
}
