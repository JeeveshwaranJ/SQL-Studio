"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  Code, 
  Database, 
  Layers,
  ChevronDown,
  Info
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { generatePrismaSchema } from "../../lib/export/prisma";
import { generateDrizzleSchema } from "../../lib/export/drizzle";
import { generateSqlDump, exportToCsv, exportToJson } from "../../lib/export/dumps";

interface ORMExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportMode = "orm" | "data";
type OrmFormat = "prisma" | "drizzle";
type DataFormat = "sql" | "csv" | "json" | "sqlite";

export default function ORMExportDialog({ isOpen, onClose }: ORMExportDialogProps) {
  const { adapter, tables, results, exportDb } = useDbStore();

  const [mode, setMode] = useState<ExportMode>("orm");
  const [ormFormat, setOrmFormat] = useState<OrmFormat>("prisma");
  const [dataFormat, setDataFormat] = useState<DataFormat>("sql");

  // Selection state for data exports
  const [dataTarget, setDataTarget] = useState<"query" | "table">("query");
  const [selectedTable, setSelectedTable] = useState("");

  // Preview contents
  const [previewContent, setPreviewContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // Auto-select first table if none selected
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  // Compute preview content dynamically
  useEffect(() => {
    if (!adapter) return;
    
    if (mode === "orm") {
      const driverId = adapter.id;
      if (ormFormat === "prisma") {
        setPreviewContent(generatePrismaSchema(tables, driverId));
      } else {
        setPreviewContent(generateDrizzleSchema(tables, driverId));
      }
    } else {
      // Data Dumps
      const isQuery = dataTarget === "query";
      
      if (isQuery) {
        if (!results) {
          setPreviewContent("-- No active query results to export. Run a query first.");
          return;
        }
        
        if (dataFormat === "sql") {
          setPreviewContent(generateSqlDump("query_results", results.columns, results.rows, adapter.id));
        } else if (dataFormat === "csv") {
          setPreviewContent(exportToCsv(results.columns, results.rows));
        } else if (dataFormat === "json") {
          setPreviewContent(exportToJson(results.columns, results.rows));
        } else if (dataFormat === "sqlite") {
          setPreviewContent("-- SQLite binary export is not supported for custom query results. Export as SQL insert script instead.");
        }
      } else {
        // Table export requires rows from the table, but wait! We don't have the table rows loaded here.
        // We can warn the user that exporting a full table will query the records, and show a generate trigger!
        setPreviewContent(`-- Click "Generate Export" to query the database and compile data dump for table "${selectedTable}".`);
      }
    }
  }, [mode, ormFormat, dataFormat, dataTarget, selectedTable, tables, results, adapter]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!adapter) return;

    if (mode === "data" && dataTarget === "table" && dataFormat === "sqlite") {
      // Full SQLite database download
      if (adapter.id === "sqlite") {
        exportDb();
      } else {
        alert("SQLite download applies only to local SQLite Demo DB connections.");
      }
      return;
    }

    let finalContent = previewContent;
    let fileName = "export";
    let mimeType = "text/plain";

    // If exporting full table, run the select query first to fetch rows
    if (mode === "data" && dataTarget === "table" && dataFormat !== "sqlite") {
      if (!selectedTable) return;
      try {
        const queryRes = await adapter.execute(`SELECT * FROM ${adapter.id === "mysql" ? `\`${selectedTable}\`` : `"${selectedTable}"`};`);
        if (queryRes.error) {
          alert("Failed to query table data: " + queryRes.error);
          return;
        }

        if (dataFormat === "sql") {
          finalContent = generateSqlDump(selectedTable, queryRes.columns, queryRes.rows, adapter.id);
        } else if (dataFormat === "csv") {
          finalContent = exportToCsv(queryRes.columns, queryRes.rows);
        } else {
          finalContent = exportToJson(queryRes.columns, queryRes.rows);
        }
      } catch (err: any) {
        alert("Query failed: " + err.message);
        return;
      }
    }

    // Set file extension and name
    if (mode === "orm") {
      if (ormFormat === "prisma") {
        fileName = "schema.prisma";
        mimeType = "text/plain";
      } else {
        fileName = "schema.ts";
        mimeType = "application/javascript";
      }
    } else {
      const prefix = dataTarget === "query" ? "query_results" : selectedTable;
      if (dataFormat === "sql") {
        fileName = `${prefix}_dump.sql`;
        mimeType = "application/sql";
      } else if (dataFormat === "csv") {
        fileName = `${prefix}.csv`;
        mimeType = "text/csv";
      } else if (dataFormat === "json") {
        fileName = `${prefix}.json`;
        mimeType = "application/json";
      }
    }

    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGeneratePreview = async () => {
    if (!adapter || !selectedTable) return;
    setPreviewContent("-- Querying database to generate preview... please wait.");
    
    try {
      const queryRes = await adapter.execute(`SELECT * FROM ${adapter.id === "mysql" ? `\`${selectedTable}\`` : `"${selectedTable}"`} LIMIT 200;`);
      if (queryRes.error) {
        setPreviewContent(`-- Failed to query table data:\n-- ${queryRes.error}`);
        return;
      }

      if (dataFormat === "sql") {
        setPreviewContent(generateSqlDump(selectedTable, queryRes.columns, queryRes.rows, adapter.id));
      } else if (dataFormat === "csv") {
        setPreviewContent(exportToCsv(queryRes.columns, queryRes.rows));
      } else if (dataFormat === "json") {
        setPreviewContent(exportToJson(queryRes.columns, queryRes.rows));
      }
    } catch (err: any) {
      setPreviewContent(`-- Query failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-xs text-foreground select-none">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn scale-[1.01] transition-all">
        {/* Header */}
        <div className="flex h-12 items-center justify-between px-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Export Schema & Data</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-muted/30 border-b border-border p-2 gap-1 shrink-0">
          <button
            onClick={() => setMode("orm")}
            className={`flex-1 py-1.5 rounded font-bold text-center transition-all cursor-pointer ${
              mode === "orm" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ORM Schemas
          </button>
          <button
            onClick={() => setMode("data")}
            className={`flex-1 py-1.5 rounded font-bold text-center transition-all cursor-pointer ${
              mode === "data" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Data Dumps
          </button>
        </div>

        {/* Configurations Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 flex flex-col min-h-0">
          {mode === "orm" ? (
            /* ORM EXPORTS CONF */
            <div className="grid grid-cols-2 gap-4 shrink-0">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">ORM Output Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOrmFormat("prisma")}
                    className={`flex-1 py-1 px-2.5 rounded border border-border text-center font-semibold cursor-pointer transition-all ${
                      ormFormat === "prisma" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                    }`}
                  >
                    Prisma Schema
                  </button>
                  <button
                    onClick={() => setOrmFormat("drizzle")}
                    className={`flex-1 py-1 px-2.5 rounded border border-border text-center font-semibold cursor-pointer transition-all ${
                      ormFormat === "drizzle" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                    }`}
                  >
                    Drizzle Schema
                  </button>
                </div>
              </div>
              <div className="p-2 border border-border/30 bg-accent/5 rounded leading-normal flex gap-1.5">
                <Info className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <span className="text-[10px] text-muted-foreground">
                  ORM schemas compile columns, PKs, UNIQUE tags, and foreign key references based on full tables catalog information.
                </span>
              </div>
            </div>
          ) : (
            /* DATA DUMPS CONF */
            <div className="grid grid-cols-2 gap-4 shrink-0 border-b border-border/20 pb-3">
              {/* Target Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Export Target</label>
                <select
                  value={dataTarget}
                  onChange={(e) => setDataTarget(e.target.value as any)}
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary"
                >
                  <option value="query">Active Query Results</option>
                  <option value="table">Full Database Table</option>
                </select>
              </div>

              {/* Conditional Target Input */}
              {dataTarget === "query" ? (
                <div className="p-2 border border-border/30 bg-accent/5 rounded leading-normal flex gap-1.5">
                  <Info className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-[10px] text-muted-foreground">
                    Exports columns and rows returned by the latest query statement in Monaco editor panel.
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Select Table</label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary"
                  >
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Format Selector */}
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Data Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDataFormat("sql")}
                    className={`flex-1 py-1.5 rounded border border-border text-center font-semibold cursor-pointer transition-all ${
                      dataFormat === "sql" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                    }`}
                  >
                    SQL Inserts
                  </button>
                  <button
                    onClick={() => setDataFormat("csv")}
                    className={`flex-1 py-1.5 rounded border border-border text-center font-semibold cursor-pointer transition-all ${
                      dataFormat === "csv" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                    }`}
                  >
                    CSV File
                  </button>
                  <button
                    onClick={() => setDataFormat("json")}
                    className={`flex-1 py-1.5 rounded border border-border text-center font-semibold cursor-pointer transition-all ${
                      dataFormat === "json" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                    }`}
                  >
                    JSON Objects
                  </button>
                  {dataTarget === "table" && adapter?.id === "sqlite" && (
                    <button
                      onClick={() => setDataFormat("sqlite")}
                      className={`flex-1 py-1.5 rounded border border-border text-center font-semibold cursor-pointer transition-all ${
                        dataFormat === "sqlite" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                      }`}
                    >
                      SQLite DB File
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preview Panel */}
          <div className="flex-1 flex flex-col min-h-0 space-y-1">
            <div className="flex items-center justify-between select-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Export Data Preview</span>
              {mode === "data" && dataTarget === "table" && dataFormat !== "sqlite" && (
                <button
                  onClick={handleGeneratePreview}
                  className="text-[10px] font-bold text-primary hover:text-primary/95 cursor-pointer"
                >
                  Generate Preview
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 bg-muted/65 border border-border/40 rounded overflow-hidden flex flex-col relative">
              <textarea
                readOnly
                value={previewContent}
                className="w-full flex-grow bg-transparent p-3 font-mono text-[10px] leading-relaxed text-foreground/90 focus:outline-none resize-none overflow-y-auto"
              />
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="p-4 border-t border-border bg-muted/20 flex gap-2 justify-end shrink-0 select-none">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded border border-border bg-background hover:bg-accent text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
          
          {dataFormat !== "sqlite" && (
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded border border-border bg-background hover:bg-accent text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download File</span>
          </button>
        </div>
      </div>
    </div>
  );
}
