"use client";

import React from "react";
import {
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronUp,
    Clock3,
    Code2,
    Copy,
    Download,
    FileText,
    GripVertical,
    LineChart as LineChartIcon,
    Moon,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    Play,
    Plus,
    Search,
    Share2,
    Sigma,
    Sparkles,
    Sun,
    Table2,
    Trash2,
    X,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { LaboratoryInlineMathMarkdown } from "@/components/laboratory/laboratory-inline-math-markdown";
import { createLocalScientificObject, createLocalScientificReference, exportLocalScientificObject, getLocalScientificObject, importLocalScientificObject } from "@/lib/ecosystem/local-object-store";
import type { ScientificObjectReference } from "@/lib/ecosystem/contracts";
import { discardScientificObjectTransfer, fetchScientificObjectTransfer } from "@/lib/ecosystem/transfer";
import { publishScientificObjectTransfer } from "@/lib/ecosystem/transfer";
import { createNotebookKernelAdapter, type NotebookKernelAdapter } from "@/features/notebook/core/jupyter-adapter";
import type { NotebookBlock as ApiNotebookBlock, NotebookDocument, NotebookExecutionTarget } from "@/features/notebook/core/types";
import { getEcosystemObjectHref, getEcosystemTransferHref } from "@/lib/ecosystem/apps";
import { resolveActiveProjectId } from "@/lib/ecosystem/project-context";
import { createClientId } from "@/lib/client-id";
import { createNotebookDocument, fetchNotebookDocuments, updateNotebookDocument, type NotebookDocumentPayload } from "@/lib/notebook";
import { ensureNotebookGuestSession } from "@/lib/auth";

type BlockKind = "text" | "formula" | "code" | "graph" | "table" | "result";
type SaveState = "saved" | "saving" | "error";
type NotebookHistoryItem = {
    id: string;
    documentTitle: string;
    pageTitle: string;
    blocks: NotebookBlock[];
    createdAt: string;
    signature: string;
};

type NotebookBlock = {
    id: string;
    kind: BlockKind;
    title?: string;
    content: string;
    scientific_object_reference?: ScientificObjectReference;
};

function toApiNotebookBlock(block: NotebookBlock): ApiNotebookBlock {
    const family: ApiNotebookBlock["family"] = ["code", "graph", "table"].includes(block.kind)
        ? "compute"
        : block.kind === "result"
            ? "import"
            : block.kind === "formula"
                ? "math"
                : "document";
    return {
        id: block.id,
        kind: block.kind,
        title: block.title || block.kind,
        content: block.content,
        family,
        config: {},
        execution: { status: "idle", runtime: "local" },
        scientific_object_reference: block.scientific_object_reference,
    };
}

function fromApiNotebookBlock(block: ApiNotebookBlock): NotebookBlock {
    const kind: BlockKind = ["text", "formula", "code", "graph", "table", "result"].includes(block.kind)
        ? block.kind as BlockKind
        : "result";
    return {
        id: block.id,
        kind,
        title: block.title,
        content: block.content,
        scientific_object_reference: block.scientific_object_reference,
    };
}

const blockCatalog: Array<{
    kind: BlockKind;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    { kind: "text", label: "Text", description: "Notes, headings, and explanation", icon: FileText },
    { kind: "formula", label: "Formula", description: "Beautiful typeset mathematics", icon: Sigma },
    { kind: "code", label: "Code", description: "Python and computational snippets", icon: Code2 },
    { kind: "graph", label: "Graph", description: "Interactive visual output", icon: LineChartIcon },
    { kind: "table", label: "Table", description: "Structured numeric results", icon: Table2 },
    { kind: "result", label: "Result", description: "Insight or computed conclusion", icon: Sparkles },
];

const starterBlocks: NotebookBlock[] = [
    {
        id: "intro",
        kind: "text",
        content:
            "The heat equation describes how heat diffuses through a given region over time. It is a fundamental partial differential equation in mathematical physics.",
    },
    {
        id: "formula",
        kind: "formula",
        content: String.raw`\frac{\partial u}{\partial t} = \alpha \nabla^2 u`,
    },
    {
        id: "code",
        kind: "code",
        content: "u = exp(-α*t) * sin(k*x)\nplot(u, x=0..2π)",
    },
    {
        id: "graph",
        kind: "graph",
        title: "Solution u(x, t)",
        content: "exp(-0.4*t) * sin(x)",
    },
    {
        id: "result",
        kind: "result",
        content:
            "The solution exhibits sinusoidal behavior in space with exponential decay in time. As time increases, the amplitude diminishes, representing the smoothing effect of heat diffusion.",
    },
];

const graphData = Array.from({ length: 129 }, (_, index) => {
    const x = (Math.PI * 2 * index) / 128;
    return {
        x,
        y: Math.sin(x),
    };
});

function createBlock(kind: BlockKind): NotebookBlock {
    const id = `${kind}-${createClientId()}`;
    if (kind === "text") return { id, kind, content: "Start writing…" };
    if (kind === "formula") return { id, kind, content: String.raw`f(x) = \sin(x) + x^2` };
    if (kind === "code") return { id, kind, content: "x = linspace(0, 10, 200)\ny = sin(x)" };
    if (kind === "graph") return { id, kind, title: "Untitled graph", content: "sin(x)" };
    if (kind === "table") return { id, kind, title: "Values", content: "x,y\n0,0\n1,0.84\n2,0.91" };
    return { id, kind, content: "Add a result, interpretation, or conclusion." };
}

function notebookToMarkdown(title: string, pageTitle: string, blocks: NotebookBlock[]) {
    const sections = blocks.map((block) => {
        if (block.kind === "formula") return `$$\n${block.content}\n$$`;
        if (block.kind === "code") return `\`\`\`python\n${block.content}\n\`\`\``;
        if (block.kind === "graph") return `### ${block.title || "Graph"}\n\n\`\`\`plot2d\n${JSON.stringify({ expression: block.content, title: block.title || "Graph" }, null, 2)}\n\`\`\``;
        if (block.kind === "table") return `### ${block.title || "Table"}\n\n${block.content.split(/\r?\n/).map((row) => `| ${row.split(",").join(" | ")} |`).join("\n")}`;
        if (block.kind === "result") return `> **Result.** ${block.content}`;
        return block.content;
    });
    return `# ${title}\n\n## ${pageTitle}\n\n${sections.join("\n\n")}`.trim() + "\n";
}

function notebookToIpynb(title: string, blocks: NotebookBlock[]) {
    return JSON.stringify({
        cells: blocks.map((block) => ({
            cell_type: block.kind === "code" ? "code" : "markdown",
            execution_count: null,
            metadata: {
                axion_block_id: block.id,
                axion_block_kind: block.kind,
                scientific_object_reference: block.scientific_object_reference,
            },
            outputs: [],
            source: (block.kind === "formula" ? `$$\n${block.content}\n$$` : block.content).split("\n").flatMap((line, index, lines) => index < lines.length - 1 ? [`${line}\n`] : [line]),
        })),
        metadata: {
            kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
            language_info: { name: "python" },
            axion_notebook: { schema_version: "1.0", title },
        },
        nbformat: 4,
        nbformat_minor: 5,
    }, null, 2);
}

function notebookToLatex(title: string, pageTitle: string, blocks: NotebookBlock[]) {
    const body = blocks.map((block) => {
        if (block.kind === "formula") return `\\[${block.content}\\]`;
        if (block.kind === "code") return `\\begin{verbatim}\n${block.content}\n\\end{verbatim}`;
        return block.content;
    }).join("\n\n");
    return `\\documentclass{article}\n\\usepackage{amsmath}\n\\title{${title}}\n\\begin{document}\n\\maketitle\n\\section*{${pageTitle}}\n${body}\n\\end{document}\n`;
}

function downloadNotebookFile(filename: string, content: string, mediaType = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mediaType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function NotebookWorkspace() {
    const { theme, setTheme } = useTheme();
    const [blocks, setBlocks] = React.useState<NotebookBlock[]>(starterBlocks);
    const [documentTitle, setDocumentTitle] = React.useState("Research Notebook");
    const [pageTitle, setPageTitle] = React.useState("Heat Equation");
    const [saveState, setSaveState] = React.useState<SaveState>("saved");
    const [running, setRunning] = React.useState(false);
    const [executionMessage, setExecutionMessage] = React.useState<string | null>(null);
    const jupyterConfigured = Boolean(process.env.NEXT_PUBLIC_JUPYTER_URL);
    const [executionTarget, setExecutionTarget] = React.useState<NotebookExecutionTarget>(
        jupyterConfigured ? "jupyter-kernel" : "this-device",
    );
    const kernelAdapterRef = React.useRef<NotebookKernelAdapter | null>(null);
    const [activeBlockId, setActiveBlockId] = React.useState<string | null>("graph");
    const [insertIndex, setInsertIndex] = React.useState<number | null>(2);
    const [commandOpen, setCommandOpen] = React.useState(false);
    const [commandSearch, setCommandSearch] = React.useState("");
    const [shareOpen, setShareOpen] = React.useState(false);
    const [shareLink, setShareLink] = React.useState("");
    const [historyOpen, setHistoryOpen] = React.useState(false);
    const [historyItems, setHistoryItems] = React.useState<NotebookHistoryItem[]>([]);
    const [exportOpen, setExportOpen] = React.useState(false);
    const [moreOpen, setMoreOpen] = React.useState(false);
    const [documentsOpen, setDocumentsOpen] = React.useState(false);
    const [documents, setDocuments] = React.useState<NotebookDocument[]>([]);
    const [outlineOpen, setOutlineOpen] = React.useState(false);
    const [menuBlockId, setMenuBlockId] = React.useState<string | null>(null);
    const [draggingId, setDraggingId] = React.useState<string | null>(null);
    const [backendDocumentId, setBackendDocumentId] = React.useState<string | null>(null);
    const historyHydratedRef = React.useRef(false);
    const saveTimerRef = React.useRef<number | null>(null);
    const notebookStateRef = React.useRef({ blocks, documentTitle, pageTitle, executionTarget, backendDocumentId });
    notebookStateRef.current = { blocks, documentTitle, pageTitle, executionTarget, backendDocumentId };

    const persistNotebook = React.useCallback(async (snapshot = notebookStateRef.current) => {
        try {
            await ensureNotebookGuestSession();
            const current = snapshot;
            const payload: NotebookDocumentPayload = {
                title: current.documentTitle,
                summary: current.pageTitle,
                visibility: "private",
                blocks: current.blocks.map(toApiNotebookBlock),
                metadata: {
                    schema_version: 1,
                    source: "notebook-workspace-v1",
                    execution_target: current.executionTarget,
                },
            };
            const saved = current.backendDocumentId
                ? await updateNotebookDocument(current.backendDocumentId, payload)
                : await createNotebookDocument(payload);
            setBackendDocumentId(saved.id);
            window.localStorage.setItem("axion-notebook-backend-document-id", saved.id);
            setDocuments((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
            setSaveState("saved");
        } catch (error) {
            setSaveState("error");
            setExecutionMessage(error instanceof Error ? `Local copy kept; server save failed: ${error.message}` : "Local copy kept; server save failed.");
        }
    }, []);

    const touch = React.useCallback(() => {
        setSaveState("saving");
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            void persistNotebook();
        }, 900);
    }, [persistNotebook]);

    React.useEffect(() => {
        let alive = true;
        const searchParams = new URLSearchParams(window.location.search);
        const isTransferHydration = searchParams.get("source") === "transfer" && Boolean(searchParams.get("transferId"));
        void ensureNotebookGuestSession()
            .then(() => fetchNotebookDocuments())
            .then((documents) => {
                if (alive) setDocuments(documents);
                // A cross-app Scientific Object import owns the initial state for
                // this navigation. Loading an older/default document afterwards
                // would overwrite the imported block before autosave completes.
                if (!alive || isTransferHydration || !documents.length) return;
                const storedId = window.localStorage.getItem("axion-notebook-backend-document-id");
                const document = documents.find((item: { id: string }) => item.id === storedId) || documents[0];
                if (!document) return;
                setBackendDocumentId(document.id);
                setDocumentTitle(document.title);
                setPageTitle(document.summary || "Research Notebook");
                setBlocks(document.blocks.map(fromApiNotebookBlock));
                window.localStorage.setItem("axion-notebook-backend-document-id", document.id);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, []);

    const selectDocument = React.useCallback((document: NotebookDocument) => {
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        if (saveState === "saving") void persistNotebook(notebookStateRef.current);
        setBackendDocumentId(document.id);
        setDocumentTitle(document.title);
        setPageTitle(document.summary || "Research Notebook");
        setBlocks(document.blocks.map(fromApiNotebookBlock));
        window.localStorage.setItem("axion-notebook-backend-document-id", document.id);
        setDocumentsOpen(false);
        setMoreOpen(false);
        setSaveState("saved");
        setExecutionMessage(`Opened ${document.title}.`);
    }, [persistNotebook, saveState]);

    const startNewNotebook = React.useCallback(() => {
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        if (saveState === "saving") void persistNotebook(notebookStateRef.current);
        setBackendDocumentId(null);
        window.localStorage.removeItem("axion-notebook-backend-document-id");
        setDocumentTitle("Research Notebook");
        setPageTitle("Untitled study");
        setBlocks([]);
        setActiveBlockId(null);
        setSaveState("saving");
        setDocumentsOpen(false);
        setMoreOpen(false);
        setExecutionMessage("New notebook ready. Add a block to save it.");
    }, [persistNotebook, saveState]);

    React.useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const objectId = searchParams.get("objectId");
        const transferId = searchParams.get("transferId");
        const source = searchParams.get("source");
        if (source === "transfer" && transferId) {
            void fetchScientificObjectTransfer(transferId)
                .then(async (transfer) => {
                    const object = await importLocalScientificObject(transfer.payload);
                    await discardScientificObjectTransfer(transferId);
                    return object;
                })
                .then((object) => {
                    if (!object?.revision?.payload || typeof object.revision.payload !== "object") return;
                    const payload = object.revision.payload as Record<string, unknown>;
                    const report = typeof payload.report_markdown === "string" ? payload.report_markdown : "";
                    const summary = typeof payload.summary === "string" ? payload.summary : "";
                    const content = report.trim() || summary.trim() || JSON.stringify(payload, null, 2);
                    const scientificObjectReference: ScientificObjectReference = {
                        projectId: object.projectId,
                        objectId: object.id,
                        mode: "pinned",
                        revision: object.currentRevision,
                    };
                    void createLocalScientificReference({
                        projectId: object.projectId,
                        reference: scientificObjectReference,
                        containerObjectId: "notebook-workspace:local",
                        role: "notebook-result-source",
                    });
                    setBlocks((current) => current.some((block) => block.id === `scientific-object-${object.id}`)
                        ? current
                        : [...current, { id: `scientific-object-${object.id}`, kind: "result", title: object.title, content, scientific_object_reference: scientificObjectReference }]);
                    setPageTitle(object.title);
                    setActiveBlockId(`scientific-object-${object.id}`);
                    touch();
                })
                .catch((error) => setExecutionMessage(error instanceof Error ? error.message : "Scientific Object transfer failed."));
            return;
        }
        if (!objectId || source !== "project") return;
        void getLocalScientificObject(objectId).then((object) => {
            if (!object?.revision?.payload || typeof object.revision.payload !== "object") return;
            const payload = object.revision.payload as Record<string, unknown>;
            const report = typeof payload.report_markdown === "string" ? payload.report_markdown : "";
            const summary = typeof payload.summary === "string" ? payload.summary : "";
            const content = report.trim() || summary.trim() || JSON.stringify(payload, null, 2);
            const scientificObjectReference: ScientificObjectReference = {
                projectId: object.projectId,
                objectId: object.id,
                mode: "pinned",
                revision: object.currentRevision,
            };
            void createLocalScientificReference({
                projectId: object.projectId,
                reference: scientificObjectReference,
                containerObjectId: "notebook-workspace:local",
                role: "notebook-result-source",
            });
            setBlocks((current) => current.some((block) => block.id === `scientific-object-${object.id}`)
                ? current
                : [...current, { id: `scientific-object-${object.id}`, kind: "result", title: object.title, content, scientific_object_reference: scientificObjectReference }]);
            setPageTitle(object.title);
            setActiveBlockId(`scientific-object-${object.id}`);
            touch();
        }).catch(() => undefined);
    }, [touch]);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setCommandOpen(true);
            }
            if (event.key === "Escape") {
                setCommandOpen(false);
                setShareOpen(false);
                setHistoryOpen(false);
                setDocumentsOpen(false);
                setExportOpen(false);
                setInsertIndex(null);
                setMoreOpen(false);
                setMenuBlockId(null);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    React.useEffect(() => {
        setShareLink(window.location.href);
        try {
            const raw = window.localStorage.getItem("axion-notebook-history-v1");
            const parsed = raw ? JSON.parse(raw) : [];
            setHistoryItems(Array.isArray(parsed) ? parsed.slice(0, 12) : []);
        } catch {
            setHistoryItems([]);
        } finally {
            historyHydratedRef.current = true;
        }
    }, []);

    React.useEffect(() => {
        if (!historyHydratedRef.current) return;
        window.localStorage.setItem("axion-notebook-history-v1", JSON.stringify(historyItems.slice(0, 12)));
    }, [historyItems]);

    React.useEffect(() => {
        const signature = JSON.stringify({ documentTitle, pageTitle, blocks });
        const timer = window.setTimeout(() => {
            setHistoryItems((current) => {
                if (current[0]?.signature === signature) return current;
                return [
                    {
                        id: createClientId("history"),
                        documentTitle,
                        pageTitle,
                        blocks,
                        createdAt: new Date().toISOString(),
                        signature,
                    },
                    ...current,
                ].slice(0, 12);
            });
        }, 1800);
        return () => window.clearTimeout(timer);
    }, [blocks, documentTitle, pageTitle]);

    React.useEffect(() => () => {
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        if (kernelAdapterRef.current?.dispose) void kernelAdapterRef.current.dispose();
    }, []);

    const getKernelAdapter = React.useCallback(() => {
        if (executionTarget !== "this-device" && executionTarget !== "jupyter-kernel") {
            throw new Error(`EXECUTION_TARGET_NOT_CONFIGURED:${executionTarget}`);
        }
        if (executionTarget === "jupyter-kernel" && !jupyterConfigured) {
            throw new Error("JUPYTER_SERVER_NOT_CONFIGURED");
        }
        if (!kernelAdapterRef.current || kernelAdapterRef.current.target !== executionTarget) {
            if (kernelAdapterRef.current?.dispose) void kernelAdapterRef.current.dispose();
            kernelAdapterRef.current = createNotebookKernelAdapter(executionTarget, {
                jupyter: executionTarget === "jupyter-kernel" ? {
                    baseUrl: process.env.NEXT_PUBLIC_JUPYTER_URL || "",
                    token: process.env.NEXT_PUBLIC_JUPYTER_TOKEN,
                    kernelName: process.env.NEXT_PUBLIC_JUPYTER_KERNEL || "python3",
                } : undefined,
                pyodide: {
                    indexURL: process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL,
                    loadPackagesFromImports: true,
                },
            });
        }
        return kernelAdapterRef.current;
    }, [executionTarget, jupyterConfigured]);

    const updateBlock = (id: string, patch: Partial<NotebookBlock>) => {
        setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...patch } : block)));
        touch();
    };

    const addBlock = (kind: BlockKind, atIndex = blocks.length) => {
        const next = createBlock(kind);
        setBlocks((current) => [...current.slice(0, atIndex), next, ...current.slice(atIndex)]);
        setActiveBlockId(next.id);
        setInsertIndex(null);
        setCommandOpen(false);
        setCommandSearch("");
        touch();
    };

    const removeBlock = (id: string) => {
        setBlocks((current) => current.filter((block) => block.id !== id));
        if (activeBlockId === id) setActiveBlockId(null);
        setMenuBlockId(null);
        touch();
    };

    const restoreHistoryItem = (item: NotebookHistoryItem) => {
        setBlocks(item.blocks);
        setDocumentTitle(item.documentTitle);
        setPageTitle(item.pageTitle);
        setHistoryOpen(false);
        setExecutionMessage(`Restored ${new Date(item.createdAt).toLocaleTimeString()}.`);
        touch();
    };

    const handleExport = async (format: string) => {
        setExportOpen(false);
        const markdown = notebookToMarkdown(documentTitle, pageTitle, blocks);
        if (format === "Markdown") {
            downloadNotebookFile(`${documentTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "notebook"}.md`, markdown);
            setExecutionMessage("Markdown export downloaded.");
            return;
        }
        if (format === "LaTeX") {
            downloadNotebookFile(`${documentTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "notebook"}.tex`, notebookToLatex(documentTitle, pageTitle, blocks));
            setExecutionMessage("LaTeX export downloaded.");
            return;
        }
        if (format === "Notebook JSON") {
            downloadNotebookFile(`${documentTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "notebook"}.json`, JSON.stringify({ schemaVersion: "1.0", documentTitle, pageTitle, blocks, exportedAt: new Date().toISOString() }, null, 2), "application/json;charset=utf-8");
            setExecutionMessage("Notebook JSON export downloaded.");
            return;
        }
        if (format === "Jupyter .ipynb") {
            downloadNotebookFile(`${documentTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "notebook"}.ipynb`, notebookToIpynb(documentTitle, blocks), "application/json;charset=utf-8");
            setExecutionMessage("Jupyter notebook export downloaded.");
            return;
        }
        if (format === "Writer") {
            const projectId = resolveActiveProjectId();
            const transferProjectId = projectId || "unassigned-transfer";
            try {
                const sourceReference = [...blocks]
                    .reverse()
                    .find((block) => block.scientific_object_reference)?.scientific_object_reference;
                const serialized = sourceReference
                    ? await exportLocalScientificObject(sourceReference.objectId)
                    : await (async () => {
                        const object = await createLocalScientificObject({
                            projectId: transferProjectId,
                            kind: "notebook",
                            domain: "notebook",
                            title: `${documentTitle} · ${pageTitle}`,
                            sourceApp: "notebook",
                            payload: {
                                type: "notebook",
                                schemaVersion: "1.0",
                                documentTitle,
                                pageTitle,
                                blocks,
                                report_markdown: markdown,
                                summary: `Notebook with ${blocks.length} scientific blocks.`,
                            },
                            provenance: {
                                sourceApp: "notebook",
                                engine: "Axion Notebook",
                                engineVersion: "workspace-v1",
                                executionTarget,
                                inputs: { blockCount: blocks.length },
                                finishedAt: new Date().toISOString(),
                            },
                        });
                        return await exportLocalScientificObject(object.id);
                    })();
                try {
                    const transfer = await publishScientificObjectTransfer(await serialized);
                    window.location.href = getEcosystemTransferHref("writer", transfer.transferId, projectId);
                } catch (error) {
                    if (projectId && sourceReference) {
                        window.location.href = getEcosystemObjectHref("writer", projectId, sourceReference.objectId);
                        return;
                    }
                    throw error;
                }
            } catch (error) {
                setExecutionMessage(error instanceof Error ? error.message : "Writer handoff failed.");
            }
            return;
        }
        setExecutionMessage(`${format} export will be connected to the render pipeline.`);
    };

    const duplicateBlock = (id: string) => {
        setBlocks((current) => {
            const index = current.findIndex((block) => block.id === id);
            if (index < 0) return current;
            const source = current[index];
            const copy = { ...source, id: `${source.kind}-${createClientId()}` };
            return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
        });
        setMenuBlockId(null);
        touch();
    };

    const moveBlock = (id: string, direction: -1 | 1) => {
        setBlocks((current) => {
            const index = current.findIndex((block) => block.id === id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
        setMenuBlockId(null);
        touch();
    };

    const runNotebook = async () => {
        const codeBlock = blocks.find((block) => block.kind === "code");
        if (!codeBlock) {
            setExecutionMessage("Add a Python code block first.");
            return;
        }
        setRunning(true);
        setExecutionMessage(executionTarget === "jupyter-kernel" ? "Connecting to Jupyter kernel…" : "Starting local Pyodide kernel…");
        try {
            const adapter = getKernelAdapter();
            const execution = await adapter.execute(codeBlock.content);
            if (execution.status === "error") {
                setExecutionMessage(execution.output.errors?.[0]?.evalue || "Kernel execution failed.");
                return;
            }

            const projectId = resolveActiveProjectId();
            const outputText = execution.output.text || (execution.output.displayData?.length ? JSON.stringify(execution.output.displayData, null, 2) : "Execution completed without a displayed value.");
            let scientificObjectReference: ScientificObjectReference | undefined;
            if (projectId) {
                const object = await createLocalScientificObject({
                    projectId,
                    kind: "calculation",
                    domain: "notebook",
                    title: `${codeBlock.title || "Python"} execution`,
                    sourceApp: "notebook",
                    payload: {
                        type: "notebook-execution",
                        language: "python",
                        code: codeBlock.content,
                        output: execution.output,
                        runtime: execution.runtime,
                        execution_target: execution.target,
                        kernel_id: execution.kernelId,
                        duration_ms: execution.durationMs,
                    },
                    provenance: {
                        sourceApp: "notebook",
                        engine: execution.target === "jupyter-kernel" ? "Jupyter Kernel" : "Pyodide",
                        engineVersion: execution.target === "jupyter-kernel" ? "configured-server" : "0.29.3",
                        executionTarget: execution.target,
                        inputs: { blockId: codeBlock.id },
                        parameters: { runtimeMs: execution.durationMs, kernelId: execution.kernelId },
                        finishedAt: new Date().toISOString(),
                    },
                });
                scientificObjectReference = {
                    projectId: object.projectId,
                    objectId: object.id,
                    mode: "pinned",
                    revision: object.currentRevision,
                };
                await createLocalScientificReference({
                    projectId,
                    reference: scientificObjectReference,
                    containerObjectId: "notebook-workspace:local",
                    role: "notebook-execution-result",
                });
            }

            const resultBlock: NotebookBlock = {
                id: `result-${createClientId()}`,
                kind: "result",
                title: `${codeBlock.title || "Python"} result`,
                content: outputText,
                scientific_object_reference: scientificObjectReference,
            };
            setBlocks((current) => [...current, resultBlock]);
            setActiveBlockId(resultBlock.id);
            setExecutionMessage(projectId
                ? `Executed on ${execution.target}; saved as a Scientific Object.`
                : `Executed on ${execution.target}. Open this notebook from a Project to save the result object.`);
            touch();
        } catch (error) {
            setExecutionMessage(error instanceof Error ? error.message : "Kernel execution failed.");
        } finally {
            setRunning(false);
        }
    };

    const reorderOnDrop = (targetId: string) => {
        if (!draggingId || draggingId === targetId) return;
        setBlocks((current) => {
            const from = current.findIndex((item) => item.id === draggingId);
            const to = current.findIndex((item) => item.id === targetId);
            if (from < 0 || to < 0) return current;
            const next = [...current];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
        setDraggingId(null);
        touch();
    };

    const filteredCatalog = blockCatalog.filter((item) => {
        const query = commandSearch.trim().toLowerCase();
        if (!query) return true;
        return `${item.label} ${item.description}`.toLowerCase().includes(query);
    });

    return (
        <div id="notebook" className="min-h-screen bg-[#f5f5f3] text-[#171717] transition-colors dark:bg-[#090909] dark:text-[#f5f5f5]">
            <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/90 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#0b0b0b]/88">
                <div className="mx-auto flex h-[62px] max-w-[1680px] items-center gap-3 px-4 sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <button className="notebook-icon-button" aria-label="Go back">
                            <ArrowLeft className="h-[18px] w-[18px]" />
                        </button>
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#171717] text-sm font-black text-white dark:bg-white dark:text-black">N</div>
                            <span className="hidden text-sm font-extrabold tracking-[-0.02em] sm:block">Notebook</span>
                        </div>
                    </div>

                    <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 md:flex">
                        <input
                            value={documentTitle}
                            onChange={(event) => {
                                setDocumentTitle(event.target.value);
                                touch();
                            }}
                            className="w-[190px] bg-transparent text-center text-sm font-semibold tracking-[-0.01em] outline-none"
                        />
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-black/40 dark:text-white/40">
                            {saveState === "saved" ? <Check className="h-3.5 w-3.5" /> : <span className={`h-1.5 w-1.5 ${saveState === "saving" ? "animate-pulse" : "bg-red-500"} rounded-full`} />}
                            {saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Saving"}
                        </span>
                    </div>

                    <div className="flex flex-1 items-center justify-end gap-1.5">
                        <label className="hidden items-center gap-1.5 rounded-[11px] border border-black/[0.07] bg-black/[0.025] px-2.5 py-2 text-[10px] font-semibold text-black/48 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/45 sm:flex">
                            <span className="hidden lg:inline">Kernel</span>
                            <select
                                aria-label="Execution target"
                                value={executionTarget}
                                disabled={running}
                                onChange={(event) => {
                                    const nextTarget = event.target.value as NotebookExecutionTarget;
                                    setExecutionTarget(nextTarget);
                                    setExecutionMessage(nextTarget === "jupyter-kernel" && !jupyterConfigured
                                        ? "Configure NEXT_PUBLIC_JUPYTER_URL first."
                                        : null);
                                }}
                                className="max-w-[112px] cursor-pointer bg-transparent text-[10px] font-bold text-black/70 outline-none dark:text-white/70"
                            >
                                <option value="this-device">This device</option>
                                <option value="jupyter-kernel" disabled={!jupyterConfigured}>Jupyter kernel{jupyterConfigured ? "" : " · setup needed"}</option>
                                <option value="external-server" disabled>External server · next</option>
                                <option value="hpc-cluster" disabled>HPC cluster · next</option>
                            </select>
                        </label>
                        <button onClick={runNotebook} className="notebook-toolbar-button">
                            <Play className={`h-3.5 w-3.5 ${running ? "animate-pulse" : ""}`} />
                            <span className="hidden sm:inline">{running ? "Running" : "Run"}</span>
                        </button>
                        {executionMessage ? <span className={`${saveState === "error" ? "inline max-w-[220px] text-red-600 dark:text-red-300" : "hidden xl:inline max-w-[240px]"} truncate text-[10px] font-semibold text-black/40 dark:text-white/40`}>{executionMessage}</span> : null}
                        <button onClick={() => setShareOpen(true)} className="notebook-toolbar-button">
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Share</span>
                        </button>
                        <div className="relative">
                            <button onClick={() => setMoreOpen((value) => !value)} className="notebook-icon-button" aria-label="More actions">
                                <MoreHorizontal className="h-[18px] w-[18px]" />
                            </button>
                            {moreOpen ? (
                                <div className="notebook-popover absolute right-0 top-11 w-56 p-1.5">
                                    <MenuButton icon={FileText} label="Documents" onClick={() => { setDocumentsOpen(true); setMoreOpen(false); }} />
                                    <MenuButton icon={Plus} label="New notebook" onClick={startNewNotebook} />
                                    <div className="my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                                    <MenuButton icon={Clock3} label="History" onClick={() => { setHistoryOpen(true); setMoreOpen(false); }} />
                                    <MenuButton icon={Download} label="Export" onClick={() => { setExportOpen(true); setMoreOpen(false); }} />
                                    <MenuButton icon={Search} label="Command palette" shortcut="⌘K" onClick={() => { setCommandOpen(true); setMoreOpen(false); }} />
                                    <div className="my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                                    <MenuButton
                                        icon={theme === "dark" ? Sun : Moon}
                                        label={theme === "dark" ? "Light appearance" : "Dark appearance"}
                                        onClick={() => { setTheme(theme === "dark" ? "light" : "dark"); setMoreOpen(false); }}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </header>

            <div className="relative mx-auto flex max-w-[1680px]">
                <aside className={`fixed bottom-5 left-4 z-30 hidden lg:block ${outlineOpen ? "w-64" : "w-auto"}`}>
                    {outlineOpen ? (
                        <div className="notebook-popover w-64 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                <div>
                                    <div className="text-xs font-extrabold">Outline</div>
                                    <div className="mt-0.5 text-[11px] text-black/40 dark:text-white/40">{blocks.length} blocks</div>
                                </div>
                                <button onClick={() => setOutlineOpen(false)} className="notebook-icon-button h-8 w-8">
                                    <PanelLeftClose className="h-4 w-4" />
                                </button>
                            </div>
                            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                                {pageTitle || "Untitled"}
                            </button>
                            <div className="mt-1 space-y-0.5">
                                {blocks.map((block) => (
                                    <button
                                        key={block.id}
                                        onClick={() => {
                                            document.getElementById(`block-${block.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                            setActiveBlockId(block.id);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] text-black/55 hover:bg-black/[0.04] hover:text-black dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white"
                                    >
                                        <BlockGlyph kind={block.kind} />
                                        <span className="truncate">{block.title || blockCatalog.find((item) => item.kind === block.kind)?.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setOutlineOpen(true)} className="notebook-floating-button" aria-label="Open outline">
                            <PanelLeftOpen className="h-4 w-4" />
                        </button>
                    )}
                </aside>

                <main className="w-full px-3 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-14">
                    <article className="notebook-document mx-auto min-h-[calc(100vh-120px)] max-w-[1060px] px-5 py-12 sm:px-10 sm:py-16 md:px-16 lg:px-[96px]">
                        <div className="mx-auto max-w-[820px]">
                            <input
                                value={pageTitle}
                                onChange={(event) => {
                                    setPageTitle(event.target.value);
                                    touch();
                                }}
                                className="w-full bg-transparent font-serif text-[38px] font-semibold leading-tight tracking-[-0.035em] outline-none placeholder:text-black/20 dark:placeholder:text-white/20 sm:text-[48px]"
                                placeholder="Untitled"
                            />
                            <div className="mt-3 text-[12px] font-medium text-black/32 dark:text-white/30">Edited just now · Computational document</div>
                        </div>

                        <div className="mx-auto mt-8 max-w-[820px] sm:mt-10">
                            <InsertPoint index={0} open={insertIndex === 0} onToggle={() => setInsertIndex(insertIndex === 0 ? null : 0)} onAdd={addBlock} />

                            {blocks.map((block, index) => (
                                <React.Fragment key={block.id}>
                                    <div
                                        id={`block-${block.id}`}
                                        draggable
                                        onDragStart={() => setDraggingId(block.id)}
                                        onDragEnd={() => setDraggingId(null)}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => reorderOnDrop(block.id)}
                                        onClick={() => setActiveBlockId(block.id)}
                                        className={`group relative scroll-mt-28 rounded-[20px] transition-all duration-200 ${draggingId === block.id ? "opacity-40" : ""}`}
                                    >
                                        <div className={`absolute -left-10 top-3 hidden items-center gap-1 transition-opacity lg:flex ${activeBlockId === block.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                            <button className="cursor-grab p-1.5 text-black/22 hover:text-black/50 active:cursor-grabbing dark:text-white/20 dark:hover:text-white/50" aria-label="Drag block">
                                                <GripVertical className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <div className={`absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full border border-black/[0.06] bg-white/90 p-1 shadow-sm backdrop-blur-xl transition-all dark:border-white/[0.08] dark:bg-[#181818]/92 ${activeBlockId === block.id ? "opacity-100" : "pointer-events-none -translate-y-1 opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"}`}>
                                            {(block.kind === "code" || block.kind === "graph") ? (
                                                <button onClick={(event) => { event.stopPropagation(); runNotebook(); }} className="notebook-context-button" aria-label="Run block">
                                                    <Play className="h-3.5 w-3.5" />
                                                </button>
                                            ) : null}
                                            <div className="relative">
                                                <button onClick={(event) => { event.stopPropagation(); setMenuBlockId(menuBlockId === block.id ? null : block.id); }} className="notebook-context-button" aria-label="Block actions">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                                {menuBlockId === block.id ? (
                                                    <div onClick={(event) => event.stopPropagation()} className="notebook-popover absolute right-0 top-9 w-48 p-1.5">
                                                        <MenuButton icon={Copy} label="Duplicate" onClick={() => duplicateBlock(block.id)} />
                                                        <MenuButton icon={ChevronUp} label="Move up" onClick={() => moveBlock(block.id, -1)} />
                                                        <MenuButton icon={ChevronDown} label="Move down" onClick={() => moveBlock(block.id, 1)} />
                                                        <div className="my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                                                        <MenuButton icon={Trash2} label="Delete" destructive onClick={() => removeBlock(block.id)} />
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <BlockRenderer block={block} active={activeBlockId === block.id} onChange={(patch) => updateBlock(block.id, patch)} />
                                    </div>
                                    <InsertPoint index={index + 1} open={insertIndex === index + 1} onToggle={() => setInsertIndex(insertIndex === index + 1 ? null : index + 1)} onAdd={addBlock} />
                                </React.Fragment>
                            ))}

                            {!blocks.length ? (
                                <button onClick={() => setInsertIndex(0)} className="mx-auto flex min-h-44 w-full items-center justify-center rounded-[22px] border border-dashed border-black/10 text-sm font-semibold text-black/35 transition hover:border-black/20 hover:text-black/60 dark:border-white/10 dark:text-white/35 dark:hover:border-white/20 dark:hover:text-white/60">
                                    <Plus className="mr-2 h-4 w-4" /> Add your first block
                                </button>
                            ) : null}
                        </div>
                    </article>
                </main>
            </div>

            {commandOpen ? (
                <ModalBackdrop onClose={() => setCommandOpen(false)}>
                    <div className="notebook-modal w-full max-w-xl overflow-hidden p-2">
                        <div className="flex items-center gap-3 border-b border-black/[0.06] px-3 dark:border-white/[0.08]">
                            <Search className="h-4 w-4 text-black/35 dark:text-white/35" />
                            <input
                                autoFocus
                                value={commandSearch}
                                onChange={(event) => setCommandSearch(event.target.value)}
                                placeholder="Search blocks and actions…"
                                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-black/30 dark:placeholder:text-white/30"
                            />
                            <kbd className="rounded-md border border-black/[0.08] px-1.5 py-1 text-[10px] text-black/35 dark:border-white/[0.1] dark:text-white/35">ESC</kbd>
                        </div>
                        <div className="p-1.5">
                            <div className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-black/30 dark:text-white/28">Add block</div>
                            {filteredCatalog.map((item) => (
                                <button key={item.kind} onClick={() => addBlock(item.kind)} className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition hover:bg-black/[0.045] dark:hover:bg-white/[0.06]">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.045] dark:bg-white/[0.07]"><item.icon className="h-4 w-4" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold">{item.label}</span>
                                        <span className="mt-0.5 block text-[11px] text-black/38 dark:text-white/35">{item.description}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </ModalBackdrop>
            ) : null}

            {shareOpen ? (
                <ModalBackdrop onClose={() => setShareOpen(false)}>
                    <div className="notebook-modal w-full max-w-md p-6">
                        <div className="flex items-start justify-between gap-6">
                            <div>
                                <div className="text-lg font-extrabold tracking-[-0.025em]">Share notebook</div>
                                <div className="mt-1 text-xs leading-5 text-black/42 dark:text-white/40">Invite collaborators or copy a public demo link.</div>
                            </div>
                            <button onClick={() => setShareOpen(false)} className="notebook-icon-button"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-6 flex items-center gap-2 rounded-[14px] border border-black/[0.08] bg-black/[0.025] p-2 dark:border-white/[0.09] dark:bg-white/[0.04]">
                            <div className="min-w-0 flex-1 truncate px-2 text-xs text-black/45 dark:text-white/42">{shareLink || "Current workspace"}</div>
                            <button
                                onClick={() => {
                                    const link = shareLink || window.location.href;
                                    void navigator.clipboard?.writeText(link);
                                    setExecutionMessage("Workspace link copied.");
                                }}
                                className="rounded-[10px] bg-black px-3 py-2 text-xs font-bold text-white dark:bg-white dark:text-black"
                            >Copy link</button>
                        </div>
                        <div className="mt-5 flex items-center justify-between rounded-[14px] border border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
                            <div>
                                <div className="text-xs font-bold">Anyone with the link</div>
                                <div className="mt-1 text-[11px] text-black/38 dark:text-white/36">Can view this notebook</div>
                            </div>
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">View only</span>
                        </div>
                    </div>
                </ModalBackdrop>
            ) : null}

            {historyOpen ? (
                <ModalBackdrop onClose={() => setHistoryOpen(false)}>
                    <div className="notebook-modal w-full max-w-lg p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-lg font-extrabold tracking-[-0.025em]">Version history</div>
                                <div className="mt-1 text-xs text-black/40 dark:text-white/38">Local notebook snapshots</div>
                            </div>
                            <button onClick={() => setHistoryOpen(false)} className="notebook-icon-button"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-5 space-y-2">
                            {historyItems.length ? historyItems.map((item, index) => (
                                <button key={item.id} onClick={() => restoreHistoryItem(item)} className="flex w-full items-center gap-3 rounded-[15px] border border-black/[0.06] px-4 py-3 text-left transition hover:bg-black/[0.025] dark:border-white/[0.08] dark:hover:bg-white/[0.04]">
                                    <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-emerald-500" : "bg-black/15 dark:bg-white/20"}`} />
                                    <span className="flex-1">
                                        <span className="block truncate text-xs font-bold">{item.pageTitle || item.documentTitle}</span>
                                        <span className="mt-1 block text-[11px] text-black/38 dark:text-white/35">{new Date(item.createdAt).toLocaleString()} · {item.blocks.length} blocks</span>
                                    </span>
                                    {index === 0 ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : null}
                                </button>
                            )) : (
                                <div className="rounded-[15px] border border-dashed border-black/[0.08] px-4 py-5 text-xs text-black/40 dark:border-white/[0.1] dark:text-white/38">Snapshots will appear after the first edit.</div>
                            )}
                        </div>
                    </div>
                </ModalBackdrop>
            ) : null}

            {documentsOpen ? (
                <ModalBackdrop onClose={() => setDocumentsOpen(false)}>
                    <div className="notebook-modal w-full max-w-lg p-6">
                        <div className="flex items-start justify-between gap-6">
                            <div>
                                <div className="text-lg font-extrabold tracking-[-0.025em]">Documents</div>
                                <div className="mt-1 text-xs text-black/40 dark:text-white/38">Saved notebooks in this workspace</div>
                            </div>
                            <button onClick={() => setDocumentsOpen(false)} className="notebook-icon-button"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-5 space-y-2">
                            {documents.length ? documents.map((document) => (
                                <button key={document.id} onClick={() => selectDocument(document)} className={`flex w-full items-center gap-3 rounded-[15px] border px-4 py-3 text-left transition hover:bg-black/[0.025] dark:hover:bg-white/[0.04] ${document.id === backendDocumentId ? "border-black/20 dark:border-white/20" : "border-black/[0.06] dark:border-white/[0.08]"}`}>
                                    <FileText className="h-4 w-4 shrink-0 text-black/35 dark:text-white/35" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-bold">{document.title}</span>
                                        <span className="mt-1 block truncate text-[11px] text-black/38 dark:text-white/35">{document.summary || "No summary"} · {document.blocks.length} blocks</span>
                                    </span>
                                    {document.id === backendDocumentId ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : null}
                                </button>
                            )) : (
                                <div className="rounded-[15px] border border-dashed border-black/[0.08] px-4 py-5 text-xs text-black/40 dark:border-white/[0.1] dark:text-white/38">No saved notebooks yet. Add a block and it will appear here.</div>
                            )}
                        </div>
                    </div>
                </ModalBackdrop>
            ) : null}

            {exportOpen ? (
                <ModalBackdrop onClose={() => setExportOpen(false)}>
                    <div className="notebook-modal w-full max-w-md p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-lg font-extrabold tracking-[-0.025em]">Export</div>
                                <div className="mt-1 text-xs text-black/40 dark:text-white/38">Keep the notebook clean; choose a format only when needed.</div>
                            </div>
                            <button onClick={() => setExportOpen(false)} className="notebook-icon-button"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            {["PDF", "Writer", "Markdown", "LaTeX", "Notebook JSON", "Jupyter .ipynb", "Image"].map((format) => (
                                <button key={format} onClick={() => void handleExport(format)} className="rounded-[14px] border border-black/[0.07] px-4 py-4 text-left text-xs font-bold transition hover:border-black/15 hover:bg-black/[0.025] dark:border-white/[0.09] dark:hover:border-white/15 dark:hover:bg-white/[0.04]">
                                    <Download className="mb-3 h-4 w-4 text-black/32 dark:text-white/32" />
                                    {format}
                                </button>
                            ))}
                        </div>
                    </div>
                </ModalBackdrop>
            ) : null}
        </div>
    );
}

function BlockRenderer({
    block,
    active,
    onChange,
}: {
    block: NotebookBlock;
    active: boolean;
    onChange: (patch: Partial<NotebookBlock>) => void;
}) {
    if (block.kind === "text") {
        return (
            <textarea
                value={block.content}
                onChange={(event) => onChange({ content: event.target.value })}
                rows={Math.max(2, Math.ceil(block.content.length / 92))}
                className="w-full resize-none bg-transparent px-1 py-3 text-[16px] leading-8 text-black/66 outline-none placeholder:text-black/25 dark:text-white/62 dark:placeholder:text-white/25 sm:text-[17px]"
            />
        );
    }

    if (block.kind === "formula") {
        return (
            <div className={`relative flex min-h-28 items-center justify-center rounded-[18px] px-7 py-8 transition ${active ? "bg-black/[0.018] dark:bg-white/[0.025]" : ""}`}>
                <div className="max-w-full overflow-x-auto text-center text-[22px] sm:text-[27px]">
                    <LaboratoryInlineMathMarkdown content={`$$${block.content}$$`} />
                </div>
            </div>
        );
    }

    if (block.kind === "code") {
        const lines = block.content.split(/\r?\n/);
        return (
            <div className={`overflow-hidden rounded-[16px] border transition ${active ? "border-black/12 shadow-[0_8px_24px_rgba(0,0,0,0.035)] dark:border-white/14" : "border-black/[0.07] dark:border-white/[0.09]"}`}>
                <div className="grid grid-cols-[42px_minmax(0,1fr)] bg-[#fafaf9] dark:bg-[#111]">
                    <div className="select-none border-r border-black/[0.055] py-4 text-right font-mono text-[12px] leading-6 text-black/22 dark:border-white/[0.07] dark:text-white/20">
                        {lines.map((_, index) => <div key={index} className="pr-3">{index + 1}</div>)}
                    </div>
                    <textarea
                        value={block.content}
                        onChange={(event) => onChange({ content: event.target.value })}
                        rows={Math.max(2, lines.length)}
                        spellCheck={false}
                        className="min-h-[82px] resize-none bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-[#262626] outline-none dark:text-[#e8e8e8]"
                    />
                </div>
            </div>
        );
    }

    if (block.kind === "graph") {
        return (
            <div className={`rounded-[18px] border bg-white p-4 transition dark:bg-[#101010] sm:p-5 ${active ? "border-black/12 shadow-[0_14px_36px_rgba(0,0,0,0.045)] dark:border-white/14" : "border-black/[0.07] dark:border-white/[0.09]"}`}>
                <div className="mb-4 flex items-center justify-between gap-4 pr-20">
                    <input
                        value={block.title || ""}
                        onChange={(event) => onChange({ title: event.target.value })}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-bold tracking-[-0.01em] outline-none"
                    />
                    <span className="hidden rounded-full bg-[#2f6df6]/[0.08] px-2.5 py-1 text-[10px] font-bold text-[#2f6df6] sm:inline">t = 0.5</span>
                </div>
                <div className="h-[260px] min-h-[260px] w-full sm:h-[320px] sm:min-h-[320px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={260} initialDimension={{ width: 640, height: 260 }} debounce={120}>
                        <LineChart data={graphData} margin={{ top: 8, right: 12, bottom: 10, left: -8 }}>
                            <CartesianGrid stroke="currentColor" strokeOpacity={0.07} vertical={false} />
                            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.13} />
                            <XAxis
                                dataKey="x"
                                type="number"
                                domain={[0, Math.PI * 2]}
                                ticks={[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2, Math.PI * 2]}
                                tickFormatter={(value) => {
                                    if (Math.abs(value) < 0.01) return "0";
                                    if (Math.abs(value - Math.PI / 2) < 0.01) return "π/2";
                                    if (Math.abs(value - Math.PI) < 0.01) return "π";
                                    if (Math.abs(value - (Math.PI * 3) / 2) < 0.01) return "3π/2";
                                    return "2π";
                                }}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.38 }}
                            />
                            <YAxis
                                domain={[-1.1, 1.1]}
                                ticks={[-1, -0.5, 0, 0.5, 1]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.38 }}
                            />
                            <Tooltip
                                formatter={(value) => [typeof value === "number" ? value.toFixed(4) : value, "u(x,t)"]}
                                labelFormatter={(value) => `x = ${Number(value).toFixed(3)}`}
                                contentStyle={{ borderRadius: 12, border: "1px solid rgba(120,120,120,.16)", fontSize: 11 }}
                            />
                            <Line type="monotone" dataKey="y" stroke="#2f6df6" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} animationDuration={0} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    if (block.kind === "table") {
        const rows = block.content.split(/\r?\n/).map((line) => line.split(","));
        return (
            <div className="overflow-hidden rounded-[16px] border border-black/[0.07] bg-white dark:border-white/[0.09] dark:bg-[#101010]">
                <div className="border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
                    <input value={block.title || "Values"} onChange={(event) => onChange({ title: event.target.value })} className="bg-transparent text-xs font-bold outline-none" />
                </div>
                <div className="divide-y divide-black/[0.055] dark:divide-white/[0.07]">
                    {rows.slice(0, 8).map((row, rowIndex) => (
                        <div key={rowIndex} className={`grid grid-cols-2 ${rowIndex === 0 ? "bg-black/[0.025] text-black/45 dark:bg-white/[0.04] dark:text-white/45" : ""}`}>
                            <div className="border-r border-black/[0.055] px-4 py-2.5 font-mono text-xs dark:border-white/[0.07]">{row[0] || ""}</div>
                            <div className="px-4 py-2.5 font-mono text-xs">{row[1] || ""}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-[17px] border px-4 py-4 sm:px-5 ${active ? "border-[#2f6df6]/20 bg-[#2f6df6]/[0.055]" : "border-[#2f6df6]/12 bg-[#2f6df6]/[0.035]"}`}>
            <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2f6df6]/10 text-[#2f6df6]">
                    <Sparkles className="h-3.5 w-3.5" />
                </span>
                <textarea
                    value={block.content}
                    onChange={(event) => onChange({ content: event.target.value })}
                    rows={Math.max(2, Math.ceil(block.content.length / 100))}
                    className="w-full resize-none bg-transparent text-[14px] leading-6 text-black/62 outline-none dark:text-white/60"
                />
            </div>
        </div>
    );
}

function InsertPoint({
    index,
    open,
    onToggle,
    onAdd,
}: {
    index: number;
    open: boolean;
    onToggle: () => void;
    onAdd: (kind: BlockKind, index: number) => void;
}) {
    return (
        <div className="group/insert relative flex h-10 items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-black/[0.05] opacity-0 transition group-hover/insert:opacity-100 dark:bg-white/[0.06]" />
            <button
                onClick={onToggle}
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border bg-white text-black/35 shadow-sm transition hover:scale-105 hover:text-black/65 dark:bg-[#151515] dark:text-white/35 dark:hover:text-white/70 ${open ? "border-black/15 opacity-100 dark:border-white/18" : "border-black/[0.07] opacity-0 group-hover/insert:opacity-100 dark:border-white/[0.09]"}`}
                aria-label="Insert block"
            >
                <Plus className={`h-3.5 w-3.5 transition ${open ? "rotate-45" : ""}`} />
            </button>
            {open ? (
                <div className="notebook-popover absolute left-1/2 top-9 z-30 w-[220px] -translate-x-1/2 p-1.5">
                    {blockCatalog.map((item) => (
                        <button key={item.kind} onClick={() => onAdd(item.kind, index)} className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition hover:bg-black/[0.045] dark:hover:bg-white/[0.06]">
                            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-black/[0.04] dark:bg-white/[0.07]"><item.icon className="h-3.5 w-3.5" /></span>
                            <span className="text-xs font-semibold">{item.label}</span>
                        </button>
                    ))}
                    <div className="mt-1 border-t border-black/[0.055] px-2.5 pt-2 text-[10px] text-black/30 dark:border-white/[0.07] dark:text-white/30">⌘K for all commands</div>
                </div>
            ) : null}
        </div>
    );
}

function MenuButton({
    icon: Icon,
    label,
    shortcut,
    destructive,
    onClick,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    shortcut?: string;
    destructive?: boolean;
    onClick: () => void;
}) {
    return (
        <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-black/[0.045] dark:hover:bg-white/[0.06] ${destructive ? "text-rose-600 dark:text-rose-400" : ""}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="flex-1">{label}</span>
            {shortcut ? <span className="text-[10px] font-medium text-black/30 dark:text-white/28">{shortcut}</span> : null}
        </button>
    );
}

function BlockGlyph({ kind }: { kind: BlockKind }) {
    const item = blockCatalog.find((candidate) => candidate.kind === kind);
    if (!item) return null;
    const Icon = item.icon;
    return <Icon className="h-3.5 w-3.5 shrink-0" />;
}

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div onMouseDown={onClose} className="fixed inset-0 z-[80] flex items-start justify-center bg-black/20 px-4 pt-[12vh] backdrop-blur-[2px] dark:bg-black/55">
            <div onMouseDown={(event) => event.stopPropagation()} className="w-full">
                {children}
            </div>
        </div>
    );
}
