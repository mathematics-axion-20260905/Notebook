import type { SVGProps } from "react";

export function AxionMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 40 40" fill="none" focusable="false" aria-hidden="true" {...props}>
            <rect x="3.5" y="3.5" width="33" height="33" rx="11" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10.5 29.5 20 10.5l9.5 19M14.5 22h11" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="20" cy="10.5" r="2.05" fill="currentColor" />
            <circle cx="10.5" cy="29.5" r="2.05" fill="currentColor" />
            <circle cx="29.5" cy="29.5" r="2.05" fill="currentColor" />
        </svg>
    );
}
