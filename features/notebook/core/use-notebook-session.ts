"use client";

import React from "react";

import { executeLocalPreview, inferDependencyGraph, serializeBlockToMarkdown } from "@/features/notebook/core/runtime";
import { createNotebookKernelAdapter, type JupyterServerAdapterOptions, type NotebookKernelAdapter, type PyodideAdapterOptions } from "@/features/notebook/core/jupyter-adapter";
import type {
    NotebookBlock,
    NotebookCheckpoint,
    NotebookDocument,
    NotebookExecutionJob,
    NotebookExecutionRecord,
    NotebookExecutionTarget,
} from "@/features/notebook/core/types";
import { fetchNotebookSession, type NotebookSessionUser, loginNotebookUser, logoutNotebookUser, refreshNotebookSession } from "@/lib/auth";
import {
    createNotebookDocument,
    createNotebookSnapshot,
    executeNotebookBlock,
    fetchNotebookCapabilities,
    fetchNotebookDocuments,
    fetchNotebookExecutionJob,
    fetchNotebookExecutionHistory,
    fetchNotebookSnapshots,
    restoreNotebookSnapshot,
    updateNotebookDocument,
    type NotebookDocumentPayload,
} from "@/lib/notebook";

type UseNotebookSessionOptions = {
    initialBlocks: NotebookBlock[];
    initialTitle: string;
    initialSummary: string;
    executionTarget?: NotebookExecutionTarget;
    jupyter?: JupyterServerAdapterOptions;
    pyodide?: PyodideAdapterOptions;
};

