"use client";

import React, { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import { 
  Download, 
  Image as ImageIcon, 
  FileCode, 
  Maximize, 
  LayoutGrid, 
  RotateCw,
  Plus
} from "lucide-react";
import { useDesignerStore } from "../../lib/store/designerStore";
import { useDbStore } from "../../lib/store/dbStore";
import TableNode from "./TableNode";

// Import `@xyflow/react` styles
import "@xyflow/react/dist/style.css";

// Define node types mapper
const nodeTypes = {
  table: TableNode,
};

function CanvasInner() {
  const { 
    nodes, 
    edges, 
    setNodes, 
    setEdges, 
    updateNodePosition,
    autoLayout,
    setSelectedTable,
    clearSelection
  } = useDesignerStore();

  const { adapter, dbName } = useDbStore();
  const { fitView } = useReactFlow();

  // Handle node selection, dragging, and layout updates
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updatedEdges = applyEdgeChanges(changes, edges);
      setEdges(updatedEdges);
    },
    [edges, setEdges]
  );

  const onNodeDragStop = useCallback(
    (event: any, node: any) => {
      // Save dragged positions in designerStore
      updateNodePosition(dbName, node.id, node.position);
    },
    [dbName, updateNodePosition]
  );

  const handleAutoLayout = useCallback(
    (direction: "TB" | "LR") => {
      autoLayout(direction);
      // Wait brief moment for layout state update, then save positions to localStorage
      setTimeout(() => {
        const currentNodes = useDesignerStore.getState().nodes;
        currentNodes.forEach((node) => {
          updateNodePosition(dbName, node.id, node.position);
        });
        fitView({ duration: 300 });
      }, 50);
    },
    [autoLayout, dbName, updateNodePosition, fitView]
  );

  // Trigger diagram exports (PNG, SVG, or PDF)
  const handleExport = useCallback(
    (type: "png" | "svg" | "pdf") => {
      const flowElement = document.querySelector(".react-flow") as HTMLElement;
      if (!flowElement) return;

      // Hide controls overlay temporarily during snapshot
      const controlsElement = document.querySelector(".react-flow__controls") as HTMLElement;
      if (controlsElement) controlsElement.style.display = "none";

      const options = {
        backgroundColor: "var(--background)",
        style: {
          transform: "none",
        },
      };

      const renderImg = type === "svg" ? toSvg : toPng;

      renderImg(flowElement, options)
        .then((dataUrl) => {
          if (type === "pdf") {
            const printWindow = window.open("", "_blank");
            if (printWindow) {
              printWindow.document.write(`
                <html>
                  <head>
                    <title>${dbName} ER Diagram</title>
                    <style>
                      @page { size: landscape; margin: 0; }
                      body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
                      img { max-width: 95%; max-height: 95%; object-fit: contain; }
                    </style>
                  </head>
                  <body>
                    <img src="${dataUrl}" onload="window.print();setTimeout(() => window.close(), 500);" />
                  </body>
                </html>
              `);
              printWindow.document.close();
            }
          } else {
            const link = document.createElement("a");
            link.download = `${dbName.split(".")[0]}-er-diagram.${type}`;
            link.href = dataUrl;
            link.click();
          }
        })
        .catch((err) => {
          console.error(`Failed to export diagram as ${type}:`, err);
        })
        .finally(() => {
          // Restore controls overlay visibility
          if (controlsElement) controlsElement.style.display = "flex";
        });
    },
    [dbName]
  );

  const handleCreateNewTable = async () => {
    if (!adapter) return;
    
    // Find unique name
    let index = 1;
    let tableName = `new_table_${index}`;
    const tableNames = nodes.map((n) => n.id);
    while (tableNames.includes(tableName)) {
      index++;
      tableName = `new_table_${index}`;
    }

    let createSql = `CREATE TABLE "${tableName}" ("id" INTEGER PRIMARY KEY AUTOINCREMENT);`;
    if (adapter.id === "postgres") {
      createSql = `CREATE TABLE "${tableName}" ("id" SERIAL PRIMARY KEY);`;
    } else if (adapter.id === "mysql") {
      createSql = `CREATE TABLE \`${tableName}\` (\`id\` INT AUTO_INCREMENT PRIMARY KEY);`;
    }

    try {
      const res = await adapter.execute(createSql);
      if (res.error) {
        alert("Failed to create table:\n" + res.error);
        return;
      }
      
      useDbStore.getState().refreshSchema();
      setSelectedTable(tableName);
    } catch (err: any) {
      alert("Failed to create table:\n" + err.message);
    }
  };

  return (
    <div className="flex-grow h-full flex flex-col min-h-0 relative select-none">
      {/* Top Toolbar overlay */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2 select-none">
        <button
          onClick={handleCreateNewTable}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg shadow bg-primary text-primary-foreground hover:bg-primary/95 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Table</span>
        </button>

        <div className="flex items-center gap-1 bg-card border border-border/80 shadow p-1 rounded-lg">
          <button
            onClick={() => handleAutoLayout("TB")}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded hover:bg-accent text-foreground transition-all cursor-pointer"
            title="Auto-align Top-to-Bottom"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Vertical Align</span>
          </button>
          <button
            onClick={() => handleAutoLayout("LR")}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded hover:bg-accent text-foreground transition-all cursor-pointer"
            title="Auto-align Left-to-Right"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Horizontal Align</span>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-card border border-border/80 shadow p-1 rounded-lg">
          <button
            onClick={() => handleExport("png")}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded hover:bg-accent text-foreground transition-all cursor-pointer"
            title="Export ER Diagram as PNG Image"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Export PNG</span>
          </button>
          <button
            onClick={() => handleExport("svg")}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded hover:bg-accent text-foreground transition-all cursor-pointer"
            title="Export ER Diagram as Vector SVG"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Export SVG</span>
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded hover:bg-accent text-foreground transition-all cursor-pointer"
            title="Export ER Diagram as PDF Document"
          >
            <Download className="h-3.5 w-3.5 text-red-500" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* React Flow Workspace Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        onPaneClick={clearSelection}
        fitView
        className="flex-1 min-h-0 w-full"
      >
        <Background gap={16} size={1} color="var(--border)" className="opacity-60" />
        <Controls showFitView={true} className="!bg-card !border-border !text-foreground [&>button]:!border-border [&>button]:!bg-card [&>button]:hover:!bg-accent [&>button>svg]:!fill-foreground" />
      </ReactFlow>
    </div>
  );
}

export default function DesignerCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
