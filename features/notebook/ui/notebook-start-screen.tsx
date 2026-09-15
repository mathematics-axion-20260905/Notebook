"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BookOpenText, Clock3, FileText, FolderKanban, Plus } from "lucide-react";

import { AxionMark } from "@/components/axion";
import { useLocale } from "@/components/locale-provider";
import { getEcosystemHref, getEcosystemProjectsHref } from "@/lib/ecosystem/apps";
import { getRemoteProject } from "@/lib/ecosystem/remote-object-store";
import { listLocalProjects, resolveActiveProjectId, type LocalProjectSummary } from "@/lib/ecosystem/project-context";
import { fetchNotebookDocuments } from "@/lib/notebook";
import type { NotebookDocument } from "@/features/notebook/core/types";
import { ensureNotebookGuestSession } from "@/lib/auth";

type StartProject = LocalProjectSummary & { isActive?: boolean };

function projectIdFromDocument(document: NotebookDocument) {
  const value = document.metadata.project_id;
  return typeof value === "string" && value.trim() ? value : null;
}

export function NotebookStartScreen() {
  const { locale } = useLocale();
  const copy = locale === "uz"
    ? {
      brandLine: "Tadqiqot ish maydoni", kicker: "Notebook", title: "Tadqiqotni davom ettiring.", lead: "Loyihani tanlang yoki yangi notebook oching. Hisoblash, izoh va Scientific Object bir xil kontekstda qoladi.", projects: "Loyihalar", recent: "So‘nggi notebooklar", noProjects: "Hozircha loyiha yo‘q.", noProjectsDetail: "Avval Science Hub’da loyiha yarating yoki bevosita shaxsiy notebookdan boshlang.", openProjects: "Loyihalarni ochish", newNotebook: "Yangi notebook", open: "Ochish", blocks: "blok", active: "Faol", noDocuments: "Hozircha notebook yo‘q.", noDocumentsDetail: "Yangi notebook ochib, birinchi qaydingizni boshlang.", personal: "Shaxsiy ish maydoni", loading: "Ish maydoni yuklanmoqda…", projectFallback: "Loyiha", updated: "Yangilangan"
    }
    : {
      brandLine: "Research workspace", kicker: "Notebook", title: "Continue the research.", lead: "Choose a Project or open a new notebook. Computation, explanation and Scientific Objects stay in the same context.", projects: "Projects", recent: "Recent notebooks", noProjects: "No projects yet.", noProjectsDetail: "Create a Project in Science Hub or start directly with a personal notebook.", openProjects: "Open Projects", newNotebook: "New notebook", open: "Open", blocks: "blocks", active: "Active", noDocuments: "No notebooks yet.", noDocumentsDetail: "Open a new notebook and make your first research record.", personal: "Personal workspace", loading: "Loading workspace…", projectFallback: "Project", updated: "Updated"
    };
  const [projects, setProjects] = React.useState<StartProject[]>([]);
  const [documents, setDocuments] = React.useState<NotebookDocument[]>([]);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    const activeId = resolveActiveProjectId();
    setActiveProjectId(activeId);
    const localProjects = listLocalProjects();
    setProjects(localProjects.map((project) => ({ ...project, isActive: project.id === activeId })));
    setLoading(false);

    void (async () => {
      let notebookDocuments: NotebookDocument[] = [];
      try {
        await ensureNotebookGuestSession();
        notebookDocuments = await fetchNotebookDocuments(activeId);
      } catch {
        // The launcher remains useful from the local project cache when the archive is offline.
      }

      const projectIds = new Set(localProjects.map((project) => project.id));
      notebookDocuments.forEach((document) => {
        const projectId = projectIdFromDocument(document);
        if (projectId) projectIds.add(projectId);
      });

      const missingProjects = [...projectIds]
        .filter((projectId) => !localProjects.some((project) => project.id === projectId))
        .map((projectId) => getRemoteProject(projectId).then((project) => project ? {
          id: project.slug,
          title: project.title,
          description: project.description,
        } : { id: projectId, title: `${copy.projectFallback} · ${projectId.slice(0, 8)}` }));
      const remoteProjects = await Promise.all(missingProjects);

      if (!alive) return;
      setDocuments(notebookDocuments);
      setProjects([...localProjects, ...remoteProjects].map((project) => ({
        ...project,
        isActive: project.id === activeId,
      })));
    })();

    return () => { alive = false; };
  }, [copy.projectFallback]);

  const visibleDocuments = activeProjectId
    ? documents.filter((document) => projectIdFromDocument(document) === activeProjectId)
    : documents;

  return (
    <div className="ax-workspace-root min-h-screen">
      <header className="ax-work-subnav sticky top-0 z-40">
        <div className="ax-work-container flex h-16 items-center justify-between gap-5">
          <Link href="/" className="flex min-w-0 items-center gap-3 rounded-[var(--ax-work-control-radius)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
            <AxionMark className="h-8 w-8 text-[var(--ax-accent)]" />
            <span className="min-w-0 leading-none"><span className="block truncate font-serif text-[19px] font-medium tracking-[-0.03em]">Axion Notebook</span><span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--ax-text-faint)]">{copy.brandLine}</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={getEcosystemProjectsHref()} className="hidden h-9 items-center rounded-[var(--ax-work-control-radius)] px-3 text-[11px] font-semibold text-[var(--ax-text-soft)] hover:bg-[var(--ax-work-surface-muted)] hover:text-[var(--ax-text)] sm:inline-flex">{copy.openProjects}</Link>
            <Link href="/workspace?new=1" className="inline-flex h-9 items-center gap-2 rounded-[var(--ax-work-control-radius)] bg-[var(--ax-accent-strong)] px-3.5 text-[11px] font-semibold text-white hover:bg-[var(--ax-accent)]"><Plus className="h-3.5 w-3.5" />{copy.newNotebook}</Link>
          </div>
        </div>
      </header>

      <main className="ax-work-container">
        <section className="ax-work-pagehead">
          <div>
            <p className="ax-work-kicker">{copy.kicker}</p>
            <h1 className="ax-work-title">{copy.title}</h1>
            <p className="ax-work-lead">{copy.lead}</p>
          </div>
          <div className="ax-work-stats">
            <div className="ax-work-stat"><div className="ax-work-stat-value">{projects.length}</div><div className="ax-work-stat-label">{copy.projects}</div></div>
            <div className="ax-work-stat"><div className="ax-work-stat-value">{documents.length}</div><div className="ax-work-stat-label">{copy.recent}</div></div>
            <div className="ax-work-stat"><div className="ax-work-stat-value">{activeProjectId ? copy.active : copy.personal}</div><div className="ax-work-stat-label">{copy.kicker}</div></div>
          </div>
        </section>

        <section className="ax-work-section">
          <div className="mb-5 flex items-end justify-between gap-5"><div><div className="ax-work-kicker">{copy.projects}</div><h2 className="mt-2 font-serif text-[27px] tracking-[-0.04em]">{copy.title}</h2></div><span className="hidden text-[10px] text-[var(--ax-text-faint)] sm:block">{copy.brandLine}</span></div>
          {loading ? <div className="border-y border-[var(--ax-work-line)] py-10 text-sm text-[var(--ax-text-soft)]">{copy.loading}</div> : projects.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/workspace?project=${encodeURIComponent(project.id)}`} className={`group rounded-[var(--ax-work-panel-radius)] border bg-[var(--ax-surface)] p-5 shadow-[var(--ax-work-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--ax-line-strong)] ${project.isActive ? "border-[var(--ax-accent)]/45" : "border-[var(--ax-work-line)]"}`}>
                  <div className="flex items-start justify-between gap-4"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ax-work-line)] text-[var(--ax-accent)]"><FolderKanban className="h-4 w-4" /></span>{project.isActive ? <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--ax-accent)]">{copy.active}</span> : null}</div>
                  <h3 className="mt-7 truncate font-serif text-[23px] tracking-[-0.035em]">{project.title}</h3>
                  <p className="mt-2 line-clamp-2 min-h-10 text-[11px] leading-5 text-[var(--ax-text-soft)]">{project.description || copy.brandLine}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-[var(--ax-work-line)] pt-3 text-[10px] font-semibold text-[var(--ax-text-faint)]"><span>{copy.open}</span><ArrowRight className="h-3.5 w-3.5 text-[var(--ax-accent)] transition-transform group-hover:translate-x-0.5" /></div>
                </Link>
              ))}
              <Link href={getEcosystemProjectsHref()} className="flex min-h-[190px] flex-col justify-between rounded-[var(--ax-work-panel-radius)] border border-dashed border-[var(--ax-line-strong)] p-5 text-[var(--ax-text-soft)] transition hover:bg-[var(--ax-work-surface-muted)]"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ax-work-line)] text-[var(--ax-accent)]"><Plus className="h-4 w-4" /></span><span><span className="block font-serif text-[21px] text-[var(--ax-text)]">{copy.openProjects}</span><span className="mt-1 block text-[11px] leading-5">{copy.noProjectsDetail}</span></span></Link>
            </div>
          ) : (
            <div className="grid gap-4 rounded-[var(--ax-work-panel-radius)] border border-dashed border-[var(--ax-line-strong)] p-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><h3 className="font-serif text-[24px] tracking-[-0.035em]">{copy.noProjects}</h3><p className="mt-2 max-w-xl text-[12px] leading-6 text-[var(--ax-text-soft)]">{copy.noProjectsDetail}</p></div><Link href={getEcosystemProjectsHref()} className="inline-flex h-10 items-center justify-center rounded-[var(--ax-work-control-radius)] bg-[var(--ax-accent-strong)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--ax-accent)]">{copy.openProjects}</Link></div>
          )}
        </section>

        <section className="ax-work-section pt-4">
          <div className="mb-5 flex items-end justify-between gap-5"><div><div className="ax-work-kicker">{copy.recent}</div><h2 className="mt-2 font-serif text-[27px] tracking-[-0.04em]">{activeProjectId ? projects.find((project) => project.id === activeProjectId)?.title || copy.recent : copy.recent}</h2></div><Link href="/workspace?new=1" className="hidden text-[11px] font-semibold text-[var(--ax-accent)] sm:inline-flex">{copy.newNotebook} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></div>
          {visibleDocuments.length ? <div className="ax-work-list">{visibleDocuments.slice(0, 8).map((document) => { const projectId = projectIdFromDocument(document); return <Link key={document.id} href={`/workspace?document=${encodeURIComponent(document.id)}${projectId ? `&project=${encodeURIComponent(projectId)}` : ""}`} className="ax-work-row group flex items-center gap-4 px-1 py-5 sm:px-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ax-work-line)] text-[var(--ax-accent)]"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-serif text-[21px] tracking-[-0.03em]">{document.title}</span><span className="mt-1 flex items-center gap-2 text-[10px] text-[var(--ax-text-faint)]"><Clock3 className="h-3 w-3" />{document.blocks.length} {copy.blocks}{document.updated_at ? ` · ${copy.updated} ${new Date(document.updated_at).toLocaleDateString()}` : ""}</span></span><ArrowRight className="h-4 w-4 text-[var(--ax-accent)] transition-transform group-hover:translate-x-0.5" /></Link>; })}</div> : <div className="grid gap-4 rounded-[var(--ax-work-panel-radius)] border border-dashed border-[var(--ax-line-strong)] p-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><h3 className="font-serif text-[23px] tracking-[-0.035em]">{copy.noDocuments}</h3><p className="mt-2 text-[12px] leading-6 text-[var(--ax-text-soft)]">{copy.noDocumentsDetail}</p></div><Link href={activeProjectId ? `/workspace?project=${encodeURIComponent(activeProjectId)}&new=1` : "/workspace?new=1"} className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ax-work-control-radius)] bg-[var(--ax-accent-strong)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--ax-accent)]"><Plus className="h-3.5 w-3.5" />{copy.newNotebook}</Link></div>}
        </section>
      </main>
    </div>
  );
}
