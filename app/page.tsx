"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText, Braces, Sigma } from "lucide-react";

import { NotebookHeroScene } from "@/components/home/notebook-hero-scene";
import { AxionMark } from "@/components/axion";
import { useLocale } from "@/components/locale-provider";

const notebookLandingCopy = {
  en: {
    nav: ["Product", "Workflow", "Ecosystem"],
    brandLine: "Research workspace",
    productKicker: "Product overview",
    productTitle: "A structured notebook for scientific reasoning.",
    productCopy: "Record assumptions, equations, code, observations and findings in one research context. Typed blocks add structure without turning the document into an operations dashboard.",
    heroKicker: "Axion Notebook · research memory",
    heroTitle: ["Scientific reasoning,", "kept", "structured."],
    heroLead: "Record explanations, formulas, code, figures and results while keeping them linked to the scientific work that produced them.",
    open: "Open Notebook",
    explore: "Explore the product",
    promises: [["Record", "Write questions, explanations and observations in a document designed for scientific reading."], ["Compute", "Use mathematics and code where they support the reasoning, without making them the entire interface."], ["Reference", "Keep evidence tied to the Project so its context remains available at the next stage."]],
    workflowKicker: "Research workflow",
    workflowTitle: "From a question to a finding, in one research record.",
    workflowCopy: "Notebook records scientific context, interpretation and evidence alongside the work. It complements computation instead of replacing it.",
    workflow: [["01", "Question", "Start with what you are trying to understand, not with a blank code cell."], ["02", "Model", "State assumptions, equations and the structure of the investigation."], ["03", "Computation", "Use Math results or code exactly where they support the reasoning."], ["04", "Observation", "Record what the evidence actually shows while it is still in context."], ["05", "Finding", "Keep the conclusion attached to the model, evidence and revision that produced it."]],
    ecosystemKicker: "One research trail",
    ecosystemTitle: "Reasoning remains connected to the result.",
    ecosystemCopy: "Bring a saved Math result into Notebook, add observations and findings, then hand the same scientific context to Writer.",
    ecosystemItems: [["Math", "Create the calculation and visualization."], ["Notebook", "Explain, observe and build the research trail."], ["Writer", "Use the evidence in a publication-ready document."]],
    finalTitle: ["A research record should remain", "readable."],
    finalCopy: "Use a structured notebook where explanations, mathematics, code and evidence remain in the same scientific context.",
    preview: { figure: "Fig 01 · Research Notebook", saved: "Saved locally", trail: "Research trail", items: ["Question", "Model", "Computation", "Observation", "Finding"], footer: ["Text + equations", "Code + results", "Project context"], observation: "Observation 03", title: "Heat diffusion study", lead: "The temperature field smooths over time while preserving the symmetry implied by the boundary conditions.", model: "Model", linked: "Linked Math result", live: "live context", finding: "Finding.", findingCopy: "Amplitude decays exponentially while the spatial mode remains smooth." },
  },
  uz: {
    nav: ["Mahsulot", "Jarayon", "Ekotizim"],
    brandLine: "Tadqiqot ish maydoni",
    productKicker: "Mahsulot haqida",
    productTitle: "Ilmiy fikrlash uchun tuzilmali notebook.",
    productCopy: "Farazlar, tenglamalar, kod, kuzatuvlar va xulosalarni yagona tadqiqot kontekstida qayd eting. Tiplangan bloklar hujjatni murakkab boshqaruv paneliga aylantirmasdan tuzilma beradi.",
    heroKicker: "Axion Notebook · ilmiy tadqiqot qaydi",
    heroTitle: ["Ilmiy fikrlash", "tuzilmali", "qayd etiladi."],
    heroLead: "Izohlar, formulalar, kod, grafiklar va natijalarni ularni yuzaga keltirgan ilmiy ish bilan bog‘langan holda qayd eting.",
    open: "Notebookni ochish",
    explore: "Mahsulotni ko‘rish",
    promises: [["Qayd eting", "Savollar, izohlar va kuzatuvlarni ilmiy o‘qishga mos hujjatda yozing."], ["Hisoblang", "Fikrlashni qo‘llab-quvvatlaydigan joyda matematika va koddan foydalaning, interfeysni ortiqcha murakkablashtirmang."], ["Bog‘lang", "Keyingi bosqichda kontekst saqlanishi uchun dalillarni Loyiha bilan biriktiring."]],
    workflowKicker: "Tadqiqot jarayoni",
    workflowTitle: "Savoldan xulosagacha — yagona tadqiqot qaydida.",
    workflowCopy: "Notebook ilmiy kontekst, talqin va dalillarni ish jarayoni bilan birga qayd etadi. U hisoblash vositasini almashtirmaydi, balki uni izohlaydi.",
    workflow: [["01", "Savol", "Bo‘sh kod katagidan emas, tushunmoqchi bo‘lgan narsangizdan boshlang."], ["02", "Model", "Farazlar, tenglamalar va tadqiqot tuzilmasini belgilang."], ["03", "Hisoblash", "Fikrlashni qo‘llab-quvvatlaydigan joyda Math natijasi yoki koddan foydalaning."], ["04", "Kuzatuv", "Dalil nimani ko‘rsatayotganini kontekst hali yangi paytda yozib oling."], ["05", "Xulosa", "Xulosani uni yaratgan model, dalil va revision bilan birga saqlang."]],
    ecosystemKicker: "Bitta tadqiqot izi",
    ecosystemTitle: "Fikrlash natija bilan bog‘liq qoladi.",
    ecosystemCopy: "Saqlangan Math natijasini Notebookka olib keling, kuzatuv va xulosalarni qo‘shing, so‘ng o‘sha ilmiy kontekstni Writerga uzating.",
    ecosystemItems: [["Math", "Hisoblash va vizualizatsiyani yarating."], ["Notebook", "Tadqiqot izini tushuntiring va kuzating."], ["Writer", "Dalillardan nashrga tayyor hujjatda foydalaning."]],
    finalTitle: ["Tadqiqot qaydi", "o‘qilishi oson"],
    finalCopy: "Izohlar, matematika, kod va dalillar yagona ilmiy kontekstda saqlanadigan tuzilmali notebookdan foydalaning.",
    preview: { figure: "01-rasm · Tadqiqot Notebooki", saved: "Mahalliy saqlandi", trail: "Tadqiqot izi", items: ["Savol", "Model", "Hisoblash", "Kuzatuv", "Xulosa"], footer: ["Matn + tenglamalar", "Kod + natijalar", "Loyiha konteksti"], observation: "Kuzatuv 03", title: "Issiqlik tarqalishi tadqiqoti", lead: "Harorat maydoni vaqt o‘tishi bilan silliqlashadi va chegaraviy shartlar bergan simmetriyani saqlaydi.", model: "Model", linked: "Math natijasi", live: "jonli kontekst", finding: "Xulosa.", findingCopy: "Amplituda eksponensial kamayadi, fazoviy mod esa silliq qoladi." },
  },
} as const;

