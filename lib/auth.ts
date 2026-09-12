import { fetchPublic } from "@/lib/api";

export type NotebookSessionUser = {
    id: number;
    username: string;
    is_authenticated: boolean;
};

type TokenResponse = {
    access: string;
    refresh: string;
};

let guestSessionPromise: Promise<NotebookSessionUser> | null = null;

async function parseApiError(response: Response) {
    try {
        const data = await response.json();
        return typeof data === "object" && data ? JSON.stringify(data) : `Request failed with status ${response.status}`;
    } catch {
        return `Request failed with status ${response.status}`;
    }
}

async function withoutAccessToken<T>(request: () => Promise<T>) {
    const existingAccess = window.localStorage.getItem("notebook_access_token");
    window.localStorage.removeItem("notebook_access_token");
    try {
        return await request();
    } finally {
        // Keep a newly issued token, but restore the old one when an anonymous
        // recovery request fails so the caller can decide the next fallback.
        const currentAccess = window.localStorage.getItem("notebook_access_token");
        if (!currentAccess && existingAccess) {
            window.localStorage.setItem("notebook_access_token", existingAccess);
        }
    }
}

export async function loginNotebookUser(username: string, password: string) {
    const response = await fetchPublic("/api/token/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    const data = await response.json() as TokenResponse;
    window.localStorage.setItem("notebook_access_token", data.access);
    window.localStorage.setItem("notebook_refresh_token", data.refresh);
    return data;
}

export async function refreshNotebookSession() {
    const refresh = window.localStorage.getItem("notebook_refresh_token");
    if (!refresh) return null;
    const response = await withoutAccessToken(() => fetchPublic("/api/token/refresh/", {
        method: "POST",
        body: JSON.stringify({ refresh }),
    }));
    if (!response.ok) return null;
    const data = await response.json() as { access: string };
    window.localStorage.setItem("notebook_access_token", data.access);
    return data.access;
}

export async function fetchNotebookSession() {
    const response = await fetchPublic("/api/notebook/auth/session/");
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(await parseApiError(response));
    return await response.json() as NotebookSessionUser;
}

export async function bootstrapDemoNotebookUser() {
    const response = await withoutAccessToken(() => fetchPublic("/api/notebook/auth/bootstrap-demo/", {
        method: "POST",
    }));
    if (!response.ok) throw new Error(await parseApiError(response));
    return await response.json() as { status: string; username: string; access: string; refresh: string };
}

export async function ensureNotebookGuestSession() {
    if (guestSessionPromise) return guestSessionPromise;

    guestSessionPromise = (async () => {
        const current = await fetchNotebookSession();
        if (current) return current;

        // Access tokens are intentionally short-lived. Try the refresh token
        // before issuing a new shared guest session, and serialize concurrent
        // callers so an expired token cannot win a race against a fresh one.
        const refreshedAccess = await refreshNotebookSession();
        if (refreshedAccess) {
            const refreshed = await fetchNotebookSession();
            if (refreshed) return refreshed;
        }

        const bootstrap = await bootstrapDemoNotebookUser();
        window.localStorage.setItem("notebook_access_token", bootstrap.access);
        window.localStorage.setItem("notebook_refresh_token", bootstrap.refresh);
        const bootstrapped = await fetchNotebookSession();
        if (!bootstrapped) throw new Error("NOTEBOOK_SESSION_UNAVAILABLE");
        return bootstrapped;
    })();

    try {
        return await guestSessionPromise;
    } finally {
        guestSessionPromise = null;
    }
}

export function logoutNotebookUser() {
    window.localStorage.removeItem("notebook_access_token");
    window.localStorage.removeItem("notebook_refresh_token");
}
