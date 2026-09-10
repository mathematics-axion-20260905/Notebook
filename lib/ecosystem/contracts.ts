export const SCIENTIFIC_OBJECT_SCHEMA_VERSION = "1.0" as const;
export const SCIENTIFIC_OBJECT_TRANSFER_SCHEMA_VERSION = "1.0" as const;

export type EcosystemAppId =
  | "science"
  | "library"
  | "math"
  | "notebook"
  | "writer"
  | "physics"
  | (string & {});

export type ScientificObjectKind =
  | "problem"
  | "solution"
  | "equation"
  | "model"
  | "calculation"
  | "simulation"
  | "dataset"
  | "visualization"
  | "scene"
  | "notebook"
  | "hypothesis"
  | "observation"
  | "finding"
  | "decision"
  | "document"
  | "publication"
  | (string & {});

export type ScientificReferenceMode = "live" | "pinned" | "frozen";
export type ExecutionTarget =
  | "this-device"
  | "local-python"
  | "jupyter-kernel"
  | "external-server"
  | "hpc-cluster"
  | (string & {});

export interface ProjectRef {
  id: string;
  title: string;
  slug?: string;
}

export interface ScientificObjectReference {
  projectId: string;
  objectId: string;
  mode: ScientificReferenceMode;
  revision?: number;
  snapshotId?: string;
}

export interface ScientificArtifact {
  id?: string;
  role: string;
  mediaType?: string;
  uri: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface ScientificProvenance {
  sourceApp: EcosystemAppId;
  engine?: string;
  engineVersion?: string;
  executionTarget?: ExecutionTarget;
  inputs?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  assumptions?: unknown[];
  parentObjects?: ScientificObjectReference[];
  startedAt?: string;
  finishedAt?: string;
  [key: string]: unknown;
}

export interface ScientificObjectRevision<TPayload = unknown> {
  objectId: string;
  revision: number;
  payload: TPayload;
  provenance: ScientificProvenance;
  artifacts?: ScientificArtifact[];
  contentHash?: string;
  createdAt?: string;
}

export interface ScientificObject<TPayload = unknown> {
  id: string;
  projectId: string;
  kind: ScientificObjectKind;
  domain?: string;
  schemaVersion: string;
  title: string;
  sourceApp: EcosystemAppId;
  currentRevision: number;
  metadata?: Record<string, unknown>;
  revision?: ScientificObjectRevision<TPayload>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScientificObjectTransferEnvelope<TPayload = unknown> {
  transferSchemaVersion: typeof SCIENTIFIC_OBJECT_TRANSFER_SCHEMA_VERSION;
  exportedAt: string;
  object: Omit<ScientificObject<TPayload>, "revision">;
  revisions: Array<ScientificObjectRevision<TPayload>>;
}

export function serializeScientificObject<TPayload>(object: ScientificObject<TPayload>, revisions: Array<ScientificObjectRevision<TPayload>> = object.revision ? [object.revision] : []): string {
  const { revision: _currentRevision, ...metadata } = object;
  return JSON.stringify({ transferSchemaVersion: SCIENTIFIC_OBJECT_TRANSFER_SCHEMA_VERSION, exportedAt: new Date().toISOString(), object: metadata, revisions } satisfies ScientificObjectTransferEnvelope<TPayload>);
}

export function deserializeScientificObject<TPayload>(serialized: string): ScientificObjectTransferEnvelope<TPayload> {
  let parsed: Partial<ScientificObjectTransferEnvelope<TPayload>>;
  try { parsed = JSON.parse(serialized) as Partial<ScientificObjectTransferEnvelope<TPayload>>; } catch { throw new Error("INVALID_SCIENTIFIC_OBJECT_TRANSFER_ENVELOPE"); }
  if (parsed.transferSchemaVersion !== SCIENTIFIC_OBJECT_TRANSFER_SCHEMA_VERSION || !parsed.object || !Array.isArray(parsed.revisions)) throw new Error("INVALID_SCIENTIFIC_OBJECT_TRANSFER_ENVELOPE");
  if (!parsed.object.id || !parsed.object.projectId || !parsed.object.schemaVersion || !parsed.object.kind || !parsed.object.sourceApp || parsed.object.currentRevision < 1) throw new Error("INVALID_SCIENTIFIC_OBJECT_TRANSFER_OBJECT");
  const revisionNumbers = parsed.revisions.map((revision) => revision.revision);
  if (!parsed.revisions.length || new Set(revisionNumbers).size !== revisionNumbers.length || !parsed.revisions.some((revision) => revision.revision === parsed.object?.currentRevision) || parsed.revisions.some((revision) => revision.objectId !== parsed.object?.id || revision.revision < 1 || !revision.provenance)) throw new Error("INVALID_SCIENTIFIC_OBJECT_TRANSFER_REVISIONS");
  return parsed as ScientificObjectTransferEnvelope<TPayload>;
}

export type ScientificSceneDimension = "2d" | "3d";

export interface ScientificSceneLayer {
  id: string;
  kind:
    | "curve"
    | "surface"
    | "mesh"
    | "point-cloud"
    | "scalar-field"
    | "vector-field"
    | "trajectory"
    | "region"
    | "annotation"
    | (string & {});
  source?: ScientificObjectReference;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface ScientificSceneSpec {
  version: "1.0" | (string & {});
  dimension: ScientificSceneDimension;
  coordinateSystem?: string;
  layers: ScientificSceneLayer[];
  annotations?: unknown[];
  controls?: unknown[];
  time?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  sourceRefs?: ScientificObjectReference[];
  adapterMetadata?: Record<string, unknown>;
}
