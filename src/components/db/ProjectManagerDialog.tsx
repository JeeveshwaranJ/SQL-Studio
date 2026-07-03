"use client";

import React, { useState, useEffect } from "react";
import { X, Database, Folder, PlusCircle, Shield, Key, AlertCircle, CheckCircle2, Trash2, Clock, Terminal } from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { DATABASE_TEMPLATES, DatabaseTemplate } from "../../lib/database/templates";
import { encryptData, decryptData } from "../../lib/db/crypto";
import { ProjectMetadata } from "../../lib/storage/indexedDbAdapter";

interface ProjectManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SavedConnection {
  id: string;
  name: string;
  driver: "postgres" | "mysql";
  ciphertext: string;
}

export default function ProjectManagerDialog({ isOpen, onClose }: ProjectManagerDialogProps) {
  const { 
    connectRemoteDb, 
    initDb, 
    createProjectFromTemplate, 
    loadSavedProject, 
    deleteSavedProject,
    projectId: activeProjectId
  } = useDbStore();

  const [activeTab, setActiveTab] = useState<"recent" | "new" | "remote">("recent");

  // Recent Projects
  const [recentProjects, setRecentProjects] = useState<ProjectMetadata[]>([]);

  // New Project Form
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);

  // Connection parameters
  const [driver, setDriver] = useState<"postgres" | "mysql">("postgres");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [user, setUser] = useState("postgres");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("postgres");
  const [ssl, setSsl] = useState(false);

  // Save/Load Encrypted Profile
  const [saveConnection, setSaveConnection] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [decryptPassphrase, setDecryptPassphrase] = useState("");
  const [showDecryptPrompt, setShowDecryptPrompt] = useState(false);

  // Status message
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [connectStatus, setConnectStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  // Load Saved Index & Projects list
  const refreshProjectsList = async () => {
    try {
      const { persistenceManager } = await import("../../lib/storage/persistenceManager");
      const list = await persistenceManager.listProjects();
      setRecentProjects(list);
    } catch (e) {
      console.error("Failed to load projects list", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshProjectsList();
      try {
        const raw = localStorage.getItem("sqlstudio-connections");
        if (raw) setSavedConnections(JSON.parse(raw));
      } catch {}
    }
  }, [isOpen]);

  useEffect(() => {
    if (driver === "postgres") {
      setPort("5432");
      setUser("postgres");
      setDatabase("postgres");
    } else {
      setPort("3306");
      setUser("root");
      setDatabase("mysql");
    }
    setTestStatus("idle");
    setStatusMsg("");
  }, [driver]);

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setConnectStatus("connecting");
    try {
      const template = DATABASE_TEMPLATES[selectedTemplateIndex];
      await createProjectFromTemplate(newProjectName.trim(), template.sql);
      setConnectStatus("idle");
      onClose();
    } catch (err: any) {
      setConnectStatus("error");
      setStatusMsg(err.message || String(err));
    }
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setStatusMsg("");
    try {
      const response = await fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver, host, port, user, password, database, ssl }),
      });
      const data = await response.json();
      if (response.ok) {
        setTestStatus("success");
        setStatusMsg("Connection test successful! Database is reachable.");
      } else {
        setTestStatus("error");
        setStatusMsg(data.error || "Connection failed.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setStatusMsg(err.message || String(err));
    }
  };

  const handleConnectRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectStatus("connecting");
    setStatusMsg("");
    try {
      const response = await fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver, host, port, user, password, database, ssl }),
      });
      const data = await response.json();
      if (!response.ok) {
        setConnectStatus("error");
        setStatusMsg(data.error || "Failed to establish connection.");
        return;
      }

      if (saveConnection) {
        if (!passphrase) {
          setConnectStatus("error");
          setStatusMsg("An encryption passphrase is required to save connection.");
          return;
        }
        const payload = JSON.stringify({ host, port, user, password, database, ssl });
        const ciphertext = await encryptData(payload, passphrase);
        const newSaved: SavedConnection = {
          id: Math.random().toString(36).substring(2),
          name: `${driver.toUpperCase()} - ${host}:${port}/${database}`,
          driver,
          ciphertext,
        };
        const updated = [...savedConnections.filter(c => c.name !== newSaved.name), newSaved];
        localStorage.setItem("sqlstudio-connections", JSON.stringify(updated));
        setSavedConnections(updated);
      }

      await connectRemoteDb(driver, data.sessionId, host, port, database);
      setConnectStatus("idle");
      onClose();
    } catch (err: any) {
      setConnectStatus("error");
      setStatusMsg(err.message || String(err));
    }
  };

  const handleDecryptAndLoad = async () => {
    const conn = savedConnections.find(c => c.id === selectedSavedId);
    if (!conn) return;
    try {
      const decryptedText = await decryptData(conn.ciphertext, decryptPassphrase);
      const data = JSON.parse(decryptedText);
      setDriver(conn.driver);
      setHost(data.host);
      setPort(data.port);
      setUser(data.user);
      setPassword(data.password);
      setDatabase(data.database);
      setSsl(data.ssl);
      setShowDecryptPrompt(false);
      setDecryptPassphrase("");
      setTestStatus("success");
      setStatusMsg("Connection credentials decrypted successfully.");
    } catch {
      setTestStatus("error");
      setStatusMsg("Incorrect passphrase. Decryption failed.");
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this project? All tables and data will be wiped.")) return;
    await deleteSavedProject(id);
    refreshProjectsList();
  };

  const handleDeleteSavedConn = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedConnections.filter(c => c.id !== id);
    localStorage.setItem("sqlstudio-connections", JSON.stringify(updated));
    setSavedConnections(updated);
    if (selectedSavedId === id) {
      setSelectedSavedId("");
      setShowDecryptPrompt(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col text-foreground animate-fadeIn scale-[1.01] transition-all max-h-[85vh]">
        {/* Header */}
        <div className="flex h-12 items-center justify-between px-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="h-4.5 w-4.5 text-primary animate-pulse" />
            <span className="text-sm font-bold tracking-tight">Project & Connection Manager</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Custom Tabs */}
        <div className="flex border-b border-border bg-card/50 shrink-0 px-4 pt-1 gap-1">
          <button
            onClick={() => setActiveTab("recent")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "recent"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            Recent Projects
          </button>
          <button
            onClick={() => {
              setActiveTab("new");
              setNewProjectName("");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "new"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New From Template
          </button>
          <button
            onClick={() => setActiveTab("remote")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "remote"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Remote Server Connection
          </button>
        </div>

        {/* Tab Body Contents */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          {statusMsg && (
            <div className={`mb-3 flex items-start gap-2 p-3 rounded border text-xs leading-relaxed ${
              testStatus === "success" 
                ? "border-green-500/20 bg-green-500/5 text-green-500" 
                : "border-red-500/20 bg-red-500/5 text-red-500"
            }`}>
              {testStatus === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* TAB 1: RECENT PROJECTS */}
          {activeTab === "recent" && (
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Saved Offline Databases
              </span>
              
              {recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded text-muted-foreground text-center">
                  <Folder className="h-10 w-10 text-muted-foreground/15 mb-2" />
                  <span className="text-xs">No saved projects found. Create one from the template tab or import a DB file.</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                  {recentProjects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        loadSavedProject(proj.id);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-3 rounded border transition-colors cursor-pointer group select-none ${
                        activeProjectId === proj.id
                          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                          : "border-border/60 hover:bg-accent/40 bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Database className="h-5 w-5 text-blue-500" />
                        <div>
                          <span className="text-xs font-bold font-mono text-foreground block">{proj.name}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="uppercase px-1 rounded bg-muted text-[8px] font-bold font-mono border border-border">
                              {proj.dialect}
                            </span>
                            <Clock className="h-3 w-3" />
                            <span>Last edited: {new Date(proj.updatedAt).toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="text-muted-foreground hover:text-red-500 p-1.5 rounded hover:bg-accent cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150"
                        title="Delete project permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEW FROM TEMPLATE */}
          {activeTab === "new" && (
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My E-commerce Project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Choose Database Schema Template</label>
                <div className="grid grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto pr-1">
                  {DATABASE_TEMPLATES.map((tmpl, idx) => (
                    <div
                      key={tmpl.name}
                      onClick={() => setSelectedTemplateIndex(idx)}
                      className={`p-3 rounded border text-left cursor-pointer transition-all select-none ${
                        selectedTemplateIndex === idx
                          ? "border-primary/60 bg-primary/5"
                          : "border-border bg-card/60 hover:bg-accent/40"
                      }`}
                    >
                      <span className="text-xs font-bold block">{tmpl.name}</span>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                        {tmpl.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={connectStatus === "connecting"}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-sm transition-colors"
              >
                {connectStatus === "connecting" ? "Creating Project..." : "Create Project from Template"}
              </button>
            </form>
          )}

          {/* TAB 3: REMOTE SERVER CONNECTION */}
          {activeTab === "remote" && (
            <form onSubmit={handleConnectRemote} className="space-y-3.5">
              {/* Saved connections dropdown */}
              {savedConnections.length > 0 && !showDecryptPrompt && (
                <div className="p-3 border border-border/40 rounded bg-accent/5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Saved connection profiles
                  </span>
                  <div className="flex gap-2">
                    <select
                      value={selectedSavedId}
                      onChange={(e) => {
                        setSelectedSavedId(e.target.value);
                        if (e.target.value) setShowDecryptPrompt(true);
                      }}
                      className="flex-1 text-xs bg-background border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
                    >
                      <option value="">-- select connection profile --</option>
                      {savedConnections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {selectedSavedId && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSavedConn(selectedSavedId, e)}
                        className="p-1.5 rounded border border-red-500/20 text-red-500 hover:bg-red-500/5 cursor-pointer"
                        title="Delete credentials profile"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Decrypt Creds Prompt */}
              {showDecryptPrompt && (
                <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 rounded space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-500">
                    <Shield className="h-4 w-4" />
                    <span>Enter Decryption Passphrase</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Passphrase"
                      value={decryptPassphrase}
                      onChange={(e) => setDecryptPassphrase(e.target.value)}
                      className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleDecryptAndLoad}
                      className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/95 cursor-pointer"
                    >
                      Decrypt
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDecryptPrompt(false);
                        setSelectedSavedId("");
                      }}
                      className="px-3 py-1.5 rounded border border-border bg-background hover:bg-accent text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Connection inputs */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dialect / Engine</label>
                <select
                  value={driver}
                  onChange={(e) => setDriver(e.target.value as any)}
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Host</label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Port</label>
                  <input
                    type="text"
                    required
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Username</label>
                  <input
                    type="text"
                    required
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Database</label>
                  <input
                    type="text"
                    required
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center h-9 pl-1">
                  <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ssl}
                      onChange={(e) => setSsl(e.target.checked)}
                      className="rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                    />
                    <span>SSL Mode</span>
                  </label>
                </div>
              </div>

              {/* Encryption options */}
              <div className="p-3 border border-border/40 rounded bg-accent/5 space-y-3">
                <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveConnection}
                    onChange={(e) => setSaveConnection(e.target.checked)}
                    className="rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="font-semibold text-primary flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Save connection profile encrypted
                  </span>
                </label>

                {saveConnection && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Passphrase</span>
                    <input
                      type="password"
                      required={saveConnection}
                      placeholder="Passphrase"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === "testing" || connectStatus === "connecting"}
                  className="flex-1 text-xs font-semibold py-2 px-3 rounded border border-border bg-background hover:bg-accent disabled:opacity-50 cursor-pointer"
                >
                  {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                <button
                  type="submit"
                  disabled={connectStatus === "connecting"}
                  className="flex-grow flex items-center justify-center gap-1.5 text-xs font-bold py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {connectStatus === "connecting" ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
