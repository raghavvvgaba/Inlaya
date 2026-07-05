"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function getProjectIssuesRefreshKey(projectId: string) {
  return `devin:project:${projectId}:issues-refresh-needed`;
}

export function ProjectIssuesRefreshOnReturn({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    function refreshIfNeeded() {
      const refreshKey = getProjectIssuesRefreshKey(projectId);

      if (window.sessionStorage.getItem(refreshKey) !== "true") {
        return;
      }

      window.sessionStorage.removeItem(refreshKey);
      router.refresh();
    }

    refreshIfNeeded();
    window.addEventListener("pageshow", refreshIfNeeded);
    window.addEventListener("focus", refreshIfNeeded);

    return () => {
      window.removeEventListener("pageshow", refreshIfNeeded);
      window.removeEventListener("focus", refreshIfNeeded);
    };
  }, [projectId, router]);

  return null;
}
