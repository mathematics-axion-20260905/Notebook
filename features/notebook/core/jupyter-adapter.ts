"use client";

import type { NotebookExecutionTarget } from "@/features/notebook/core/types";

export type NotebookKernelOutput = {
    text?: string;
    displayData?: Array<Record<string, unknown>>;
    errors?: Array<{ ename?: string; evalue?: string; traceback?: string[] }>;
    result?: unknown;
};

export type NotebookKernelExecution = {
    status: "success" | "error";
    target: NotebookExecutionTarget;
    runtime: "local" | "hybrid" | "server-boundary";
    durationMs: number;
    output: NotebookKernelOutput;
    kernelId?: string;
};

export type NotebookKernelAdapter = {
    target: NotebookExecutionTarget;
    execute: (code: string) => Promise<NotebookKernelExecution>;
    dispose?: () => Promise<void>;
};

type PyodideRuntime = {
    runPythonAsync: (code: string) => Promise<unknown>;
    loadPackagesFromImports?: (code: string) => Promise<void>;
};

type PyodideModule = {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideRuntime>;
};

export type PyodideAdapterOptions = {
    indexURL?: string;
    loadPackagesFromImports?: boolean;
};

function now() {
    return typeof performance === "undefined" ? Date.now() : performance.now();
}

function toDisplayValue(value: unknown) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function createPyodideAdapter(options: PyodideAdapterOptions = {}): NotebookKernelAdapter {
    let runtimePromise: Promise<PyodideRuntime> | null = null;
    const indexURL = options.indexURL || "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";

    async function getRuntime() {
        if (!runtimePromise) {
            runtimePromise = import("pyodide").then((module) => (module as unknown as PyodideModule).loadPyodide({ indexURL }));
        }
        return runtimePromise;
    }

    return {
        target: "this-device",
        async execute(code) {
            const started = now();
            try {
                const runtime = await getRuntime();
                if (options.loadPackagesFromImports && runtime.loadPackagesFromImports) {
                    await runtime.loadPackagesFromImports(code);
                }
                const result = await runtime.runPythonAsync(code);
                return {
                    status: "success",
                    target: "this-device",
                    runtime: "local",
                    durationMs: Math.round(now() - started),
                    output: { text: toDisplayValue(result) },
                };
            } catch (error) {
                return {
                    status: "error",
                    target: "this-device",
                    runtime: "local",
                    durationMs: Math.round(now() - started),
                    output: { errors: [{ ename: "PyodideError", evalue: error instanceof Error ? error.message : String(error) }] },
                };
            }
        },
    };
}

export type JupyterServerAdapterOptions = {
    baseUrl: string;
    token?: string;
    kernelName?: string;
    timeoutMs?: number;
};

type JupyterMessage = {
    msg_type?: string;
    parent_header?: { msg_id?: string };
    content?: Record<string, unknown>;
};

