"use client";

import React, { useState, useRef } from "react";
import { 
  X, 
  Upload, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  FileText, 
  Table as TableIcon,
  Database,
  ArrowRight,
  AlertTriangle,
  Play,
  RotateCw,
  Info
} from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { parseCsv, inferColumnTypes } from "../../lib/import/csv";
import { parseJsonImport } from "../../lib/import/json";

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "upload" | "mapping" | "confirm" | "executing";

export default function ImportWizard({ isOpen, onClose }: ImportWizardProps) {
  const { adapter, tables, runQuery, refreshSchema, loadDbFromFile } = useDbStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper State
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileExtension, setFileExtension] = useState<string>("");

  // Parsed File Content States (CSV / JSON)
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[][]>([]);
  const [inferredTypes, setInferredTypes] = useState<string[]>([]);

  // Raw script SQL (for .sql files)
  const [sqlScriptText, setSqlScriptText] = useState("");

  // Mapping Configuration States
  const [targetType, setTargetType] = useState<"new" | "existing">("new");
  const [newTableName, setNewTableName] = useState("");
  const [selectedExistingTable, setSelectedExistingTable] = useState("");
  
  // Mapping columns dictionary: sourceColumnName -> { targetName, type, existingTargetCol }
  const [columnMappings, setColumnMappings] = useState<Record<string, {
    targetName: string;
    type: string;
    existingTargetCol: string;
  }>>({});

  // Execution Progress States
  const [progressPercent, setProgressPercent] = useState(0);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionSuccess, setExecutionSuccess] = useState(false);
  const [statusText, setStatusText] = useState("");

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processSelectedFile(selected);
    }
  };

  const processSelectedFile = async (selectedFile: File) => {
    const name = selectedFile.name;
    const ext = name.split(".").pop()?.toLowerCase() || "";
    
    if (!["sql", "csv", "json", "sqlite", "db"].includes(ext)) {
      alert("Unsupported file format. Please upload .sql, .csv, .json, or .sqlite/.db files.");
      return;
    }

    setFile(selectedFile);
    setFileExtension(ext);
    setExecutionError(null);
    setExecutionSuccess(false);

    // Read and parse file
    const reader = new FileReader();

    if (ext === "sql") {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setSqlScriptText(text);
        setStep("confirm");
      };
      reader.readAsText(selectedFile);
    } else if (ext === "sqlite" || ext === "db") {
      if (adapter && adapter.id !== "sqlite") {
        if (!window.confirm("You are currently connected to a remote database. Loading this SQLite file will disconnect your session and open this file locally as Demo DB. Proceed?")) {
          setFile(null);
          return;
        }
      }
      setStep("confirm");
    } else if (ext === "csv") {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const matrix = parseCsv(text);
          if (matrix.length === 0) throw new Error("CSV file is empty.");
          
          const headers = matrix[0];
          const dataRows = matrix.slice(1);
          const types = inferColumnTypes(headers, dataRows);

          setParsedHeaders(headers);
          setParsedRows(dataRows);
          setInferredTypes(types);
          
          // Seed initial table name & mappings
          const cleanTableName = name.split(".")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_");
          setNewTableName(cleanTableName);

          // Initialize mapping configs
          const initMappings: typeof columnMappings = {};
          headers.forEach((h, idx) => {
            initMappings[h] = {
              targetName: h.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
              type: types[idx],
              existingTargetCol: "",
            };
          });
          setColumnMappings(initMappings);

          if (tables.length > 0) {
            setSelectedExistingTable(tables[0].name);
          }
          setStep("mapping");
        } catch (err: any) {
          alert(`CSV parsing error: ${err.message || err}`);
          setFile(null);
        }
      };
      reader.readAsText(selectedFile);
    } else if (ext === "json") {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const { headers, rows: dataRows, inferredTypes: types } = parseJsonImport(text);
          
          setParsedHeaders(headers);
          setParsedRows(dataRows);
          setInferredTypes(types);

          const cleanTableName = name.split(".")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_");
          setNewTableName(cleanTableName);

          const initMappings: typeof columnMappings = {};
          headers.forEach((h, idx) => {
            initMappings[h] = {
              targetName: h.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
              type: types[idx],
              existingTargetCol: "",
            };
          });
          setColumnMappings(initMappings);

          if (tables.length > 0) {
            setSelectedExistingTable(tables[0].name);
          }
          setStep("mapping");
        } catch (err: any) {
          alert(`JSON parsing error: ${err.message || err}`);
          setFile(null);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleRunImport = async () => {
    if (!file || !adapter) return;
    setStep("executing");
    setProgressPercent(10);
    setExecutionError(null);
    setExecutionSuccess(false);

    try {
      if (fileExtension === "sqlite" || fileExtension === "db") {
        setStatusText("Loading local SQLite file...");
        await loadDbFromFile(file);
        setProgressPercent(100);
        setExecutionSuccess(true);
        setStatusText("SQLite database imported and loaded successfully!");
        return;
      }

      if (fileExtension === "sql") {
        setStatusText("Executing SQL script...");
        // Split script by semicolon to execute commands sequentially
        const statements = sqlScriptText
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (let i = 0; i < statements.length; i++) {
          setStatusText(`Executing statement ${i + 1} of ${statements.length}...`);
          const res = await adapter.execute(statements[i]);
          if (res.error) {
            throw new Error(`Line ${i + 1} SQL failure:\n${res.error}`);
          }
          setProgressPercent(Math.min(95, Math.round(((i + 1) / statements.length) * 100)));
        }

        refreshSchema();
        setProgressPercent(100);
        setExecutionSuccess(true);
        setStatusText("SQL Script executed successfully!");
        return;
      }

      // CSV & JSON Data import
      const isNew = targetType === "new";
      const targetTable = isNew ? newTableName : selectedExistingTable;
      const quote = adapter.id === "mysql" ? "`" : '"';

      if (isNew) {
        setStatusText(`Creating new table ${targetTable}...`);
        // Generate CREATE TABLE query
        const colDefinitions = parsedHeaders.map((h) => {
          const mapping = columnMappings[h];
          return `${quote}${mapping.targetName}${quote} ${mapping.type}`;
        }).join(", ");

        const createTableSql = `CREATE TABLE ${quote}${targetTable}${quote} (${colDefinitions});`;
        const createRes = await adapter.execute(createTableSql);
        if (createRes.error) {
          throw new Error(`Failed to create table:\n${createRes.error}`);
        }
      }

      // Import records in batches of 100 rows
      const batchSize = 100;
      const totalBatches = Math.ceil(parsedRows.length / batchSize);

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        setStatusText(`Inserting batch ${batchIdx + 1} of ${totalBatches} (${batchIdx * batchSize} - ${Math.min(parsedRows.length, (batchIdx + 1) * batchSize)} rows)...`);
        
        const start = batchIdx * batchSize;
        const end = Math.min(parsedRows.length, start + batchSize);
        const batchRows = parsedRows.slice(start, end);

        // Generate inserts
        for (const row of batchRows) {
          const targetColsList: string[] = [];
          const valuesList: string[] = [];

          parsedHeaders.forEach((h, idx) => {
            const mapping = columnMappings[h];
            const cellVal = row[idx];
            const targetCol = isNew ? mapping.targetName : mapping.existingTargetCol;

            if (targetCol) {
              targetColsList.push(`${quote}${targetCol}${quote}`);
              
              if (cellVal === null || cellVal === undefined || cellVal === "") {
                valuesList.push("NULL");
              } else if (typeof cellVal === "number" || typeof cellVal === "boolean") {
                valuesList.push(String(cellVal));
              } else {
                // String or numeric representation check
                const valStr = String(cellVal).trim();
                const isNum = !isNaN(Number(valStr)) && valStr !== "";
                valuesList.push(isNum ? valStr : `'${valStr.replace(/'/g, "''")}'`);
              }
            }
          });

          if (targetColsList.length > 0) {
            const insertSql = `INSERT INTO ${quote}${targetTable}${quote} (${targetColsList.join(", ")}) VALUES (${valuesList.join(", ")});`;
            const insertRes = await adapter.execute(insertSql);
            if (insertRes.error) {
              throw new Error(`Failed to insert row:\n${insertRes.error}`);
            }
          }
        }

        setProgressPercent(Math.min(95, Math.round(((batchIdx + 1) / totalBatches) * 100)));
      }

      refreshSchema();
      setProgressPercent(100);
      setExecutionSuccess(true);
      setStatusText(`Data imported successfully! ${parsedRows.length} rows inserted into "${targetTable}".`);
    } catch (err: any) {
      setExecutionError(err.message || String(err));
      setProgressPercent(100);
    }
  };

  const resetWizard = () => {
    setFile(null);
    setFileExtension("");
    setParsedHeaders([]);
    setParsedRows([]);
    setStep("upload");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-xs text-foreground">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn scale-[1.01] transition-all">
        {/* Header */}
        <div className="flex h-12 items-center justify-between px-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Import Database Wizard</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Wizard Body Panels */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* STEP 1: UPLOAD ZONE */}
          {step === "upload" && (
            <div className="space-y-4">
              <div 
                onDragOver={handleDragOver}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/50 bg-accent/5 hover:bg-accent/10 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-2"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept=".sql,.csv,.json,.sqlite,.db" 
                  className="hidden" 
                />
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-foreground/90">Drop file here or click to select</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Supports .sql script, .csv values, .json arrays, or .sqlite/.db binaries</p>
                </div>
              </div>

              <div className="p-3 rounded border border-border/30 bg-accent/10 leading-normal flex gap-2">
                <Info className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground/90 block">Import Operations</span>
                  <p className="text-muted-foreground">
                    If you import CSV/JSON files, the wizard will automatically infer columns data types and let you map them into new tables or append to existing tables.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING PARAMETERS (CSV / JSON) */}
          {step === "mapping" && (
            <div className="space-y-4">
              {/* Parse Preview Grid (First 3 rows) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">File Parse Preview (First 3 Rows)</span>
                <div className="overflow-x-auto border border-border/40 rounded bg-accent/5">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead className="bg-card text-muted-foreground border-b border-border">
                      <tr>
                        {parsedHeaders.map((h, i) => (
                          <th key={i} className="px-3 py-1.5 font-bold border-r border-border/40">
                            {h} <span className="text-[8px] font-normal italic">({inferredTypes[i].toLowerCase()})</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-mono">
                      {parsedRows.slice(0, 3).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 border-r border-border/20 truncate max-w-[150px]">
                              {cell === null ? "NULL" : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Target Selector */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Target Destination</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground/95">
                    <input 
                      type="radio" 
                      name="targetType" 
                      checked={targetType === "new"}
                      onChange={() => setTargetType("new")}
                      className="text-primary focus:ring-primary focus:ring-offset-0" 
                    />
                    <span>Import into New Table</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground/95">
                    <input 
                      type="radio" 
                      name="targetType" 
                      checked={targetType === "existing"}
                      onChange={() => setTargetType("existing")}
                      className="text-primary focus:ring-primary focus:ring-offset-0" 
                    />
                    <span>Append to Existing Table</span>
                  </label>
                </div>
              </div>

              {/* Destination inputs */}
              {targetType === "new" ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Table Name</label>
                  <input
                    type="text"
                    required
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-semibold">Select Target Table</label>
                  <select
                    value={selectedExistingTable}
                    onChange={(e) => setSelectedExistingTable(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column Mapping Grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Columns Mapping Grid</span>
                <div className="border border-border/40 rounded overflow-hidden">
                  <div className="grid grid-cols-3 bg-muted px-3 py-1.5 font-semibold text-muted-foreground border-b border-border">
                    <span>Source Column</span>
                    <span className="flex items-center gap-1 justify-center"><ArrowRight className="h-3.5 w-3.5" /> Destination Column</span>
                    <span className="text-right">Data Type</span>
                  </div>

                  <div className="divide-y divide-border/30 bg-background max-h-[160px] overflow-y-auto">
                    {parsedHeaders.map((h, i) => {
                      const mapping = columnMappings[h] || { targetName: h, type: "TEXT", existingTargetCol: "" };
                      const targetTableSchema = tables.find(t => t.name === selectedExistingTable);

                      return (
                        <div key={h} className="grid grid-cols-3 items-center px-3 py-2 font-mono text-[11px]">
                          <span className="truncate pr-2 font-semibold text-foreground/80">{h}</span>
                          
                          <div className="px-1 flex justify-center">
                            {targetType === "new" ? (
                              <input
                                type="text"
                                value={mapping.targetName}
                                onChange={(e) => setColumnMappings({
                                  ...columnMappings,
                                  [h]: { ...mapping, targetName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }
                                })}
                                className="w-full max-w-[150px] bg-background border border-border/70 rounded px-2 py-0.5 text-[10px]"
                              />
                            ) : (
                              <select
                                value={mapping.existingTargetCol}
                                onChange={(e) => setColumnMappings({
                                  ...columnMappings,
                                  [h]: { ...mapping, existingTargetCol: e.target.value }
                                })}
                                className="w-full max-w-[150px] bg-background border border-border/70 rounded px-2 py-0.5 text-[10px] cursor-pointer"
                              >
                                <option value="">-- omit column --</option>
                                {targetTableSchema?.columns.map(c => (
                                  <option key={c.name} value={c.name}>{c.name}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div className="text-right">
                            {targetType === "new" ? (
                              <select
                                value={mapping.type}
                                onChange={(e) => setColumnMappings({
                                  ...columnMappings,
                                  [h]: { ...mapping, type: e.target.value }
                                })}
                                className="bg-transparent border border-border/40 rounded px-1.5 py-0.5 text-[10px] font-bold text-primary focus:outline-none cursor-pointer"
                              >
                                <option value="INTEGER">INTEGER</option>
                                <option value="REAL">REAL</option>
                                <option value="BOOLEAN">BOOLEAN</option>
                                <option value="TEXT">TEXT</option>
                              </select>
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {targetTableSchema?.columns.find(c => c.name === mapping.existingTargetCol)?.type || "omit"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRMATION SUMMARY */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="p-4 border border-primary/20 bg-primary/5 rounded-xl space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-primary">
                  <Play className="h-4 w-4" />
                  <span>Ready to Run Import</span>
                </h3>
                
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-normal font-medium">
                  <li>File: <span className="font-mono text-foreground font-bold">{file?.name}</span> ({file?.size} bytes)</li>
                  {fileExtension === "sql" && (
                    <li>Operation: Execute SQL script containing <span className="font-mono text-foreground font-bold">{sqlScriptText.length}</span> characters</li>
                  )}
                  {(fileExtension === "sqlite" || fileExtension === "db") && (
                    <li>Operation: Disconnect active profiles and load raw SQLite binary local database</li>
                  )}
                  {["csv", "json"].includes(fileExtension) && (
                    <>
                      <li>Operation: Import <span className="font-mono text-foreground font-bold">{parsedRows.length}</span> records</li>
                      {targetType === "new" ? (
                        <li>Destination: Create new table <span className="font-mono text-foreground font-bold">"{newTableName}"</span> with <span className="font-mono text-foreground font-bold">{parsedHeaders.length}</span> columns</li>
                      ) : (
                        <li>Destination: Append to existing table <span className="font-mono text-foreground font-bold">"{selectedExistingTable}"</span></li>
                      )}
                    </>
                  )}
                </ul>
              </div>

              <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 text-yellow-500 rounded flex gap-2 leading-relaxed">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>
                  Import actions modify database schemas and row records. Make sure you have backed up any critical connection datasets before proceeding.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: EXECUTING PROGRESS ZONE */}
          {step === "executing" && (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-4 select-none">
              
              {!executionError && !executionSuccess && (
                <div className="flex flex-col items-center gap-2.5">
                  <RotateCw className="h-8 w-8 text-primary animate-spin" />
                  <span className="font-bold text-foreground/90">Executing import script...</span>
                </div>
              )}

              {executionError && (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-red-500">Import Script Failed</h3>
                  <div className="bg-red-500/5 border border-red-500/20 p-3 rounded font-mono text-[10px] text-red-400 break-all text-left max-w-lg max-h-[120px] overflow-y-auto leading-normal">
                    {executionError}
                  </div>
                </div>
              )}

              {executionSuccess && (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-green-500/10 rounded-full text-green-500">
                    <Check className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-green-500">Import Complete</h3>
                </div>
              )}

              {/* Progress Bar */}
              <div className="w-full max-w-sm space-y-1.5">
                <div className="w-full bg-accent/40 border border-border/30 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{statusText}</span>
                  <span className="font-bold">{progressPercent}%</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 border-t border-border bg-muted/20 flex gap-2 justify-between shrink-0 select-none">
          {step === "mapping" && (
            <button
              onClick={resetWizard}
              className="flex items-center gap-1 font-semibold py-2 px-3.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          )}

          {step === "confirm" && (
            <button
              onClick={() => {
                if (fileExtension === "sql" || fileExtension === "sqlite" || fileExtension === "db") {
                  resetWizard();
                } else {
                  setStep("mapping");
                }
              }}
              className="flex items-center gap-1 font-semibold py-2 px-3.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          )}

          <div className="flex-grow" />

          {step === "mapping" && (
            <button
              onClick={() => {
                if (targetType === "new" && !newTableName.trim()) {
                  alert("Please specify a valid table name.");
                  return;
                }
                if (targetType === "existing" && !selectedExistingTable) {
                  alert("Please select a target table.");
                  return;
                }
                setStep("confirm");
              }}
              className="flex items-center gap-1 font-bold py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-sm transition-all"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {step === "confirm" && (
            <button
              onClick={handleRunImport}
              className="flex items-center gap-1.5 font-bold py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-sm transition-all"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Start Import</span>
            </button>
          )}

          {(step === "executing" && (executionError || executionSuccess)) && (
            <button
              onClick={onClose}
              className="font-bold py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-sm transition-all"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
