"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Database, 
  Play, 
  RotateCw, 
  Check, 
  AlertTriangle, 
  Settings2, 
  Layers, 
  RefreshCw,
  Info,
  Calendar,
  Grid
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { 
  ColumnGenConfig, 
  generateCellMockValue, 
  seedMockData 
} from "../../lib/mockdata/generator";

export default function MockGenerator() {
  const { adapter, tables, refreshSchema } = useDbStore();

  const [selectedTable, setSelectedTable] = useState("");
  const [rowCount, setRowCount] = useState(50);
  const [useTopoSort, setUseTopoSort] = useState(true);

  // Column generator configs dictionary: column_name -> ColumnGenConfig
  const [configs, setConfigs] = useState<Record<string, ColumnGenConfig>>({});

  // Preview state
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [previewVersion, setPreviewVersion] = useState(0);

  // Seeding execution status
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Retrieve active table definition
  const tableSchema = useMemo(() => {
    return tables.find((t) => t.name === selectedTable) || null;
  }, [tables, selectedTable]);

  // Set default table on load
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  // Initialize column configurations when table selection changes
  useEffect(() => {
    if (!tableSchema) return;

    const initialConfigs: Record<string, ColumnGenConfig> = {};
    tableSchema.columns.forEach((col) => {
      // Find if this is a foreign key
      const fk = tableSchema.foreignKeys.find((f) => f.column === col.name);
      
      if (fk) {
        initialConfigs[col.name] = { genType: "fk" };
      } else {
        const type = col.type.toUpperCase();
        if (type.includes("INT") || type.includes("SERIAL")) {
          initialConfigs[col.name] = { genType: "number", min: 1, max: 100 };
        } else if (type.includes("DOUBLE") || type === "REAL" || type === "FLOAT") {
          initialConfigs[col.name] = { genType: "number", min: 1, max: 1000 };
        } else if (type.includes("BOOL")) {
          initialConfigs[col.name] = { genType: "number", min: 0, max: 1 };
        } else if (type.includes("DATE") || type.includes("TIME")) {
          initialConfigs[col.name] = { genType: "date", dateStart: "2024-01-01", dateEnd: "2026-01-01" };
        } else if (col.name.toLowerCase().includes("email")) {
          initialConfigs[col.name] = { genType: "email" };
        } else if (col.name.toLowerCase().includes("phone")) {
          initialConfigs[col.name] = { genType: "phone" };
        } else if (col.name.toLowerCase().includes("address") || col.name.toLowerCase().includes("street")) {
          initialConfigs[col.name] = { genType: "address" };
        } else if (col.name.toLowerCase().includes("uuid") || col.name.toLowerCase().includes("guid")) {
          initialConfigs[col.name] = { genType: "uuid" };
        } else {
          initialConfigs[col.name] = { genType: "name" };
        }
      }
    });

    setConfigs(initialConfigs);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPreviewVersion((prev) => prev + 1); // trigger preview update
  }, [tableSchema]);

  // Compute in-memory preview (up to 20 rows)
  useEffect(() => {
    if (!tableSchema) return;

    const rows: any[][] = [];
    const count = 20;

    for (let r = 0; r < count; r++) {
      const row: any[] = [];
      tableSchema.columns.forEach((col) => {
        const config = configs[col.name];
        if (!config) {
          row.push(null);
          return;
        }

        // Mock parent FK pool for preview (simple mock IDs)
        const mockFkPool = col.type.toUpperCase().includes("INT") 
          ? [1, 2, 3, 4, 5]
          : ["uuid-1", "uuid-2", "uuid-3"];

        const val = generateCellMockValue(col, config, mockFkPool);
        row.push(val);
      });
      rows.push(row);
    }

    setPreviewRows(rows);
  }, [tableSchema, configs, previewVersion]);

  const handleUpdateConfig = (colName: string, field: keyof ColumnGenConfig, value: any) => {
    setConfigs((prev) => ({
      ...prev,
      [colName]: {
        ...prev[colName],
        [field]: value,
      },
    }));
  };

  const handleRegenerateColumnPreview = (colName: string) => {
    setPreviewVersion((prev) => prev + 1);
  };

  const handleRunSeeder = async () => {
    if (!adapter || !tableSchema) return;
    setIsExecuting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Build the tables dictionary configuration
    const fullConfigs: Record<string, Record<string, ColumnGenConfig>> = {
      [selectedTable]: configs,
    };

    const res = await seedMockData(
      adapter,
      tables,
      selectedTable,
      rowCount,
      fullConfigs,
      useTopoSort
    );

    setIsExecuting(false);
    if (res.success) {
      setSuccessMsg(`Seeding complete! Successfully inserted ${res.insertedCount} mock rows.`);
      refreshSchema();
    } else {
      setErrorMsg(res.error || "Execution failed during mock seeding.");
    }
  };

  return (
    <div className="flex-1 flex min-h-0 bg-background select-none text-foreground font-sans transition-colors">
      
      {/* 1. Left Sidebar: Settings Control Panel */}
      <div className="w-[320px] border-r border-border bg-card flex flex-col min-h-0 shrink-0">
        
        {/* Title */}
        <div className="h-12 border-b border-border bg-muted/40 px-4 flex items-center gap-2 shrink-0">
          <Settings2 className="h-4.5 w-4.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mock Seeding Settings</span>
        </div>

        {/* Scroll Controls Box */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Target Table Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Target Table</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Row Count Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Row Count to Generate</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={rowCount}
              onChange={(e) => setRowCount(Math.max(1, Number(e.target.value)))}
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Topo Sort Checklist */}
          <label className="flex items-start gap-2.5 p-2.5 rounded border border-border bg-muted/10 cursor-pointer">
            <input
              type="checkbox"
              checked={useTopoSort}
              onChange={(e) => setUseTopoSort(e.target.checked)}
              className="mt-0.5 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
            />
            <div className="space-y-0.5 leading-tight">
              <span className="text-[11px] font-bold text-foreground/90 block">Topological Sort seeding</span>
              <p className="text-[10px] text-muted-foreground font-medium leading-normal">
                Ensures parent tables are generated first and samples generated keys to prevent orphaned FK records.
              </p>
            </div>
          </label>

          <div className="h-px bg-border/40" />

          {/* Column configs title */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Map Column Generators</span>
            
            {tableSchema?.columns.map((col) => {
              const config = configs[col.name] || { genType: "name" };
              const isFk = tableSchema.foreignKeys.some((f) => f.column === col.name);

              return (
                <div key={col.name} className="p-3 rounded border border-border/40 bg-background space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold truncate pr-1">{col.name}</span>
                    <button
                      onClick={() => handleRegenerateColumnPreview(col.name)}
                      className="text-muted-foreground hover:text-primary rounded p-0.5 hover:bg-accent transition-colors"
                      title="Regenerate preview rows for this column"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Generator Type Selector */}
                  <select
                    value={config.genType}
                    disabled={isFk}
                    onChange={(e) => handleUpdateConfig(col.name, "genType", e.target.value as any)}
                    className="w-full bg-muted border border-border rounded px-2.5 py-1 text-[11px] text-foreground focus:outline-none cursor-pointer disabled:opacity-60"
                  >
                    {isFk ? (
                      <option value="fk">Reference Parent FK</option>
                    ) : (
                      <>
                        <option value="name">Name / Word</option>
                        <option value="address">Street Address</option>
                        <option value="email">Email address</option>
                        <option value="phone">Phone number</option>
                        <option value="uuid">UUID string</option>
                        <option value="date">Date Bound</option>
                        <option value="number">Number Range</option>
                        <option value="regex">Custom Regex</option>
                      </>
                    )}
                  </select>

                  {/* Conditional Gen Configurations Inputs */}
                  {config.genType === "number" && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        placeholder="min"
                        value={config.min !== undefined ? config.min : ""}
                        onChange={(e) => handleUpdateConfig(col.name, "min", e.target.value === "" ? undefined : Number(e.target.value))}
                        className="w-full bg-background border border-border rounded px-2 py-0.5 text-[10px] focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="max"
                        value={config.max !== undefined ? config.max : ""}
                        onChange={(e) => handleUpdateConfig(col.name, "max", e.target.value === "" ? undefined : Number(e.target.value))}
                        className="w-full bg-background border border-border rounded px-2 py-0.5 text-[10px] focus:outline-none"
                      />
                    </div>
                  )}

                  {config.genType === "date" && (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="Start Date: YYYY-MM-DD"
                        value={config.dateStart || ""}
                        onChange={(e) => handleUpdateConfig(col.name, "dateStart", e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-0.5 text-[10px] focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="End Date: YYYY-MM-DD"
                        value={config.dateEnd || ""}
                        onChange={(e) => handleUpdateConfig(col.name, "dateEnd", e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-0.5 text-[10px] focus:outline-none"
                      />
                    </div>
                  )}

                  {config.genType === "regex" && (
                    <input
                      type="text"
                      placeholder="e.g. [A-Z]{3}-\d{4}"
                      value={config.regex || ""}
                      onChange={(e) => handleUpdateConfig(col.name, "regex", e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-0.5 text-[10px] focus:outline-none font-mono"
                    />
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Seeding Action Footer */}
        <div className="p-4 border-t border-border bg-muted/20 shrink-0">
          <button
            onClick={handleRunSeeder}
            disabled={isExecuting || !tableSchema}
            className="w-full py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow disabled:opacity-55 transition-all"
          >
            {isExecuting ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                <span>Generating Mocks...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Seed Database</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Right Side: Grid Preview Area */}
      <div className="flex-grow flex flex-col min-h-0">
        
        {/* Header */}
        <div className="h-12 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Grid className="h-4.5 w-4.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">In-Memory Generated preview (First 20 rows)</span>
          </div>
          <button
            onClick={() => setPreviewVersion((v) => v + 1)}
            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/95"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Regenerate Preview</span>
          </button>
        </div>

        {/* Alerts & Table preview */}
        <div className="flex-grow overflow-auto p-4 space-y-4">
          
          {/* Status Alerts */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded border border-red-500/20 bg-red-500/5 text-red-500 text-xs animate-fadeIn">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded border border-green-500/20 bg-green-500/5 text-green-500 text-xs animate-fadeIn">
              {successMsg}
            </div>
          )}

          {/* Grid Preview Table */}
          {!tableSchema ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground select-none">
              <Layers className="h-10 w-10 text-muted-foreground/20 mb-2" />
              <span>No database tables available to seed.</span>
            </div>
          ) : (
            <div className="border border-border/40 rounded-xl overflow-hidden shadow-sm bg-card max-w-full">
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead className="bg-muted text-muted-foreground font-bold border-b border-border sticky top-0">
                  <tr>
                    {tableSchema.columns.map((col) => (
                      <th key={col.name} className="px-4 py-2.5 border-r border-border/40">
                        <div className="flex flex-col">
                          <span className="font-mono text-foreground font-bold">{col.name}</span>
                          <span className="text-[9px] font-normal font-mono text-muted-foreground/80 uppercase">
                            {col.type}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 font-mono text-[11px] leading-relaxed">
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-accent/10 odd:bg-card/30">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2 border-r border-border/20 truncate max-w-[200px]" title={String(cell)}>
                          {cell === null ? (
                            <span className="text-[10px] text-muted-foreground/50 italic font-sans">NULL</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
