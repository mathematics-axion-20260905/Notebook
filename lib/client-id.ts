let fallbackCounter = 0;

/** Create an id without requiring a secure browser context. */
export function createClientId(prefix = "id") {
    const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }

    if (cryptoApi?.getRandomValues) {
        const bytes = new Uint32Array(2);
        cryptoApi.getRandomValues(bytes);
        return `${prefix}-${Date.now().toString(36)}-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }

    fallbackCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
