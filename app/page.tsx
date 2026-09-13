import Link from "next/link";
import { ArrowRight, BookOpenText, Braces, Sigma } from "lucide-react";

import { NotebookHeroScene } from "@/components/home/notebook-hero-scene";

function NotebookMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 text-[var(--ax-accent)]" aria-hidden="true">
      <circle cx="20" cy="20" r="17.2" fill="none" stroke="currentColor" strokeWidth="1.05" />
      <path d="M11 11.5h18M11 17h14M11 22.5h18M11 28h11" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.68" />
      <circle cx="30.5" cy="28" r="1.55" fill="currentColor" />
    </svg>
  );
}

const promises = [
  ["Think", "Write questions, explanations and observations in a document made for reading."],
  ["Compute", "Bring in mathematics and code when reasoning needs them, not as the whole interface."],
  ["Connect", "Keep evidence tied to the Project so context survives the next handoff."],
];

const workflow = [
  ["01", "Question", "Start with what you are trying to understand, not with a blank code cell."],
  ["02", "Model", "State assumptions, equations and the structure of the investigation."],
  ["03", "Computation", "Use Math results or code exactly where they support the reasoning."],
  ["04", "Observation", "Record what the evidence actually shows while it is still in context."],
  ["05", "Finding", "Keep the conclusion attached to the model, evidence and revision that produced it."],
];

