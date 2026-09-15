"use client";

import React from "react";

import { ProjectObjectTray } from "@/components/ecosystem/project-object-tray";
import { ComputationalNotebook } from "@/features/notebook/ui/computational-notebook";
import { NotebookStartScreen } from "@/features/notebook/ui/notebook-start-screen";

function hasNotebookDeepLink() {
  const params = new URLSearchParams(window.location.search);
  return ["project", "document", "new", "source", "objectId", "transferId"].some((key) => params.has(key));
}

export function NotebookWorkspaceEntry() {
  const [mode, setMode] = React.useState<"loading" | "start" | "workspace">("loading");

  React.useEffect(() => {
    setMode(hasNotebookDeepLink() ? "workspace" : "start");
  }, []);

  if (mode === "loading") return <div className="min-h-screen bg-[var(--ax-canvas)]" aria-hidden="true" />;
  if (mode === "start") return <NotebookStartScreen />;
  return <><ProjectObjectTray /><ComputationalNotebook /></>;
}
