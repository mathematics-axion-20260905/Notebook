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

async function parseApiError(response: Response) {
    try {
        const data = await response.json();
        return typeof data === "object" && data ? JSON.stringify(data) : `Request failed with status ${response.status}`;
    } catch {
        return `Request failed with status ${response.status}`;
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
    const response = await fetchPublic("/api/token/refresh/", {
        method: "POST",
        body: JSON.stringify({ refresh }),
    });
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
    const response = await fetchPublic("/api/notebook/auth/bootstrap-demo/", {
        method: "POST",
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    return await response.json() as { status: string; username: string; access: string; refresh: string };
}

export async function ensureNotebookGuestSession() {
    const current = await fetchNotebookSession();
    if (current) return current;
    const bootstrap = await bootstrapDemoNotebookUser();
    window.localStorage.setItem("notebook_access_token", bootstrap.access);
    window.localStorage.setItem("notebook_refresh_token", bootstrap.refresh);
    return await fetchNotebookSession();
}

export function logoutNotebookUser() {
    window.localStorage.removeItem("notebook_access_token");
    window.localStorage.removeItem("notebook_refresh_token");
}
