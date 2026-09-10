export type EcosystemApp = "science" | "math" | "notebook" | "writer";

export const ECOSYSTEM_NAME = process.env.NEXT_PUBLIC_ECOSYSTEM_NAME || "Axion Science";

// Production defaults assume one browser origin with path-based routing.
// App switching goes to the primary working surface, while each app root remains a public landing page.
// Local development can override any app with NEXT_PUBLIC_*_URL, e.g. a different port/path.
const configuredUrls: Record<EcosystemApp, string> = {
  science: process.env.NEXT_PUBLIC_SCIENCE_URL || "/",
  math: process.env.NEXT_PUBLIC_MATH_URL || "/math/laboratory",
  notebook: process.env.NEXT_PUBLIC_NOTEBOOK_URL || "/notebook/workspace",
  writer: process.env.NEXT_PUBLIC_WRITER_URL || "/writer/documents",
};

const configuredObjectUrls: Record<EcosystemApp, string> = {
  science: process.env.NEXT_PUBLIC_SCIENCE_OBJECT_URL || "/projects",
  math: process.env.NEXT_PUBLIC_MATH_OBJECT_URL || "/math/laboratory",
  notebook: process.env.NEXT_PUBLIC_NOTEBOOK_OBJECT_URL || "/notebook/workspace",
  writer: process.env.NEXT_PUBLIC_WRITER_OBJECT_URL || "/writer/new",
};

export const ECOSYSTEM_APPS: Array<{ id: EcosystemApp; label: string }> = [
  { id: "math", label: "Math" },
  { id: "notebook", label: "Notebook" },
  { id: "writer", label: "Writer" },
  { id: "science", label: "Explore" },
];

export function getEcosystemHref(app: EcosystemApp, _currentApp: EcosystemApp, projectId?: string | null): string {
  const base = configuredUrls[app];
  if (!projectId) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}project=${encodeURIComponent(projectId)}`;
}

export function getEcosystemObjectHref(app: EcosystemApp, projectId: string, objectId: string): string {
  const base = configuredObjectUrls[app];
  return `${base}${base.includes("?") ? "&" : "?"}source=project&project=${encodeURIComponent(projectId)}&objectId=${encodeURIComponent(objectId)}`;
}

export function getEcosystemTransferHref(app: EcosystemApp, transferId: string, projectId?: string | null): string {
  const base = configuredObjectUrls[app];
  const params = new URLSearchParams({ source: "transfer", transferId });
  if (projectId) params.set("project", projectId);
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
}
