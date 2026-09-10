export type ScientificObjectTransferRecord = {
  transferId: string;
  payload?: string;
  contentHash?: string;
  createdAt?: string;
  expiresAt?: string;
};

function transferEndpoint(transferId?: string) {
  const base = (process.env.NEXT_PUBLIC_ECOSYSTEM_CORE_URL || "/api").replace(/\/$/, "");
  return `${base}/ecosystem/transfers${transferId ? `/${encodeURIComponent(transferId)}` : ""}/`;
}

async function parseError(response: Response) {
  try {
    const payload = await response.json() as { detail?: string };
    return payload.detail || `Transfer request failed with status ${response.status}`;
  } catch {
    return `Transfer request failed with status ${response.status}`;
  }
}

export async function publishScientificObjectTransfer(serialized: string): Promise<ScientificObjectTransferRecord> {
  const response = await fetch(transferEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: serialized }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return await response.json() as ScientificObjectTransferRecord;
}

export async function fetchScientificObjectTransfer(transferId: string) {
  const response = await fetch(transferEndpoint(transferId), { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  const record = await response.json() as ScientificObjectTransferRecord;
  if (!record.transferId || typeof record.payload !== "string") throw new Error("SCIENTIFIC_OBJECT_TRANSFER_RESPONSE_INVALID");
  return record as Required<Pick<ScientificObjectTransferRecord, "transferId" | "payload">> & ScientificObjectTransferRecord;
}

export async function discardScientificObjectTransfer(transferId: string) {
  const response = await fetch(transferEndpoint(transferId), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(await parseError(response));
}
