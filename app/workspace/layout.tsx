import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Research workspace",
    description: "Private computational notebook workspace for project reasoning, evidence and scientific objects.",
    alternates: { canonical: "/workspace" },
    robots: noIndexRobots,
};

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
