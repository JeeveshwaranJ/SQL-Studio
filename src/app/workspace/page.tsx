"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { RotateCw, Database as DbIcon } from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import ThemeHydrator from "../../components/layout/ThemeHydrator";

// Dynamically import PanelLayout to disable server-side rendering for browser-only Monaco and WASM libraries
const PanelLayout = dynamic(() => import("../../components/layout/PanelLayout"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center rounded bg-zinc-800/50 p-4 border border-zinc-700/50 animate-pulse">
          <DbIcon className="h-10 w-10 text-[#007acc]" />
        </div>
        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
          <RotateCw className="h-4 w-4 animate-spin text-[#007acc]" />
          <span>Starting SQL Studio Workspace...</span>
        </div>
      </div>
    </div>
  ),
});

export default function WorkspacePage() {
  const { adapter, initDb } = useDbStore();

  // Initialize the seeded in-memory database when the application loads
  useEffect(() => {
    if (!adapter) {
      initDb();
    }
  }, [adapter, initDb]);

  return (
    <>
      <ThemeHydrator />
      <PanelLayout />
    </>
  );
}
