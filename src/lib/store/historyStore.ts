import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useDbStore } from "./dbStore";

export interface HistoryItem {
  id: string;
  sql: string;
  timestamp: string;
  success: boolean;
  executionTime: number;
  error?: string | null;
  pinned?: boolean;
  tags?: string[];
}

interface HistoryState {
  history: HistoryItem[]; // Active history for current database
  historyMap: Record<string, HistoryItem[]>; // dbName -> HistoryItems
  
  // Actions
  addHistoryItem: (sql: string, success: boolean, executionTime: number, error?: string | null) => void;
  removeHistoryItem: (id: string) => void;
  clearHistory: () => void;
  togglePin: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  syncCurrentDbHistory: (dbName: string) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      historyMap: {},

      addHistoryItem: (sql, success, executionTime, error = null) => {
        // Retrieve current active database name dynamically
        const dbName = useDbStore.getState().dbName || "in-memory.db";

        set((state) => {
          const dbHistory = state.historyMap[dbName] || [];
          
          const newItem: HistoryItem = {
            id: crypto.randomUUID?.() || Date.now().toString(),
            sql: sql.trim(),
            timestamp: new Date().toLocaleString(),
            success,
            executionTime,
            error,
            pinned: false,
            tags: [],
          };

          // Filter out duplicate SQL queries unless they are pinned, to keep logs tidy
          const filtered = dbHistory.filter((item) => item.sql !== newItem.sql || item.pinned);
          const updatedDbHistory = [newItem, ...filtered].slice(0, 50);

          const updatedMap = {
            ...state.historyMap,
            [dbName]: updatedDbHistory,
          };

          return {
            historyMap: updatedMap,
            history: updatedDbHistory,
          };
        });
      },

      removeHistoryItem: (id) => {
        const dbName = useDbStore.getState().dbName || "in-memory.db";
        set((state) => {
          const dbHistory = state.historyMap[dbName] || [];
          const updatedDbHistory = dbHistory.filter((item) => item.id !== id);
          
          const updatedMap = {
            ...state.historyMap,
            [dbName]: updatedDbHistory,
          };

          return {
            historyMap: updatedMap,
            history: updatedDbHistory,
          };
        });
      },

      clearHistory: () => {
        const dbName = useDbStore.getState().dbName || "in-memory.db";
        set((state) => {
          const updatedMap = {
            ...state.historyMap,
            [dbName]: [],
          };
          return {
            historyMap: updatedMap,
            history: [],
          };
        });
      },

      togglePin: (id) => {
        const dbName = useDbStore.getState().dbName || "in-memory.db";
        set((state) => {
          const dbHistory = state.historyMap[dbName] || [];
          const updatedDbHistory = dbHistory.map((item) => {
            if (item.id === id) {
              return { ...item, pinned: !item.pinned };
            }
            return item;
          });

          // Sort history so pinned items float to the top
          const sorted = [...updatedDbHistory].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return 0;
          });

          const updatedMap = {
            ...state.historyMap,
            [dbName]: sorted,
          };

          return {
            historyMap: updatedMap,
            history: sorted,
          };
        });
      },

      addTag: (id, tag) => {
        const dbName = useDbStore.getState().dbName || "in-memory.db";
        const cleanTag = tag.trim().toLowerCase();
        if (!cleanTag) return;

        set((state) => {
          const dbHistory = state.historyMap[dbName] || [];
          const updatedDbHistory = dbHistory.map((item) => {
            if (item.id === id) {
              const currentTags = item.tags || [];
              if (!currentTags.includes(cleanTag)) {
                return { ...item, tags: [...currentTags, cleanTag] };
              }
            }
            return item;
          });

          const updatedMap = {
            ...state.historyMap,
            [dbName]: updatedDbHistory,
          };

          return {
            historyMap: updatedMap,
            history: updatedDbHistory,
          };
        });
      },

      removeTag: (id, tag) => {
        const dbName = useDbStore.getState().dbName || "in-memory.db";
        set((state) => {
          const dbHistory = state.historyMap[dbName] || [];
          const updatedDbHistory = dbHistory.map((item) => {
            if (item.id === id) {
              const currentTags = item.tags || [];
              return { ...item, tags: currentTags.filter((t) => t !== tag) };
            }
            return item;
          });

          const updatedMap = {
            ...state.historyMap,
            [dbName]: updatedDbHistory,
          };

          return {
            historyMap: updatedMap,
            history: updatedDbHistory,
          };
        });
      },

      syncCurrentDbHistory: (dbName) => {
        set((state) => {
          const dbHistory = state.historyMap[dbName] || [];
          return { history: dbHistory };
        });
      },
    }),
    {
      name: "sqlstudio-history-v2",
    }
  )
);
