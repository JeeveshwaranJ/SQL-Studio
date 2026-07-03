import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Database } from "sql.js";
import { parseDbSchema, SchemaModel, TableModel } from "../schema/parser";
import { getAutoLayoutedElements } from "../schema/layout";
import { useDbStore } from "./dbStore";

export interface NodePosition {
  x: number;
  y: number;
}

export interface DesignerState {
  // Selection state
  selectedTableName: string | null;
  selectedColumnName: string | null;
  
  // React Flow state
  nodes: any[];
  edges: any[];
  
  // Table positions index: Record<dbName, Record<tableName, Position>>
  savedPositions: Record<string, Record<string, NodePosition>>;

  // Actions
  setSelectedTable: (tableName: string | null) => void;
  setSelectedColumn: (columnName: string | null, tableName?: string | null) => void;
  setNodes: (nodes: any[]) => void;
  setEdges: (edges: any[]) => void;
  updateNodePosition: (dbName: string, tableName: string, position: NodePosition) => void;
  syncSchema: (dbOrTables: any, dbName: string) => void;
  autoLayout: (direction?: "TB" | "LR") => void;
  clearSelection: () => void;
}

export const useDesignerStore = create<DesignerState>()(
  persist(
    (set, get) => ({
      selectedTableName: null,
      selectedColumnName: null,
      nodes: [],
      edges: [],
      savedPositions: {},

      setSelectedTable: (tableName) => {
        set({ 
          selectedTableName: tableName,
          selectedColumnName: null // Reset column selection when changing tables
        });
      },

      setSelectedColumn: (columnName, tableName = null) => {
        if (tableName) {
          set({
            selectedTableName: tableName,
            selectedColumnName: columnName,
          });
        } else {
          set({ selectedColumnName: columnName });
        }
      },

      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),

      updateNodePosition: (dbName, tableName, position) => {
        set((state) => {
          const dbPositions = state.savedPositions[dbName] || {};
          const updatedPositions = {
            ...state.savedPositions,
            [dbName]: {
              ...dbPositions,
              [tableName]: position,
            },
          };
          return { savedPositions: updatedPositions };
        });
      },

      syncSchema: (dbOrTables, dbName) => {
        let schemaTables: any[] = [];
        if (Array.isArray(dbOrTables)) {
          schemaTables = dbOrTables;
        } else if (dbOrTables && typeof dbOrTables.getSchema === "function") {
          schemaTables = useDbStore.getState().tables;
        } else if (dbOrTables && typeof dbOrTables.exec === "function") {
          schemaTables = parseDbSchema(dbOrTables).tables;
        } else {
          schemaTables = useDbStore.getState().tables;
        }

        const { savedPositions } = get();
        const dbPositions = savedPositions[dbName] || {};

        // 1. Map TableModels to React Flow nodes
        let newNodes: any[] = schemaTables.map((table) => {
          // Retrieve saved position or default
          const position = dbPositions[table.name] || { x: 0, y: 0 };
          return {
            id: table.name,
            type: "table",
            data: table,
            position,
          };
        });

        // 2. Map relationships to React Flow edges
        const newEdges: any[] = [];
        schemaTables.forEach((table: any) => {
          table.foreignKeys.forEach((fk: any, idx: number) => {
            const edgeId = `edge-${table.name}-${fk.column}-to-${fk.refTable}-${fk.refColumn}`;
            newEdges.push({
              id: edgeId,
              source: table.name,
              target: fk.refTable,
              sourceHandle: `${table.name}-${fk.column}-source`,
              targetHandle: `${fk.refTable}-${fk.refColumn}-target`,
              type: "smoothstep",
              style: { strokeWidth: 2, stroke: "var(--primary)" },
              markerEnd: {
                type: "arrowclosed",
                color: "var(--primary)",
                width: 15,
                height: 15,
              },
            });
          });
        });

        // 3. If there are no saved positions for any tables, trigger initial Dagre auto-layout
        const hasNoPositions = schemaTables.every((t) => !dbPositions[t.name]);
        if (hasNoPositions && schemaTables.length > 0) {
          newNodes = getAutoLayoutedElements(newNodes, newEdges, "TB");
          
          // Save layouted positions back to state so they persist
          const newDbPositions: Record<string, NodePosition> = {};
          newNodes.forEach((node) => {
            newDbPositions[node.id] = node.position;
          });

          set((state) => ({
            nodes: newNodes,
            edges: newEdges,
            savedPositions: {
              ...state.savedPositions,
              [dbName]: newDbPositions,
            },
          }));
        } else {
          set({
            nodes: newNodes,
            edges: newEdges,
          });
        }
      },

      autoLayout: (direction = "TB") => {
        const { nodes, edges } = get();
        if (nodes.length === 0) return;
        
        const layoutedNodes = getAutoLayoutedElements(nodes, edges, direction);
        
        // Find which database we are layouting for
        // We can save layouted positions to state. Since autoLayout runs on the current nodes,
        // we'll update coordinates in the canvas component which saves it when triggered.
        set({ nodes: layoutedNodes });
      },

      clearSelection: () => {
        set({
          selectedTableName: null,
          selectedColumnName: null,
        });
      },
    }),
    {
      name: "sqlstudio-designer",
      partialize: (state) => ({ savedPositions: state.savedPositions }), // Only persist positions, keep runtime UI state transient
    }
  )
);