function joinUrl(baseUrl: string, path: string) {
    return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function websocketUrl(baseUrl: string, path: string, token?: string) {
    const url = joinUrl(baseUrl, path).replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
    if (!token) return url;
    return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

async function readJson(response: Response) {
    if (!response.ok) throw new Error(`JUPYTER_SERVER_HTTP_${response.status}`);
    return await response.json() as Record<string, unknown>;
}

export function createJupyterServerAdapter(options: JupyterServerAdapterOptions): NotebookKernelAdapter {
    let kernelId: string | undefined;
    let socket: WebSocket | null = null;

    async function ensureKernel() {
        if (kernelId) return kernelId;
        const response = await fetch(joinUrl(options.baseUrl, "/api/kernels"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(options.token ? { Authorization: `token ${options.token}` } : {}),
            },
            body: JSON.stringify({ name: options.kernelName || "python3" }),
        });
        const data = await readJson(response);
        if (typeof data.id !== "string") throw new Error("JUPYTER_KERNEL_ID_MISSING");
        kernelId = data.id;
        return kernelId;
    }

    async function closeSocket() {
        if (!socket) return;
        socket.close();
        socket = null;
    }

    return {
        target: "jupyter-kernel",
        async execute(code) {
            const started = now();
            const id = await ensureKernel();
            const ws = new WebSocket(websocketUrl(options.baseUrl, `/api/kernels/${id}/channels`, options.token));
            socket = ws;

            return await new Promise<NotebookKernelExecution>((resolve) => {
                const msgId = crypto.randomUUID();
                const output: NotebookKernelOutput = { displayData: [], errors: [] };
                let settled = false;
                let timeout: number | undefined;
                const finish = (status: "success" | "error") => {
                    if (settled) return;
                    settled = true;
                    if (timeout !== undefined) window.clearTimeout(timeout);
                    void closeSocket();
                    resolve({
                        status,
                        target: "jupyter-kernel",
                        runtime: "server-boundary",
                        durationMs: Math.round(now() - started),
                        output,
                        kernelId: id,
                    });
                };
                timeout = window.setTimeout(() => finish("error"), options.timeoutMs ?? 30000);

                ws.onerror = () => finish("error");
                ws.onclose = () => {
                    if (!settled) finish("error");
                };
                ws.onmessage = (event) => {
                    let message: JupyterMessage;
                    try {
                        message = JSON.parse(String(event.data)) as JupyterMessage;
                    } catch {
                        return;
                    }
                    if (message.parent_header?.msg_id !== msgId) return;
                    const content = message.content || {};
                    if (message.msg_type === "stream" && typeof content.text === "string") {
                        output.text = `${output.text || ""}${content.text}`;
                    } else if (["display_data", "execute_result"].includes(message.msg_type || "")) {
                        output.displayData?.push(content);
                        if (message.msg_type === "execute_result" && content.data && typeof content.data === "object") {
                            output.result = content.data;
                        }
                    } else if (message.msg_type === "error") {
                        output.errors?.push({
                            ename: typeof content.ename === "string" ? content.ename : undefined,
                            evalue: typeof content.evalue === "string" ? content.evalue : undefined,
                            traceback: Array.isArray(content.traceback) ? content.traceback as string[] : undefined,
                        });
                        finish("error");
                    } else if (message.msg_type === "status" && content.execution_state === "idle") {
                        finish(output.errors?.length ? "error" : "success");
                    }
                };
                ws.onopen = () => {
                    ws.send(JSON.stringify({
                        header: {
                            msg_id: msgId,
                            username: "axion-notebook",
                            session: crypto.randomUUID(),
                            msg_type: "execute_request",
                            version: "5.3",
                        },
                        parent_header: {},
                        metadata: {},
                        content: { code, silent: false, store_history: true, user_expressions: {}, allow_stdin: false, stop_on_error: true },
                        channel: "shell",
                    }));
                };
            });
        },
        async dispose() {
            await closeSocket();
            if (!kernelId) return;
            const currentKernelId = kernelId;
            kernelId = undefined;
            await fetch(joinUrl(options.baseUrl, `/api/kernels/${currentKernelId}`), {
                method: "DELETE",
                headers: options.token ? { Authorization: `token ${options.token}` } : undefined,
            });
        },
    };
}

export function createNotebookKernelAdapter(target: NotebookExecutionTarget, options: { jupyter?: JupyterServerAdapterOptions; pyodide?: PyodideAdapterOptions } = {}) {
    if (target === "this-device") return createPyodideAdapter(options.pyodide);
    if (target === "jupyter-kernel" && options.jupyter) return createJupyterServerAdapter(options.jupyter);
    throw new Error(`EXECUTION_TARGET_NOT_CONFIGURED:${target}`);
}

export function createConfiguredNotebookKernelAdapter() {
    const jupyterUrl = process.env.NEXT_PUBLIC_JUPYTER_URL;
    if (jupyterUrl) {
        return createJupyterServerAdapter({
            baseUrl: jupyterUrl,
            token: process.env.NEXT_PUBLIC_JUPYTER_TOKEN,
            kernelName: process.env.NEXT_PUBLIC_JUPYTER_KERNEL || "python3",
        });
    }

    return createPyodideAdapter({
        indexURL: process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL,
        loadPackagesFromImports: true,
    });
}
