"use client";

import React from "react";

import { LaboratoryInlineMathMarkdown } from "@/components/laboratory/laboratory-inline-math-markdown";
import { PremiumFeatureBadge } from "@/components/premium-feature-badge";
import { createIdleExecutionState } from "@/features/notebook/core/runtime";
import type { NotebookBlock, NotebookBlockPlugin, NotebookPluginRenderProps } from "@/features/notebook/core/types";
import { createClientId } from "@/lib/client-id";
import { buildIntegralCodeForMode } from "@/lib/integral-code-generator";

function createBlock(kind: NotebookBlock["kind"], family: NotebookBlock["family"], title: string, content: string, config: Record<string, string> = {}, runtime: "local" | "hybrid" | "server-boundary" = "local"): NotebookBlock {
    return {
        id: `${kind}-${createClientId()}`,
        kind,
        family,
        title,
        content,
        config,
        execution: createIdleExecutionState(runtime),
    };
}

function DefaultEditor({ block, onChange }: NotebookPluginRenderProps) {
    return (
        <div className="space-y-3">
            <textarea
                value={block.content}
                onChange={(event) => onChange({ content: event.target.value })}
                className="min-h-32 w-full resize-y rounded-xl border border-border/70 bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-accent/45 focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
        </div>
    );
}

function TextPreview({ block }: NotebookPluginRenderProps) {
    return <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">{block.content}</div>;
}

function FormulaPreview({ block }: NotebookPluginRenderProps) {
    return <LaboratoryInlineMathMarkdown content={`$$${block.content}$$`} />;
}

function SolveEditor({ block, onChange }: NotebookPluginRenderProps) {
    return (
        <div className="space-y-3">
            <textarea
                value={block.content}
                onChange={(event) => onChange({ content: event.target.value })}
                className="min-h-32 w-full resize-y rounded-xl border border-border/70 bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-accent/45 focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <div className="grid gap-2 sm:grid-cols-4">
                {(["variable", "lower", "upper", "method"] as const).map((key) => (
                    <input
                        key={key}
                        value={block.config[key] ?? ""}
                        onChange={(event) => onChange({ config: { ...block.config, [key]: event.target.value } })}
                        placeholder={key}
                        className="h-9 rounded-xl border border-border/70 bg-background px-3 font-mono text-xs outline-none"
                    />
                ))}
            </div>
        </div>
    );
}

