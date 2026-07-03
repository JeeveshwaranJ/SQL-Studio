"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  GitCompare, 
  Play, 
  Copy, 
  Check, 
  AlertTriangle, 
  PlusCircle, 
  MinusCircle, 
  Edit, 
  Download, 
  ArrowRight, 
  RotateCw,
  RefreshCw,
  Info,
  Terminal,
  FileCode
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { diffSchemas, SchemaDiff, TableModification } from "../../lib/diff/schemaDiff";
import { parseSqlDdlText } from "../../lib/sql/parserHelper";
import { 
  generateMigrationSQL, 
  detectDestructiveOperations, 
  dryRunMigration 
} from "../../lib/migration/migration";
import { SchemaModel } from "../../lib/schema/parser";

export default function SchemaDiffViewer() {
  const { adapter, tables } = useDbStore();

  // Diff Sources configurations
  const [sourceType, setSourceType] = useState<"active" | "sql">("active");
  const [targetType, setTargetType] = useState<"sql" | "active">("sql");
  const [targetDialect, setTargetDialect] = useState<"sqlite" | "postgres" | "mysql">("sqlite");

  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const targetFileInputRef = useRef<HTMLInputElement>(null);

  const [sourceFileName, setSourceFileName] = useState("");
  const [targetFileName, setTargetFileName] = useState("");

  const [sourceModel, setSourceModel] = useState<SchemaModel | null>(null);
  const [targetModel, setTargetModel] = useState<SchemaModel | null>(null);

  // Computed results
  const [schemaDiff, setSchemaDiff] = useState<SchemaDiff | null>(null);
  const [migrationSql, setMigrationSql] = useState<string[]>([]);
  const [destructiveWarnings, setDestructiveWarnings] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"report" | "sql">("report");

  // Dry run status states
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{ success: boolean; error: string | null } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Set default dialect based on adapter
  useEffect(() => {
    if (adapter) {
      setTargetDialect(adapter.id as any);
    }
  }, [adapter]);

  // Sync source model if using active connection
  useEffect(() => {
    if (sourceType === "active" && tables) {
      setSourceModel({ tables });
    }
  }, [sourceType, tables]);

  // Sync target model if using active connection
  useEffect(() => {
    if (targetType === "active" && tables) {
      setTargetModel({ tables });
    }
  }, [targetType, tables]);

  const handleSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const model = await parseSqlDdlText(text);
        setSourceModel(model);
      } catch (err: any) {
        alert("Failed to parse source DDL: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleTargetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTargetFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const model = await parseSqlDdlText(text);
        setTargetModel(model);
      } catch (err: any) {
        alert("Failed to parse target DDL: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleComputeDiff = () => {
    if (!sourceModel || !targetModel) {
      alert("Please configure both Source and Target schema schemas first.");
      return;
    }

    const diff = diffSchemas(sourceModel, targetModel);
    const sqlStmts = generateMigrationSQL(diff, targetDialect);
    const warnings = detectDestructiveOperations(diff);

    setSchemaDiff(diff);
    setMigrationSql(sqlStmts);
    setDestructiveWarnings(warnings);
    setAcknowledged(false);
    setDryRunResult(null);
  };

  const handleCopyCode = () => {
    if (destructiveWarnings.length > 0 && !acknowledged) return;
    const fullSql = migrationSql.join("\n\n");
    navigator.clipboard.writeText(fullSql);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRunDryRun = async () => {
    if (!sourceModel || migrationSql.length === 0) return;
    if (destructiveWarnings.length > 0 && !acknowledged) return;

    setIsDryRunning(true);
    setDryRunResult(null);

    const result = await dryRunMigration(sourceModel, migrationSql, targetDialect);
    
    setIsDryRunning(false);
    setDryRunResult(result);
  };

  const hasDestructive = destructiveWarnings.length > 0;
  const isActionDisabled = hasDestructive && !acknowledged;

  return (
    <div className="flex-1 flex min-h-0 bg-background text-foreground font-sans select-none transition-colors">
      
      {/* 1. Left Config column */}
      <div className="w-[320px] border-r border-border bg-card flex flex-col min-h-0 shrink-0">
        <div className="h-12 border-b border-border bg-muted/40 px-4 flex items-center gap-2 shrink-0">
          <GitCompare className="h-4.5 w-4.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SQL Diff settings</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          
          {/* SOURCE CONFIG */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">1. Source Schema (Original)</span>
            
            <div className="flex gap-2 bg-muted/30 p-0.5 rounded border border-border/40">
              <button
                onClick={() => setSourceType("active")}
                className={`flex-1 py-1 text-center font-semibold rounded text-[11px] cursor-pointer ${
                  sourceType === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Active DB
              </button>
              <button
                onClick={() => setSourceType("sql")}
                className={`flex-1 py-1 text-center font-semibold rounded text-[11px] cursor-pointer ${
                  sourceType === "sql" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                SQL File
              </button>
            </div>

            {sourceType === "active" ? (
              <div className="p-3 bg-muted/10 border border-border/40 rounded flex flex-col gap-1">
                <span className="font-bold text-foreground/80 block">Current Connection</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate">{adapter ? adapter.name : "Not connected"}</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="file"
                  ref={sourceFileInputRef}
                  onChange={handleSourceUpload}
                  accept=".sql"
                  className="hidden"
                />
                <button
                  onClick={() => sourceFileInputRef.current?.click()}
                  className="w-full py-2 px-3 bg-background border border-border hover:bg-accent rounded flex items-center justify-center gap-1.5 font-bold cursor-pointer transition-colors"
                >
                  <FileCode className="h-4 w-4 text-primary" />
                  <span>{sourceFileName ? "Change Source SQL" : "Upload Source SQL"}</span>
                </button>
                {sourceFileName && (
                  <span className="text-[10px] font-mono text-muted-foreground block truncate text-center">
                    {sourceFileName} ({sourceModel?.tables.length || 0} tables)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center shrink-0">
            <ArrowRight className="h-4 w-4 text-muted-foreground/60 rotate-90 sm:rotate-0" />
          </div>

          {/* TARGET CONFIG */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">2. Target Schema (Desired)</span>
            
            <div className="flex gap-2 bg-muted/30 p-0.5 rounded border border-border/40">
              <button
                onClick={() => setTargetType("active")}
                className={`flex-1 py-1 text-center font-semibold rounded text-[11px] cursor-pointer ${
                  targetType === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Active DB
              </button>
              <button
                onClick={() => setTargetType("sql")}
                className={`flex-1 py-1 text-center font-semibold rounded text-[11px] cursor-pointer ${
                  targetType === "sql" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                SQL File
              </button>
            </div>

            {targetType === "active" ? (
              <div className="p-3 bg-muted/10 border border-border/40 rounded flex flex-col gap-1">
                <span className="font-bold text-foreground/80 block">Current Connection</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate">{adapter ? adapter.name : "Not connected"}</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="file"
                  ref={targetFileInputRef}
                  onChange={handleTargetUpload}
                  accept=".sql"
                  className="hidden"
                />
                <button
                  onClick={() => targetFileInputRef.current?.click()}
                  className="w-full py-2 px-3 bg-background border border-border hover:bg-accent rounded flex items-center justify-center gap-1.5 font-bold cursor-pointer transition-colors"
                >
                  <FileCode className="h-4 w-4 text-primary" />
                  <span>{targetFileName ? "Change Target SQL" : "Upload Target SQL"}</span>
                </button>
                {targetFileName && (
                  <span className="text-[10px] font-mono text-muted-foreground block truncate text-center">
                    {targetFileName} ({targetModel?.tables.length || 0} tables)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-border/50" />

          {/* DIALECT SELECT */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Migration SQL Dialect</label>
            <select
              value={targetDialect}
              onChange={(e) => setTargetDialect(e.target.value as any)}
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="sqlite">SQLite</option>
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

        </div>

        {/* Generate triggers */}
        <div className="p-4 border-t border-border bg-muted/20 shrink-0">
          <button
            onClick={handleComputeDiff}
            disabled={!sourceModel || !targetModel}
            className="w-full py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow disabled:opacity-55 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Compute SQL Diff</span>
          </button>
        </div>
      </div>

      {/* 2. Right Workspace column */}
      <div className="flex-grow flex flex-col min-h-0">
        
        {/* Header Tabs */}
        <div className="h-12 border-b border-border bg-card px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("report")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "report" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>Diff Report</span>
            </button>
            <button
              onClick={() => setActiveTab("sql")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "sql" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Migration SQL ({migrationSql.length} statements)</span>
            </button>
          </div>
        </div>

        {/* Tab contents scroll pane */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          
          {!schemaDiff && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <GitCompare className="h-12 w-12 text-muted-foreground/15 mb-2.5" />
              <span className="text-xs font-bold">Configure Schemas to Compare</span>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5 max-w-sm">
                Select your original schema source on the left settings panel, upload your target DDL script, and click "Compute SQL Diff".
              </p>
            </div>
          )}

          {schemaDiff && activeTab === "report" && (
            <div className="space-y-4">
              
              {/* Added Tables */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-green-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <PlusCircle className="h-4.5 w-4.5" />
                  <span>Added Tables ({schemaDiff.addedTables.length})</span>
                </h3>
                
                {schemaDiff.addedTables.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-medium pl-6">No new tables added.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                    {schemaDiff.addedTables.map((t) => (
                      <div key={t.name} className="p-3 border border-green-500/20 bg-green-500/5 rounded-xl space-y-1.5 font-mono">
                        <span className="font-bold text-foreground text-xs leading-none">CREATE TABLE "{t.name}"</span>
                        <div className="text-[10px] text-muted-foreground divide-y divide-border/20">
                          {t.columns.map((c) => (
                            <div key={c.name} className="py-0.5 flex justify-between">
                              <span>{c.name}</span>
                              <span className="font-bold text-primary">{c.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-border/40" />

              {/* Modified Tables */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Edit className="h-4.5 w-4.5" />
                  <span>Modified Tables ({Object.keys(schemaDiff.modifiedTables).length})</span>
                </h3>

                {Object.keys(schemaDiff.modifiedTables).length === 0 ? (
                  <p className="text-xs text-muted-foreground font-medium pl-6">No tables modified.</p>
                ) : (
                  <div className="space-y-3 pl-6">
                    {Object.values(schemaDiff.modifiedTables).map((mod: TableModification) => (
                      <div key={mod.tableName} className="border border-border/40 rounded-xl overflow-hidden bg-card">
                        
                        {/* Header banner */}
                        <div className="bg-muted px-4 py-2 border-b border-border font-mono font-bold text-foreground/80 flex justify-between select-none">
                          <span>ALTER TABLE "{mod.tableName}"</span>
                        </div>

                        {/* Mod details */}
                        <div className="p-4 space-y-3 text-[11px] font-mono leading-relaxed">
                          
                          {/* Added Columns */}
                          {mod.addedColumns.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-green-500 uppercase block select-none">Add Columns</span>
                              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                                {mod.addedColumns.map((c) => (
                                  <li key={c.name}>
                                    ADD COLUMN <span className="font-bold text-foreground">"{c.name}"</span> ({c.type}) {c.notNull ? "NOT NULL" : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Removed Columns */}
                          {mod.removedColumns.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-red-500 uppercase block select-none">Drop Columns</span>
                              <ul className="list-disc pl-5 text-red-400 space-y-0.5">
                                {mod.removedColumns.map((col) => (
                                  <li key={col}>DROP COLUMN "{col}"</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Modified Columns details */}
                          {mod.modifiedColumns.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-yellow-500 uppercase block select-none">Modify Columns Constraints</span>
                              <div className="divide-y divide-border/20 pl-4 border-l border-yellow-500/20 space-y-1">
                                {mod.modifiedColumns.map((colMod) => (
                                  <div key={colMod.columnName} className="pt-1 flex flex-col">
                                    <span className="font-bold text-foreground">COLUMN "{colMod.columnName}"</span>
                                    <ul className="list-disc pl-5 text-[10px] text-muted-foreground space-y-0.5 mt-0.5">
                                      {colMod.typeChanged && (
                                        <li>Type changed: <span className="line-through">{colMod.oldColumn.type}</span> ➜ <span className="font-bold text-foreground">{colMod.newColumn.type}</span></li>
                                      )}
                                      {colMod.nullabilityChanged && (
                                        <li>Nullability changed: {colMod.newColumn.notNull ? "SET NOT NULL" : "DROP NOT NULL"}</li>
                                      )}
                                      {colMod.defaultChanged && (
                                        <li>Default changed: {colMod.oldColumn.defaultVal || "NULL"} ➜ {colMod.newColumn.defaultVal || "NULL"}</li>
                                      )}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-border/40" />

              {/* Removed Tables */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <MinusCircle className="h-4.5 w-4.5" />
                  <span>Removed Tables ({schemaDiff.removedTables.length})</span>
                </h3>

                {schemaDiff.removedTables.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-medium pl-6">No tables removed.</p>
                ) : (
                  <ul className="list-disc pl-11 text-xs text-red-400 space-y-0.5 font-mono">
                    {schemaDiff.removedTables.map((tbl) => (
                      <li key={tbl}>DROP TABLE "{tbl}";</li>
                    ))}
                  </ul>
                )}
              </div>

            </div>
          )}

          {schemaDiff && activeTab === "sql" && (
            <div className="space-y-4 h-full flex flex-col min-h-0">
              
              {/* Warnings Banner */}
              {hasDestructive && (
                <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-xl space-y-2 shrink-0 animate-fadeIn">
                  <div className="flex items-start gap-2.5 text-red-500">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs">Destructive Schema Modifications Detected!</span>
                      <p className="text-[10px] text-red-400 leading-normal">
                        This migration contains operations that will permanently delete data (drop columns, drop tables, or narrowing types). Review warnings below carefully.
                      </p>
                    </div>
                  </div>
                  
                  <ul className="list-disc pl-10 text-[10px] text-red-400 font-mono space-y-0.5 leading-normal">
                    {destructiveWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>

                  <label className="flex items-center gap-2 pt-1 pl-7 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      className="rounded border-red-500/30 bg-background text-red-500 focus:ring-red-500 focus:ring-offset-0"
                    />
                    <span className="text-[10px] font-bold text-red-500">I acknowledge this DDL SQL script contains destructive actions.</span>
                  </label>
                </div>
              )}

              {/* Dry Run Banner Result */}
              {dryRunResult && (
                <div className={`p-3 border rounded-xl flex gap-2.5 shrink-0 animate-fadeIn ${
                  dryRunResult.success 
                    ? "border-green-500/25 bg-green-500/5 text-green-500" 
                    : "border-red-500/25 bg-red-500/5 text-red-500"
                }`}>
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs">
                      {dryRunResult.success ? "Dry Run Completed Successfully!" : "Dry Run Check Failed!"}
                    </span>
                    <p className={`text-[10px] leading-normal ${dryRunResult.success ? "text-green-400" : "text-red-400"}`}>
                      {dryRunResult.success 
                        ? `The generated DDL statements list is syntactically correct and passed the SQLite WASM pre-compilation check.`
                        : dryRunResult.error}
                    </p>
                  </div>
                </div>
              )}

              {/* Code Previews */}
              <div className="flex-1 min-h-0 bg-muted/65 border border-border/40 rounded-xl overflow-hidden flex flex-col relative select-text">
                <textarea
                  readOnly
                  value={migrationSql.join("\n\n")}
                  className="w-full flex-grow bg-transparent p-4 font-mono text-[10px] leading-relaxed text-foreground/90 focus:outline-none resize-none overflow-y-auto"
                />

                {/* Floated actions */}
                <div className="absolute right-4 bottom-4 flex gap-2 select-none">
                  <button
                    onClick={handleRunDryRun}
                    disabled={isDryRunning || isActionDisabled}
                    className="px-3.5 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow disabled:opacity-45 transition-colors text-foreground"
                    title="Validate DDL statements against sandbox instance"
                  >
                    {isDryRunning ? (
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>Run Dry Run</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    disabled={isActionDisabled}
                    className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow disabled:opacity-45 transition-colors"
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
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
