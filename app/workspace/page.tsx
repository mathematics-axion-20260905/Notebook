import type { Metadata } from "next";
import { ProjectObjectTray } from "@/components/ecosystem/project-object-tray";
import { ComputationalNotebook } from "@/features/notebook/ui/computational-notebook";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Research workspace",
    description: "Research notebook workspace for mathematics, code, graphs, evidence, and project reasoning.",
    alternates: { canonical: "/workspace" },
    robots: noIndexRobots,
};

export default function NotebookWorkspacePage() {
    return (
        <div className="ax-workspace-root ax-notebook-workspace">
            <ProjectObjectTray />
            <ComputationalNotebook />
        </div>
    );
}
