"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Terminal, Database, Upload, Download, Sparkles, AlertCircle, SunMoon, Command } from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { useThemeStore, AppTheme } from "../../lib/store/themeStore";

interface CommandItem {
  name: string;
  description: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { runQuery, activeQuery, exportDb, initDb } = useDbStore();
  const { theme, setTheme } = useThemeStore();
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const toggleTheme = () => {
    const nextTheme: AppTheme = theme === "vscode-dark" ? "github-light" : "vscode-dark";
    setTheme(nextTheme);
  };

  const commands: CommandItem[] = [
    {
      name: "Run SQL Query",
      description: "Execute the active query in the Monaco editor",
      shortcut: "Ctrl+Enter",
      icon: <Terminal className="h-4 w-4 text-green-500" />,
      action: () => {
        if (activeQuery) runQuery(activeQuery);
      },
    },
    {
      name: "Export SQLite File",
      description: "Save active SQLite database binary locally",
      shortcut: "Ctrl+E",
      icon: <Download className="h-4 w-4 text-blue-500" />,
      action: () => exportDb(),
    },
    {
      name: "Reset Local Database",
      description: "Wipe all schemas and return to default sandbox",
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      action: () => {
        if (window.confirm("Are you sure you want to reset? This wipes current table data.")) {
          initDb();
        }
      },
    },
    {
      name: "Toggle Color Theme",
      description: "Switch between Dark and Light workspaces",
      shortcut: "Ctrl+Shift+T",
      icon: <SunMoon className="h-4 w-4 text-yellow-500" />,
      action: () => toggleTheme(),
    },
  ];

  // Listen to keyboard shortcut triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
        setSelectedIndex(0);
      }
      
      // Close palette: Escape
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCommands = commands.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (cmd: CommandItem) => {
    cmd.action();
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs p-4 pt-[15vh] select-none">
      <div 
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col text-foreground animate-fadeIn"
        onKeyDown={handleKeyDown}
      >
        {/* Search header */}
        <div className="flex h-11 items-center px-3 border-b border-border bg-muted/20 gap-2 shrink-0">
          <Search className="h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Type a command or search actions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-0 focus:outline-none text-xs text-foreground py-1"
            autoFocus
          />
          <div className="flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground font-mono">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </div>

        {/* List of actions */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 max-h-[250px] space-y-0.5">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">No matching commands found.</div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.name}
                onClick={() => handleSelect(cmd)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                  selectedIndex === idx ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={selectedIndex === idx ? "text-primary-foreground" : ""}>{cmd.icon}</div>
                  <div>
                    <span className="block">{cmd.name}</span>
                    <span className={`text-[10px] ${selectedIndex === idx ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                      {cmd.description}
                    </span>
                  </div>
                </div>
                {cmd.shortcut && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-border ${
                    selectedIndex === idx ? "bg-primary-foreground/15 border-transparent text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {cmd.shortcut}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
