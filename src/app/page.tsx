"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Database, 
  Terminal, 
  Layers, 
  FileSpreadsheet, 
  Sparkles, 
  ChevronRight, 
  ArrowRight,
  Shield, 
  CloudOff,
  GitBranch, 
  Check,
  Cpu,
  Brain,
  Zap,
  Lock,
  Workflow,
  MousePointerClick
} from "lucide-react";
import ThemeHydrator from "../components/layout/ThemeHydrator";

const AI_PROMPTS = [
  "Create an e-commerce database with users, products, and order tracking...",
  "Analyze monthly recurring revenue (MRR) grouped by subscription tier...",
  "Generate 500 mock users with random addresses and transactional history...",
  "Write an optimized join to query orders with corresponding user profile tags..."
];

const DOC_SECTIONS = [
  {
    id: "query",
    icon: <Terminal className="h-4.5 w-4.5 text-violet-400" />,
    title: "SQL Query Editor",
    steps: [
      "Open the <strong>Query Editor</strong> tab from the top navigation bar.",
      "Type any standard SQLite query in the editor window. Autocomplete suggestions will appear automatically as you write.",
      "Press <strong>Ctrl+Enter</strong> (or click the <strong>Run</strong> button) to execute the query.",
      "Toggle between the <strong>Table</strong>, <strong>JSON</strong>, and <strong>CSV</strong> tabs in the bottom panel to inspect, copy, or download the results."
    ]
  },
  {
    id: "designer",
    icon: <Workflow className="h-4.5 w-4.5 text-indigo-400" />,
    title: "Visual Schema Designer",
    steps: [
      "Navigate to the <strong>Schema Designer</strong> tab.",
      "Click <strong>New Table</strong> to visually add a table. Define table name, columns, data types, and primary keys.",
      "To link tables, drag a column from a child table and drop it directly onto the primary key column of the parent table.",
      "Click <strong>Save</strong> or <strong>Export DDL</strong> to apply changes or export creation scripts."
    ]
  },
  {
    id: "explorer",
    icon: <FileSpreadsheet className="h-4.5 w-4.5 text-sky-400" />,
    title: "Spreadsheet Explorer",
    steps: [
      "Open the <strong>Data Explorer</strong> view.",
      "Select a table from the sidebar to inspect its records in a structured grid layout.",
      "Double-click any cell to directly edit values, sort table columns by clicking headers, or page through results.",
      "Use the search field to filter records matching your queries."
    ]
  },
  {
    id: "seeder",
    icon: <Sparkles className="h-4.5 w-4.5 text-amber-400" />,
    title: "Mock Data Seeder",
    steps: [
      "Navigate to the <strong>Mock Data</strong> generator page.",
      "Select the table you want to populate with mock data.",
      "The system automatically suggests format mapping fields (e.g. Email template for column 'email'). Adjust these manually if needed.",
      "Specify the number of rows (e.g. 100 or 1000) and click <strong>Generate</strong> to seed the table instantly."
    ]
  },
  {
    id: "timeline",
    icon: <GitBranch className="h-4.5 w-4.5 text-rose-400" />,
    title: "Diff & Timeline",
    steps: [
      "Open the <strong>SQL Diff</strong> panel.",
      "Click <strong>Take Snapshot</strong> to record the current state of your database schema structure.",
      "After modifying tables, click <strong>Compare</strong> to view line-by-line schema updates in visual diff mode.",
      "Click <strong>Generate Migration DDL</strong> to output the SQL ALTER commands needed to transition between versions."
    ]
  },
  {
    id: "assistant",
    icon: <Brain className="h-4.5 w-4.5 text-emerald-400" />,
    title: "AI Copilot Chat",
    steps: [
      "Click the <strong>AI Copilot</strong> button at the top header to toggle open the right assistant panel.",
      "Choose a mode: <strong>Generate SQL</strong>, <strong>Explain SQL</strong>, or <strong>Optimize Query</strong>.",
      "Enter a conversational description (e.g. 'Find active users ordering last week') and hit submit.",
      "The AI queries your schema structures and inserts the output code directly into the active SQL editor."
    ]
  }
];

