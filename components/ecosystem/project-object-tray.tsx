"use client";

import React from "react";

import { AxActionLink, AxBadge, AxButton, AxPanel } from "@/components/axion";
import { getEcosystemHref, getEcosystemObjectHref } from "@/lib/ecosystem/apps";
import { exportLocalScientificObject, getLocalScientificObject, importLocalScientificObject, listLocalScientificObjects } from "@/lib/ecosystem/local-object-store";
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

export function ProjectObjectTray() {
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [projectTitle, setProjectTitle] = React.useState<string | null>(null);
  const [objects, setObjects] = React.useState<ScientificObject[]>([]);
  const [open, setOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [transferState, setTransferState] = React.useState<string | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    const activeProjectId = resolveActiveProjectId();
    setProjectId(activeProjectId);
    setProjectTitle(getLocalProjectTitle(activeProjectId));
    if (!activeProjectId) {
      setObjects([]);
      return;
    }
    try {
      setObjects(await listLocalScientificObjects(activeProjectId));
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
                <AxActionLink href={getEcosystemObjectHref("writer", projectId, object.id)} size="sm" variant="primary">Writer</AxActionLink>
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
