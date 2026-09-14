"use client";

import { useLocale } from "@/components/locale-provider";

export function LanguageSwitcher() {
    const { locale, setLocale } = useLocale();
    return (
        <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-0.5" role="group" aria-label={locale === "uz" ? "Til" : "Language"}>
            {(["en", "uz"] as const).map((option) => (
                <button key={option} type="button" aria-pressed={locale === option} onClick={() => setLocale(option)} className={`h-5 rounded-full px-1.5 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors ${locale === option ? "bg-[var(--ax-surface)] text-[var(--ax-text)] shadow-[0_1px_2px_rgb(23_36_54_/_0.08)]" : "text-[var(--ax-text-faint)] hover:text-[var(--ax-text-soft)]"}`}>
                    {option === "uz" ? "O‘z" : "En"}
                </button>
            ))}
        </div>
    );
}
