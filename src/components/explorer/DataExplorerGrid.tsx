import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash, 
  Edit2, 
  Check, 
  X, 
  AlertTriangle,
  Play,
  RotateCw,
  Key,
  FileSpreadsheet,
  FileCode,
  Download,
  Upload
} from "lucide-react";
import { useDbStore, TableSchema } from "../../lib/store/dbStore";

interface Filter {
  column: string;
  operator: "=" | "!=" | "contains" | ">" | "<" | "IS NULL";
  value: string;
}

export default function DataExplorerGrid({ selectedTable }: { selectedTable: string }) {
  const { adapter, tables, runQuery } = useDbStore();
  const tableSchema = tables.find((t) => t.name === selectedTable);

  // Grid Data States
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);

  // Pagination & Sorting States
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");

  // Filters State
  const [filters, setFilters] = useState<Filter[]>([]);

  // Editing Cell State
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
    originalValue: any;
    currentValue: string;
  } | null>(null);

  // Update Confirmation Modal State
  const [pendingUpdate, setPendingUpdate] = useState<{
    sql: string;
    rowIndex: number;
    colIndex: number;
    newValue: any;
  } | null>(null);

  // Row Addition Modal State
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});

  // Pending Row Deletion State
  const [pendingDeleteSql, setPendingDeleteSql] = useState<string | null>(null);

  // File Upload Reference
  const csvImportRef = useRef<HTMLInputElement>(null);

  const quoteIdent = useCallback((ident: string) => {
    const q = adapter?.id === "mysql" ? "`" : '"';
    return `${q}${ident.replace(new RegExp(q, "g"), q + q)}${q}`;
  }, [adapter]);

  // Fetch grid data
  const fetchData = useCallback(async () => {
    if (!selectedTable || !adapter) return;
    setIsLoading(true);
    setGridError(null);

    const qTable = quoteIdent(selectedTable);
    
    // 1. Build WHERE filters clause
    const whereClauses: string[] = [];
    filters.forEach((f) => {
      if (!f.column) return;
      const qCol = quoteIdent(f.column);
      if (f.operator === "IS NULL") {
        whereClauses.push(`${qCol} IS NULL`);
      } else if (f.operator === "contains") {
        const valEscaped = f.value.replace(/'/g, "''");
        if (adapter.id === "postgres") {
          whereClauses.push(`${qCol} ILIKE '%${valEscaped}%'`);
        } else {
          whereClauses.push(`${qCol} LIKE '%${valEscaped}%'`);
        }
      } else {
        const valEscaped = f.value.replace(/'/g, "''");
        const isNum = !isNaN(Number(f.value)) && f.value.trim() !== "";
        const valFormatted = isNum ? f.value : `'${valEscaped}'`;
        whereClauses.push(`${qCol} ${f.operator} ${valFormatted}`);
      }
    });

    const whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    // 2. Build Count Query
    const countSql = `SELECT COUNT(*) AS total FROM ${qTable}${whereString};`;
    
    // 3. Build Select Query
    let selectSql = `SELECT * FROM ${qTable}${whereString}`;
    if (sortColumn) {
      selectSql += ` ORDER BY ${quoteIdent(sortColumn)} ${sortDirection}`;
    }
    selectSql += ` LIMIT ${pageSize} OFFSET ${pageIndex * pageSize};`;

    try {
      const countRes = await adapter.execute(countSql);
      if (countRes.error) {
        setGridError(countRes.error);
        setIsLoading(false);
        return;
      }
      
      const totalCount = countRes.rows.length > 0 ? Number(countRes.rows[0][0]) : 0;
      setTotalRows(totalCount);

      const selectRes = await adapter.execute(selectSql);
      if (selectRes.error) {
        setGridError(selectRes.error);
      } else {
        setColumns(selectRes.columns);
        setRows(selectRes.rows);
      }
    } catch (err: any) {
      setGridError(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedTable, adapter, pageIndex, pageSize, sortColumn, sortDirection, filters, quoteIdent]);

  // Fetch when page, sort, or filters change
  useEffect(() => {
    setPageIndex(0);
    setEditingCell(null);
  }, [selectedTable, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData, pageIndex, pageSize, sortColumn, sortDirection]);

  // Handle cell double-click
  const handleCellDoubleClick = (rowIndex: number, colIndex: number, val: any) => {
    handleCellEditStart(rowIndex, colIndex, val);
  };

  const handleCellEditStart = (rowIndex: number, colIndex: number, val: any) => {
    setEditingCell({
      rowIndex,
      colIndex,
      originalValue: val,
      currentValue: val === null ? "" : String(val),
    });
  };

  // Submit cell edit (Generates UPDATE query and triggers confirmation modal)
  const submitCellEdit = () => {
    if (!editingCell || !tableSchema || !adapter) return;
    const { rowIndex, colIndex, originalValue, currentValue } = editingCell;

    if (String(originalValue) === currentValue) {
      setEditingCell(null);
      return;
    }

    const colName = columns[colIndex];
    
    // Find Primary Key column to target the exact row
    const pkCol = tableSchema.columns.find((c) => c.pk);
    if (!pkCol) {
      alert("Updates are disabled for tables without a Primary Key.");
      setEditingCell(null);
      return;
    }

    const pkColIndex = columns.indexOf(pkCol.name);
    if (pkColIndex === -1) {
      alert(`Primary key column "${pkCol.name}" was not returned in the dataset.`);
      setEditingCell(null);
      return;
    }

    const pkVal = rows[rowIndex][pkColIndex];
    const pkValFormatted = typeof pkVal === "number" ? pkVal : `'${String(pkVal).replace(/'/g, "''")}'`;

    // Format new value
    let valFormatted = "NULL";
    if (currentValue.trim() !== "") {
      const isNum = !isNaN(Number(currentValue)) && currentValue.trim() !== "";
      valFormatted = isNum ? currentValue : `'${currentValue.replace(/'/g, "''")}'`;
    }

    const updateSql = `UPDATE ${quoteIdent(selectedTable)} SET ${quoteIdent(colName)} = ${valFormatted} WHERE ${quoteIdent(pkCol.name)} = ${pkValFormatted};`;

    setPendingUpdate({
      sql: updateSql,
      rowIndex,
      colIndex,
      newValue: currentValue.trim() === "" ? null : currentValue,
    });
    setEditingCell(null);
  };

  // Execute update query
  const handleConfirmUpdate = async () => {
    if (!pendingUpdate || !adapter) return;
    setIsLoading(true);

    try {
      const res = await adapter.execute(pendingUpdate.sql);
      if (res.error) {
        alert(`Failed to execute update:\n${res.error}`);
      } else {
        // Optimistic UI updates
        const updatedRows = [...rows];
        updatedRows[pendingUpdate.rowIndex][pendingUpdate.colIndex] = pendingUpdate.newValue;
        setRows(updatedRows);
      }
    } catch (err: any) {
      alert(`Error during update: ${err.message || err}`);
    } finally {
      setPendingUpdate(null);
      setIsLoading(false);
      fetchData(); // Reload full page to stay in sync
    }
  };

  // Delete row handler
  const handleDeleteRow = (rowIndex: number) => {
    if (!tableSchema || !adapter) return;
    const pkCol = tableSchema.columns.find((c) => c.pk);
    if (!pkCol) {
      alert("Deleting is disabled for tables without a Primary Key.");
      return;
    }
    const pkColIndex = columns.indexOf(pkCol.name);
    if (pkColIndex === -1) {
      alert(`Primary key column "${pkCol.name}" is missing in table.`);
      return;
    }
    const pkVal = rows[rowIndex][pkColIndex];
    const pkValFormatted = typeof pkVal === "number" ? pkVal : `'${String(pkVal).replace(/'/g, "''")}'`;
    const deleteSql = `DELETE FROM ${quoteIdent(selectedTable)} WHERE ${quoteIdent(pkCol.name)} = ${pkValFormatted};`;
    setPendingDeleteSql(deleteSql);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteSql || !adapter) return;
    setIsLoading(true);
    try {
      const res = await adapter.execute(pendingDeleteSql);
      if (res.error) {
        alert(`Deletion failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Deletion error: ${err.message || err}`);
    } finally {
      setPendingDeleteSql(null);
      setIsLoading(false);
      fetchData();
    }
  };

  // Add row form handler
  const handleAddRowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableSchema || !adapter) return;
    setIsLoading(true);

    const cols: string[] = [];
    const vals: string[] = [];

    tableSchema.columns.forEach((c) => {
      const val = newRowData[c.name];
      if (val !== undefined && val.trim() !== "") {
        cols.push(quoteIdent(c.name));
        const isNum = !isNaN(Number(val)) && val.trim() !== "";
        vals.push(isNum ? val : `'${val.replace(/'/g, "''")}'`);
      }
    });

    if (cols.length === 0) {
      alert("Please fill in at least one column.");
      setIsLoading(false);
      return;
    }

    const insertSql = `INSERT INTO ${quoteIdent(selectedTable)} (${cols.join(", ")}) VALUES (${vals.join(", ")});`;

    try {
      const res = await adapter.execute(insertSql);
      if (res.error) {
        alert(`Failed to add record:\n${res.error}`);
      } else {
        setShowAddRowModal(false);
        setNewRowData({});
        fetchData();
      }
    } catch (err: any) {
      alert(`Insert error: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Exporters
  const handleExportCSV = () => {
    if (rows.length === 0) return;
    try {
      const csvHeaders = columns.join(",");
      const csvLines = rows.map(r => 
        r.map(val => {
          if (val === null) return "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
        }).join(",")
      );
      const blob = new Blob([[csvHeaders, ...csvLines].join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedTable}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export CSV");
    }
  };

  const handleExportJSON = () => {
    if (rows.length === 0) return;
    try {
      const formatted = rows.map(r => {
        const obj: any = {};
        columns.forEach((col, idx) => {
          obj[col] = r[idx];
        });
        return obj;
      });
      const blob = new Blob([JSON.stringify(formatted, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedTable}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export JSON");
    }
  };

  // CSV Importer
  const handleCSVImportClick = () => {
    csvImportRef.current?.click();
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adapter) return;
    setIsLoading(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) {
        alert("CSV file is empty or missing data rows.");
        setIsLoading(false);
        return;
      }

      const csvHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
      // Simple parse lines
      let importedCount = 0;
      let failedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
        const colsToInsert: string[] = [];
        const valsToInsert: string[] = [];

        csvHeaders.forEach((header, idx) => {
          const colValue = values[idx];
          if (columns.includes(header) && colValue !== undefined && colValue !== "") {
            colsToInsert.push(quoteIdent(header));
            const isNum = !isNaN(Number(colValue)) && colValue !== "";
            valsToInsert.push(isNum ? colValue : `'${colValue.replace(/'/g, "''")}'`);
          }
        });

        if (colsToInsert.length > 0) {
          const insertSql = `INSERT INTO ${quoteIdent(selectedTable)} (${colsToInsert.join(", ")}) VALUES (${valsToInsert.join(", ")});`;
          const res = await adapter.execute(insertSql);
          if (res.error) failedCount++;
          else importedCount++;
        }
      }

      alert(`Import finished: Successfully loaded ${importedCount} rows. Failed rows: ${failedCount}`);
      fetchData();
    } catch (err: any) {
      alert(`Import error: ${err.message || err}`);
    } finally {
      setIsLoading(false);
      if (csvImportRef.current) csvImportRef.current.value = "";
    }
  };

  const handleAddFilter = () => {
    if (!tableSchema || tableSchema.columns.length === 0) return;
    const defaultCol = tableSchema.columns[0].name;
    setFilters([...filters, { column: defaultCol, operator: "=", value: "" }]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleFilterChange = (index: number, field: keyof Filter, val: string) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], [field]: val };
    setFilters(updated);
  };

  const handleHeaderClick = (colName: string) => {
    if (sortColumn === colName) {
      if (sortDirection === "ASC") {
        setSortDirection("DESC");
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(colName);
      setSortDirection("ASC");
    }
  };

  const totalPages = Math.ceil(totalRows / pageSize);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-xs select-none">
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-border bg-card shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNewRowData({});
              setShowAddRowModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold hover:bg-primary/95 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Row</span>
          </button>
          
          <div className="h-4 w-px bg-border mx-1" />

          {/* Import / Export Controls */}
          <input
            type="file"
            ref={csvImportRef}
            onChange={handleCSVImport}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={handleCSVImportClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent text-foreground font-semibold cursor-pointer"
            title="Import CSV"
          >
            <Upload className="h-3.5 w-3.5 text-green-500" />
            <span>CSV Import</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent text-foreground font-semibold cursor-pointer"
            title="Export CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
            <span>CSV Export</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent text-foreground font-semibold cursor-pointer"
            title="Export JSON"
          >
            <FileCode className="h-3.5 w-3.5 text-purple-500" />
            <span>JSON Export</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAddFilter}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded bg-accent hover:bg-accent/80 text-foreground transition-all cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Filter Builder</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      {filters.length > 0 && (
        <div className="p-3 border-b border-border bg-muted/20 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filters.map((f, idx) => (
              <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded border border-border bg-background">
                <select
                  value={f.column}
                  onChange={(e) => handleFilterChange(idx, "column", e.target.value)}
                  className="bg-transparent text-[11px] focus:outline-none cursor-pointer max-w-[100px] truncate"
                >
                  {tableSchema?.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={f.operator}
                  onChange={(e) => handleFilterChange(idx, "operator", e.target.value as any)}
                  className="bg-transparent text-[11px] font-bold text-primary focus:outline-none cursor-pointer"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value="contains">like</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="IS NULL">null</option>
                </select>

                {f.operator !== "IS NULL" ? (
                  <input
                    type="text"
                    value={f.value}
                    placeholder="value"
                    onChange={(e) => handleFilterChange(idx, "value", e.target.value)}
                    className="flex-1 bg-transparent border-0 border-b border-border focus:border-primary text-[11px] focus:outline-none px-1"
                  />
                ) : (
                  <div className="flex-grow" />
                )}

                <button
                  type="button"
                  onClick={() => handleRemoveFilter(idx)}
                  className="text-muted-foreground hover:text-red-500 rounded p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Main Grid View */}
      <div className="flex-1 min-h-0 relative overflow-auto">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-card border border-border shadow-md rounded-lg p-3">
              <RotateCw className="h-4 w-4 animate-spin" />
              <span>Fetching remote records...</span>
            </div>
          </div>
        )}

        {gridError ? (
          <div className="p-8 flex flex-col items-center justify-center text-center text-red-500 space-y-2">
            <AlertTriangle className="h-10 w-10 text-red-500/20" />
            <h3 className="text-sm font-bold">Failed to load grid rows</h3>
            <p className="text-xs text-muted-foreground max-w-md">{gridError}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded border border-border hover:bg-accent text-foreground transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground/20 mb-2" />
            <span className="text-xs">No records matching current filters.</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse font-sans text-xs">
            {/* Headers */}
            <thead className="bg-card text-muted-foreground sticky top-0 z-5 select-none border-b border-border">
              <tr>
                <th className="px-3 py-2.5 font-semibold border-r border-border/40 w-10 text-center">Actions</th>
                {columns.map((colName) => {
                  const isPk = tableSchema?.columns.find((c) => c.name === colName)?.pk;
                  const isCurrentSort = sortColumn === colName;

                  return (
                    <th
                      key={colName}
                      onClick={() => handleHeaderClick(colName)}
                      className="px-4 py-2.5 font-semibold border-r border-border/40 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1">
                          {isPk && <Key className="h-3 w-3 text-yellow-500 shrink-0" />}
                          <span className={isPk ? "font-bold text-foreground" : ""}>{colName}</span>
                        </span>
                        <ArrowUpDown className={`h-3 w-3 ${isCurrentSort ? "text-primary" : "text-muted-foreground/30"}`} />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Rows */}
            <tbody className="divide-y divide-border/50">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-accent/20 transition-all odd:bg-card/20 group">
                  {/* Actions Column */}
                  <td className="px-2 py-1.5 border-r border-border/20 text-center w-10">
                    <button
                      onClick={() => handleDeleteRow(rIdx)}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-accent/40 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete record"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  {row.map((val, cIdx) => {
                    const isEditing = editingCell?.rowIndex === rIdx && editingCell?.colIndex === cIdx;
                    
                    return (
                      <td
                        key={cIdx}
                        onDoubleClick={() => handleCellDoubleClick(rIdx, cIdx, val)}
                        className={`px-4 py-2 border-r border-border/20 font-mono text-[11px] truncate max-w-[250px] relative cursor-text hover:bg-accent/10 ${
                          isEditing ? "p-0" : ""
                        }`}
                        title={val === null ? "NULL" : String(val)}
                      >
                        {isEditing ? (
                          <div className="flex items-center h-full w-full bg-background border border-primary absolute inset-0 z-10">
                            <input
                              type="text"
                              value={editingCell.currentValue}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  currentValue: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitCellEdit();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="flex-grow h-full bg-transparent px-3 text-[11px] focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={submitCellEdit}
                              className="p-1 text-green-500 hover:bg-accent shrink-0"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="p-1 text-red-500 hover:bg-accent shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : val === null ? (
                          <span className="text-[10px] text-muted-foreground/60 italic font-sans">NULL</span>
                        ) : typeof val === "object" ? (
                          <span className="text-primary truncate">{JSON.stringify(val)}</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 3. Pagination Footer */}
      <div className="h-11 px-4 border-t border-border bg-card shrink-0 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>Total records:</span>
          <span className="font-bold text-foreground">{totalRows}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>Page</span>
            <span className="font-bold text-foreground">{pageIndex + 1}</span>
            <span>of</span>
            <span className="font-bold text-foreground">{totalPages || 1}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0 || isLoading}
              className="p-1 border border-border bg-background hover:bg-accent rounded disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
              disabled={pageIndex >= totalPages - 1 || isLoading}
              className="p-1 border border-border bg-background hover:bg-accent rounded disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. SQL UPDATE Confirmation Modal */}
      {pendingUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-4 space-y-4 text-foreground animate-fadeIn">
            <div className="flex items-start gap-3 text-yellow-500">
              <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold">SQL Update Confirmation</h3>
                <p className="text-xs text-muted-foreground">
                  Confirm executing the SQL generation below against the active connection.
                </p>
              </div>
            </div>

            <div className="bg-muted p-3 rounded font-mono text-[10px] text-foreground border border-border/80 break-all leading-normal max-h-[120px] overflow-y-auto">
              {pendingUpdate.sql}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingUpdate(null)}
                className="px-3 py-1.5 rounded border border-border bg-background hover:bg-accent text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpdate}
                className="px-3.5 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="h-3 w-3" />
                <span>Run Query</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SQL DELETE Confirmation Modal */}
      {pendingDeleteSql && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-4 space-y-4 text-foreground animate-fadeIn">
            <div className="flex items-start gap-3 text-red-500">
              <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold">Delete Row Confirmation</h3>
                <p className="text-xs text-muted-foreground">
                  This action is irreversible. Confirm executing this SQL statement.
                </p>
              </div>
            </div>

            <div className="bg-muted p-3 rounded font-mono text-[10px] text-foreground border border-border/80 break-all leading-normal max-h-[120px] overflow-y-auto">
              {pendingDeleteSql}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingDeleteSql(null)}
                className="px-3 py-1.5 rounded border border-border bg-background hover:bg-accent text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash className="h-3.5 w-3.5" />
                <span>Delete Row</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Add Row Modal */}
      {showAddRowModal && tableSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-4 space-y-4 text-foreground animate-fadeIn flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold tracking-tight">Add New Record to "{selectedTable}"</span>
              <button
                onClick={() => setShowAddRowModal(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddRowSubmit} className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
              {tableSchema.columns.map((c) => {
                const isAuto = c.pk && c.type.toUpperCase().includes("INT");
                
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>{c.name} ({c.type})</span>
                      {isAuto && <span className="text-yellow-500 font-semibold">(AUTOINCREMENT)</span>}
                    </div>
                    <input
                      type="text"
                      disabled={isAuto}
                      placeholder={isAuto ? "Autogenerated primary key" : `Value for ${c.name}`}
                      value={newRowData[c.name] || ""}
                      onChange={(e) => setNewRowData({ ...newRowData, [c.name]: e.target.value })}
                      className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </div>
                );
              })}

              <div className="flex gap-2 justify-end pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="px-3 py-1.5 rounded border border-border bg-background hover:bg-accent text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 cursor-pointer"
                >
                  Insert Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


// Re-expose Layers for null data state illustration compatibility
const Layers = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L12 7.5l5.571 2.25m0 0L21.75 12l-4.179 2.25m0 0l-5.571 3-5.571-3m11.142 0L12 16.5l-5.571-2.25" />
  </svg>
);