function NotebookPreview() {
  return (
    <div className="ax-product-frame">
      <div className="flex h-11 items-center justify-between border-b border-[var(--ax-line)] px-5"><span className="ax-figure-label">Fig 01 · Research Notebook</span><span className="text-[10px] font-semibold text-[var(--ax-accent)]">Saved locally</span></div>
      <div className="grid min-h-[560px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-5 lg:border-b-0 lg:border-r lg:p-6">
          <div className="ax-figure-label">Research trail</div>
          <div className="mt-6 space-y-1.5 text-[11px] font-semibold text-[var(--ax-text-soft)]">{['Question','Model','Computation','Observation','Finding'].map((item,index)=><div key={item} className={`rounded-[7px] px-3 py-2.5 ${index===3?'bg-white text-[var(--ax-text)] shadow-[var(--ax-shadow-subtle)]':''}`}>{item}</div>)}</div>
          <div className="mt-9 border-t border-[var(--ax-line)] pt-5 text-[10px] leading-5 text-[var(--ax-text-faint)]">Text + equations<br />Code + results<br />Project context</div>
        </aside>
        <article className="bg-[var(--ax-canvas)] p-5 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-[860px]">
            <p className="ax-figure-label text-[var(--ax-accent)]">Observation 03</p>
            <h3 className="mt-3 font-serif text-[clamp(32px,4vw,50px)] tracking-[-0.045em]">Heat diffusion study</h3>
            <p className="mt-4 max-w-[680px] text-[13px] leading-7 text-[var(--ax-text-soft)]">The temperature field smooths over time while preserving the symmetry implied by the boundary conditions.</p>
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.02fr_.98fr]">
              <div className="space-y-4">
                <div className="rounded-[14px] border border-[var(--ax-line)] bg-white p-6"><div className="ax-figure-label">Model</div><div className="mt-5 text-center font-serif text-[30px]">∂u/∂t = α∇²u</div></div>
                <div className="rounded-[14px] border border-[#263953] bg-[#101827] p-6 font-mono text-[11px] leading-6 text-[#d9e7f8]"><span className="text-[#8eb7e8]">x</span> = linspace(0, 2π, 200)<br /><span className="text-[#8eb7e8]">u</span> = exp(-α*t) * sin(x)<br />plot(x, u)</div>
              </div>
              <div className="rounded-[14px] border border-[var(--ax-line)] bg-white p-6">
                <div className="flex items-center justify-between"><span className="ax-figure-label">Linked Math result</span><span className="text-[9px] font-semibold text-[var(--ax-accent)]">live context</span></div>
                <svg viewBox="0 0 340 220" className="mt-5 h-[220px] w-full" aria-hidden="true"><path d="M18 110H322M170 18V204" stroke="#d8e1ec" strokeWidth="1"/><path d="M18 110 C52 56 85 56 116 110 C148 164 180 164 212 110 C244 56 278 56 322 110" fill="none" stroke="#2f6fbe" strokeWidth="2.2"/><path d="M18 110 C62 80 91 80 132 110 C173 140 200 140 241 110 C282 80 304 85 322 110" fill="none" stroke="#91b2dd" strokeWidth="1.2" opacity=".72"/></svg>
                <div className="mt-4 border-t border-[var(--ax-line)] pt-4 text-[12px] leading-6 text-[var(--ax-text-soft)]"><span className="font-semibold text-[var(--ax-text)]">Finding.</span> Amplitude decays exponentially while the spatial mode remains smooth.</div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

export default function NotebookHomePage() {
  return (
    <div className="ax-landing min-h-[calc(100vh-32px)]">
      <header className="ax-premium-nav">
        <div className="ax-landing-container ax-premium-nav-inner">
          <Link href="/" className="flex min-w-0 items-center gap-3.5"><NotebookMark/><span className="min-w-0 leading-none"><span className="block truncate font-serif text-[22px] font-medium tracking-[-0.035em]">Axion Notebook</span><span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.25em] text-[var(--ax-text-faint)]">Research workspace</span></span></Link>
          <nav className="hidden items-center gap-1 xl:flex"><Link href="#product" className="ax-premium-nav-link">Product</Link><Link href="#workflow" className="ax-premium-nav-link">Workflow</Link><Link href="#ecosystem" className="ax-premium-nav-link">Ecosystem</Link></nav>
          <div className="flex items-center gap-1.5"><Link href="/workspace" className="ax-premium-secondary hidden sm:inline-flex">Workspace</Link><Link href="/workspace" className="ax-premium-primary">Open Notebook <span aria-hidden="true">→</span></Link></div>
        </div>
      </header>

      <main>
        <div className="ax-landing-container"><section className="ax-landing-hero"><div className="ax-hero-copy"><p className="ax-landing-kicker">Axion Notebook · research memory</p><h1 className="ax-landing-display">Reasoning,<br />kept <span className="italic">alive.</span></h1><div className="ax-signature-rule" aria-hidden="true"/><p className="ax-landing-lead">Capture explanations, formulas, code, figures and results without separating them from the scientific work that produced them.</p><div className="mt-8 flex flex-wrap gap-2"><Link href="/workspace" className="ax-premium-primary">Open Notebook <ArrowRight className="h-4 w-4"/></Link><Link href="#product" className="ax-premium-secondary">Explore the product <ArrowRight className="h-3.5 w-3.5 text-[var(--ax-text-faint)]"/></Link></div></div><div className="ax-hero-visual"><NotebookHeroScene/></div></section></div>

        <section className="ax-promise-strip"><div className="ax-landing-container ax-promise-grid">{promises.map(([title,copy])=><div key={title} className="ax-promise-item"><div className="ax-promise-title">{title}</div><p className="ax-promise-copy">{copy}</p></div>)}</div></section>

        <section id="product" className="ax-landing-section"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">The product</p><h2 className="ax-section-title">A notebook that remembers the research, not just the text.</h2></div><p className="ax-section-copy">Build a readable trail from question to finding. Typed blocks add scientific structure when useful while the document stays calm and human-first.</p></div><NotebookPreview/></div></section>

        <section id="workflow" className="ax-landing-section ax-landing-section-alt"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">Research workflow</p><h2 className="ax-section-title">From a question to a finding, in one readable trail.</h2></div><p className="ax-section-copy">Notebook is not another solver. It is where scientific context, interpretation and evidence remain legible over time.</p></div><div className="ax-editorial-list">{workflow.map(([index,title,copy])=><div key={index} className="ax-editorial-row"><div className="ax-editorial-index">{index}</div><div className="ax-editorial-title">{title}</div><p className="ax-editorial-copy">{copy}</p></div>)}</div></div></section>

        <section id="ecosystem" className="ax-landing-section ax-landing-section-alt"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">One research trail</p><h2 className="ax-section-title">Reasoning should stay connected to the result.</h2></div><p className="ax-section-copy">Bring a saved Math result into Notebook, add observations and findings, then hand the same scientific context to Writer.</p></div><div className="mt-14 grid gap-3 lg:grid-cols-3">{[{icon:Sigma,title:'Math',copy:'Create the calculation and visualization.'},{icon:BookOpenText,title:'Notebook',copy:'Explain, observe and build the research trail.'},{icon:Braces,title:'Writer',copy:'Use the evidence in a publication-ready document.'}].map(({icon:Icon,title,copy},index)=><div key={title} className="relative border-t border-[var(--ax-line)] py-7 lg:px-7 lg:first:pl-0"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[var(--ax-accent)]"/><span className="font-serif text-[25px]">{title}</span></div><p className="mt-3 max-w-sm text-[13px] leading-6 text-[var(--ax-text-soft)]">{copy}</p>{index<2?<ArrowRight className="absolute right-2 top-9 hidden h-4 w-4 text-[var(--ax-text-faint)] lg:block"/>:null}</div>)}</div></div></section>

        <section className="ax-final-cta"><div className="ax-landing-container"><h2 className="ax-final-title">Research memory should feel like an <span className="italic">instrument.</span></h2><p className="ax-final-copy">Open a quiet notebook where explanations, mathematics, code and evidence stay in the same scientific context.</p><Link href="/workspace" className="ax-premium-primary mt-8">Open Notebook <ArrowRight className="h-4 w-4"/></Link></div></section>
      </main>

      <footer className="border-t border-[var(--ax-line)] bg-white"><div className="ax-landing-container flex flex-col justify-between gap-5 py-9 text-[11px] text-[var(--ax-text-faint)] sm:flex-row sm:items-center"><span>Axion Notebook · part of Axion Science</span><div className="flex gap-6"><Link href="/workspace">Workspace</Link><Link href="#product">Product</Link><Link href="#ecosystem">Ecosystem</Link></div></div></footer>
    </div>
  );
}
