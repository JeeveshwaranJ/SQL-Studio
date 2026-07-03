"use client";

import React, { useState } from "react";
import { 
  History as HistoryIcon, 
  Database, 
  Trash2, 
  Copy, 
  Play, 
  Clock, 
  Pin,
  Tag,
  Search,
  Plus
} from "lucide-react";
import { useHistoryStore, HistoryItem } from "../../lib/store/historyStore";
import { useDbStore } from "../../lib/store/dbStore";
import DatabaseInspector from "./DatabaseInspector";

type SidebarTab = "schema" | "history";

export default function HistorySidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("schema");
  const { 
    history, 
    removeHistoryItem, 
    clearHistory, 
    togglePin, 
    addTag, 
    removeTag 
  } = useHistoryStore();

  const { runQuery, setActiveQuery } = useDbStore();
  const [searchQuery, setSearchQuery] = useState("");

  const handleCopyHistory = (e: React.MouseEvent, sql: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sql);
  };

  const handleApplyQuery = (sql: string) => {
    setActiveQuery(sql);
  };

  const handleRunQueryImmediate = (e: React.MouseEvent, sql: string) => {
    e.stopPropagation();
    setActiveQuery(sql);
    runQuery(sql);
  };

  // Filter history based on search string matching SQL statements or tags
  const filteredHistory = history.filter((item) => {
    const s = searchQuery.toLowerCase().trim();
    if (!s) return true;
    const matchesSql = item.sql.toLowerCase().includes(s);
    const matchesTag = item.tags?.some((t) => t.toLowerCase().includes(s));
    return matchesSql || matchesTag;
  });

  return (
    <div className="flex flex-col h-full min-h-0 select-none bg-card transition-colors">
      {/* Sidebar Tab Selector */}
      <div className="flex h-11 border-b border-border bg-card shrink-0">
        <button
          onClick={() => setActiveTab("schema")}
          className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "schema"
              ? "border-primary text-primary bg-background/30"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>Schema</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "history"
              ? "border-primary text-primary bg-background/30"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          <span>History ({history.length})</span>
        </button>
      </div>

      {/* Tab Panel Contents */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "schema" ? (
          <DatabaseInspector />
        ) : (
          /* History Tab */
          <div className="flex-1 min-h-0 p-3 flex flex-col space-y-3">
            {/* Header controls & Clear option */}
            <div className="flex items-center justify-between pb-1 shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Query History
              </span>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                  title="Clear all stored query history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* History Search filter bar */}
            {history.length > 0 && (
              <div className="relative shrink-0 select-none">
                <input
                  type="text"
                  placeholder="Search history by sql or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border rounded pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[10px] placeholder:font-sans placeholder:text-[11px]"
                />
                <Search className="h-3.5 w-3.5 text-muted-foreground/60 absolute left-2.5 top-2" />
              </div>
            )}

            {/* List */}
            {filteredHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center rounded-lg border border-dashed border-border/50 bg-accent/10">
                <Clock className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-xs text-muted-foreground font-medium">
                  {history.length === 0 ? "No query history" : "No matches found"}
                </p>
                <p className="text-[10px] text-muted-foreground/80 mt-1 max-w-[160px] leading-relaxed">
                  {history.length === 0 
                    ? "Executed SQL statements will appear here." 
                    : "Try adjusting your search keywords."}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                {filteredHistory.map((item: HistoryItem) => (
                  <div
                    key={item.id}
                    onClick={() => handleApplyQuery(item.sql)}
                    className="group relative flex flex-col p-2.5 rounded border border-border/40 hover:border-primary/50 bg-accent/10 hover:bg-accent/20 cursor-pointer transition-all duration-150"
                  >
                    {/* Status Badge & Timestamp */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            item.success ? "bg-green-500 animate-pulse" : "bg-red-500"
                          }`}
                          title={item.success ? "Success" : "Failed"}
                        />
                        <span className="text-[9px] font-mono text-muted-foreground font-bold">
                          {item.executionTime}ms
                        </span>
                        {item.pinned && (
                          <Pin className="h-3 w-3 text-yellow-500 rotate-45 shrink-0" />
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground/75 font-mono">
                        {item.timestamp.split(",")[1]?.trim() || item.timestamp}
                      </span>
                    </div>

                    {/* SQL Body */}
                    <pre className="text-[11px] font-mono text-foreground/90 overflow-x-hidden text-ellipsis whitespace-nowrap bg-background/50 p-1.5 rounded border border-border/10 max-h-16 overflow-y-hidden select-text">
                      {item.sql}
                    </pre>

                    {/* Error message preview if failed */}
                    {!item.success && item.error && (
                      <span className="text-[9px] text-red-400 font-mono mt-1 line-clamp-1 italic">
                        {item.error}
                      </span>
                    )}

                    {/* Tags line */}
                    <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                      {item.tags?.map((t) => (
                        <span
                          key={t}
                          className="text-[8px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center gap-0.5 leading-none transition-colors"
                        >
                          <span>{t}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTag(item.id, t);
                            }}
                            className="hover:text-red-500 leading-none font-bold text-[9px] ml-0.5"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const tName = prompt("Enter custom tag:");
                          if (tName) addTag(item.id, tName);
                        }}
                        className="text-[8px] font-bold font-mono px-2 py-0.5 bg-muted hover:bg-accent border border-border text-muted-foreground hover:text-foreground rounded-full flex items-center gap-0.5 leading-none transition-colors cursor-pointer"
                        title="Add custom tag label"
                      >
                        <Plus className="h-2 w-2" />
                        <span>Tag</span>
                      </button>
                    </div>

                    {/* Overlay Action Buttons on Hover */}
                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-card border border-border/80 rounded p-0.5 shadow-sm transition-all duration-150">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(item.id);
                        }}
                        className={`rounded p-1 hover:bg-accent transition-colors cursor-pointer ${
                          item.pinned ? "text-yellow-500" : "text-muted-foreground hover:text-foreground"
                        }`}
                        title={item.pinned ? "Unpin query" : "Pin query"}
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => handleCopyHistory(e, item.sql)}
                        className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Copy query to clipboard"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => handleRunQueryImmediate(e, item.sql)}
                        className="rounded p-1 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Run query immediately"
                      >
                        <Play className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHistoryItem(item.id);
                        }}
                        className="rounded p-1 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                        title="Remove from history"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
