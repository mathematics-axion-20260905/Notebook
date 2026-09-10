import { fetchPublic } from "@/lib/api";
import type {
    NotebookBlock,
    NotebookCapability,
    NotebookCheckpoint,
    NotebookDocument,
    NotebookExecutionJob,
    NotebookExecutionRecord,
} from "@/features/notebook/core/types";

export type NotebookDocumentPayload = {
    title: string;
    summary: string;
    visibility?: "private" | "public_read";
    blocks: NotebookBlock[];
    metadata?: Record<string, unknown>;
    is_locked?: boolean;
};

function normalizeBlock(payload: Record<string, unknown>): NotebookBlock | null {
    if (
        typeof payload.id !== "string" ||
        typeof payload.kind !== "string" ||
        typeof payload.title !== "string" ||
        typeof payload.content !== "string"
    ) {
        return null;
    }

    const kindMap: Record<string, NotebookBlock["kind"]> = {
        python: "code",
        theorem: "proof",
        "lab-result": "result",
        answer: "proof",
    };

    const normalizedKind = (kindMap[payload.kind] || payload.kind) as NotebookBlock["kind"];
    const familyMap: Record<NotebookBlock["kind"], NotebookBlock["family"]> = {
        text: "document",
        formula: "math",
        solve: "compute",
        graph: "compute",
        table: "compute",
        code: "compute",
        proof: "document",
        exercise: "document",
        result: "import",
        export: "publication",
    };

    const config = typeof payload.config === "object" && payload.config ? payload.config as Record<string, string> : {};
    const metadata = typeof payload.metadata === "object" && payload.metadata ? payload.metadata as Record<string, unknown> : {};
    const scientificObjectReference = typeof payload.scientific_object_reference === "object" && payload.scientific_object_reference
        ? payload.scientific_object_reference as NotebookBlock["scientific_object_reference"]
        : undefined;
    const execution = typeof payload.execution === "object" && payload.execution ? payload.execution as Record<string, unknown> : {};

    return {
        id: payload.id,
        kind: normalizedKind,
        family: familyMap[normalizedKind] || "document",
        title: payload.title,
        content: payload.content,
        config,
        scientific_object_reference: scientificObjectReference,
        execution: {
            status: typeof execution.status === "string" ? execution.status as NotebookBlock["execution"]["status"] : typeof metadata.execution_status === "string" ? metadata.execution_status as NotebookBlock["execution"]["status"] : "idle",
            runtime: typeof execution.runtime === "string" ? execution.runtime as NotebookBlock["execution"]["runtime"] : typeof metadata.execution_runtime === "string" ? metadata.execution_runtime as NotebookBlock["execution"]["runtime"] : "local",
            target: typeof execution.target === "string" ? execution.target as NotebookBlock["execution"]["target"] : undefined,
            kernelId: typeof execution.kernelId === "string" ? execution.kernelId : undefined,
            cacheKey: typeof execution.cacheKey === "string" ? execution.cacheKey : undefined,
            detail: typeof execution.detail === "string" ? execution.detail : undefined,
            durationMs: typeof execution.durationMs === "number" ? execution.durationMs : undefined,
            updatedAt: typeof execution.updatedAt === "string" ? execution.updatedAt : undefined,
            output: typeof execution.output === "object" && execution.output ? execution.output as Record<string, unknown> : undefined,
            error: typeof execution.error === "string" ? execution.error : undefined,
        },
    };
}

function normalizeNotebook(payload: Record<string, unknown>): NotebookDocument | null {
    if (typeof payload.id !== "string" || typeof payload.title !== "string" || !Array.isArray(payload.blocks)) {
        return null;
    }

    return {
        id: payload.id,
        owner: typeof payload.owner === "object" && payload.owner ? payload.owner as { id: number; username: string } : null,
        title: payload.title,
        summary: typeof payload.summary === "string" ? payload.summary : "",
        visibility: payload.visibility === "public_read" ? "public_read" : "private",
        blocks: payload.blocks
            .map((item: unknown) => normalizeBlock(item as Record<string, unknown>))
            .filter((item: NotebookBlock | null): item is NotebookBlock => Boolean(item)),
        metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata as Record<string, unknown> : {},
        revision: typeof payload.revision === "number" ? payload.revision : 1,
        is_locked: typeof payload.is_locked === "boolean" ? payload.is_locked : false,
        created_at: typeof payload.created_at === "string" ? payload.created_at : "",
        updated_at: typeof payload.updated_at === "string" ? payload.updated_at : "",
    };
}

