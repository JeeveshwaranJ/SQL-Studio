"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Database as DbIcon, 
  Upload as UploadIcon, 
  Download as DownloadIcon, 
  Plus, 
  RotateCw, 
  Sliders,
  Menu,
  Clock,
  Trash2
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { useThemeStore, AppTheme } from "../../lib/store/themeStore";
import ThemeHydrator from "../../components/layout/ThemeHydrator";
import ProjectManagerDialog from "../../components/db/ProjectManagerDialog";
import ImportWizard from "../../components/import/ImportWizard";
import ORMExportDialog from "../../components/export/ORMExportDialog";
import SchemaDiffViewer from "../../components/diff/SchemaDiffViewer";
import { migrationTimeline, MigrationVersion } from "../../lib/migration/timeline";

export default function DiffPage() {
  const { 
    dbName, 
    isDbLoading, 
    initDb, 
    loadDbFromFile,
    tables,
    projectId,
    runQuery
  } = useDbStore();

  const { theme, setTheme } = useThemeStore();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog visibility state
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Timeline state
  const [timeline, setTimeline] = useState<MigrationVersion[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [selectedVersionA, setSelectedVersionA] = useState<string>("");
  const [selectedVersionB, setSelectedVersionB] = useState<string>("");
  const [generatedMigrationSql, setGeneratedMigrationSql] = useState("");

  const refreshTimeline = () => {
    const list = migrationTimeline.getTimeline(projectId);
    setTimeline(list);
  };

  useEffect(() => {
    refreshTimeline();
  }, [projectId]);

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim() || tables.length === 0) return;
    migrationTimeline.addSchemaVersion(projectId, snapshotName.trim(), tables);
    setSnapshotName("");
    refreshTimeline();
    alert("Database snapshot version created!");
  };

  const handleCompare = () => {
    const vA = timeline.find(v => v.id === selectedVersionA);
    const vB = timeline.find(v => v.id === selectedVersionB);
    if (!vA || !vB) {
      alert("Please select two versions to compare.");
      return;
    }
    const sql = migrationTimeline.generateMigrationSQL(vA.tablesSnapshot, vB.tablesSnapshot);
    setGeneratedMigrationSql(sql);
  };

  const handleRollback = async (version: MigrationVersion) => {
    if (!window.confirm(`Are you sure you want to rollback database schema to "${version.name}"? This will execute schema modifications.`)) return;
    
    const rollbackSql = migrationTimeline.generateMigrationSQL(tables, version.tablesSnapshot);
    if (rollbackSql.includes("-- No schema changes")) {
      alert("Database schema is already matching this version.");
      return;
    }

    try {
      await runQuery(rollbackSql);
      alert("Rollback successful! Schema updated.");
    } catch (err: any) {
      alert("Rollback failed:\n" + err.message);
    }
  };

  const handleDeleteSnapshot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this snapshot from timeline?")) return;
    migrationTimeline.deleteVersion(projectId, id);
    refreshTimeline();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadDbFromFile(file);
    }
  };

  const themeDisplayNames: Record<AppTheme, string> = {
    "vscode-dark": "VS Code Dark",
    "github-light": "GitHub Light",
    "dracula": "Dracula",
  };

  return (
    <>
      <ThemeHydrator />
      <div className="flex flex-col flex-1 h-screen w-full select-none overflow-hidden bg-background text-foreground animate-fadeIn text-xs">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded bg-primary/10 p-1.5 text-primary">
                <DbIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight md:text-base">SQL Studio</h1>
                <p className="text-[10px] text-muted-foreground leading-none">Database Diff & Migrations</p>
              </div>
            </div>

            <div className="h-4 w-px bg-border mx-2 hidden sm:block" />

            <nav className="flex items-center gap-0.5 bg-accent/40 border border-border/40 rounded-lg p-0.5 select-none hidden sm:flex">
              <Link href="/workspace" className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${pathname === "/workspace" ? "bg-background text-foreground shadow-sm font-bold border border-border/10" : "text-muted-foreground hover:text-foreground"}`}>Query Editor</Link>
              <Link href="/designer" className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${pathname === "/designer" ? "bg-background text-foreground shadow-sm font-bold border border-border/10" : "text-muted-foreground hover:text-foreground"}`}>Schema Designer</Link>
              <Link href="/explorer" className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${pathname === "/explorer" ? "bg-background text-foreground shadow-sm font-bold border border-border/10" : "text-muted-foreground hover:text-foreground"}`}>Data Explorer</Link>
              <Link href="/mock-data" className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${pathname === "/mock-data" ? "bg-background text-foreground shadow-sm font-bold border border-border/10" : "text-muted-foreground hover:text-foreground"}`}>Mock Data</Link>
              <Link href="/diff" className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${pathname === "/diff" ? "bg-background text-foreground shadow-sm font-bold border border-border/10" : "text-muted-foreground hover:text-foreground"}`}>SQL Diff</Link>
            </nav>

            <div className="h-4 w-px bg-border mx-2 hidden sm:block" />

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setIsConnectOpen(true)}
                className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/95 text-[11px] rounded bg-primary/10 px-2.5 py-1 border border-primary/20 transition-all cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Connection</span>
              </button>
              <span className="text-muted-foreground hidden lg:inline">Active:</span>
              {isDbLoading ? (
                <div className="flex items-center gap-1.5 text-primary">
                  <RotateCw className="h-3 w-3 animate-spin" />
                  <span>Loading DB...</span>
                </div>
              ) : (
                <span className="font-mono rounded bg-accent/50 px-2 py-0.5 border border-border/30 text-accent-foreground max-w-[120px] truncate hidden md:inline">
                  {dbName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".db,.sqlite,.sqlite3" className="hidden" />
            <button onClick={initDb} disabled={isDbLoading} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-50 transition-all cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> <span className="hidden lg:inline">New DB</span>
            </button>
            <button onClick={() => setIsImportOpen(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-all">
              <UploadIcon className="h-3.5 w-3.5 text-green-500" /> <span className="hidden lg:inline">Import</span>
            </button>
            <button onClick={() => setIsExportOpen(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-all">
              <DownloadIcon className="h-3.5 w-3.5 text-primary" /> <span className="hidden lg:inline">Export</span>
            </button>
            <div className="h-4 w-px bg-border mx-1" />
            <select value={theme} onChange={(e) => setTheme(e.target.value as AppTheme)} className="text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-foreground">
              <option value="vscode-dark">{themeDisplayNames["vscode-dark"]}</option>
              <option value="github-light">{themeDisplayNames["github-light"]}</option>
              <option value="dracula">{themeDisplayNames["dracula"]}</option>
            </select>
          </div>
        </header>

        <main className="flex-grow flex min-h-0 min-w-0 bg-background text-foreground transition-colors relative overflow-hidden">
          {/* Left panel: Timeline panel */}
          <div className="w-64 border-r border-border bg-card flex flex-col min-h-0 select-none shrink-0">
            {/* Create Snapshot Form */}
            <form onSubmit={handleSaveSnapshot} className="p-3 border-b border-border space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Snapshot Schema State
              </span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  placeholder="e.g. Version 1"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground font-bold hover:bg-primary/95 cursor-pointer text-[10px]"
                >
                  Save
                </button>
              </div>
            </form>

            {/* Compare Selector */}
            {timeline.length >= 2 && (
              <div className="p-3 border-b border-border space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Compare Schema States
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={selectedVersionA}
                    onChange={(e) => setSelectedVersionA(e.target.value)}
                    className="bg-background border border-border rounded p-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-foreground"
                  >
                    <option value="">-- From --</option>
                    {timeline.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedVersionB}
                    onChange={(e) => setSelectedVersionB(e.target.value)}
                    className="bg-background border border-border rounded p-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-foreground"
                  >
                    <option value="">-- To --</option>
                    {timeline.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleCompare}
                  className="w-full flex items-center justify-center gap-1 text-[10px] font-bold py-1 px-2 rounded bg-accent text-foreground hover:bg-accent/80 transition-all cursor-pointer border border-border"
                >
                  Generate DDL Script
                </button>
              </div>
            )}

            {/* Timeline history list */}
            <div className="flex-grow overflow-y-auto p-2.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Timeline Versions
              </span>

              {timeline.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-[11px]">No versions saved.</div>
              ) : (
                <div className="space-y-1.5">
                  {timeline.map((v) => (
                    <div key={v.id} className="p-2 border border-border bg-background rounded-lg space-y-1 group">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[11px] truncate max-w-[120px]">{v.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRollback(v)}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer"
                          >
                            Rollback
                          </button>
                          <button
                            onClick={(e) => handleDeleteSnapshot(v.id, e)}
                            className="text-muted-foreground hover:text-red-500 p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground block font-mono">
                        {new Date(v.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Content Workspace */}
          <div className="flex-grow flex flex-col min-h-0 min-w-0 bg-background relative p-4 space-y-4 overflow-y-auto">
            {generatedMigrationSql ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-green-500 uppercase tracking-wider">
                    Generated Migration SQL Script
                  </span>
                  <button
                    onClick={() => {
                      runQuery(generatedMigrationSql);
                      alert("Migration SQL script run successfully!");
                      setGeneratedMigrationSql("");
                    }}
                    className="px-3.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-xs cursor-pointer"
                  >
                    Run Migration
                  </button>
                </div>
                <pre className="p-3 bg-card border border-border rounded-lg font-mono text-xs select-text overflow-x-auto whitespace-pre-wrap">
                  {generatedMigrationSql}
                </pre>
              </div>
            ) : (
              <SchemaDiffViewer />
            )}
          </div>
        </main>

        {/* Dialog Overlays */}
        <ProjectManagerDialog isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />
        <ImportWizard isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
        <ORMExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      </div>
    </>
  );
}
