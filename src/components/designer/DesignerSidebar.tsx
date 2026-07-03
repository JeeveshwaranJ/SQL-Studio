"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Trash2, 
  Plus, 
  ChevronLeft, 
  Save, 
  PlusCircle, 
  Link as LinkIcon, 
  AlertTriangle 
} from "lucide-react";
import { useDesignerStore } from "../../lib/store/designerStore";
import { useDbStore } from "../../lib/store/dbStore";
import { TableModel, ColumnModel, ForeignKeyModel } from "../../lib/schema/parser";
import { generateTableMigrationSQL } from "../../lib/schema/ddl";

export default function DesignerSidebar() {
  const { 
    selectedTableName, 
    selectedColumnName, 
    setSelectedTable, 
    setSelectedColumn,
    nodes,
    syncSchema,
    clearSelection
  } = useDesignerStore();

  const { adapter, dbName, refreshSchema } = useDbStore();

  const [draftTable, setDraftTable] = useState<TableModel | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Foreign Key form state
  const [fkCol, setFkCol] = useState("");
  const [fkRefTable, setFkRefTable] = useState("");
  const [fkRefCol, setFkRefCol] = useState("");

  // Check constraint form state
  const [checkExpr, setCheckExpr] = useState("");

  // Retrieve the original table definition from the active nodes
  const originalTable = useMemo(() => {
    const node = nodes.find((n) => n.id === selectedTableName);
    return node ? (node.data as TableModel) : null;
  }, [nodes, selectedTableName]);

  // Sync draftTable with the original when selection changes
  useEffect(() => {
    if (originalTable) {
      setDraftTable(JSON.parse(JSON.stringify(originalTable)));
      setErrorMsg(null);
      setSuccessMsg(null);
      
      // Reset form states
      setFkCol("");
      setFkRefTable("");
      setFkRefCol("");
      setCheckExpr("");
    } else {
      setDraftTable(null);
    }
  }, [originalTable]);

  if (!draftTable || !selectedTableName) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center select-none text-muted-foreground bg-card transition-colors">
        <div className="text-xs">
          <p className="font-semibold">No selection</p>
          <p className="mt-1 max-w-[200px]">Click a table header or column on the canvas to edit its properties.</p>
        </div>
      </div>
    );
  }

  // Column Detail Editing state
  const activeColumn = draftTable.columns.find((c) => c.name === selectedColumnName);

  const handleUpdateColumnField = (colName: string, field: keyof ColumnModel, value: any) => {
    if (!draftTable) return;
    const updatedCols = draftTable.columns.map((c) => {
      if (c.name === colName) {
        // If toggling PK and it's part of composite PKs, handle index reset or toggle
        return { ...c, [field]: value };
      }
      return c;
    });

    // If PK is toggled off and it was the selected column, adjust
    setDraftTable({
      ...draftTable,
      columns: updatedCols,
    });
  };

  const handleRenameColumn = (oldName: string, newName: string) => {
    if (!draftTable || !newName.trim()) return;
    const updatedCols = draftTable.columns.map((c) => {
      if (c.name === oldName) {
        return { ...c, name: newName.trim() };
      }
      return c;
    });

    // Also update foreign keys references within this table
    const updatedFks = draftTable.foreignKeys.map((fk) => {
      if (fk.column === oldName) {
        return { ...fk, column: newName.trim() };
      }
      return fk;
    });

    setDraftTable({
      ...draftTable,
      columns: updatedCols,
      foreignKeys: updatedFks,
    });

    if (selectedColumnName === oldName) {
      setSelectedColumn(newName.trim(), selectedTableName);
    }
  };

  const handleAddColumn = () => {
    if (!draftTable) return;
    // Find a unique default name
    let index = 1;
    let colName = `column_${index}`;
    while (draftTable.columns.some((c) => c.name === colName)) {
      index++;
      colName = `column_${index}`;
    }

    const newCol: ColumnModel = {
      name: colName,
      type: "TEXT",
      pk: false,
      unique: false,
      defaultVal: null,
      notNull: false,
    };

    setDraftTable({
      ...draftTable,
      columns: [...draftTable.columns, newCol],
    });
    setSelectedColumn(colName, selectedTableName);
  };

  const handleDeleteColumn = (colName: string) => {
    if (!draftTable) return;
    
    // Prevent deleting all columns
    if (draftTable.columns.length <= 1) {
      setErrorMsg("A table must contain at least one column.");
      return;
    }

    setDraftTable({
      ...draftTable,
      columns: draftTable.columns.filter((c) => c.name !== colName),
      foreignKeys: draftTable.foreignKeys.filter((fk) => fk.column !== colName),
    });

    if (selectedColumnName === colName) {
      setSelectedColumn(null);
    }
  };

  const handleAddForeignKey = () => {
    if (!draftTable || !fkCol || !fkRefTable || !fkRefCol) return;

    // Check duplicate
    const exists = draftTable.foreignKeys.some(
      (fk) => fk.column === fkCol && fk.refTable === fkRefTable && fk.refColumn === fkRefCol
    );

    if (exists) {
      setErrorMsg("This relationship already exists.");
      return;
    }

    const newFk: ForeignKeyModel = {
      column: fkCol,
      refTable: fkRefTable,
      refColumn: fkRefCol,
    };

    setDraftTable({
      ...draftTable,
      foreignKeys: [...draftTable.foreignKeys, newFk],
    });

    // Reset inputs
    setFkCol("");
    setFkRefTable("");
    setFkRefCol("");
    setErrorMsg(null);
  };

  const handleDeleteForeignKey = (index: number) => {
    if (!draftTable) return;
    setDraftTable({
      ...draftTable,
      foreignKeys: draftTable.foreignKeys.filter((_, i) => i !== index),
    });
  };

  const handleAddCheckConstraint = () => {
    if (!draftTable || !checkExpr.trim()) return;
    
    if (draftTable.checkConstraints.includes(checkExpr.trim())) {
      setErrorMsg("This CHECK constraint is already defined.");
      return;
    }

    setDraftTable({
      ...draftTable,
      checkConstraints: [...draftTable.checkConstraints, checkExpr.trim()],
    });

    setCheckExpr("");
    setErrorMsg(null);
  };

  const handleDeleteCheckConstraint = (index: number) => {
    if (!draftTable) return;
    setDraftTable({
      ...draftTable,
      checkConstraints: draftTable.checkConstraints.filter((_, i) => i !== index),
    });
  };

  const handleDropTable = async () => {
    if (!adapter || !originalTable) return;
    if (!window.confirm(`Are you sure you want to drop the table "${originalTable.name}"? This deletes all data in the table permanently.`)) return;

    try {
      const qTable = adapter.id === "mysql" 
        ? `\`${originalTable.name.replace(/`/g, '``')}\`` 
        : `"${originalTable.name.replace(/"/g, '""')}"`;
      await adapter.execute(`DROP TABLE ${qTable};`);
      
      refreshSchema();
      clearSelection();
    } catch (err: any) {
      setErrorMsg(`Drop failed: ${err.message || err}`);
    }
  };

  const handleApplyChanges = async () => {
    if (!adapter || !originalTable || !draftTable) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate table name
    if (!draftTable.name.trim()) {
      setErrorMsg("Table name cannot be empty.");
      return;
    }

    try {
      // Generate transaction DDL statements
      const ddlStatements = generateTableMigrationSQL(originalTable, draftTable);

      // Filter out SQLite specific PRAGMA commands if running against Postgres/MySQL
      const filteredStatements = ddlStatements.filter((sql) => {
        const sqlTrim = sql.trim().toUpperCase();
        if (adapter.id !== "sqlite" && sqlTrim.startsWith("PRAGMA")) {
          return false;
        }
        return true;
      });

      // Execute sequentially on remote/local database
      for (const sql of filteredStatements) {
        const res = await adapter.execute(sql);
        if (res.error) {
          throw new Error(res.error);
        }
      }

      // Refresh schema triggers designer sync inside store
      refreshSchema();
      
      // Select the updated table name
      setSelectedTable(draftTable.name);
      setSuccessMsg("Changes applied successfully!");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to apply changes: ${err?.message || String(err)}`);
    }
  };

  // Get lists of tables and columns for Foreign Key dropdown selects
  const otherTables = nodes
    .map((n) => n.id)
    .filter((id) => id !== draftTable.name);

  const selectedRefTableObj = nodes.find((n) => n.id === fkRefTable);
  const refColumns = selectedRefTableObj 
    ? (selectedRefTableObj.data as TableModel).columns.map((c) => c.name) 
    : [];

  return (
    <div className="flex flex-col h-full bg-card border-l border-border select-none min-h-0 text-foreground transition-colors">
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-border bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          {activeColumn && (
            <button
              onClick={() => setSelectedColumn(null)}
              className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {activeColumn ? "Column Properties" : "Table Properties"}
          </span>
        </div>
        <button
          onClick={clearSelection}
          className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-5">
        {/* Status Alerts */}
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded border border-red-500/20 bg-red-500/5 text-red-500 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded border border-green-500/20 bg-green-500/5 text-green-500 text-xs">
            {successMsg}
          </div>
        )}

        {/* ------------------ COLUMN DETAILS VIEW ------------------ */}
        {activeColumn ? (
          <div className="space-y-4">
            {/* Column Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Column Name</label>
              <input
                type="text"
                value={activeColumn.name}
                onChange={(e) => handleRenameColumn(activeColumn.name, e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Column Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data Type</label>
              <select
                value={activeColumn.type.toUpperCase()}
                onChange={(e) => handleUpdateColumnField(activeColumn.name, "type", e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="INTEGER">INTEGER</option>
                <option value="TEXT">TEXT</option>
                <option value="REAL">REAL</option>
                <option value="BLOB">BLOB</option>
                <option value="NUMERIC">NUMERIC</option>
                <option value="VARCHAR(255)">VARCHAR(255)</option>
              </select>
            </div>

            {/* Constraints Checklist */}
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Constraints</label>
              
              {/* Primary Key */}
              <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeColumn.pk}
                  onChange={(e) => handleUpdateColumnField(activeColumn.name, "pk", e.target.checked)}
                  className="rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span>Primary Key (PK)</span>
              </label>

              {/* Unique */}
              <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeColumn.unique}
                  onChange={(e) => handleUpdateColumnField(activeColumn.name, "unique", e.target.checked)}
                  className="rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span>Unique (UNIQUE)</span>
              </label>

              {/* Not Null */}
              <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeColumn.notNull}
                  onChange={(e) => handleUpdateColumnField(activeColumn.name, "notNull", e.target.checked)}
                  className="rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span>Not Null (NOT NULL)</span>
              </label>
            </div>

            {/* Default Value */}
            <div className="space-y-1 pt-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Default Value</label>
              <input
                type="text"
                placeholder="NULL or value (e.g. 'Guest', 0)"
                value={activeColumn.defaultVal || ""}
                onChange={(e) => handleUpdateColumnField(activeColumn.name, "defaultVal", e.target.value || null)}
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono placeholder:font-sans"
              />
            </div>

            {/* Drop Column Button */}
            <div className="pt-4">
              <button
                onClick={() => handleDeleteColumn(activeColumn.name)}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded border border-red-500/20 text-red-500 hover:bg-red-500/5 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Column</span>
              </button>
            </div>
          </div>
        ) : (
          /* ------------------ TABLE VIEW ------------------ */
          <div className="space-y-5">
            {/* Table Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Table Name</label>
              <input
                type="text"
                value={draftTable.name}
                onChange={(e) => setDraftTable({ ...draftTable, name: e.target.value })}
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Columns List Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Columns</label>
                <button
                  onClick={handleAddColumn}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/90 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Column</span>
                </button>
              </div>

              <div className="border border-border/30 rounded divide-y divide-border/20 bg-background/50">
                {draftTable.columns.map((c) => (
                  <div
                    key={c.name}
                    onClick={() => setSelectedColumn(c.name, draftTable.name)}
                    className="flex items-center justify-between p-2 hover:bg-accent/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded leading-none ${
                        c.pk ? "bg-yellow-500/10 text-yellow-500" : "bg-muted text-muted-foreground"
                      }`}>
                        {c.pk ? "PK" : "COL"}
                      </span>
                      <span className="text-xs font-medium font-mono truncate">{c.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{c.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Foreign Keys Configuration */}
            <div className="space-y-3 pt-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Foreign Key Relations</label>
              
              {/* Existing FKs */}
              {draftTable.foreignKeys.length > 0 && (
                <div className="space-y-1.5">
                  {draftTable.foreignKeys.map((fk, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded border border-border/40 bg-background/30 text-xs font-mono">
                      <div className="flex items-center gap-1.5 truncate">
                        <LinkIcon className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{fk.column} ➜ {fk.refTable}({fk.refColumn})</span>
                      </div>
                      <button
                        onClick={() => handleDeleteForeignKey(idx)}
                        className="text-muted-foreground hover:text-red-500 rounded p-1 hover:bg-accent transition-colors cursor-pointer"
                        title="Delete relationship"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add FK Form */}
              <div className="p-3 rounded border border-border/50 bg-background/30 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block">Add Relationship</span>
                
                {/* Local Column Select */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block">From Column</span>
                  <select
                    value={fkCol}
                    onChange={(e) => setFkCol(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">-- select column --</option>
                    {draftTable.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Referenced Table Select */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block">References Table</span>
                  <select
                    value={fkRefTable}
                    onChange={(e) => {
                      setFkRefTable(e.target.value);
                      setFkRefCol("");
                    }}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">-- select table --</option>
                    {otherTables.map((tbl) => (
                      <option key={tbl} value={tbl}>
                        {tbl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Referenced Column Select */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block">References Column</span>
                  <select
                    value={fkRefCol}
                    onChange={(e) => setFkRefCol(e.target.value)}
                    disabled={!fkRefTable}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
                  >
                    <option value="">-- select column --</option>
                    {refColumns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleAddForeignKey}
                  disabled={!fkCol || !fkRefTable || !fkRefCol}
                  className="flex w-full items-center justify-center gap-1 text-xs font-semibold py-1.5 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Relationship</span>
                </button>
              </div>
            </div>

            {/* Check Constraints */}
            <div className="space-y-3 pt-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">CHECK Constraints</label>
              
              {/* Existing Check Constraints */}
              {draftTable.checkConstraints.length > 0 && (
                <div className="space-y-1">
                  {draftTable.checkConstraints.map((chk, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded border border-border/40 bg-background/30 text-xs font-mono">
                      <span className="truncate">{chk}</span>
                      <button
                        onClick={() => handleDeleteCheckConstraint(idx)}
                        className="text-muted-foreground hover:text-red-500 rounded p-1 hover:bg-accent transition-colors cursor-pointer"
                        title="Delete constraint"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Check Constraint Form */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. price >= 0"
                  value={checkExpr}
                  onChange={(e) => setCheckExpr(e.target.value)}
                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono placeholder:font-sans"
                />
                <button
                  onClick={handleAddCheckConstraint}
                  disabled={!checkExpr.trim()}
                  className="flex items-center justify-center p-1.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-50 cursor-pointer text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="h-px bg-border pt-2" />

            {/* Danger Drop Table */}
            <div className="pt-2">
              <button
                onClick={handleDropTable}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded border border-red-500/20 text-red-500 hover:bg-red-500/5 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Drop Table</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Action Footer */}
      <div className="p-4 border-t border-border bg-muted/20 flex gap-2 shrink-0">
        <button
          onClick={() => {
            if (originalTable) {
              setDraftTable(JSON.parse(JSON.stringify(originalTable)));
            }
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className="flex-1 text-xs font-semibold py-2 px-3 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleApplyChanges}
          className="flex-1 flex items-center justify-center gap-1 text-xs font-bold py-2 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-sm transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );
}
