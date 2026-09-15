import type { Metadata } from "next";
import { NotebookWorkspaceEntry } from "@/features/notebook/ui/notebook-workspace-entry";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Research workspace",
    description: "Research notebook workspace for mathematics, code, graphs, evidence, and project reasoning.",
    alternates: { canonical: "/workspace" },
    robots: noIndexRobots,
};

export default function NotebookWorkspacePage() {
    return <div className="ax-workspace-root ax-notebook-workspace"><NotebookWorkspaceEntry /></div>;
}
