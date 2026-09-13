import type { Metadata } from "next";

export const SITE_URL = "https://notebook.dirac.space";
export const SITE_NAME = "Axion Notebook";
export const SITE_DESCRIPTION =
    "A calm scientific notebook for explanations, formulas, code, figures and research evidence.";

export const siteMetadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE_NAME} | Axion Science`, template: "%s | Axion Notebook" },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: ["research notebook", "scientific notes", "computational notebook", "research workflow", "Axion Science"],
    authors: [{ name: "Axion Science" }],
    creator: "Axion Science",
    publisher: "Axion Science",
    alternates: { canonical: "/" },
    openGraph: {
        type: "website",
        url: SITE_URL,
        siteName: SITE_NAME,
        title: `${SITE_NAME} | Axion Science`,
        description: SITE_DESCRIPTION,
        locale: "en_US",
    },
    twitter: { card: "summary", title: `${SITE_NAME} | Axion Science`, description: SITE_DESCRIPTION },
    robots: { index: true, follow: true },
};

export const noIndexRobots: Metadata["robots"] = {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
};

export const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "ScienceApplication",
    operatingSystem: "Web",
    publisher: { "@type": "Organization", name: "Axion Science", url: "https://dirac.space" },
};