function SolvePreview({ block }: NotebookPluginRenderProps) {
    const output = block.execution.output ?? {};
    return (
        <div className="space-y-4">
            <PremiumFeatureBadge label="Hybrid runtime" detail={block.execution.runtime} />
            <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Status" value={block.execution.status} />
                <Metric label="Runtime" value={block.execution.runtime} />
                <Metric label="Duration" value={block.execution.durationMs ? `${block.execution.durationMs} ms` : "pending"} />
            </div>
            {"exact_latex" in output && typeof output.exact_latex === "string" ? (
                <LaboratoryInlineMathMarkdown content={`$$${output.exact_latex}$$`} />
            ) : (
                <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">Run this block to get a server-backed result.</div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Method" value={typeof output.method === "string" ? output.method : "hybrid"} />
                <Metric label="Numeric" value={typeof output.numeric_value === "string" ? output.numeric_value : "pending"} />
                <Metric label="Detail" value={block.execution.detail || "pending"} />
            </div>
        </div>
    );
}

function GraphTableEditor({ block, onChange }: NotebookPluginRenderProps) {
    const fields = block.kind === "graph" ? ["xMin", "xMax", "samples"] : ["xMin", "xMax", "rows"];
    return (
        <div className="space-y-3">
            <textarea
                value={block.content}
                onChange={(event) => onChange({ content: event.target.value })}
                className="min-h-32 w-full resize-y rounded-xl border border-border/70 bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-accent/45 focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <div className="grid gap-2 sm:grid-cols-3">
                {fields.map((key) => (
                    <input
                        key={key}
                        value={block.config[key] ?? ""}
                        onChange={(event) => onChange({ config: { ...block.config, [key]: event.target.value } })}
                        placeholder={key}
                        className="h-9 rounded-xl border border-border/70 bg-background px-3 font-mono text-xs outline-none"
                    />
                ))}
            </div>
        </div>
    );
}

function GraphPreview({ block }: NotebookPluginRenderProps) {
    const points = Array.isArray(block.execution.output?.points) ? block.execution.output.points as Array<{ x: number; y: number }> : [];
    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Status" value={block.execution.status} />
                <Metric label="Points" value={String(points.length)} />
                <Metric label="Detail" value={block.execution.detail || "Waiting for execute"} />
            </div>
            <pre className="site-code-surface max-h-[260px] overflow-auto p-4 text-xs">{JSON.stringify(points.slice(0, 20), null, 2)}</pre>
        </div>
    );
}

function TablePreview({ block }: NotebookPluginRenderProps) {
    const rows = Array.isArray(block.execution.output?.rows) ? block.execution.output.rows as Array<{ x: number; y: number }> : [];
    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Status" value={block.execution.status} />
                <Metric label="Rows" value={String(rows.length)} />
                <Metric label="Detail" value={block.execution.detail || "Waiting for execute"} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/70">
                {rows.slice(0, 12).map((row) => (
                    <div key={`${row.x}-${row.y}`} className="grid grid-cols-2 border-b border-border/50 px-3 py-2 text-sm last:border-b-0">
                        <span className="font-mono">{row.x.toFixed(4)}</span>
                        <span className="font-mono">{row.y.toFixed(8)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CodePreview({ block }: NotebookPluginRenderProps) {
    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Runtime" value={block.execution.runtime} />
                <Metric label="Status" value={block.execution.status} />
                <Metric label="Lines" value={String(block.content.split(/\r?\n/).length)} />
            </div>
            <pre className="site-code-surface overflow-auto p-4 text-sm leading-6">{block.content}</pre>
        </div>
    );
}

function ResultPreview({ block }: NotebookPluginRenderProps) {
    return <LaboratoryInlineMathMarkdown content={block.content} />;
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="site-soft-panel rounded-[1.1rem] bg-background/80 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
            <div className="mt-2 break-words font-mono text-sm font-black">{value}</div>
        </div>
    );
}

export const notebookPlugins: NotebookBlockPlugin[] = [
    {
        kind: "text",
        family: "document",
        label: "Text",
        description: "Research notes and explanation.",
        runtime: "local",
        supportsExecute: false,
        create: () => createBlock("text", "document", "Text block", "Write a paragraph, derivation note, or section heading."),
        validate: (block) => (block.content.trim() ? [] : ["Text block cannot be empty."]),
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: DefaultEditor,
        preview: TextPreview,
    },
    {
        kind: "formula",
        family: "math",
        label: "Formula",
        description: "Rendered LaTeX/math expression.",
        runtime: "local",
        supportsExecute: false,
        create: () => createBlock("formula", "math", "Formula block", "f(x) = sin(x) + x^2"),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n$$${block.content}$$`,
        editor: DefaultEditor,
        preview: FormulaPreview,
    },
    {
        kind: "solve",
        family: "compute",
        label: "Solve",
        description: "Server-backed symbolic solve block.",
        runtime: "hybrid",
        supportsExecute: true,
        create: () => createBlock("solve", "compute", "Solve block", "sin(x) + x^2 / 5", { variable: "x", lower: "0", upper: "3.14", method: "auto" }, "hybrid"),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: SolveEditor,
        preview: SolvePreview,
    },
    {
        kind: "graph",
        family: "compute",
        label: "Graph",
        description: "Dependency-aware graph sampling block.",
        runtime: "hybrid",
        supportsExecute: true,
        create: () => createBlock("graph", "compute", "Graph block", "sin(x)", { xMin: "-6.28", xMax: "6.28", samples: "180" }, "hybrid"),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: GraphTableEditor,
        preview: GraphPreview,
    },
    {
        kind: "table",
        family: "compute",
        label: "Table",
        description: "Generated numeric table from expression.",
        runtime: "hybrid",
        supportsExecute: true,
        create: () => createBlock("table", "compute", "Table block", "sin(x) + x^2", { xMin: "0", xMax: "5", rows: "8" }, "hybrid"),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: GraphTableEditor,
        preview: TablePreview,
    },
    {
        kind: "code",
        family: "compute",
        label: "Code",
        description: "Reproducibility code appendix.",
        runtime: "server-boundary",
        supportsExecute: true,
        create: () => createBlock("code", "compute", "Code block", "import sympy as sp\nx = sp.symbols('x')\nsp.integrate(sp.sin(x), x)", {}, "server-boundary"),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n\`\`\`python\n${block.content}\n\`\`\``,
        editor: DefaultEditor,
        preview: CodePreview,
    },
    {
        kind: "proof",
        family: "document",
        label: "Proof",
        description: "Statement and proof block.",
        runtime: "local",
        supportsExecute: false,
        create: () => createBlock("proof", "document", "Proof block", "Theorem statement.\n\nProof: ..."),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: DefaultEditor,
        preview: TextPreview,
    },
    {
        kind: "exercise",
        family: "document",
        label: "Exercise",
        description: "Problem prompt block.",
        runtime: "local",
        supportsExecute: false,
        create: () => createBlock("exercise", "document", "Exercise block", "Show that the computed profile satisfies the stated differential relation."),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: DefaultEditor,
        preview: TextPreview,
    },
    {
        kind: "result",
        family: "import",
        label: "Result",
        description: "Imported lab result block.",
        runtime: "local",
        supportsExecute: false,
        create: () => createBlock("result", "import", "Imported result", "Imported result payload."),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: DefaultEditor,
        preview: ResultPreview,
    },
    {
        kind: "export",
        family: "publication",
        label: "Export",
        description: "Publication/export packaging block.",
        runtime: "local",
        supportsExecute: false,
        create: () => createBlock("export", "publication", "Export block", "Export this worksheet to Writer, Markdown, LaTeX, or notebook JSON."),
        validate: () => [],
        serialize: (block) => `## ${block.title}\n\n${block.content}`,
        editor: DefaultEditor,
        preview: TextPreview,
    },
];

export const notebookPluginMap = new Map(notebookPlugins.map((plugin) => [plugin.kind, plugin]));

export function getNotebookPlugin(kind: NotebookBlock["kind"]) {
    return notebookPluginMap.get(kind) ?? notebookPluginMap.get("text")!;
}

export function createCodeAppendixBlock(sourceBlock: NotebookBlock) {
    return createBlock(
        "code",
        "compute",
        `${sourceBlock.title || "Solve block"} code appendix`,
        buildIntegralCodeForMode("python-sympy", {
            expression: sourceBlock.content,
            lower: sourceBlock.config.lower || "0",
            upper: sourceBlock.config.upper || "1",
            solveMethod: sourceBlock.config.method || "auto",
        }),
        {
            sourceBlockId: sourceBlock.id,
            generatedFrom: "solve-block",
            method: sourceBlock.config.method || "auto",
        },
        "server-boundary",
    );
}
