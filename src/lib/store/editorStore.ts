import { create } from "zustand";

export interface SqlTab {
  id: string;
  name: string;
  query: string;
}

export interface SqlSnippet {
  id: string;
  name: string;
  sql: string;
}

interface EditorState {
  tabs: SqlTab[];
  activeTabId: string;
  snippets: SqlSnippet[];
  
  // Actions
  addTab: (query?: string, name?: string) => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
  updateActiveTabQuery: (query: string) => void;
  saveSnippet: (name: string, sql: string) => void;
  deleteSnippet: (id: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [
    { id: "tab-1", name: "Query 1", query: "SELECT * FROM users;" }
  ],
  activeTabId: "tab-1",
  snippets: [],

  addTab: (query = "SELECT * FROM users;", name) => {
    const { tabs } = get();
    const newId = `tab-${Math.random().toString(36).substring(2)}`;
    const tabName = name || `Query ${tabs.length + 1}`;
    const newTab = { id: newId, name: tabName, query };
    
    set({
      tabs: [...tabs, newTab],
      activeTabId: newId
    });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return; // Keep at least one tab open
    
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveId = activeTabId;
    
    if (activeTabId === id) {
      // If we closed the active tab, switch to the last tab remaining
      newActiveId = newTabs[newTabs.length - 1].id;
    }
    
    set({
      tabs: newTabs,
      activeTabId: newActiveId
    });
  },

  selectTab: (id) => {
    set({ activeTabId: id });
  },

  updateActiveTabQuery: (query) => {
    const { tabs, activeTabId } = get();
    const updated = tabs.map((t) => {
      if (t.id === activeTabId) {
        return { ...t, query };
      }
      return t;
    });
    set({ tabs: updated });
  },

  saveSnippet: (name, sql) => {
    const { snippets } = get();
    const id = `snip-${Math.random().toString(36).substring(2)}`;
    const newSnippet = { id, name, sql };
    
    set({ snippets: [...snippets, newSnippet] });
  },

  deleteSnippet: (id) => {
    const { snippets } = get();
    set({ snippets: snippets.filter((s) => s.id !== id) });
  }
}));
