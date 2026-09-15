"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

import { ProjectObjectTray } from "@/components/ecosystem/project-object-tray";
import { ComputationalNotebook } from "@/features/notebook/ui/computational-notebook";
import { NotebookStartScreen } from "@/features/notebook/ui/notebook-start-screen";

export function NotebookWorkspaceEntry() {
  const [mode, setMode] = React.useState<"loading" | "start" | "workspace">("loading");
  const searchParams = useSearchParams();

  React.useEffect(() => {
    setMode(["project", "document", "new", "source", "objectId", "transferId"].some((key) => searchParams.has(key)) ? "workspace" : "start");
  }, [searchParams]);

  if (mode === "loading") return <div className="min-h-screen bg-[var(--ax-canvas)]" aria-hidden="true" />;
  if (mode === "start") return <NotebookStartScreen />;
  return <><ProjectObjectTray /><ComputationalNotebook /></>;
}
