import type { ScientificObject } from "./contracts";

export type RemoteScientificObjectRecord = ScientificObject & {
  serializedPayload: string;
  contentHash?: string;
};

function coreUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_ECOSYSTEM_CORE_URL || "").replace(/\/$/, "");
  return base ? `${base}${path}` : null;
}

async function parseError(response: Response) {
  try {
    const payload = await response.json() as { detail?: string };
    return payload.detail || `Core request failed with status ${response.status}`;
  } catch {
    return `Core request failed with status ${response.status}`;
  }
}

export async function syncScientificObject(serializedPayload: string): Promise<RemoteScientificObjectRecord | null> {
  const endpoint = coreUrl("/ecosystem/objects/");
  if (!endpoint) return null;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: serializedPayload }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return await response.json() as RemoteScientificObjectRecord;
}

export async function listRemoteScientificObjects(projectId: string): Promise<RemoteScientificObjectRecord[]> {
  const endpoint = coreUrl(`/ecosystem/objects/?project=${encodeURIComponent(projectId)}`);
  if (!endpoint) return [];
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  const payload = await response.json() as { results?: RemoteScientificObjectRecord[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

export async function getRemoteScientificObject(objectId: string): Promise<RemoteScientificObjectRecord | null> {
  const endpoint = coreUrl(`/ecosystem/objects/${encodeURIComponent(objectId)}/`);
  if (!endpoint) return null;
  const response = await fetch(endpoint, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await parseError(response));
  return await response.json() as RemoteScientificObjectRecord;
}
