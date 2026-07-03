import dagre from "dagre";

// Estimated dimensions for table nodes to feed into the dagre layout engine
const NODE_WIDTH = 220;
const COLUMN_HEIGHT = 32;
const HEADER_HEIGHT = 48;

interface RFNode {
  id: string;
  data: any;
  position: { x: number; y: number };
  [key: string]: any;
}

interface RFEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: any;
}

/**
 * Calculates node positions using Dagre's directed graph layout engine.
 * Supports horizontal (Left-to-Right 'LR') and vertical (Top-to-Bottom 'TB') orientations.
 */
export function getAutoLayoutedElements(
  nodes: RFNode[],
  edges: RFEdge[],
  direction: "TB" | "LR" = "TB"
): RFNode[] {
  const g = new dagre.graphlib.Graph();
  
  // Set layout defaults. ranksep is separation between columns/rows. nodesep is spacing between elements on same rank.
  g.setGraph({
    rankdir: direction,
    ranksep: 120,
    nodesep: 80,
  });
  
  g.setDefaultEdgeLabel(() => ({}));

  // 1. Register nodes in Dagre with estimated dimensions
  nodes.forEach((node) => {
    const columnsCount = node.data?.columns?.length || 0;
    const estimatedHeight = HEADER_HEIGHT + columnsCount * COLUMN_HEIGHT;
    
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: estimatedHeight,
    });
  });

  // 2. Register edges in Dagre
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // 3. Run Dagre layout calculation
  dagre.layout(g);

  // 4. Map calculated positions back to React Flow coordinates
  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const columnsCount = node.data?.columns?.length || 0;
    const estimatedHeight = HEADER_HEIGHT + columnsCount * COLUMN_HEIGHT;

    return {
      ...node,
      position: {
        // Dagre positions elements from their center; translate to top-left for React Flow
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - estimatedHeight / 2,
      },
    };
  });
}
