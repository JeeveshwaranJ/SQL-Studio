"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Brain, Settings, Play, Copy, ArrowRight, CornerDownLeft, Eye, Zap, Info } from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { AiService } from "./aiService";

export default function AiPanel() {
  const { tables, activeQuery, setActiveQuery, runQuery } = useDbStore();
  const [activeSubTab, setActiveSubTab] = useState<"generate" | "explain" | "optimize">("generate");
  const [showSettings, setShowSettings] = useState(false);

  // Inputs/Outputs
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Result States
  const [generatedSql, setGeneratedSql] = useState("");
  const [explanation, setExplanation] = useState<any>(null);
  const [optimization, setOptimization] = useState<any>(null);

  const getSchemaSummary = () => {
    return tables
      .map((t) => {
        const cols = t.columns.map((c) => `${c.name} (${c.type}${c.pk ? " PK" : ""})`).join(", ");
        const fks = t.foreignKeys.map((f) => `FK ${f.column} -> ${f.refTable}(${f.refColumn})`).join(", ");
        return `Table: ${t.name}\n  Columns: ${cols}${fks ? `\n  Relations: ${fks}` : ""}`;
      })
      .join("\n\n");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setErrorMsg("");
    setGeneratedSql("");
    
    try {
      const sql = await AiService.generateSql(prompt.trim(), getSchemaSummary());
      setGeneratedSql(sql);
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplain = async () => {
    setIsLoading(true);
    setErrorMsg("");
    setExplanation(null);
    try {
      const data = await AiService.explainSql(activeQuery, getSchemaSummary());
      setExplanation(data);
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimize = async () => {
    setIsLoading(true);
    setErrorMsg("");
    setOptimization(null);
    try {
      const data = await AiService.optimizeSql(activeQuery, getSchemaSummary());
      setOptimization(data);
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToEditor = (sqlText: string) => {
    setActiveQuery(sqlText);
  };

  const handleRunGenerated = async (sqlText: string) => {
    setActiveQuery(sqlText);
    await runQuery(sqlText);
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border text-foreground select-none overflow-hidden">
      {/* Header */}
      <div className="flex h-11 items-center justify-between px-3 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-bold tracking-tight">AI SQL Assistant</span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1 rounded hover:bg-accent cursor-pointer transition-colors ${
            showSettings ? "text-primary bg-accent/40" : "text-muted-foreground"
          }`}
          title="AI Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Settings Drawer overlay */}
      {showSettings && (
        <div className="p-3 border-b border-border bg-accent/5 space-y-3 shrink-0 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Configuration</span>
            <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">Close</button>
          </div>

          <div className="space-y-2.5">
            <div className="p-2 border border-border/80 bg-background rounded-lg space-y-1">
              <span className="font-bold text-[10px] text-muted-foreground block uppercase">Active Provider</span>
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Brain className="h-4 w-4" />
                <span>Hugging Face Space Model</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                Space ID: jeeves111/my-ai-chatbot
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              To swap the model space, set the <code className="font-mono">HF_SPACE_ID</code> variable inside your <code className="font-mono">.env.local</code> environment file.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border bg-card/60 shrink-0 text-xs px-2 pt-1 gap-1">
        <button
          onClick={() => setActiveSubTab("generate")}
          className={`px-3 py-1.5 font-semibold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "generate"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Generate SQL
        </button>
        <button
          onClick={() => setActiveSubTab("explain")}
          className={`px-3 py-1.5 font-semibold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "explain"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Explain SQL
        </button>
        <button
          onClick={() => setActiveSubTab("optimize")}
          className={`px-3 py-1.5 font-semibold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "optimize"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Optimize Query
        </button>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {errorMsg && (
          <div className="flex items-start gap-2 p-2.5 border border-red-500/20 bg-red-500/5 text-red-500 text-xs rounded">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SUBTAB 1: GENERATE SQL */}
        {activeSubTab === "generate" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                What data do you want to query?
              </label>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Find total sum of order amounts grouped by status and product category"
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[90px] pr-8 leading-relaxed resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !prompt.trim()}
                  className="absolute bottom-2.5 right-2.5 p-1 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 cursor-pointer transition-all"
                  title="Generate SQL"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
                <Brain className="h-4 w-4 animate-spin text-primary" />
                <span>Cooking SQL Query...</span>
              </div>
            )}

            {generatedSql && (
              <div className="space-y-2 border border-border/80 bg-accent/5 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Generated Query</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSendToEditor(generatedSql)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-[10px] text-foreground font-semibold cursor-pointer border border-border"
                      title="Load query in tab"
                    >
                      <CornerDownLeft className="h-3 w-3" />
                      Apply
                    </button>
                    <button
                      onClick={() => handleRunGenerated(generatedSql)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-primary hover:bg-primary/95 text-[10px] text-primary-foreground font-bold cursor-pointer"
                      title="Run query immediately"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Run
                    </button>
                  </div>
                </div>
                <pre className="text-[11px] font-mono p-2.5 rounded bg-background border border-border/60 overflow-x-auto text-foreground select-text max-h-[160px]">
                  {generatedSql}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: EXPLAIN SQL */}
        {activeSubTab === "explain" && (
          <div className="space-y-4">
            <div className="p-3 border border-border/40 bg-accent/5 rounded-lg space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Active Editor Query</span>
              <pre className="text-[10px] font-mono p-2 rounded bg-background border border-border/50 overflow-x-auto truncate">
                {activeQuery || "-- empty query --"}
              </pre>
              <button
                onClick={handleExplain}
                disabled={isLoading || !activeQuery.trim()}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Brain className="h-3.5 w-3.5" />
                Analyze & Explain
              </button>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
                <Brain className="h-4 w-4 animate-spin text-primary" />
                <span>Explaining structure...</span>
              </div>
            )}

            {explanation && (
              <div className="space-y-3.5 text-xs leading-relaxed">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Overview</span>
                  <div className="p-3 rounded border border-border bg-accent/5 text-foreground/90">
                    {explanation.explanation}
                  </div>
                </div>

                {explanation.tables && explanation.tables.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Tables Referenced</span>
                    <div className="flex flex-wrap gap-1">
                      {explanation.tables.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded border border-border bg-background text-[10px] font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Performance & Execution Plan</span>
                  <div className="p-3 rounded border border-border bg-accent/5 text-foreground/90 whitespace-pre-wrap font-mono text-[10px]">
                    {explanation.performance}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 3: OPTIMIZE SQL */}
        {activeSubTab === "optimize" && (
          <div className="space-y-4">
            <div className="p-3 border border-border/40 bg-accent/5 rounded-lg space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Active Editor Query</span>
              <pre className="text-[10px] font-mono p-2 rounded bg-background border border-border/50 overflow-x-auto truncate">
                {activeQuery || "-- empty query --"}
              </pre>
              <button
                onClick={handleOptimize}
                disabled={isLoading || !activeQuery.trim()}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Zap className="h-3.5 w-3.5 text-yellow-400" />
                Optimize Execution
              </button>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
                <Brain className="h-4 w-4 animate-spin text-primary" />
                <span>Running optimization profiles...</span>
              </div>
            )}

            {optimization && (
              <div className="space-y-3.5 text-xs">
                {optimization.suggestions && optimization.suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Improvement Highlights</span>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                      {optimization.suggestions.map((s: string, idx: number) => (
                        <li key={idx} className="leading-normal">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Optimized Query</span>
                    <button
                      onClick={() => handleSendToEditor(optimization.sql)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-[10px] text-foreground font-semibold cursor-pointer border border-border"
                    >
                      <CornerDownLeft className="h-3 w-3" />
                      Apply
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono p-2.5 rounded bg-background border border-border/60 overflow-x-auto text-foreground max-h-[140px]">
                    {optimization.sql}
                  </pre>
                </div>

                {optimization.indexes && optimization.indexes.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">Recommended Indexes</span>
                    {optimization.indexes.map((idxSql: string, idx: number) => (
                      <div key={idx} className="flex flex-col gap-1.5 p-2 rounded bg-background border border-border/60">
                        <pre className="text-[9px] font-mono overflow-x-auto text-muted-foreground">{idxSql}</pre>
                        <button
                          type="button"
                          onClick={() => runQuery(idxSql)}
                          className="self-end px-2 py-0.5 rounded bg-primary hover:bg-primary/95 text-[9px] text-primary-foreground font-bold cursor-pointer"
                        >
                          Execute Index
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-expose AlertCircle and Brain for local error alerts
const AlertCircle = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  </svg>
);
