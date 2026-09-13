import { describe, expect, it } from "vitest";

import {
  deserializeScientificObject,
  serializeScientificObject,
  type ScientificObject,
} from "./contracts";

describe("Scientific Object transfer envelope", () => {
  it("round-trips structured payload and provenance", () => {
    const object: ScientificObject<{ value: number }> = {
      id: "object-1",
      projectId: "project-1",
      kind: "calculation",
      schemaVersion: "1.0",
      title: "Integral result",
      sourceApp: "math",
      currentRevision: 1,
      revision: {
        objectId: "object-1",
        revision: 1,
        payload: { value: 42 },
        provenance: { sourceApp: "math", executionTarget: "this-device" },
      },
    };

    const envelope = deserializeScientificObject(serializeScientificObject(object));

    expect(envelope.object.id).toBe("object-1");
    expect(envelope.revisions[0].payload).toEqual({ value: 42 });
    expect(envelope.revisions[0].provenance.executionTarget).toBe("this-device");
  });

  it("rejects an envelope that silently drops an earlier revision", () => {
    const incomplete = {
      transferSchemaVersion: "1.0",
      exportedAt: new Date().toISOString(),
      object: {
        id: "object-1",
        projectId: "project-1",
        kind: "calculation",
        schemaVersion: "1.0",
        title: "Integral result",
        sourceApp: "math",
        currentRevision: 2,
      },
      revisions: [{
        objectId: "object-1",
        revision: 2,
        payload: { value: 42 },
        provenance: { sourceApp: "math" },
      }],
    };

    expect(() => deserializeScientificObject(JSON.stringify(incomplete))).toThrow("INVALID_SCIENTIFIC_OBJECT_TRANSFER_REVISIONS");
  });
});
