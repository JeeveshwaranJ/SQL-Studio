"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Table, Key, Link as LinkIcon, Settings } from "lucide-react";
import { useDesignerStore } from "../../lib/store/designerStore";
import { TableModel } from "../../lib/schema/parser";

interface TableNodeProps {
  id: string; // React Flow Node ID (Table Name)
  data: TableModel;
  selected?: boolean;
}

export default function TableNode({ id: tableName, data, selected }: TableNodeProps) {
  const { 
    selectedTableName, 
    selectedColumnName, 
    setSelectedTable, 
    setSelectedColumn 
  } = useDesignerStore();

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTable(tableName);
  };

  const handleColumnClick = (e: React.MouseEvent, columnName: string) => {
    e.stopPropagation();
    setSelectedColumn(columnName, tableName);
  };

  const isTableSelected = selected || selectedTableName === tableName && !selectedColumnName;

  return (
    <div
      onClick={handleNodeClick}
      className={`min-w-[220px] rounded-lg border-2 bg-card text-foreground shadow-md transition-all ${
        isTableSelected
          ? "border-primary shadow-primary/20 scale-[1.02]"
          : "border-border hover:border-muted-foreground/50"
      }`}
    >
      {/* Node Header (Table Title) */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2.5 rounded-t-lg select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Table className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold truncate tracking-tight">{tableName}</span>
        </div>
        
        <button 
          onClick={handleNodeClick}
          className="rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>

      {/* Columns List */}
      <div className="py-1 divide-y divide-border/10 select-none">
        {data.columns.map((col) => {
          const isFk = data.foreignKeys.some((f) => f.column === col.name);
          const isPk = col.pk;
          const isColSelected = selectedTableName === tableName && selectedColumnName === col.name;

          return (
            <div
              key={col.name}
              onClick={(e) => handleColumnClick(e, col.name)}
              className={`relative flex items-center justify-between px-3 py-1.5 hover:bg-accent/40 cursor-pointer text-xs ${
                isColSelected ? "bg-primary/10 hover:bg-primary/15 font-semibold" : ""
              }`}
            >
              {/* Left Side: Handles & PK Mark & Name */}
              <div className="flex items-center gap-1.5 min-w-0 relative">
                {/* Target Handle for PK (receiving lines) */}
                {isPk && (
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`${tableName}-${col.name}-target`}
                    className="!w-2 !h-2 !left-[-4px] !bg-yellow-500 !border-0"
                    style={{ position: "absolute", top: "50%", transform: "translateY(-50%)" }}
                  />
                )}
                
                {/* Icons */}
                {isPk ? (
                  <span title="Primary Key">
                    <Key className="h-3 w-3 text-yellow-500 shrink-0" />
                  </span>
                ) : isFk ? (
                  <span title="Foreign Key">
                    <LinkIcon className="h-3 w-3 text-primary shrink-0" />
                  </span>
                ) : (
                  <div className="w-3" />
                )}

                <span className="font-mono truncate text-[11px] text-foreground/90">{col.name}</span>
              </div>

              {/* Right Side: Handles & Type */}
              <div className="flex items-center gap-1.5 ml-2 relative shrink-0">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {col.type || "TEXT"}
                </span>

                {/* Source Handle for FK (starting lines) */}
                {isFk && (
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`${tableName}-${col.name}-source`}
                    className="!w-2 !h-2 !right-[-4px] !bg-primary !border-0"
                    style={{ position: "absolute", top: "50%", transform: "translateY(-50%)" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Constraints Footer */}
      {(data.checkConstraints?.length > 0) && (
        <div className="border-t border-border/10 bg-accent/5 px-3 py-1.5 text-[9px] font-mono text-muted-foreground select-none">
          <div className="font-semibold uppercase tracking-wider text-[8px] text-muted-foreground/75 mb-0.5">Checks</div>
          {data.checkConstraints.map((chk, i) => (
            <div key={i} className="truncate" title={`CHECK (${chk})`}>
              • CHECK ({chk})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
