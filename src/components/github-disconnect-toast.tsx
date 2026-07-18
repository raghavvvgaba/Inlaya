"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type GithubDisconnectToastProps = {
  didDisconnect: boolean;
};

export function GithubDisconnectToast({
  didDisconnect,
}: GithubDisconnectToastProps) {
  useEffect(() => {
    if (!didDisconnect) return;

    toast.success(
      "GitHub disconnected. Your imported project records were removed.",
      { id: "github-disconnected" },
    );

    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    window.history.replaceState({}, "", url.toString());
  }, [didDisconnect]);

  return null;
}
