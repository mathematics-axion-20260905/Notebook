"use client";

import type { ReactNode } from "react";
import type { ScientificObjectReference } from "@/lib/ecosystem/contracts";

export type NotebookBlockFamily =
    | "document"
    | "math"
    | "compute"
    | "import"
    | "publication";

export type NotebookBlockKind =
    | "text"
    | "formula"
    | "solve"
    | "graph"
    | "table"
    | "code"
    | "proof"
    | "exercise"
    | "result"
    | "export";

export type NotebookExecutionStatus =
    | "idle"
    | "dirty"
    | "queued"
    | "running"
    | "success"
    | "error"
    | "stale";

export type NotebookExecutionTarget =
    | "this-device"
    | "jupyter-kernel"
    | "external-server"
    | "hpc-cluster";

export type NotebookExecutionState = {
    status: NotebookExecutionStatus;
    runtime: "local" | "hybrid" | "server-boundary";
    target?: NotebookExecutionTarget;
    kernelId?: string;
    cacheKey?: string;
    detail?: string;
    durationMs?: number;
    updatedAt?: string;
    output?: Record<string, unknown>;
    error?: string;
};

export type NotebookBlockConfig = Record<string, string>;

export type NotebookBlock = {
    id: string;
    kind: NotebookBlockKind;
    title: string;
    content: string;
    family: NotebookBlockFamily;
    config: NotebookBlockConfig;
    execution: NotebookExecutionState;
    scientific_object_reference?: ScientificObjectReference;
};

export type NotebookDocument = {
    id: string;
    owner: { id: number; username: string } | null;
    title: string;
    summary: string;
    visibility: "private" | "public_read";
    blocks: NotebookBlock[];
    metadata: Record<string, unknown>;
    revision: number;
    is_locked: boolean;
    created_at: string;
    updated_at: string;
};

export type NotebookCheckpoint = {
    id: string;
    document_id: string;
    label: string;
    source: string;
    blocks: NotebookBlock[];
    metadata: Record<string, unknown>;
    revision: number;
    is_named: boolean;
    created_at: string;
};

export type NotebookDependencyNode = {
    id: string;
    title: string;
    kind: NotebookBlockKind;
    dependsOn: string | null;
    stale: boolean;
};

export type NotebookBlockResult = {
    status: "success" | "error";
    runtime: "local" | "hybrid" | "server-boundary";
    cache_key: string;
    duration_ms: number;
    detail: string;
    output: Record<string, unknown>;
};

export type NotebookExecutionRecord = {
    id: string;
    document_id: string;
    block_id: string;
    block_kind: string;
    title: string;
    status: string;
    runtime: string;
    cache_key: string;
    detail: string;
    inputs: Record<string, unknown>;
    output: Record<string, unknown>;
    duration_ms: number;
    created_at: string;
};

export type NotebookExecutionJob = {
    id: string;
    document_id: string;
    submitted_by: { id: number; username: string } | null;
    block_id: string;
    block_kind: string;
    title: string;
    status: "queued" | "running" | "success" | "error" | "timeout" | "canceled";
    runtime: string;
    cache_key: string;
    detail: string;
    inputs: Record<string, unknown>;
    output: Record<string, unknown>;
    duration_ms: number;
    timeout_seconds: number;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    updated_at: string;
};

export type NotebookCapability = {
    kind: NotebookBlockKind;
    family: NotebookBlockFamily;
    title: string;
    runtime: "local" | "hybrid" | "server-boundary";
    supports_preview: boolean;
    supports_execute: boolean;
    supports_export: boolean;
};

export type NotebookPluginRenderProps = {
    block: NotebookBlock;
    onChange: (patch: Partial<NotebookBlock>) => void;
};

export type NotebookBlockPlugin = {
    kind: NotebookBlockKind;
    family: NotebookBlockFamily;
    label: string;
    description: string;
    runtime: "local" | "hybrid" | "server-boundary";
    supportsExecute: boolean;
    create: () => NotebookBlock;
    validate: (block: NotebookBlock) => string[];
    serialize: (block: NotebookBlock) => string;
    editor: (props: NotebookPluginRenderProps) => ReactNode;
    preview: (props: NotebookPluginRenderProps) => ReactNode;
};
