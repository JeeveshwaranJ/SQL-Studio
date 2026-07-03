import React, { useRef, useEffect, useState } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import { format } from "sql-formatter";
import { Play, Sparkles, HelpCircle, Minimize2, Plus, X, Bookmark, Save, Trash } from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { useThemeStore } from "../../lib/store/themeStore";
import { useEditorStore } from "../../lib/store/editorStore";
import { validateSqlQuery } from "../../lib/validate/validator";
import { registerSchemaAutocomplete } from "../../lib/editor/autocomplete";

export default function SqlEditor({ onCollapse }: { onCollapse?: () => void }) {
  const { activeQuery, setActiveQuery, runQuery, tables, setValidationProblems } = useDbStore();
  const { theme } = useThemeStore();
  
  // Editor Store state
  const { 
    tabs, 
    activeTabId, 
    selectTab, 
    addTab, 
    closeTab, 
    updateActiveTabQuery,
    snippets,
    saveSnippet,
    deleteSnippet
  } = useEditorStore();

  const [showSnippets, setShowSnippets] = useState(false);
  const [newSnippetName, setNewSnippetName] = useState("");

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const completionProviderRef = useRef<any>(null);

  // Sync active query from dbStore when active tab changes
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    if (activeTab) {
      setActiveQuery(activeTab.query);
    }
  }, [activeTabId]);

  // Setup custom editor themes before mount
  const handleEditorBeforeMount = (monaco: Monaco) => {
    // Dracula Theme
    monaco.editor.defineTheme("dracula", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword", foreground: "ff79c6", fontStyle: "bold" },
        { token: "string", foreground: "f1fa8c" },
        { token: "number", foreground: "bd93f9" },
        { token: "operator", foreground: "ff79c6" },
        { token: "predefined", foreground: "8be9fd" },
      ],
      colors: {
        "editor.background": "#282a36",
        "editor.foreground": "#f8f8f2",
        "editor.lineHighlightBackground": "#44475a25",
        "editorLineNumber.foreground": "#6272a4",
        "editorLineNumber.activeForeground": "#ff79c6",
        "editorCursor.foreground": "#f8f8f0",
      },
    });

    // GitHub Light Theme
    monaco.editor.defineTheme("github-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a737d", fontStyle: "italic" },
        { token: "keyword", foreground: "d73a49", fontStyle: "bold" },
        { token: "string", foreground: "032f62" },
        { token: "number", foreground: "005cc5" },
        { token: "operator", foreground: "d73a49" },
        { token: "predefined", foreground: "e36209" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#24292e",
        "editor.lineHighlightBackground": "#f6f8fa",
        "editorLineNumber.foreground": "#959da5",
        "editorLineNumber.activeForeground": "#24292e",
        "editorCursor.foreground": "#24292e",
      },
    });
  };

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Focus editor on load
    editor.focus();

    // Bind Ctrl+Enter (or Cmd+Enter) to run the query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeSelectedOrFullQuery();
    });

    // Bind Ctrl+Shift+F to format the query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      formatQueryText();
    });

    // Initial registration of autocompletes
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }
    completionProviderRef.current = registerSchemaAutocomplete(monaco, tables);
  };

  // Register completion items when tables change
  useEffect(() => {
    if (monacoRef.current) {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
      completionProviderRef.current = registerSchemaAutocomplete(monacoRef.current, tables);
    }
    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, [tables]);

  // Run Semantic Validator and Update Monaco markers (squiggles)
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const problems = validateSqlQuery(activeQuery, tables);
    setValidationProblems(problems);

    const monaco = monacoRef.current;
    const markers = problems.map((p) => ({
      severity: p.severity === "error"
        ? monaco.MarkerSeverity.Error
        : p.severity === "warning"
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Info,
      message: p.message,
      startLineNumber: p.line,
      startColumn: p.column,
      endLineNumber: p.line,
      endColumn: p.column + 60,
    }));

    monaco.editor.setModelMarkers(model, "sql-validator", markers);
  }, [activeQuery, tables, setValidationProblems]);

  // Listen to problems panel click focus events
  useEffect(() => {
    const handleFocusLine = (e: Event) => {
      const customEvent = e as CustomEvent;
      const editor = editorRef.current;
      if (editor && customEvent.detail) {
        editor.focus();
        editor.setPosition({ lineNumber: customEvent.detail.line, column: customEvent.detail.column || 1 });
        editor.revealLineInCenter(customEvent.detail.line);
      }
    };
    window.addEventListener("focus-editor-line", handleFocusLine);
    return () => window.removeEventListener("focus-editor-line", handleFocusLine);
  }, []);

  const executeSelectedOrFullQuery = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    let query = "";

    if (selection && !selection.isEmpty() && model) {
      query = model.getValueInRange(selection);
    } else {
      query = editor.getValue();
    }

    if (query.trim()) {
      runQuery(query);
    }
  };

  const formatQueryText = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const query = editor.getValue();
    if (!query.trim()) return;

    try {
      const formatted = format(query, {
        language: "sqlite",
        tabWidth: 2,
        keywordCase: "upper",
      });
      setActiveQuery(formatted);
      updateActiveTabQuery(formatted);
    } catch (err) {
      console.error("SQL format error:", err);
    }
  };

  const handleEditorChange = (val: string | undefined) => {
    const value = val || "";
    setActiveQuery(value);
    updateActiveTabQuery(value);
  };

  const handleSaveSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnippetName.trim() || !activeQuery.trim()) return;
    saveSnippet(newSnippetName.trim(), activeQuery);
    setNewSnippetName("");
    alert("Snippet saved successfully!");
  };

  const monacoTheme = theme === "dracula" 
    ? "dracula" 
    : theme === "github-light" 
    ? "github-light" 
    : "vs-dark"; // vscode-dark uses vs-dark

  return (
    <div className="flex flex-col h-full min-h-0 bg-background transition-colors">
      {/* Tab Selector Header */}
      <div className="flex h-9 items-center justify-between border-b border-border bg-card/60 px-2 shrink-0 select-none overflow-x-auto gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-t-md text-xs font-semibold cursor-pointer border-t border-x transition-colors ${
                activeTabId === tab.id
                  ? "bg-background border-border text-foreground"
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/20"
              }`}
            >
              <span className="truncate max-w-[80px] font-mono">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="rounded p-0.5 hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => addTab()}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Open new tab"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSnippets(!showSnippets)}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-border cursor-pointer transition-colors ${
              showSnippets ? "bg-primary/10 border-primary text-primary" : "bg-background hover:bg-accent text-muted-foreground"
            }`}
          >
            <Bookmark className="h-3 w-3" />
            <span>Snippets ({snippets.length})</span>
          </button>
        </div>
      </div>

      {/* Snippet Manager Overlay Section */}
      {showSnippets && (
        <div className="p-3 border-b border-border bg-accent/5 flex gap-4 shrink-0 text-xs select-none">
          {/* Save Snippet Form */}
          <form onSubmit={handleSaveSnippet} className="w-1/2 space-y-2 border-r border-border/60 pr-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Save Active Query as Snippet
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Snippet name"
                value={newSnippetName}
                onChange={(e) => setNewSnippetName(e.target.value)}
                className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground font-bold hover:bg-primary/95 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </form>

          {/* Snippet List */}
          <div className="w-1/2 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Saved Snippets
            </span>
            {snippets.length === 0 ? (
              <span className="text-[11px] text-muted-foreground block py-1">No saved snippets.</span>
            ) : (
              <div className="max-h-[80px] overflow-y-auto space-y-1 pr-1">
                {snippets.map((snip) => (
                  <div
                    key={snip.id}
                    className="flex justify-between items-center p-1.5 rounded border border-border bg-background hover:bg-accent/40 cursor-pointer"
                    onClick={() => {
                      setActiveQuery(snip.sql);
                      updateActiveTabQuery(snip.sql);
                      setShowSnippets(false);
                    }}
                  >
                    <span className="font-semibold text-[11px] truncate max-w-[150px]">{snip.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSnippet(snip.id);
                      }}
                      className="text-muted-foreground hover:text-red-500 p-0.5 rounded cursor-pointer"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Controls Header */}
      <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SQL Query Editor</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground hidden lg:flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            <span>Ctrl+Enter to run | Ctrl+Shift+F to format</span>
          </span>

          <div className="flex items-center gap-1.5">
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-colors"
                title="Collapse SQL Editor"
              >
                <Minimize2 className="h-3.5 w-3.5 text-red-500" />
                <span>Collapse</span>
              </button>
            )}
            <button
              onClick={formatQueryText}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border border-border bg-background hover:bg-accent cursor-pointer transition-colors"
              title="Format query (Ctrl+Shift+F)"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Format</span>
            </button>
            <button
              onClick={executeSelectedOrFullQuery}
              className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-sm transition-colors"
              title="Run query (Ctrl+Enter)"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 min-h-0 relative w-full">
        <Editor
          height="100%"
          language="sql"
          theme={monacoTheme}
          value={activeQuery}
          onChange={handleEditorChange}
          beforeMount={handleEditorBeforeMount}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-geist-mono), Courier New, monospace",
            lineHeight: 20,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            lineNumbers: "on",
            renderLineHighlight: "all",
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            wordWrap: "on",
            tabSize: 2,
            formatOnType: false,
            contextmenu: true,
            quickSuggestions: { other: true, comments: false, strings: false },
          }}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <span className="text-xs text-muted-foreground">Initializing Monaco Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
