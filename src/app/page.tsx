"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { Terminal, ArrowRight, Github, LayoutDashboard, Code, ShieldAlert, GitBranch, Play, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";

const ROLES = ["developer", "builder", "creator", "an engineer"];

export default function HomePage() {
  const [roleIndex, setRoleIndex] = useState(0);
  const [activeAccordion, setActiveAccordion] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRoleIndex((prev) => (prev + 1) % ROLES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const accordionItems = [
    {
      title: "Connect your repository",
      description: "Import any GitHub repository in one click. Devin creates a secure, isolated sandbox for each project, shared with everyone in your organization."
    },
    {
      title: "Talk to Devin",
      description: "Describe what you want to change in plain English. Our AI analyzes the codebase and implements exact edits across multiple files simultaneously."
    },
    {
      title: "Review changes",
      description: "Instantly preview your changes in a live interactive sandbox before they ever touch your actual repository."
    },
    {
      title: "Push to GitHub",
      description: "When you are happy with the preview, hit commit. Devin creates a clean, formatted Pull Request ready for engineering review."
    }
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground overflow-x-hidden font-sans">
      <main className="flex-1 flex flex-col w-full">
        {/* Navbar */}
        <div className="w-full border-b border-border fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md transition-all duration-300">
          <header className="w-full h-14">
            <div className="w-full h-full px-6 sm:px-8 md:px-16 lg:px-24 flex justify-between items-center max-w-screen-2xl mx-auto">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground rounded-md">
                  <Terminal className="h-5 w-5" />
                </div>
                <span className="text-lg font-bold tracking-widest uppercase text-primary">
                  Devin
                </span>
              </Link>
              
              <div className="hidden lg:flex items-center gap-9 text-sm font-semibold">
                 <a href="#problem" className="text-muted-foreground hover:text-foreground transition-colors">Problem</a>
                 <a href="#solution" className="text-muted-foreground hover:text-foreground transition-colors">Solution</a>
                 <a href="#workflow" className="text-muted-foreground hover:text-foreground transition-colors">Workflow</a>
              </div>

              <div className="flex items-center gap-4">
                <SignedOut>
                  <Link
                    className="text-sm font-medium text-muted-foreground transition hover:text-foreground hidden sm:block"
                    href="/sign-in"
                  >
                    Log in
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-8 rounded-md px-4"
                    href="/sign-up"
                  >
                    Get Started
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-8 rounded-md px-4"
                    href="/projects"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Projects
                  </Link>
                </SignedIn>
              </div>
            </div>
          </header>
        </div>
        
        <div className="h-14"></div>

        <div className="flex-1 flex flex-col">
          
          {/* Hybrid Hero Section (Sparkles Inspired) */}
          <section className="relative flex w-full flex-col items-center justify-center gap-6 pt-32 pb-24 sm:pt-40 sm:pb-32 px-6">
            <div className="flex max-w-[800px] flex-col items-center justify-center gap-10">
              <div className="flex flex-col items-center justify-center gap-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-1.5 text-sm font-medium">
                  Built for modern teams
                </div>
                <div className="flex flex-col gap-4">
                  <h1 className="text-center text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground tracking-tight leading-[1.1]">
                    Make everyone on your team <br className="hidden sm:block" />
                    <span className="inline-block relative text-primary mt-2">
                      <span className="inline-block min-w-[300px] text-center animate-in fade-in duration-500" key={roleIndex}>
                        {ROLES[roleIndex]}
                      </span>
                    </span>
                  </h1>
                  <p className="text-center text-lg sm:text-xl font-medium text-muted-foreground max-w-2xl mx-auto mt-2">
                    (without breaking anything on production)
                  </p>
                </div>
              </div>
              
              <div className="flex w-full flex-col items-center gap-3 sm:w-fit sm:flex-row mt-4">
                 <SignedOut>
                    <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 h-12 rounded-md px-8 w-full sm:w-auto">
                      Start contributing
                    </Link>
                  </SignedOut>
                  <SignedIn>
                    <Link href="/projects" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 h-12 rounded-md px-8 w-full sm:w-auto">
                      Go to Projects
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </SignedIn>
              </div>
            </div>
          </section>

          {/* Problem Section (Sparkles Inspired) */}
          <section id="problem" className="relative flex w-full items-center justify-center bg-muted/30 border-y border-border py-24 sm:py-28">
            <div className="flex w-full max-w-7xl flex-col items-center justify-center gap-12 px-6 sm:px-8">
              <div className="flex flex-col items-center justify-center gap-2 max-w-2xl">
                <h2 className="text-center text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">The problem</h2>
                <p className="text-center text-lg text-muted-foreground sm:text-xl">
                  Your team has ideas. Your engineers are busy. Corners get cut.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                <div className="flex h-full min-h-[280px] w-full flex-col justify-between rounded-2xl border border-border bg-card px-8 pt-8 pb-8 transition-transform hover:-translate-y-1 shadow-sm">
                  <div className="flex w-full justify-between items-start">
                    <h3 className="text-4xl font-bold text-muted-foreground/30">1.</h3>
                    <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                       <LayoutDashboard className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex flex-col mt-8">
                    <h4 className="text-lg font-semibold text-foreground mb-2">Engineering bottleneck</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Every feature request goes through your dev team. Non-technical teammates wait days or weeks for simple copy changes.
                    </p>
                  </div>
                </div>

                <div className="flex h-full min-h-[280px] w-full flex-col justify-between rounded-2xl border border-border bg-card px-8 pt-8 pb-8 transition-transform hover:-translate-y-1 shadow-sm">
                  <div className="flex w-full justify-between items-start">
                    <h3 className="text-4xl font-bold text-muted-foreground/30">2.</h3>
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                       <GitBranch className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex flex-col mt-8">
                    <h4 className="text-lg font-semibold text-foreground mb-2">Context-switching</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Engineers spend more time explaining git branches than writing code. Knowledge silos slow everyone down.
                    </p>
                  </div>
                </div>

                <div className="flex h-full min-h-[280px] w-full flex-col justify-between rounded-2xl border border-border bg-card px-8 pt-8 pb-8 transition-transform hover:-translate-y-1 shadow-sm">
                  <div className="flex w-full justify-between items-start">
                    <h3 className="text-4xl font-bold text-muted-foreground/30">3.</h3>
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                       <ShieldAlert className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex flex-col mt-8">
                    <h4 className="text-lg font-semibold text-foreground mb-2">Risk of mistakes</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Giving non-engineers direct codebase access is dangerous. One wrong commit can break the production build.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Solution Section (Sparkles Inspired Accordion + Preview) */}
          <section id="solution" className="relative flex w-full items-center justify-center py-24 sm:py-32">
            <div className="flex w-full max-w-7xl items-start justify-center gap-12 lg:gap-24 px-6 sm:px-8 flex-col lg:flex-row">
              <div className="flex flex-col items-start justify-start gap-10 w-full lg:w-1/2">
                <div className="flex flex-col items-start justify-start gap-4">
                  <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">The solution</h2>
                  <p className="text-lg text-muted-foreground sm:text-xl">
                    Devin gives your whole team the power to build without the risk. Safe sandboxes, real-time previews, and structured pull requests.
                  </p>
                </div>
                
                <div className="flex w-full flex-col gap-2">
                  {accordionItems.map((item, index) => (
                    <div 
                      key={index} 
                      className={`flex w-full flex-col border-b border-border transition-colors duration-300 ${activeAccordion === index ? 'pb-6' : 'pb-4'}`}
                    >
                      <button 
                        onClick={() => setActiveAccordion(index)}
                        className="flex w-full items-center justify-between py-4 text-left group"
                      >
                        <h4 className={`text-lg sm:text-xl font-medium transition-colors ${activeAccordion === index ? 'text-primary' : 'text-foreground group-hover:text-primary/80'}`}>
                          {item.title}
                        </h4>
                        <div className="text-muted-foreground transition-transform duration-300">
                          {activeAccordion === index ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </button>
                      
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${activeAccordion === index ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <p className="text-muted-foreground text-base leading-relaxed pr-8">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sticky Preview Block */}
              <div className="hidden lg:block w-full lg:w-1/2 sticky top-32">
                <div className="rounded-xl border border-border bg-card p-2 shadow-xl shadow-black/5">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center relative">
                     {/* Decorative background based on active state */}
                     <div className="absolute inset-0 bg-gradient-to-br from-background/40 to-muted/40"></div>
                     
                     <div className="relative z-10 flex flex-col items-center text-center p-6">
                        {activeAccordion === 0 && (
                          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                            <Github className="w-16 h-16 text-foreground mb-4 opacity-80" />
                            <div className="font-mono text-sm bg-background border border-border px-4 py-2 rounded-full shadow-sm">github.com/org/repo</div>
                          </div>
                        )}
                        {activeAccordion === 1 && (
                          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                            <Terminal className="w-16 h-16 text-foreground mb-4 opacity-80" />
                            <div className="font-mono text-sm bg-background border border-border px-4 py-2 rounded-lg text-left w-64 shadow-sm">
                              <span className="text-primary">&gt;</span> Change the hero button to say "Get Started" and make it blue.
                            </div>
                          </div>
                        )}
                        {activeAccordion === 2 && (
                          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                            <LayoutDashboard className="w-16 h-16 text-foreground mb-4 opacity-80" />
                            <div className="flex gap-2">
                               <div className="w-32 h-24 bg-background border border-border rounded-md shadow-sm"></div>
                               <div className="w-32 h-24 bg-primary/10 border border-primary/30 rounded-md shadow-sm relative">
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-semibold text-primary">LIVE PREVIEW</span>
                                  </div>
                               </div>
                            </div>
                          </div>
                        )}
                        {activeAccordion === 3 && (
                          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                            <GitBranch className="w-16 h-16 text-emerald-500 mb-4 opacity-80" />
                            <div className="font-mono text-sm bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-4 py-2 rounded-full shadow-sm">
                              PR #142 Created Successfully
                            </div>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Kosuke Inspired Workflow/Architecture Ticker Section */}
          <section id="workflow" className="py-24 sm:py-28 lg:py-32 overflow-hidden border-t border-border bg-background">
            <div className="container mx-auto px-6 sm:px-8 max-w-screen-2xl">
               <div className="mb-14 sm:mb-16">
                  <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-3xl">
                    <span className="text-foreground">Configure once.</span> <span className="text-muted-foreground">Ship forever.</span>
                  </h2>
                  <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    Connect your repo, select a branch, and you're off. Every commit happens automatically inside the workspace boundaries. You focus on shipping, we handle the workflow.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-stretch">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between px-1 mb-4 min-h-[24px]">
                      <span className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Setup</span>
                    </div>
                    <div className="flex-1 flex flex-col p-6 rounded-2xl border border-border bg-card shadow-sm">
                      <div className="flex-1 flex flex-col min-h-0 space-y-4">
                        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                          <span className="font-mono text-xs text-muted-foreground/70 w-5">01</span>
                          <span className="flex-1 text-sm font-medium text-foreground">Import repo</span>
                        </div>
                        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                          <span className="font-mono text-xs text-muted-foreground/70 w-5">02</span>
                          <span className="flex-1 text-sm font-medium text-foreground">Load files</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground/70 w-5">03</span>
                          <span className="flex-1 text-sm font-medium text-foreground">Set context</span>
                        </div>
                      </div>
                      <div className="mt-auto pt-6 border-t border-dashed border-border flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Ready</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between px-1 mb-4 min-h-[24px]">
                      <span className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Contribute</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center relative overflow-hidden rounded-2xl border border-border bg-card py-16 shadow-sm">
                      <div className="relative">
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-border/60 -translate-y-1/2 z-0"></div>
                        <div className="flex items-center gap-8 px-8 overflow-x-hidden relative z-10 w-full" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
                          <div className="flex items-center gap-8 animate-[marquee_20s_linear_infinite] whitespace-nowrap min-w-max">
                            {[
                              { text: "Update pricing copy", branch: "maria/pm" },
                              { text: "Add FAQ entry", branch: "sam/marketing" },
                              { text: "Fix nav hover", branch: "alex/design" },
                              { text: "Update pricing copy", branch: "maria/pm" },
                              { text: "Add FAQ entry", branch: "sam/marketing" },
                              { text: "Fix nav hover", branch: "alex/design" },
                              { text: "Update pricing copy", branch: "maria/pm" },
                              { text: "Add FAQ entry", branch: "sam/marketing" },
                              { text: "Fix nav hover", branch: "alex/design" }
                            ].map((ticket, i) => (
                              <div key={i} className="inline-flex items-center gap-2.5 px-4 py-2 bg-background border border-border/80 rounded-full text-[13px] font-medium text-foreground shadow-sm">
                                <span className="w-1 h-1 rounded-full bg-foreground/80 shrink-0"></span>
                                <span className="font-medium tracking-tight">{ticket.text}</span>
                                <span className="font-mono text-[11px] text-muted-foreground/50 ml-3 tracking-normal">{ticket.branch}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 mt-12 mx-8">
                        {['Identify', 'Edit', 'Review', 'Commit'].map((step, idx) => (
                           <div key={idx} className="relative flex flex-col items-center pt-6">
                            <div className="absolute top-[-52px] left-1/2 -translate-x-1/2 w-px bg-border/60 h-[76px]"></div>
                            <div className="w-2 h-2 rounded-full bg-border mb-3 z-10"></div>
                            <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-muted-foreground text-center">
                              {step}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </section>
          
          <footer className="mt-auto border-t border-border py-12 bg-muted/20">
            <div className="container mx-auto px-6 sm:px-8 max-w-screen-2xl">
              <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-muted-foreground" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    © {new Date().getFullYear()} Devin Engineering
                  </p>
                </div>
                <div className="flex gap-8">
                  <a href="#" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Documentation</a>
                  <a href="#" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
                  <a href="#" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Terms</a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