type NotebookLandingCopy = (typeof notebookLandingCopy)[keyof typeof notebookLandingCopy];

function NotebookPreview({ copy }: { copy: NotebookLandingCopy }) {
  return (
    <div className="ax-product-frame">
      <div className="flex h-11 items-center justify-between border-b border-[var(--ax-line)] px-5"><span className="ax-figure-label">{copy.preview.figure}</span><span className="text-[10px] font-semibold text-[var(--ax-accent)]">{copy.preview.saved}</span></div>
      <div className="grid min-h-[560px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-5 lg:border-b-0 lg:border-r lg:p-6">
          <div className="ax-figure-label">{copy.preview.trail}</div>
          <div className="mt-6 space-y-1.5 text-[11px] font-semibold text-[var(--ax-text-soft)]">{copy.preview.items.map((item,index)=><div key={item} className={`rounded-[7px] px-3 py-2.5 ${index===3?'bg-white text-[var(--ax-text)] shadow-[var(--ax-shadow-subtle)]':''}`}>{item}</div>)}</div>
          <div className="mt-9 border-t border-[var(--ax-line)] pt-5 text-[10px] leading-5 text-[var(--ax-text-faint)]">{copy.preview.footer.map((item) => <span key={item} className="block">{item}</span>)}</div>
        </aside>
        <article className="bg-[var(--ax-canvas)] p-5 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-[860px]">
            <p className="ax-figure-label text-[var(--ax-accent)]">{copy.preview.observation}</p>
            <h3 className="mt-3 font-serif text-[clamp(32px,4vw,50px)] tracking-[-0.045em]">{copy.preview.title}</h3>
            <p className="mt-4 max-w-[680px] text-[13px] leading-7 text-[var(--ax-text-soft)]">{copy.preview.lead}</p>
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.02fr_.98fr]">
              <div className="space-y-4">
                <div className="rounded-[14px] border border-[var(--ax-line)] bg-white p-6"><div className="ax-figure-label">{copy.preview.model}</div><div className="mt-5 text-center font-serif text-[30px]">∂u/∂t = α∇²u</div></div>
                <div className="rounded-[14px] border border-[#263953] bg-[#101827] p-6 font-mono text-[11px] leading-6 text-[#d9e7f8]"><span className="text-[#8eb7e8]">x</span> = linspace(0, 2π, 200)<br /><span className="text-[#8eb7e8]">u</span> = exp(-α*t) * sin(x)<br />plot(x, u)</div>
              </div>
              <div className="rounded-[14px] border border-[var(--ax-line)] bg-white p-6">
                <div className="flex items-center justify-between"><span className="ax-figure-label">{copy.preview.linked}</span><span className="text-[9px] font-semibold text-[var(--ax-accent)]">{copy.preview.live}</span></div>
                <svg viewBox="0 0 340 220" className="mt-5 h-[220px] w-full" aria-hidden="true"><path d="M18 110H322M170 18V204" stroke="#d8e1ec" strokeWidth="1"/><path d="M18 110 C52 56 85 56 116 110 C148 164 180 164 212 110 C244 56 278 56 322 110" fill="none" stroke="#2f6fbe" strokeWidth="2.2"/><path d="M18 110 C62 80 91 80 132 110 C173 140 200 140 241 110 C282 80 304 85 322 110" fill="none" stroke="#91b2dd" strokeWidth="1.2" opacity=".72"/></svg>
                <div className="mt-4 border-t border-[var(--ax-line)] pt-4 text-[12px] leading-6 text-[var(--ax-text-soft)]"><span className="font-semibold text-[var(--ax-text)]">{copy.preview.finding}</span> {copy.preview.findingCopy}</div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

export default function NotebookHomePage() {
  const { locale } = useLocale();
  const copy = notebookLandingCopy[locale];
  return (
    <div className="ax-landing min-h-[calc(100vh-32px)]">
      <header className="ax-premium-nav">
        <div className="ax-landing-container ax-premium-nav-inner">
          <Link href="/" className="flex min-w-0 items-center gap-3.5"><AxionMark className="h-9 w-9 text-[var(--ax-accent)]"/><span className="min-w-0 leading-none"><span className="block truncate font-serif text-[22px] font-medium tracking-[-0.035em]">Axion Notebook</span><span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.25em] text-[var(--ax-text-faint)]">{copy.brandLine}</span></span></Link>
          <nav className="hidden items-center gap-1 xl:flex"><Link href="#product" className="ax-premium-nav-link">{copy.nav[0]}</Link><Link href="#workflow" className="ax-premium-nav-link">{copy.nav[1]}</Link><Link href="#ecosystem" className="ax-premium-nav-link">{copy.nav[2]}</Link></nav>
          <div className="flex items-center gap-1.5"><Link href="/workspace" className="ax-premium-secondary hidden sm:inline-flex">{locale === "uz" ? "Ish maydoni" : "Workspace"}</Link><Link href="/workspace" className="ax-premium-primary">{copy.open} <span aria-hidden="true">→</span></Link></div>
        </div>
      </header>

      <main>
        <div className="ax-landing-container"><section className="ax-landing-hero"><div className="ax-hero-copy"><p className="ax-landing-kicker">{copy.heroKicker}</p><h1 className="ax-landing-display">{copy.heroTitle[0]}<br />{copy.heroTitle[1]} <span className="italic">{copy.heroTitle[2]}</span></h1><div className="ax-signature-rule" aria-hidden="true"/><p className="ax-landing-lead">{copy.heroLead}</p><div className="mt-8 flex flex-wrap gap-2"><Link href="/workspace" className="ax-premium-primary">{copy.open} <ArrowRight className="h-4 w-4"/></Link><Link href="#product" className="ax-premium-secondary">{copy.explore} <ArrowRight className="h-3.5 w-3.5 text-[var(--ax-text-faint)]"/></Link></div></div><div className="ax-hero-visual"><NotebookHeroScene/></div></section></div>

        <section className="ax-promise-strip"><div className="ax-landing-container ax-promise-grid">{copy.promises.map(([title, text])=><div key={title} className="ax-promise-item"><div className="ax-promise-title">{title}</div><p className="ax-promise-copy">{text}</p></div>)}</div></section>

        <section id="product" className="ax-landing-section"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">{copy.productKicker}</p><h2 className="ax-section-title">{copy.productTitle}</h2></div><p className="ax-section-copy">{copy.productCopy}</p></div><NotebookPreview copy={copy}/></div></section>

        <section id="workflow" className="ax-landing-section ax-landing-section-alt"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">{copy.workflowKicker}</p><h2 className="ax-section-title">{copy.workflowTitle}</h2></div><p className="ax-section-copy">{copy.workflowCopy}</p></div><div className="ax-editorial-list">{copy.workflow.map(([index,title, text])=><div key={index} className="ax-editorial-row"><div className="ax-editorial-index">{index}</div><div className="ax-editorial-title">{title}</div><p className="ax-editorial-copy">{text}</p></div>)}</div></div></section>

        <section id="ecosystem" className="ax-landing-section ax-landing-section-alt"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">{copy.ecosystemKicker}</p><h2 className="ax-section-title">{copy.ecosystemTitle}</h2></div><p className="ax-section-copy">{copy.ecosystemCopy}</p></div><div className="mt-14 grid gap-3 lg:grid-cols-3">{[Sigma, BookOpenText, Braces].map((Icon,index)=><div key={copy.ecosystemItems[index][0]} className="relative border-t border-[var(--ax-line)] py-7 lg:px-7 lg:first:pl-0"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[var(--ax-accent)]"/><span className="font-serif text-[25px]">{copy.ecosystemItems[index][0]}</span></div><p className="mt-3 max-w-sm text-[13px] leading-6 text-[var(--ax-text-soft)]">{copy.ecosystemItems[index][1]}</p>{index<2?<ArrowRight className="absolute right-2 top-9 hidden h-4 w-4 text-[var(--ax-text-faint)] lg:block"/>:null}</div>)}</div></div></section>

        <section className="ax-final-cta"><div className="ax-landing-container"><h2 className="ax-final-title">{copy.finalTitle[0]} <span className="italic">{copy.finalTitle[1]}</span></h2><p className="ax-final-copy">{copy.finalCopy}</p><Link href="/workspace" className="ax-premium-primary mt-8">{copy.open} <ArrowRight className="h-4 w-4"/></Link></div></section>
      </main>

      <footer className="border-t border-[var(--ax-line)] bg-white"><div className="ax-landing-container flex flex-col justify-between gap-5 py-9 text-[11px] text-[var(--ax-text-faint)] sm:flex-row sm:items-center"><span>Axion Notebook · {locale === "uz" ? "Axion Science tarkibida" : "part of Axion Science"}</span><div className="flex gap-6"><Link href="/workspace">{locale === "uz" ? "Ish maydoni" : "Workspace"}</Link><Link href="#product">{copy.nav[0]}</Link><Link href="#ecosystem">{copy.nav[2]}</Link></div></div></footer>
    </div>
  );
}
