"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { 
  Table2, 
  Braces, 
  FileSpreadsheet, 
  Copy, 
  Download, 
  Check, 
  AlertCircle, 
  Terminal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";

type TabType = "table" | "json" | "csv" | "problems";

export default function ResultsPanel() {
  const { results, validationProblems } = useDbStore();
  const [activeTab, setActiveTab] = useState<TabType>("problems");
  const [copied, setCopied] = useState(false);

  // TanStack table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Reset pagination when new results arrive
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [results]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convert results to CSV format
  const csvContent = useMemo(() => {
    if (!results || !results.columns || results.columns.length === 0) return "";
    const header = results.columns.join(",");
    const body = results.rows
      .map((row) =>
        row
          .map((val) => {
            if (val === null || val === undefined) return "";
            const str = String(val);
            if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      )
      .join("\n");
    return `${header}\n${body}`;
  }, [results]);

  // Convert results to JSON array format
  const jsonContent = useMemo(() => {
    if (!results || !results.columns || results.columns.length === 0) return "[]";
    const objects = results.rows.map((row) => {
      const obj: Record<string, any> = {};
      results.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    return JSON.stringify(objects, null, 2);
  }, [results]);

  // Dynamically build TanStack Table columns
  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    if (!results || !results.columns || results.columns.length === 0) return [];

    const cols: ColumnDef<any>[] = [
      {
        id: "row-index",
        header: "#",
        accessorFn: (_, index) => index + 1,
        cell: (info) => (
          <span className="text-[10px] font-mono text-muted-foreground select-none">
            {info.row.index + 1 + pagination.pageIndex * pagination.pageSize}
          </span>
        ),
        enableSorting: false,
      },
    ];

    results.columns.forEach((colName, colIdx) => {
      cols.push({
        id: colName,
        header: colName,
        accessorFn: (row) => row[colIdx],
        cell: (info) => {
          const val = info.getValue();
          if (val === null || val === undefined) {
            return <span className="italic text-muted-foreground/50 text-[11px]">null</span>;
          }
          if (typeof val === "number") {
            return <span className="font-mono text-[11px] text-right block w-full">{val}</span>;
          }
          return <span className="font-sans text-[11px] text-foreground/90">{String(val)}</span>;
        },
      });
    });

    return cols;
  }, [results, pagination.pageIndex, pagination.pageSize]);

  const tableData = useMemo(() => results?.rows || [], [results]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Synchronize tab transitions based on validation and results changes
  useEffect(() => {
    if (validationProblems.length > 0) {
      setActiveTab("problems");
    } else if (results) {
      setActiveTab(results.columns.length === 0 ? "problems" : "table");
    }
  }, [validationProblems.length, results]);

  // Empty State (Before running query, only if no validation problems exist)
  if (!results && validationProblems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16 px-4 text-center select-none bg-background transition-colors h-full">
        <div className="flex items-center justify-center rounded-full bg-accent/30 p-4 text-muted-foreground/60 mb-3 border border-border/10">
          <Terminal className="h-10 w-10" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Query Result Viewer</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-[260px] leading-relaxed">
          Type SQLite code above and run it. Use <kbd className="px-1.5 py-0.5 rounded bg-accent border border-border text-[9px] font-mono select-none">Ctrl+Enter</kbd> to execute instantly.
        </p>
      </div>
    );
  }

  // Error State
  if (results && results.error) {
    return (
      <div className="flex flex-col flex-1 p-4 bg-background overflow-y-auto h-full">
        <div className="flex items-start gap-3 p-3.5 rounded border border-red-500/20 bg-red-500/5 text-red-500">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">SQL Syntax Error</h4>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-black/15 p-2 rounded border border-red-500/10 mt-1 max-w-full">
              {results.error}
            </pre>
            <p className="text-[10px] text-muted-foreground/80 mt-1.5">
              Execution took {results.executionTime}ms. Double check table names and syntax.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state with no return columns (e.g., DML/DDL success)
  const hasNoOutput = !results || results.columns.length === 0;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-background transition-colors">
      {/* Results Header / Tabs */}
      <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4 shrink-0 select-none">
        <div className="flex items-center gap-1">
          {/* Always display Problems tab */}
          <button
            onClick={() => setActiveTab("problems")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "problems"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertCircle className={`h-3.5 w-3.5 ${
              validationProblems.some(p => p.severity === "error") 
                ? "text-red-500 animate-pulse" 
                : validationProblems.some(p => p.severity === "warning") 
                ? "text-yellow-500" 
                : "text-blue-500"
            }`} />
            <span>Problems ({validationProblems.length})</span>
          </button>

          {!hasNoOutput && results && (
            <>
              <button
                onClick={() => setActiveTab("table")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === "table"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setActiveTab("json")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === "json"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Braces className="h-3.5 w-3.5" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => setActiveTab("csv")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === "csv"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
            </>
          )}
          {hasNoOutput && (
            <div className="flex items-center gap-1.5 px-1 py-2 text-xs font-bold text-green-500">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Query Run Successful</span>
            </div>
          )}
        </div>

        {/* Status Metrics & Exporters */}
        <div className="flex items-center gap-3">
          {/* Metadata info */}
          {results && (
            <span className="text-[10px] text-muted-foreground font-mono leading-none">
              {results.rows.length} {results.rows.length === 1 ? "row" : "rows"} | {results.executionTime}ms
            </span>
          )}

          {!hasNoOutput && (
            <>
              <div className="h-4 w-px bg-border" />
              
              {/* Copy & Download Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(activeTab === "csv" ? csvContent : jsonContent)}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-border bg-background hover:bg-accent text-foreground transition-all cursor-pointer"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    activeTab === "csv"
                      ? handleDownload(csvContent, "query_results.csv", "text/csv")
                      : handleDownload(jsonContent, "query_results.json", "application/json")
                  }
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-border bg-background hover:bg-accent text-foreground transition-all cursor-pointer"
                  title="Download results file"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === "problems" ? (
          /* Problems Tab Panel */
          <div className="absolute inset-0 overflow-y-auto p-4 space-y-2 bg-background">
            {validationProblems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 select-none">
                <Check className="h-8 w-8 text-green-500 mb-2" />
                <span className="text-xs font-bold text-foreground">No Problems Found</span>
                <span className="text-[10px] text-muted-foreground/80">Your SQL query is syntactically valid and matches your database schema.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {validationProblems.map((problem, idx) => {
                  const isError = problem.severity === "error";
                  const isWarn = problem.severity === "warning";
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-all ${
                        isError 
                          ? "border-red-500/15 bg-red-500/5 text-red-500 hover:bg-red-500/10" 
                          : isWarn 
                          ? "border-yellow-500/15 bg-yellow-500/5 text-yellow-500 hover:bg-yellow-500/10" 
                          : "border-blue-500/15 bg-blue-500/5 text-blue-500 hover:bg-blue-500/10"
                      }`}
                      onClick={() => {
                        const event = new CustomEvent("focus-editor-line", { detail: { line: problem.line, column: problem.column } });
                        window.dispatchEvent(event);
                      }}
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 leading-normal">
                        <span className="font-mono text-[10px] font-bold">
                          [Line {problem.line}] {problem.severity.toUpperCase()}
                        </span>
                        <p className="text-xs text-foreground/80 font-medium">{problem.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : hasNoOutput ? (
          /* Blank state for non-select queries */
          <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
            <div className="rounded-full bg-green-500/10 p-3.5 border border-green-500/20 text-green-500 mb-2.5">
              <Check className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold text-foreground">Statement Executed</span>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[280px]">
              Query was processed without returning record rows. Schema structures have been updated.
            </p>
          </div>
        ) : activeTab === "table" ? (
          /* Table Tab Panel */
          <div className="absolute inset-0 flex flex-col">
            {/* Scrollable table viewport */}
            <div className="flex-1 overflow-auto border-b border-border/30">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-card border-b border-border z-10 select-none transition-colors">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border last:border-0 hover:bg-accent/40 cursor-pointer select-none transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" && " 🔼"}
                            {header.column.getIsSorted() === "desc" && " 🔽"}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-border/20">
                  {table.getRowModel().rows.map((row) => (
                    <tr 
                      key={row.id} 
                      className="hover:bg-accent/20 border-b border-border/5 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2 border-r border-border/5 last:border-0 align-middle max-w-sm truncate"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
 
            {/* Premium Pagination Footer */}
            <div className="flex h-11 items-center justify-between px-4 shrink-0 bg-card border-t border-border select-none text-xs text-muted-foreground transition-colors">
              <div className="flex items-center gap-2">
                <span>Page</span>
                <span className="font-bold text-foreground">
                  {table.getState().pagination.pageIndex + 1}
                </span>
                <span>of</span>
                <span className="font-bold text-foreground">
                  {table.getPageCount()}
                </span>
              </div>
 
              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30 cursor-pointer"
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30 cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30 cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30 cursor-pointer"
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
 
              {/* Rows per page selector */}
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {[5, 10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : activeTab === "json" ? (
          /* JSON Tab Panel */
          <div className="absolute inset-0 overflow-auto p-4 bg-background">
            <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap select-text selection:bg-primary/20">
              {jsonContent}
            </pre>
          </div>
        ) : (
          /* CSV Tab Panel */
          <div className="absolute inset-0 overflow-auto p-4 bg-background">
            <pre className="text-xs font-mono text-foreground/90 whitespace-pre select-text selection:bg-primary/20">
              {csvContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