export default function MarketingLandingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeDocTab, setActiveDocTab] = useState("query");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Humanoid typing animation for the mock AI prompt box
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const currentFullText = AI_PROMPTS[promptIdx];
    
    if (isDeleting) {
      timer = setTimeout(() => {
        setTypedPrompt(prev => prev.slice(0, -1));
      }, 30);
    } else {
      timer = setTimeout(() => {
        setTypedPrompt(currentFullText.slice(0, typedPrompt.length + 1));
      }, 60);
    }

    if (!isDeleting && typedPrompt === currentFullText) {
      timer = setTimeout(() => setIsDeleting(true), 2500);
    } else if (isDeleting && typedPrompt === "") {
      setIsDeleting(false);
      setPromptIdx(prev => (prev + 1) % AI_PROMPTS.length);
    }

    return () => clearTimeout(timer);
  }, [typedPrompt, isDeleting, promptIdx]);

  return (
    <>
      <ThemeHydrator />
      <div className="min-h-screen bg-[#030303] text-neutral-100 selection:bg-violet-500/30 selection:text-violet-200 overflow-x-hidden font-sans relative">
        
        {/* Dynamic Neural Light Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.08),transparent_55%)] pointer-events-none -z-10" />
        <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.04),transparent_60%)] pointer-events-none -z-10 blur-xl" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03),transparent_60%)] pointer-events-none -z-10 blur-xl" />

        {/* Global grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.007)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.007)_1px,transparent_1px)] bg-[size:4rem_4rem] -z-20 pointer-events-none" />

        {/* Floating Navigation Header */}
        <header className="sticky top-0 z-50 w-full border-b border-neutral-900/50 bg-[#030303]/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-6 lg:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <Brain className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold tracking-tight text-neutral-100">
                  SQL Studio
                </span>
                <span className="text-[9px] text-violet-400/90 font-mono tracking-widest uppercase">Humanoid AI</span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider uppercase text-neutral-400">
              <a href="#features" className="hover:text-violet-400 transition-colors">Core Capabilities</a>
              <a href="#copilot" className="hover:text-violet-400 transition-colors">AI Copilot</a>
              <a href="#docs" className="hover:text-violet-400 transition-colors">Documentation</a>
            </nav>

            <div className="flex items-center gap-4">
              <Link 
                href="/workspace" 
                className="inline-flex items-center gap-1.5 justify-center rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 px-4.5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/10 transition-all border border-violet-500/30"
              >
                <span>Launch Studio</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Area */}
        <section className="relative px-6 pt-10 pb-20 lg:pt-14 lg:pb-28 max-w-7xl mx-auto flex flex-col items-center">
          
          {/* Headline */}
          <div className="text-center max-w-4xl space-y-6 mt-6">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl text-neutral-100 leading-[1.08] font-sans">
              The Intelligent SQL Workspace
              <span className="block mt-3 bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
                Co-Engineered for Humans.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed font-normal">
              A premium, offline-first client executing SQLite in WebAssembly. Visually construct relationship diagrams, generate schemas via AI pipelines, and seed mock values instantly.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Link 
                href="/workspace" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6.5 py-4 text-sm font-bold text-white shadow-xl shadow-violet-600/20 hover:bg-violet-500 transition-all border border-violet-500/20 active:scale-95"
              >
                <span>Initialize Free Console</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a 
                href="#features" 
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-900 text-neutral-300 px-6.5 py-4 text-sm font-bold transition-all"
              >
                View Features
              </a>
            </div>
          </div>

          {/* Interactive AI Prompt Simulator Mockup */}
          <section className="relative px-6 pb-20 max-w-7xl mx-auto flex flex-col items-center">
            <div className="mt-20 w-full max-w-3xl border border-neutral-900 bg-[#070707] rounded-2xl p-4 shadow-2xl shadow-violet-500/5 relative overflow-hidden group select-none">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-transparent pointer-events-none" />
              <div className="flex items-center gap-1.5 pb-3 border-b border-neutral-900/60 text-neutral-500 text-[10px] font-mono">
                <Brain className="h-3.5 w-3.5 text-violet-500" />
                <span>AI COPILOT SIMULATION</span>
              </div>
              
              <div className="pt-4 space-y-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-violet-400 font-bold uppercase tracking-wider font-mono">Prompt:</span>
                  <div className="flex-1 bg-neutral-950 border border-neutral-900 rounded-lg px-3 py-2 font-mono text-[11px] text-neutral-300 relative flex items-center min-h-[38px]">
                    <span>{typedPrompt}</span>
                    <span className="w-1.5 h-3.5 bg-violet-500 ml-0.5 animate-pulse shrink-0" />
                  </div>
                </div>

                {/* simulated response block */}
                <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono">
                    <span>GENERATED SQL CODE</span>
                    <span className="text-violet-400">99.8% Confidence</span>
                  </div>
                  <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                    {`SELECT 
  o.id AS order_id,
  u.name AS customer_name,
  SUM(o.amount) OVER(PARTITION BY o.user_id) as total_spent
FROM orders o
JOIN users u ON o.user_id = u.id;`}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        </section>

        {/* Feature Cards Grid */}
        <section id="features" className="py-24 border-t border-neutral-900 bg-[#050505]/40 px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Core Capabilities</span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-neutral-100 font-sans">Humanoid Database Orchestration</h2>
            <p className="text-neutral-400 text-sm sm:text-base">Everything needed to write queries, map structures, and review schemas locally.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Terminal className="h-6 w-6 text-violet-400" />,
                title: "Monaco Autocomplete Console",
                desc: "Full schema-aware editor with smart index lookups, real-time error detection, formatters, and query histories."
              },
              {
                icon: <Workflow className="h-6 w-6 text-indigo-400" />,
                title: "Interactive ER Graph",
                desc: "Design and edit table connections visually. Create primary key links and build schema maps by dragging nodes."
              },
              {
                icon: <FileSpreadsheet className="h-6 w-6 text-sky-400" />,
                title: "Spreadsheet Data Explorer",
                desc: "Clean database explorer table. Sort columns, search rows, and edit values instantly inside a spreadsheet interface."
              },
              {
                icon: <Sparkles className="h-6 w-6 text-amber-400" />,
                title: "Faker Mock Data Seeding",
                desc: "Detects column names (like email, name, status) and seeds tables with realistic mock data in a single click."
              },
              {
                icon: <GitBranch className="h-6 w-6 text-rose-400" />,
                title: "Migrations & Rollbacks",
                desc: "Track local schema snapshot changes, compile standard DDL scripts (ALTER, CREATE), and apply instant rollbacks."
              },
              {
                icon: <Lock className="h-6 w-6 text-emerald-400" />,
                title: "100% Offline Privacy",
                desc: "No data leaves your device. Database transactions are stored locally via client-side IndexedDB storage."
              }
            ].map((card, idx) => (
              <div 
                key={idx} 
                className="p-6 rounded-2xl border border-neutral-900 bg-[#070707]/30 hover:border-neutral-800 hover:bg-[#070707]/70 hover:shadow-xl transition-all duration-300 group"
              >
                <div className="mb-4 inline-flex p-3 rounded-xl bg-neutral-950 border border-neutral-900 group-hover:scale-105 transition-transform">
                  {card.icon}
                </div>
                <h3 className="text-sm font-bold text-neutral-200 mb-2">{card.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AI Copilot Highlight Section */}
        <section id="copilot" className="py-24 border-t border-neutral-900 px-6 lg:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="space-y-6 max-w-xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 fill-violet-400 text-violet-400" />
              <span>CO-ENGINEERING ENVIRONMENT</span>
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-neutral-100 leading-[1.1]">
              A Copilot designed around your active schema.
            </h2>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              SQL Studio integrates directly with Hugging Face Space endpoints. It automatically reads your current database structure, identifies table relations, and translates conversational prompts into executable, optimized SQL.
            </p>
            
            <ul className="space-y-3.5 text-xs text-neutral-300">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-400" /> Auto-contextualizes active SQLite schemas</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-400" /> Refactors, runs, and formats code inside the console</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-400" /> Explains execution paths and index options</li>
            </ul>
          </div>

          {/* Interactive visual layout */}
          <div className="w-full lg:max-w-md border border-neutral-900 bg-neutral-950/40 rounded-2xl p-6 relative overflow-hidden space-y-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.05),transparent_40%)]" />
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 border-b border-neutral-900 pb-3">
              <Brain className="h-4 w-4 text-violet-500" />
              <span>AI COPILOT</span>
            </div>
            
            <div className="space-y-3">
              <div className="text-[11px] leading-relaxed text-neutral-300 bg-[#080808] border border-neutral-900 p-3 rounded-xl font-mono">
                "Show me all orders from the last month that have an amount greater than 100."
              </div>
              
              <div className="flex justify-end">
                <div className="text-[11px] leading-relaxed text-emerald-400 bg-emerald-950/15 border border-emerald-900/30 p-3 rounded-xl font-mono max-w-[85%]">
                  SELECT * FROM orders <br/>
                  WHERE created_at &gt;= DATE('now', '-30 days') <br/>
                  AND amount &gt; 100;
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Documentation Section */}
        <section id="docs" className="py-24 border-t border-neutral-900 bg-[#050505]/40 px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Documentation & User Guide</span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-neutral-100">How To Use SQL Studio Features</h2>
            <p className="text-neutral-400 text-sm">Step-by-step instructions to master the database workspace.</p>
          </div>

          <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-[240px_1fr] items-start">
            {/* Sidebar selection tabs */}
            <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 select-none border-b md:border-b-0 md:border-r border-neutral-900 pr-0 md:pr-4">
              {[
                { id: "query", label: "Query Console", icon: <Terminal className="h-4 w-4" /> },
                { id: "designer", label: "ER Graph Designer", icon: <Workflow className="h-4 w-4" /> },
                { id: "explorer", label: "Spreadsheet Explorer", icon: <FileSpreadsheet className="h-4 w-4" /> },
                { id: "seeder", label: "Mock Data Seeder", icon: <Sparkles className="h-4 w-4" /> },
                { id: "timeline", label: "Diff & Migrations", icon: <GitBranch className="h-4 w-4" /> },
                { id: "assistant", label: "AI Copilot Chat", icon: <Brain className="h-4 w-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDocTab(tab.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all whitespace-nowrap cursor-pointer border ${
                    activeDocTab === tab.id
                      ? "text-violet-400 bg-violet-500/10 border-violet-500/20"
                      : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/30 border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Doc contents container */}
            <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl p-6 md:p-8 min-h-[300px]">
              {(() => {
                const currentDoc = DOC_SECTIONS.find((d) => d.id === activeDocTab);
                return (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                      {currentDoc?.icon}
                      <span>{currentDoc?.title}</span>
                    </h3>
                    <ol className="space-y-4 text-xs sm:text-sm text-neutral-400 list-decimal pl-4 leading-relaxed">
                      {currentDoc?.steps.map((step, sIdx) => (
                        <li key={sIdx} dangerouslySetInnerHTML={{ __html: step }} />
                      ))}
                    </ol>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* Support & FAQ */}
        <section id="faq" className="py-24 border-t border-neutral-900 px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="text-center space-y-3 mb-16">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Support Center</span>
            <h2 className="text-3xl font-extrabold text-neutral-100">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Is my database secure?",
                a: "Absolutely. Since SQL Studio runs client-side inside WebAssembly, your queries and schema definitions never transit over any server. All local persistence uses sandboxed IndexedDB storage in your browser."
              },
              {
                q: "Can I import existing SQL or SQLite database files?",
                a: "Yes. You can import any valid `.db`, `.sqlite`, or `.sql` file using the top panel. The explorer automatically populates the schema designer and lists tables."
              },
              {
                q: "How does the AI Copilot help me write queries?",
                a: "The assistant reads your database schema metadata. When you write a natural language request, the model evaluates table columns and relationship parameters to compose optimized SQL syntax."
              }
            ].map((faq, idx) => (
              <div 
                key={idx} 
                className="rounded-2xl border border-neutral-900 bg-neutral-950/20 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left text-xs font-bold text-neutral-200 hover:text-neutral-100 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronRight className={`h-4.5 w-4.5 text-neutral-500 transition-transform ${activeFaq === idx ? "rotate-90 text-violet-400" : ""}`} />
                </button>
                {activeFaq === idx && (
                  <div className="px-5 pb-5 pt-0 border-t border-neutral-900/60 text-xs text-neutral-400 leading-relaxed">
                    <div className="pt-4">
                      {faq.a}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Simple Footer */}
        <footer className="border-t border-neutral-900 bg-[#030303] py-12 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-600/10 text-violet-400">
                <Brain className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-neutral-400">SQL Studio</span>
            </div>
            <p>© {new Date().getFullYear()} SQL Studio. Dedicated to database craftsmanship. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-neutral-400">Privacy Policy</a>
              <a href="#" className="hover:text-neutral-400">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
