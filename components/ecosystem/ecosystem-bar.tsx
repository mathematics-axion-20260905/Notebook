"use client";

import { useEffect, useState } from "react";

import { ECOSYSTEM_APPS, ECOSYSTEM_NAME, getEcosystemHref, type EcosystemApp } from "@/lib/ecosystem/apps";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";
import { getRemoteProject } from "@/lib/ecosystem/remote-object-store";
import { useLocale } from "@/components/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export function EcosystemBar({ currentApp, projectId, projectTitle }: { currentApp: EcosystemApp; projectId?: string | null; projectTitle?: string | null }) {
  const [activeProjectId, setActiveProjectId] = useState(projectId || null);
  const [activeProjectTitle, setActiveProjectTitle] = useState(projectTitle || null);
  const { locale } = useLocale();
  const labels = locale === "uz"
    ? { math: "Matematika", notebook: "Notebook", writer: "Writer", science: "Ilmiy markaz", nav: "Ilmiy ekotizim", project: "Loyiha", active: "Faol loyiha", local: "Mahalliy ish maydoni" }
    : { math: "Math", notebook: "Notebook", writer: "Writer", science: "Science Hub", nav: "Science ecosystem", project: "Project", active: "Active project", local: "Local workspace" };

  useEffect(() => {
    const resolvedId = resolveActiveProjectId(projectId);
    setActiveProjectId(resolvedId);
    const localTitle = projectTitle || getLocalProjectTitle(resolvedId);
    setActiveProjectTitle(localTitle);
    let alive = true;
    if (!projectTitle && resolvedId) {
      void getRemoteProject(resolvedId).then((project) => {
        if (alive && project?.title) setActiveProjectTitle(project.title);
      }).catch(() => undefined);
    }
    return () => { alive = false; };
  }, [projectId, projectTitle]);

  return (
    <div className="ax-ecosystem-bar">
      <div className="ax-ecosystem-bar-inner">
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="ax-ecosystem-brand">{ECOSYSTEM_NAME}</a>
        <nav className="ax-ecosystem-nav" aria-label={labels.nav}>
          {ECOSYSTEM_APPS.map((app) => {
            const href = getEcosystemHref(app.id, currentApp, activeProjectId);
            const active = app.id === currentApp;
            const className = "ax-ecosystem-link";
            return href === "#" ? <span key={app.id} className={className} aria-disabled="true">{labels[app.id]}</span> : <a key={app.id} href={href} className={className} data-active={active} aria-current={active ? "page" : undefined}>{labels[app.id]}</a>;
          })}
        </nav>
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="ax-ecosystem-project"><span className="ax-ecosystem-project-label">{labels.project}</span><span className="ax-ecosystem-project-value">{activeProjectTitle || (activeProjectId ? labels.active : labels.local)}</span></a>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
