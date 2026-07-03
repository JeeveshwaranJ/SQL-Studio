"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Database as DbIcon, 
  Upload, 
  Download, 
  Plus, 
  RotateCw, 
  Menu,
  Layers,
  Table as TableIcon,
  Search,
  Sliders
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { useThemeStore, AppTheme } from "../../lib/store/themeStore";
import ThemeHydrator from "../../components/layout/ThemeHydrator";
import ProjectManagerDialog from "../../components/db/ProjectManagerDialog";
import ImportWizard from "../../components/import/ImportWizard";
import ORMExportDialog from "../../components/export/ORMExportDialog";

// Dynamically import DataExplorerGrid to run strictly in client-side environment
const DataExplorerGrid = dynamic(() => import("../../components/explorer/DataExplorerGrid"), {
  ssr: false,
});

function ExplorerLayout() {
  const { 
    dbName, 
    isDbLoading, 
    initDb, 
    loadDbFromFile, 
    exportDb,
    tables
  } = useDbStore();

  const { theme, setTheme } = useThemeStore();
  const pathname = usePathname();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Connection Dialog state
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Left Sidebar panel controls
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

  // Selected table in explorer state
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableSearch, setTableSearch] = useState("");

  // Initialize DB if not set
  useEffect(() => {
    if (!tables || tables.length === 0) {
      // If we don't have tables, sync/initialize
      if (!useDbStore.getState().adapter) {
        initDb();
      }
    }
  }, [tables, initDb]);

  // Default to first table if selection empty
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadDbFromFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const toggleLeftSidebar = () => {
    setIsLeftCollapsed(!isLeftCollapsed);
  };

  // Filter tables in explorer list
  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const themeDisplayNames: Record<AppTheme, string> = {
    "vscode-dark": "VS Code Dark",
    "github-light": "GitHub Light",
    "dracula": "Dracula",
  };

  return (
    <div className="flex flex-col flex-1 h-screen w-full select-none overflow-hidden bg-background text-foreground animate-fadeIn text-xs">
      {/* Explorer Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLeftSidebar}
            className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
            title={isLeftCollapsed ? "Expand Left Sidebar" : "Collapse Left Sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded bg-primary/10 p-1.5 text-primary">
              <DbIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight md:text-base">SQL Studio</h1>
              <p className="text-[10px] text-muted-foreground leading-none">Database Spreadsheet Explorer</p>
            </div>
          </div>

          <div className="h-4 w-px bg-border mx-2 hidden sm:block" />

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

          <div className="h-4 w-px bg-border mx-2 hidden sm:block" />

          {/* Database Info & Connections Button */}
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

      {/* Workspace */}
      <main className="flex-grow flex min-h-0 min-w-0 bg-background text-foreground transition-colors relative overflow-hidden">
        {/* Left Sidebar (Tables List) */}
        <div 
          className={`flex flex-col bg-card min-h-0 shrink-0 border-r border-border transition-all duration-200 ${
            isLeftCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-64 opacity-100"
          }`}
        >
          {!isLeftCollapsed && (
            <>
              {/* Table Search */}
              <div className="p-3 border-b border-border shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filter tables..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Tables list</span>
                </div>
                
                {filteredTables.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedTable(t.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-left transition-colors cursor-pointer select-none ${
                      selectedTable === t.name
                        ? "bg-primary/10 text-primary font-semibold border border-primary/10"
                        : "hover:bg-accent text-foreground/80"
                    }`}
                  >
                    <TableIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Content Workspace */}
        <div className="flex-grow flex flex-col min-h-0 min-w-0 bg-background relative">
          {selectedTable ? (
            <DataExplorerGrid selectedTable={selectedTable} />
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-8">
              <TableIcon className="h-12 w-12 text-muted-foreground/10 mb-2" />
              <span className="text-xs">No tables selected to browse. Create a table first.</span>
            </div>
          )}
        </div>
      </main>

      {/* DB Connection dialog */}
      <ProjectManagerDialog isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />
      <ImportWizard isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <ORMExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}

export default function ExplorerPage() {
  return (
    <>
      <ThemeHydrator />
      <ExplorerLayout />
    </>
  );
}
