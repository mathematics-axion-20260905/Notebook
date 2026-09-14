"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { isLocale, LOCALE_STORAGE_KEY, type Locale } from "@/lib/i18n";

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    const [locale, setLocaleState] = useState<Locale>("en");

    useEffect(() => {
        const cookie = window.document.cookie.split("; ").find((item) => item.startsWith(LOCALE_STORAGE_KEY + "="))?.split("=")[1] ?? null;
        const stored = cookie || window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (isLocale(stored)) setLocaleState(stored);
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        const sharedDomain = window.location.hostname === "dirac.space" || window.location.hostname.endsWith(".dirac.space") ? "; Domain=.dirac.space" : "";
        document.cookie = LOCALE_STORAGE_KEY + "=" + locale + "; Max-Age=31536000; Path=/; SameSite=Lax" + sharedDomain;
    }, [locale]);

    const value = useMemo(() => ({ locale, setLocale: setLocaleState }), [locale]);
    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
    const value = useContext(LocaleContext);
    if (!value) throw new Error("useLocale must be used inside LocaleProvider");
    return value;
}