export function useNotebookSession(options: UseNotebookSessionOptions) {
    const [blocks, setBlocks] = React.useState<NotebookBlock[]>(options.initialBlocks);
    const [documentTitle, setDocumentTitle] = React.useState(options.initialTitle);
    const [documentSummary, setDocumentSummary] = React.useState(options.initialSummary);
    const [visibility, setVisibility] = React.useState<"private" | "public_read">("private");
    const [documentId, setDocumentId] = React.useState<string | null>(null);
    const [revision, setRevision] = React.useState<number | null>(null);
    const [documents, setDocuments] = React.useState<NotebookDocument[]>([]);
    const [snapshots, setSnapshots] = React.useState<NotebookCheckpoint[]>([]);
    const [executionHistory, setExecutionHistory] = React.useState<NotebookExecutionRecord[]>([]);
    const [capabilities, setCapabilities] = React.useState<Array<{ kind: string; title: string }>>([]);
    const [activeBlockId, setActiveBlockId] = React.useState(options.initialBlocks[0]?.id ?? "");
    const [selectedBlockIds, setSelectedBlockIds] = React.useState<Set<string>>(() => new Set(options.initialBlocks.map((block) => block.id)));
    const [collapsedBlocks, setCollapsedBlocks] = React.useState<Record<string, boolean>>({});
    const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const [runAllState, setRunAllState] = React.useState<"idle" | "running">("idle");
    const [isDirty, setIsDirty] = React.useState(false);
    const [sessionUser, setSessionUser] = React.useState<NotebookSessionUser | null>(null);
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [isAuthLoading, setIsAuthLoading] = React.useState(true);
    const sessionId = React.useRef(crypto.randomUUID());
    const kernelAdapterRef = React.useRef<NotebookKernelAdapter | null>(null);

    React.useEffect(() => () => {
        if (kernelAdapterRef.current?.dispose) void kernelAdapterRef.current.dispose();
    }, []);

    const getKernelAdapter = React.useCallback(() => {
        const target = options.executionTarget;
        if (!target || !["this-device", "jupyter-kernel"].includes(target)) return null;
        if (!kernelAdapterRef.current || kernelAdapterRef.current.target !== target) {
            if (kernelAdapterRef.current?.dispose) void kernelAdapterRef.current.dispose();
            kernelAdapterRef.current = createNotebookKernelAdapter(target, {
                jupyter: options.jupyter,
                pyodide: options.pyodide,
            });
        }
        return kernelAdapterRef.current;
    }, [options.executionTarget, options.jupyter, options.pyodide]);

    const dependencyGraph = React.useMemo(() => inferDependencyGraph(blocks), [blocks]);
    const markdown = React.useMemo(() => blocks.map(serializeBlockToMarkdown).join("\n\n"), [blocks]);

    const waitForExecutionJob = React.useCallback(async (job: NotebookExecutionJob) => {
        let currentJob = job;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            if (["success", "error", "timeout", "canceled"].includes(currentJob.status)) {
                return currentJob;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 700));
            currentJob = await fetchNotebookExecutionJob(currentJob.id);
        }
        throw new Error("Execution job polling timed out.");
    }, []);

    React.useEffect(() => {
        let alive = true;
        void (async () => {
            try {
                let user = await fetchNotebookSession();
                if (!user) {
                    await refreshNotebookSession();
                    user = await fetchNotebookSession();
                }
                if (alive) setSessionUser(user);
            } catch (error) {
                if (alive) setAuthError(error instanceof Error ? error.message : "Session load failed.");
            } finally {
                if (alive) setIsAuthLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    React.useEffect(() => {
        let alive = true;
        void Promise.allSettled([
            fetchNotebookDocuments(),
            fetchNotebookCapabilities(),
        ]).then((results) => {
            if (!alive) return;
            const [docs, caps] = results;
            if (docs.status === "fulfilled") setDocuments(docs.value);
            if (caps.status === "fulfilled") setCapabilities(caps.value.map((item) => ({ kind: item.kind, title: item.title })));
        });
        return () => {
            alive = false;
        };
    }, []);

    const refreshDocumentScopedData = React.useCallback(async (nextDocumentId: string) => {
        const [snapshotItems, executionItems] = await Promise.all([
            fetchNotebookSnapshots(nextDocumentId),
            fetchNotebookExecutionHistory(nextDocumentId),
        ]);
        setSnapshots(snapshotItems);
        setExecutionHistory(executionItems);
    }, []);

    const buildPayload = React.useCallback((): NotebookDocumentPayload => ({
        title: documentTitle,
        summary: documentSummary,
        visibility,
        blocks,
        metadata: {
            schema_version: 1,
            document_standard: "mathsphere.computational_notebook",
            source: "notebook-core-v1",
            block_count: blocks.length,
            dependency_graph: dependencyGraph,
            stale_block_count: dependencyGraph.filter((item) => item.stale).length,
            execution_session_id: sessionId.current,
            updated_in_browser_at: new Date().toISOString(),
        },
    }), [blocks, dependencyGraph, documentSummary, documentTitle, visibility]);

    const saveDocument = React.useCallback(async () => {
        setSaveState("saving");
        setSaveError(null);
        try {
            const payload = buildPayload();
            const saved = documentId ? await updateNotebookDocument(documentId, payload) : await createNotebookDocument(payload);
            setDocumentId(saved.id);
            setRevision(saved.revision);
            setVisibility(saved.visibility);
            setDocuments((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
            setSaveState("saved");
            setIsDirty(false);
            await refreshDocumentScopedData(saved.id);
            window.setTimeout(() => setSaveState("idle"), 1200);
            return saved;
        } catch (error) {
            setSaveState("error");
            setSaveError(error instanceof Error ? error.message : "Notebook save failed.");
            return null;
        }
    }, [buildPayload, documentId, refreshDocumentScopedData]);

    React.useEffect(() => {
        if (!isDirty) return;
        const timer = window.setTimeout(() => {
            void saveDocument();
        }, 2500);
        return () => window.clearTimeout(timer);
    }, [isDirty, saveDocument]);

    const setBlockPatch = React.useCallback((blockId: string, patch: Partial<NotebookBlock>) => {
        setBlocks((current) => current.map((block) => {
            if (block.id !== blockId) return block;
            return {
                ...block,
                ...patch,
                config: patch.config ? { ...block.config, ...patch.config } : block.config,
                execution: patch.content || patch.config
                    ? { ...block.execution, status: "dirty", updatedAt: new Date().toISOString() }
                    : patch.execution
                      ? { ...block.execution, ...patch.execution }
                      : block.execution,
            };
        }));
        setIsDirty(true);
    }, []);

    const addBlock = React.useCallback((block: NotebookBlock) => {
        setBlocks((current) => [...current, block]);
        setActiveBlockId(block.id);
        setSelectedBlockIds((current) => new Set([...current, block.id]));
        setIsDirty(true);
    }, []);

    const insertBlockAfter = React.useCallback((afterId: string, nextBlock: NotebookBlock) => {
        setBlocks((current) => {
            const index = current.findIndex((item) => item.id === afterId);
            if (index < 0) return [...current, nextBlock];
            return [...current.slice(0, index + 1), nextBlock, ...current.slice(index + 1)];
        });
        setActiveBlockId(nextBlock.id);
        setSelectedBlockIds((current) => new Set([...current, nextBlock.id]));
        setIsDirty(true);
    }, []);

    const removeBlock = React.useCallback((blockId: string) => {
        setBlocks((current) => current.filter((block) => block.id !== blockId));
        setSelectedBlockIds((current) => {
            const next = new Set(current);
            next.delete(blockId);
            return next;
        });
        setIsDirty(true);
    }, []);

    const runBlock = React.useCallback(async (blockId: string) => {
        const block = blocks.find((item) => item.id === blockId);
        if (!block) return;
        if (!sessionUser) {
            setAuthError("Sign in required for execution.");
            return;
        }
        let targetDocumentId = documentId;
        if (!targetDocumentId) {
            const saved = await saveDocument();
            targetDocumentId = saved?.id ?? null;
        }
        if (!targetDocumentId) {
            setAuthError("Save the notebook before running compute blocks.");
            return;
        }

        const localPreview = block.kind === "graph" || block.kind === "table"
            ? executeLocalPreview(block)
            : null;
        setBlockPatch(blockId, {
            execution: {
                ...block.execution,
                status: "queued",
                runtime: localPreview?.runtime ?? block.execution.runtime,
                cacheKey: localPreview?.cache_key ?? block.execution.cacheKey,
                detail: localPreview?.detail ?? "Queued for worker execution.",
                durationMs: localPreview?.duration_ms ?? block.execution.durationMs,
                output: localPreview?.output ?? block.execution.output,
                updatedAt: new Date().toISOString(),
            },
        });
        try {
            const kernelAdapter = block.kind === "code" ? getKernelAdapter() : null;
            const kernelExecution = kernelAdapter ? await kernelAdapter.execute(block.content) : null;
            if (kernelExecution?.status === "error") {
                const errorText = kernelExecution.output.errors?.[0]?.evalue || kernelExecution.output.text || "Kernel execution failed.";
                throw new Error(errorText);
            }
            const submittedJob = !kernelExecution && (block.kind === "solve" || block.kind === "graph" || block.kind === "table" || block.kind === "code")
                ? await executeNotebookBlock(targetDocumentId, block)
                : null;
            const finalJob = submittedJob ? await waitForExecutionJob(submittedJob) : null;
            if (finalJob && finalJob.status !== "success") {
                throw new Error(finalJob.detail || `Execution ${finalJob.status}.`);
            }
            if (!localPreview && !finalJob && !kernelExecution) return;
            setBlockPatch(blockId, {
                execution: {
                    status: "success",
                    runtime: (kernelExecution?.runtime ?? finalJob?.runtime ?? localPreview?.runtime ?? block.execution.runtime) as NotebookBlock["execution"]["runtime"],
                    target: kernelExecution?.target ?? block.execution.target,
                    kernelId: kernelExecution?.kernelId ?? block.execution.kernelId,
                    cacheKey: finalJob?.cache_key ?? localPreview?.cache_key,
                    detail: finalJob?.detail ?? localPreview?.detail ?? (kernelExecution ? "Executed in configured kernel." : undefined),
                    durationMs: finalJob?.duration_ms ?? localPreview?.duration_ms ?? kernelExecution?.durationMs,
                    updatedAt: new Date().toISOString(),
                    output: finalJob?.output ?? localPreview?.output ?? kernelExecution?.output,
                },
            });
            if (targetDocumentId) {
                const history = await fetchNotebookExecutionHistory(targetDocumentId);
                setExecutionHistory(history);
            }
        } catch (error) {
            setBlockPatch(blockId, {
                execution: {
                    ...block.execution,
                    status: "error",
                    error: error instanceof Error ? error.message : "Execution failed.",
                    detail: error instanceof Error ? error.message : "Execution failed.",
                    updatedAt: new Date().toISOString(),
                },
            });
        }
    }, [blocks, documentId, getKernelAdapter, saveDocument, sessionUser, setBlockPatch, waitForExecutionJob]);

    const runAll = React.useCallback(async (onlyStale = false) => {
        setRunAllState("running");
        try {
            for (const block of blocks) {
                if (onlyStale && block.execution.status !== "stale" && block.execution.status !== "dirty") continue;
                if (block.kind === "solve" || block.kind === "graph" || block.kind === "table" || block.kind === "code") {
                    await runBlock(block.id);
                }
            }
        } finally {
            setRunAllState("idle");
        }
    }, [blocks, runBlock]);

    const createCheckpoint = React.useCallback(async (label: string) => {
        let targetDocumentId = documentId;
        if (!targetDocumentId) {
            const saved = await saveDocument();
            targetDocumentId = saved?.id ?? null;
        }
        if (!targetDocumentId) return;
        const snapshot = await createNotebookSnapshot(targetDocumentId, label);
        setSnapshots((current) => [snapshot, ...current]);
    }, [documentId, saveDocument]);

    const restoreCheckpoint = React.useCallback(async (snapshotId: string) => {
        if (!documentId) return;
        const restored = await restoreNotebookSnapshot(documentId, snapshotId);
        setBlocks(restored.blocks);
        setDocumentTitle(restored.title);
        setDocumentSummary(restored.summary);
        setVisibility(restored.visibility);
        setRevision(restored.revision);
        await refreshDocumentScopedData(documentId);
    }, [documentId, refreshDocumentScopedData]);

    const loadDocument = React.useCallback(async (document: NotebookDocument) => {
        setDocumentId(document.id);
        setRevision(document.revision);
        setDocumentTitle(document.title);
        setDocumentSummary(document.summary);
        setVisibility(document.visibility);
        setBlocks(document.blocks.length ? document.blocks : options.initialBlocks);
        setActiveBlockId(document.blocks[0]?.id ?? options.initialBlocks[0]?.id ?? "");
        setSelectedBlockIds(new Set(document.blocks.map((block) => block.id)));
        setIsDirty(false);
        await refreshDocumentScopedData(document.id);
    }, [options.initialBlocks, refreshDocumentScopedData]);

    const login = React.useCallback(async (username: string, password: string) => {
        setAuthError(null);
        await loginNotebookUser(username, password);
        const user = await fetchNotebookSession();
        setSessionUser(user);
    }, []);

    const logout = React.useCallback(() => {
        logoutNotebookUser();
        setSessionUser(null);
    }, []);

    return {
        blocks,
        documentTitle,
        documentSummary,
        visibility,
        documentId,
        revision,
        documents,
        snapshots,
        executionHistory,
        capabilities,
        activeBlockId,
        selectedBlockIds,
        collapsedBlocks,
        saveState,
        saveError,
        runAllState,
        isDirty,
        sessionUser,
        authError,
        isAuthLoading,
        dependencyGraph,
        markdown,
        setDocumentTitle,
        setDocumentSummary,
        setVisibility,
        setActiveBlockId,
        setSelectedBlockIds,
        setCollapsedBlocks,
        setBlockPatch,
        addBlock,
        insertBlockAfter,
        removeBlock,
        runBlock,
        runAll,
        saveDocument,
        createCheckpoint,
        restoreCheckpoint,
        loadDocument,
        login,
        logout,
    };
}
