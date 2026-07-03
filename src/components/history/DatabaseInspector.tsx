"use client";

import React, { useState } from "react";
import { 
  Database, 
  ChevronRight, 
  ChevronDown, 
  Table, 
  Columns, 
  Key, 
  Link as LinkIcon, 
  Layers, 
  Search, 
  ShieldAlert, 
  Eye 
} from "lucide-react";
import { useDbStore, TableSchema } from "../../lib/store/dbStore";

export default function DatabaseInspector() {
  const { dbName, tables, adapter } = useDbStore();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Tree expansion state
  const [dbExpanded, setDbExpanded] = useState(true);
  const [schemaExpanded, setSchemaExpanded] = useState(true);
  const [tablesNodeExpanded, setTablesNodeExpanded] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [expandedSubsections, setExpandedSubsections] = useState<Record<string, boolean>>({});

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [tableName]: !prev[tableName],
    }));
  };

  const toggleSubsection = (key: string) => {
    setExpandedSubsections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getDriverSchemaName = () => {
    if (!adapter) return "main";
    if (adapter.id === "postgres") return "public";
    if (adapter.id === "mysql") return dbName.split("/").pop() || "default";
    return "main";
  };

  // Filter tables by search term
  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.columns.some((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground select-none">
      {/* Search Filter Header */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tables or columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>
      </div>

      {/* Tree Node Container */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
        {/* Database root level */}
        <div>
          <div 
            onClick={() => setDbExpanded(!dbExpanded)}
            className="flex items-center gap-1 px-1.5 py-1 hover:bg-accent rounded cursor-pointer text-foreground font-semibold"
          >
            {dbExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <Database className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{adapter ? adapter.name : "demo.db"}</span>
          </div>

          {/* Schema Level */}
          {dbExpanded && (
            <div className="pl-3.5 border-l border-border/40 ml-3">
              <div 
                onClick={() => setSchemaExpanded(!schemaExpanded)}
                className="flex items-center gap-1 px-1.5 py-1 hover:bg-accent rounded cursor-pointer text-foreground"
              >
                {schemaExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <Eye className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Schema: {getDriverSchemaName()}</span>
              </div>

              {/* Tables Container Level */}
              {schemaExpanded && (
                <div className="pl-3.5 border-l border-border/40 ml-3">
                  <div 
                    onClick={() => setTablesNodeExpanded(!tablesNodeExpanded)}
                    className="flex items-center gap-1 px-1.5 py-1 hover:bg-accent rounded cursor-pointer text-muted-foreground"
                  >
                    {tablesNodeExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <Layers className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                    <span>Tables ({filteredTables.length})</span>
                  </div>

                  {/* List of Tables */}
                  {tablesNodeExpanded && (
                    <div className="pl-3.5 border-l border-border/40 ml-3 space-y-0.5">
                      {filteredTables.length === 0 ? (
                        <div className="text-[10px] text-muted-foreground italic px-2 py-1">
                          No tables found.
                        </div>
                      ) : (
                        filteredTables.map((table) => {
                          const isTableExpanded = expandedTables[table.name] || searchTerm !== "";
                          return (
                            <div key={table.name}>
                              {/* Table Node Row */}
                              <div 
                                onClick={() => toggleTable(table.name)}
                                className="flex items-center gap-1 px-1.5 py-1 hover:bg-accent rounded cursor-pointer text-foreground/90 font-medium"
                              >
                                {isTableExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                <Table className="h-3 w-3 text-blue-500 shrink-0" />
                                <span className="truncate">{table.name}</span>
                              </div>

                              {/* Columns, Indexes, and Constraints Subsection */}
                              {isTableExpanded && (
                                <div className="pl-3 border-l border-border/30 ml-2 space-y-0.5">
                                  
                                  {/* Columns Subsection */}
                                  <div>
                                    <div 
                                      onClick={() => toggleSubsection(`${table.name}-cols`)}
                                      className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-accent rounded cursor-pointer text-muted-foreground/80 text-[10px]"
                                    >
                                      {expandedSubsections[`${table.name}-cols`] === false ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                                      <Columns className="h-3 w-3 text-cyan-500 shrink-0" />
                                      <span>Columns ({table.columns.length})</span>
                                    </div>

                                    {expandedSubsections[`${table.name}-cols`] !== false && (
                                      <div className="pl-3 border-l border-border/20 ml-2.5 py-0.5 space-y-0.5">
                                        {table.columns.map((col) => {
                                          const isFk = table.foreignKeys.some((f) => f.column === col.name);
                                          return (
                                            <div 
                                              key={col.name}
                                              className="flex items-center justify-between px-1.5 py-0.5 hover:bg-accent/40 rounded"
                                            >
                                              <div className="flex items-center gap-1.5 truncate">
                                                {col.pk ? (
                                                  <span title="Primary Key">
                                                    <Key className="h-2.5 w-2.5 text-yellow-500 shrink-0" />
                                                  </span>
                                                ) : isFk ? (
                                                  <span title="Foreign Key">
                                                    <LinkIcon className="h-2.5 w-2.5 text-primary shrink-0" />
                                                  </span>
                                                ) : (
                                                  <div className="w-2.5" />
                                                )}
                                                <span className={col.pk ? "font-bold text-foreground/95" : "text-foreground/80"}>
                                                  {col.name}
                                                </span>
                                              </div>
                                              <span className="text-[9px] text-muted-foreground shrink-0 pl-2">
                                                {col.type.toLowerCase()}
                                                {col.notNull ? "!" : ""}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Indexes Subsection */}
                                  {table.columns.some((c) => c.unique) && (
                                    <div>
                                      <div 
                                        onClick={() => toggleSubsection(`${table.name}-idx`)}
                                        className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-accent rounded cursor-pointer text-muted-foreground/80 text-[10px]"
                                      >
                                        {expandedSubsections[`${table.name}-idx`] ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                        <Layers className="h-3 w-3 text-indigo-500 shrink-0" />
                                        <span>Indexes</span>
                                      </div>

                                      {expandedSubsections[`${table.name}-idx`] && (
                                        <div className="pl-3 border-l border-border/20 ml-2.5 py-0.5 space-y-0.5">
                                          {table.columns
                                            .filter((c) => c.unique)
                                            .map((col) => (
                                              <div 
                                                key={col.name}
                                                className="flex items-center gap-1.5 px-1.5 py-0.5 text-foreground/70"
                                              >
                                                <div className="w-1 h-1 bg-indigo-500 rounded-full" />
                                                <span>uk_{table.name}_{col.name}</span>
                                                <span className="text-[9px] text-muted-foreground">({col.name})</span>
                                              </div>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Constraints Subsection */}
                                  {(table.checkConstraints?.length > 0 || table.foreignKeys.length > 0) && (
                                    <div>
                                      <div 
                                        onClick={() => toggleSubsection(`${table.name}-const`)}
                                        className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-accent rounded cursor-pointer text-muted-foreground/80 text-[10px]"
                                      >
                                        {expandedSubsections[`${table.name}-const`] ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                        <ShieldAlert className="h-3 w-3 text-red-400 shrink-0" />
                                        <span>Constraints</span>
                                      </div>

                                      {expandedSubsections[`${table.name}-const`] && (
                                        <div className="pl-3 border-l border-border/20 ml-2.5 py-0.5 space-y-1">
                                          {/* Foreign Key Constraints */}
                                          {table.foreignKeys.map((fk, idx) => (
                                            <div 
                                              key={idx}
                                              className="px-1.5 py-0.5 text-[9px] text-foreground/70 leading-normal"
                                            >
                                              <span className="font-semibold text-primary">FK:</span> {fk.column} ➜ {fk.refTable}({fk.refColumn})
                                            </div>
                                          ))}
                                          {/* Check Constraints */}
                                          {table.checkConstraints.map((chk, idx) => (
                                            <div 
                                              key={idx}
                                              className="px-1.5 py-0.5 text-[9px] text-foreground/70 leading-normal bg-accent/20 rounded font-mono break-all"
                                              title={`CHECK (${chk})`}
                                            >
                                              <span className="font-semibold text-red-400">CHECK:</span> {chk}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
