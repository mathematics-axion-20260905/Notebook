export type Locale = "en" | "uz";

export const LOCALE_STORAGE_KEY = "axion-locale";

export function isLocale(value: string | null): value is Locale {
    return value === "en" || value === "uz";
}
