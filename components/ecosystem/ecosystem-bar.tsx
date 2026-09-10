"use client";

import { useEffect, useState } from "react";

import { ECOSYSTEM_APPS, ECOSYSTEM_NAME, getEcosystemHref, type EcosystemApp } from "@/lib/ecosystem/apps";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";

export function EcosystemBar({ currentApp, projectId, projectTitle }: { currentApp: EcosystemApp; projectId?: string | null; projectTitle?: string | null }) {
  const [activeProjectId, setActiveProjectId] = useState(projectId || null);
  const [activeProjectTitle, setActiveProjectTitle] = useState(projectTitle || null);

  useEffect(() => {
    const resolvedId = resolveActiveProjectId(projectId);
    setActiveProjectId(resolvedId);
    setActiveProjectTitle(projectTitle || getLocalProjectTitle(resolvedId));
  }, [projectId, projectTitle]);

  return (
    <div className="ax-ecosystem-bar">
      <div className="ax-ecosystem-bar-inner">
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="ax-ecosystem-brand">{ECOSYSTEM_NAME}</a>
        <nav className="ax-ecosystem-nav" aria-label="Science ecosystem">
          {ECOSYSTEM_APPS.map((app) => {
            const href = getEcosystemHref(app.id, currentApp, activeProjectId);
            const active = app.id === currentApp;
            const className = "ax-ecosystem-link";
            return href === "#" ? <span key={app.id} className={className} aria-disabled="true">{app.label}</span> : <a key={app.id} href={href} className={className} data-active={active} aria-current={active ? "page" : undefined}>{app.label}</a>;
          })}
        </nav>
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="ax-ecosystem-project"><span className="ax-ecosystem-project-label">Project</span><span className="ax-ecosystem-project-value">{activeProjectTitle || (activeProjectId ? "Active project" : "Local workspace")}</span></a>
      </div>
    </div>
  );
}
