"use client";

import React from "react";

import { AxActionLink, AxBadge, AxButton, AxPanel } from "@/components/axion";
import { getEcosystemHref, getEcosystemObjectHref, getEcosystemTransferHref } from "@/lib/ecosystem/apps";
import { exportLocalScientificObject, getLocalScientificObject, importLocalScientificObject, listLocalScientificObjects } from "@/lib/ecosystem/local-object-store";
import { publishScientificObjectTransfer } from "@/lib/ecosystem/transfer";
import { getRemoteProject, getRemoteScientificObject, listRemoteProjectFiles, listRemoteScientificObjects, uploadRemoteProjectFile, type RemoteProjectFileRecord } from "@/lib/ecosystem/remote-object-store";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";
import type { ScientificObject } from "@/lib/ecosystem/contracts";

function resultText(object: ScientificObject) {
  const payload = object.revision?.payload;
  if (!payload || typeof payload !== "object") return object.title;
  const data = payload as Record<string, unknown>;
  if (typeof data.report_markdown === "string" && data.report_markdown.trim()) return data.report_markdown;
  if (typeof data.summary === "string" && data.summary.trim()) return data.summary;
  return object.title;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectObjectTray() {
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [projectTitle, setProjectTitle] = React.useState<string | null>(null);
  const [objects, setObjects] = React.useState<ScientificObject[]>([]);
  const [files, setFiles] = React.useState<RemoteProjectFileRecord[]>([]);
  const [open, setOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [transferState, setTransferState] = React.useState<string | null>(null);
  const [sendingObjectId, setSendingObjectId] = React.useState<string | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    const activeProjectId = resolveActiveProjectId();
    setProjectId(activeProjectId);
    setProjectTitle(getLocalProjectTitle(activeProjectId));
    if (!activeProjectId) {
      setObjects([]);
      setFiles([]);
      return;
    }
    void getRemoteProject(activeProjectId).then((project) => {
      if (project?.title) setProjectTitle(project.title);
    }).catch(() => undefined);
    try {
      const localObjects = await listLocalScientificObjects(activeProjectId);
      const merged = new Map(localObjects.map((object) => [object.id, object]));
      try {
        const remoteObjects = await listRemoteScientificObjects(activeProjectId);
        for (const remote of remoteObjects) {
          if (!merged.has(remote.id)) {
            try {
              await importLocalScientificObject(remote.serializedPayload);
              const hydrated = await listLocalScientificObjects(activeProjectId);
              const cached = hydrated.find((object) => object.id === remote.id);
              if (cached) merged.set(cached.id, cached);
            } catch {
              // Keep a remote summary visible even if IndexedDB is unavailable.
              merged.set(remote.id, remote);
            }
          }
        }
      } catch {
        // The local cache remains usable while the core is offline.
      }
      try {
        setFiles(await listRemoteProjectFiles(activeProjectId));
      } catch {
        setFiles([]);
      }
      setObjects([...merged.values()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")));
    } catch {
      setObjects([]);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  if (!projectId) return null;

  const mathObjects = objects.filter((object) => object.sourceApp === "math");

  const sendObjectToWriter = async (objectId: string) => {
    if (!projectId) return;
    setSendingObjectId(objectId);
    setTransferState("Sending…");
    try {
      let serialized: string;
      try {
        serialized = await exportLocalScientificObject(objectId);
      } catch {
        const remote = await getRemoteScientificObject(objectId);
        if (!remote?.serializedPayload) throw new Error("SCIENTIFIC_OBJECT_NOT_FOUND");
        serialized = remote.serializedPayload;
      }
      const transfer = await publishScientificObjectTransfer(serialized);
      window.location.assign(getEcosystemTransferHref("writer", transfer.transferId, projectId));
    } catch (error) {
      setTransferState(error instanceof Error ? error.message : "Transfer failed");
      setSendingObjectId(null);
    }
  };

  return (
    <section className="ax-work-subnav text-[var(--ax-text)]">
      <div className="ax-work-subnav-inner">
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-11 w-full items-center justify-between gap-4 text-left outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">Project</span>
            <span className="truncate text-[11px] font-semibold text-[var(--ax-text)]">{projectTitle || "Active project"}</span>
            <AxBadge className="hidden sm:inline-flex">{mathObjects.length} results</AxBadge>
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-[var(--ax-text-soft)]">{open ? "Hide" : "Results"}</span>
        </button>

        {open ? (
          <div className="border-t border-[var(--ax-work-line)] py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] leading-4 text-[var(--ax-text-soft)]">Scientific Objects can be moved between ecosystem apps as complete JSON packages.</p>
              <div className="flex items-center gap-2">
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    try {
                      await importLocalScientificObject(await file.text());
                      setTransferState("Imported");
                      await refresh();
                    } catch (error) {
                      setTransferState(error instanceof Error ? error.message : "Import failed");
                    }
                  }}
                />
                <AxButton size="sm" variant="quiet" onClick={() => importInputRef.current?.click()}>Import JSON</AxButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file || !projectId) return;
                    if (file.size > 100 * 1024 * 1024) {
                      setTransferState("File limit is 100 MB");
                      return;
                    }
                    setTransferState("Uploading…");
                    try {
                      await uploadRemoteProjectFile(projectId, file, { uploadedFrom: "notebook" });
                      setTransferState("File uploaded");
                      await refresh();
                    } catch (error) {
                      setTransferState(error instanceof Error ? error.message : "File upload failed");
                    }
                  }}
                />
                <AxButton size="sm" variant="quiet" onClick={() => fileInputRef.current?.click()}>Upload file</AxButton>
                {transferState ? <span className="text-[9px] font-semibold text-[var(--ax-accent)]">{transferState}</span> : null}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {mathObjects.length ? mathObjects.map((object) => (
              <AxPanel key={object.id} className="flex items-center justify-between gap-3 rounded-[var(--ax-work-panel-radius)] px-4 py-3 shadow-none">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[var(--ax-text)]">{object.title}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.13em] text-[var(--ax-text-faint)]">{object.domain || object.kind}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                <AxActionLink href={getEcosystemObjectHref("notebook", projectId, object.id)} size="sm" variant="quiet">Use</AxActionLink>
                <AxButton
                  size="sm"
                  variant="primary"
                  disabled={sendingObjectId === object.id}
                  onClick={() => void sendObjectToWriter(object.id)}
                >
                  {sendingObjectId === object.id ? "Sending…" : "Writer"}
                </AxButton>
                <AxButton
                  size="sm"
                  onClick={async () => {
                    const hydrated = await getLocalScientificObject(object.id);
                    await navigator.clipboard.writeText(resultText(hydrated || object));
                    setCopiedId(object.id);
                  }}
                >
                  {copiedId === object.id ? "Copied" : "Copy"}
                </AxButton>
                <AxButton
                  size="sm"
                  variant="quiet"
                  onClick={async () => {
                    const serialized = await exportLocalScientificObject(object.id);
                    const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `${object.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "scientific-object"}.scientific-object.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                    setTransferState("Exported");
                  }}
                >Export</AxButton>
                </div>
              </AxPanel>
            )) : (
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--ax-work-line)] py-4 md:col-span-2 xl:col-span-3">
                <p className="text-xs leading-5 text-[var(--ax-text-soft)]">No saved Math results yet. Solve something in Laboratory and press Save.</p>
                <AxActionLink href={getEcosystemHref("math", "notebook", projectId)} size="sm">Open Math</AxActionLink>
              </div>
            )}
            </div>
            <div className="mt-5 border-t border-[var(--ax-work-line)] pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-text-faint)]">Project files</div>
                  <div className="mt-1 text-[10px] text-[var(--ax-text-soft)]">Stored in the ecosystem core and available to the whole Project.</div>
                </div>
                <AxBadge>{files.length}</AxBadge>
              </div>
              {files.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {files.map((file) => (
                    <a key={file.id} href={file.downloadUrl} download={file.originalName} className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--ax-work-panel-radius)] border border-[var(--ax-work-line)] px-3 py-2.5 transition hover:bg-[var(--ax-work-surface-muted)]">
                      <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--ax-text)]">{file.originalName}</span>
                      <span className="shrink-0 text-[9px] text-[var(--ax-text-faint)]">{formatFileSize(file.size)}</span>
                    </a>
                  ))}
                </div>
              ) : <p className="text-[10px] text-[var(--ax-text-faint)]">No project files yet.</p>}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