function normalizeCheckpoint(payload: Record<string, unknown>): NotebookCheckpoint | null {
    if (typeof payload.id !== "string" || typeof payload.document_id !== "string" || !Array.isArray(payload.blocks)) {
        return null;
    }
    return {
        id: payload.id,
        document_id: payload.document_id,
        label: typeof payload.label === "string" ? payload.label : "",
        source: typeof payload.source === "string" ? payload.source : "autosave",
        blocks: payload.blocks
            .map((item: unknown) => normalizeBlock(item as Record<string, unknown>))
            .filter((item: NotebookBlock | null): item is NotebookBlock => Boolean(item)),
        metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata as Record<string, unknown> : {},
        revision: typeof payload.revision === "number" ? payload.revision : 1,
        is_named: typeof payload.is_named === "boolean" ? payload.is_named : false,
        created_at: typeof payload.created_at === "string" ? payload.created_at : "",
    };
}

async function parseApiError(response: Response) {
    try {
        const data = await response.json();
        return typeof data === "object" && data ? JSON.stringify(data) : `Request failed with status ${response.status}`;
    } catch {
        return `Request failed with status ${response.status}`;
    }
}

export async function fetchNotebookDocuments() {
    const response = await fetchPublic("/api/notebook/documents/?ordering=-updated_at");
    if (!response.ok) throw new Error(await parseApiError(response));
    const data = await response.json();
    const items = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];
    return items
        .map((item: unknown) => normalizeNotebook(item as Record<string, unknown>))
        .filter((item: NotebookDocument | null): item is NotebookDocument => Boolean(item));
}

export async function createNotebookDocument(payload: NotebookDocumentPayload) {
    const response = await fetchPublic("/api/notebook/documents/", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    const normalized = normalizeNotebook(await response.json());
    if (!normalized) throw new Error("Notebook response is malformed.");
    return normalized;
}

export async function updateNotebookDocument(id: string, payload: NotebookDocumentPayload) {
    const response = await fetchPublic(`/api/notebook/documents/${encodeURIComponent(id)}/`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    const normalized = normalizeNotebook(await response.json());
    if (!normalized) throw new Error("Notebook response is malformed.");
    return normalized;
}

export async function fetchNotebookSnapshots(documentId: string) {
    const response = await fetchPublic(`/api/notebook/documents/${encodeURIComponent(documentId)}/snapshots/`);
    if (!response.ok) throw new Error(await parseApiError(response));
    const data = await response.json();
    return (Array.isArray(data) ? data : [])
        .map((item: unknown) => normalizeCheckpoint(item as Record<string, unknown>))
        .filter((item: NotebookCheckpoint | null): item is NotebookCheckpoint => Boolean(item));
}

export async function createNotebookSnapshot(documentId: string, label: string, source = "checkpoint") {
    const response = await fetchPublic(`/api/notebook/documents/${encodeURIComponent(documentId)}/snapshots/`, {
        method: "POST",
        body: JSON.stringify({ label, source, is_named: true }),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    const normalized = normalizeCheckpoint(await response.json());
    if (!normalized) throw new Error("Snapshot response is malformed.");
    return normalized;
}

export async function restoreNotebookSnapshot(documentId: string, snapshotId: string) {
    const response = await fetchPublic(`/api/notebook/documents/${encodeURIComponent(documentId)}/restore/`, {
        method: "POST",
        body: JSON.stringify({ snapshot_id: snapshotId }),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    const normalized = normalizeNotebook(await response.json());
    if (!normalized) throw new Error("Notebook response is malformed.");
    return normalized;
}

export async function fetchNotebookExecutionHistory(documentId: string) {
    const response = await fetchPublic(`/api/notebook/documents/${encodeURIComponent(documentId)}/executions/`);
    if (!response.ok) throw new Error(await parseApiError(response));
    const data = await response.json();
    return Array.isArray(data) ? data as NotebookExecutionRecord[] : [];
}

export async function fetchNotebookCapabilities() {
    const response = await fetchPublic("/api/notebook/capabilities/");
    if (!response.ok) throw new Error(await parseApiError(response));
    const data = await response.json();
    return Array.isArray(data) ? data as NotebookCapability[] : [];
}

export async function executeNotebookBlock(documentId: string | null, block: NotebookBlock) {
    const response = await fetchPublic("/api/notebook/execution/submit/", {
        method: "POST",
        body: JSON.stringify({
            document_id: documentId,
            block_id: block.id,
            kind: block.kind,
            title: block.title,
            content: block.content,
            config: block.config,
            execution_target: block.execution.target,
            scientific_object_reference: block.scientific_object_reference,
        }),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    return await response.json() as NotebookExecutionJob;
}

export async function fetchNotebookExecutionJob(jobId: string) {
    const response = await fetchPublic(`/api/notebook/execution/jobs/${encodeURIComponent(jobId)}/`);
    if (!response.ok) throw new Error(await parseApiError(response));
    return await response.json() as NotebookExecutionJob;
}
