"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Database as DbIcon, 
  Upload, 
  Download, 
  Plus, 
  RotateCw, 
  Menu,
  Sliders,
  Sparkles
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { useThemeStore, AppTheme } from "../../lib/store/themeStore";
import SqlEditor from "../editor/SqlEditor";
import ResultsPanel from "../results/ResultsPanel";
import HistorySidebar from "../history/HistorySidebar";
import ProjectManagerDialog from "../db/ProjectManagerDialog";
import ImportWizard from "../import/ImportWizard";
import ORMExportDialog from "../export/ORMExportDialog";
import AiPanel from "../../features/ai/AiPanel";

export default function PanelLayout() {
  const { 
    dbName, 
    isDbLoading, 
    initDb, 
    loadDbFromFile, 
    exportDb 
  } = useDbStore();

  const { theme, setTheme } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Navigation tracking
  const pathname = usePathname();

  // Connection modal state
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Sidebar toggle state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Editor collapse state
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);

  // AI Panel collapse state
  const [isAiCollapsed, setIsAiCollapsed] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadDbFromFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const themeDisplayNames: Record<AppTheme, string> = {
    "vscode-dark": "VS Code Dark",
    "github-light": "GitHub Light",
    "dracula": "Dracula",
  };

  return (
    <div className="flex flex-col flex-1 h-screen w-full select-none overflow-hidden bg-background text-foreground animate-fadeIn text-xs">
      {/* Premium Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded bg-primary/10 p-1.5 text-primary">
              <DbIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight md:text-base">SQL Studio</h1>
              <p className="text-[10px] text-muted-foreground leading-none">SQL Query Workspace</p>
            </div>
          </div>

          <div className="h-4 w-px bg-border mx-2 hidden md:block" />

          {/* Client-side Route Navigation */}
          <nav className="flex items-center gap-0.5 bg-accent/40 border border-border/40 rounded-lg p-0.5 select-none hidden sm:flex">
            <Link
              href="/workspace"
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                pathname === "/workspace"
                  ? "bg-background text-foreground shadow-sm font-bold border border-border/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Query Editor
            </Link>
            <Link
              href="/designer"
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                pathname === "/designer"
                  ? "bg-background text-foreground shadow-sm font-bold border border-border/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Schema Designer
            </Link>
            <Link
              href="/explorer"
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                pathname === "/explorer"
                  ? "bg-background text-foreground shadow-sm font-bold border border-border/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Data Explorer
            </Link>
            <Link
              href="/mock-data"
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                pathname === "/mock-data"
                  ? "bg-background text-foreground shadow-sm font-bold border border-border/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mock Data
            </Link>
            <Link
              href="/diff"
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                pathname === "/diff"
                  ? "bg-background text-foreground shadow-sm font-bold border border-border/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SQL Diff
            </Link>
          </nav>

          <div className="h-4 w-px bg-border mx-2 hidden sm:block font-mono" />

          {/* Database Info, Status, & Connection Panel Switch */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setIsConnectOpen(true)}
              className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/95 text-[11px] rounded bg-primary/10 px-2.5 py-1 border border-primary/20 transition-all cursor-pointer"
              title="Configure database connections"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Connection</span>
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

        {/* Action Controls & Theme Switcher */}
        <div className="flex items-center gap-2">
          {/* DB Actions */}
          <div className="flex items-center gap-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".db,.sqlite,.sqlite3"
              className="hidden"
            />
            <button
              onClick={initDb}
              disabled={isDbLoading}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-50 transition-all cursor-pointer"
              title="Start with new in-memory SQLite database"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">New DB</span>
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-all"
              title="Open Import Wizard"
            >
              <Upload className="h-3.5 w-3.5 text-green-500" />
              <span className="hidden lg:inline">Import</span>
            </button>
            <button
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-all"
              title="Open Export Dialog"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span className="hidden lg:inline">Export</span>
            </button>
            
            <button
              onClick={() => setIsAiCollapsed(!isAiCollapsed)}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-border cursor-pointer transition-all ${
                !isAiCollapsed ? "bg-primary text-primary-foreground font-bold" : "bg-background hover:bg-accent text-foreground"
              }`}
              title="Toggle AI Assistant Copilot"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span className="hidden lg:inline">AI Copilot</span>
            </button>
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Theme Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden lg:inline">Theme:</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as AppTheme)}
              className="text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-foreground"
            >
              <option value="vscode-dark">{themeDisplayNames["vscode-dark"]}</option>
              <option value="github-light">{themeDisplayNames["github-light"]}</option>
              <option value="dracula">{themeDisplayNames["dracula"]}</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-grow flex min-h-0 min-w-0 bg-background text-foreground transition-colors relative overflow-hidden">
        {/* Left Sidebar (History) */}
        <div 
          className={`flex flex-col bg-card min-h-0 shrink-0 border-r border-border transition-all duration-200 ${
            isSidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-64 opacity-100"
          }`}
        >
          {!isSidebarCollapsed && <HistorySidebar />}
        </div>

        {/* Right Content Workspace */}
        <div className="flex-grow flex min-h-0 min-w-0 bg-background relative">
          <div className="flex-grow flex flex-col min-h-0 min-w-0 bg-background relative">
            {isEditorCollapsed ? (
              <div className="flex flex-col h-full w-full min-h-0 bg-background">
                <div className="flex h-9 items-center justify-between border-b border-border bg-card px-4 shrink-0 select-none">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5 font-mono">
                    <Sliders className="h-3 w-3 text-red-500" />
                    <span>SQL Editor Collapsed</span>
                  </span>
                  <button 
                    onClick={() => setIsEditorCollapsed(false)}
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-border bg-background hover:bg-accent text-primary cursor-pointer transition-colors"
                  >
                    Show SQL Editor
                  </button>
                </div>
                <ResultsPanel />
              </div>
            ) : (
              <div className="flex flex-col h-full w-full min-h-0 bg-background">
                {/* Top SQL Editor */}
                <div className="h-1/2 min-h-[200px] flex flex-col border-b border-border relative overflow-hidden">
                  <SqlEditor onCollapse={() => setIsEditorCollapsed(true)} />
                </div>

                {/* Bottom Query Results */}
                <div className="flex-1 min-h-[200px] flex flex-col relative overflow-hidden">
                  <ResultsPanel />
                </div>
              </div>
            )}
          </div>

          {/* AI Panel sidebar */}
          {!isAiCollapsed && (
            <div className="w-80 border-l border-border bg-card flex flex-col min-h-0 shrink-0">
              <AiPanel />
            </div>
          )}
        </div>
      </main>

      {/* Connection Dialog Modal Overlay */}
      <ProjectManagerDialog isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />
      <ImportWizard isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <ORMExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
