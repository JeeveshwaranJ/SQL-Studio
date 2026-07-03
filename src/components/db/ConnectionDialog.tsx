"use client";

import React, { useState, useEffect } from "react";
import { X, Database, Info, Key, Shield, HelpCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { useDbStore } from "../../lib/store/dbStore";
import { encryptData, decryptData } from "../../lib/db/crypto";

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SavedConnection {
  id: string;
  name: string;
  driver: "postgres" | "mysql";
  ciphertext: string;
}

export default function ConnectionDialog({ isOpen, onClose }: ConnectionDialogProps) {
  const { connectRemoteDb, initDb } = useDbStore();

  const [driver, setDriver] = useState<"sqlite" | "postgres" | "mysql">("sqlite");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [user, setUser] = useState("postgres");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("postgres");
  const [ssl, setSsl] = useState(false);

  // Persistence/Encryption State
  const [saveConnection, setSaveConnection] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [decryptPassphrase, setDecryptPassphrase] = useState("");
  const [showDecryptPrompt, setShowDecryptPrompt] = useState(false);

  // Status Alerts
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [connectStatus, setConnectStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  // Sync port when driver changes
  useEffect(() => {
    if (driver === "postgres") {
      setPort("5432");
      setUser("postgres");
      setDatabase("postgres");
    } else if (driver === "mysql") {
      setPort("3306");
      setUser("root");
      setDatabase("mysql");
    }
    setTestStatus("idle");
    setStatusMsg("");
  }, [driver]);

  // Load saved connection titles on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sqlstudio-connections");
      if (raw) {
        setSavedConnections(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Failed to load saved connections index", e);
    }
  }, []);

  const handleTestConnection = async () => {
    if (driver === "sqlite") return;
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

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectStatus("idle");
    setStatusMsg("");

    if (driver === "sqlite") {
      setConnectStatus("connecting");
      await initDb();
      setConnectStatus("idle");
      onClose();
      return;
    }

    setConnectStatus("connecting");
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

      // If user opted to save connection, encrypt and save ciphertext in localStorage
      if (saveConnection) {
        if (!passphrase) {
          setConnectStatus("error");
          setStatusMsg("A encryption passphrase is required to save this connection.");
          return;
        }

        const payload = JSON.stringify({ host, port, user, password, database, ssl });
        const ciphertext = await encryptData(payload, passphrase);

        const newSaved: SavedConnection = {
          id: crypto.randomUUID?.() || Date.now().toString(),
          name: `${driver.toUpperCase()} - ${host}:${port}/${database}`,
          driver,
          ciphertext,
        };

        const updated = [...savedConnections.filter(c => c.name !== newSaved.name), newSaved];
        localStorage.setItem("sqlstudio-connections", JSON.stringify(updated));
        setSavedConnections(updated);
      }

      // Connect in Zustand store
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

    setStatusMsg("");
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
      setStatusMsg("Connection details decrypted and loaded successfully.");
    } catch (err) {
      setTestStatus("error");
      setStatusMsg("Incorrect passphrase. Decryption failed.");
    }
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
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
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col text-foreground animate-fadeIn scale-[1.01] transition-all">
        {/* Header */}
        <div className="flex h-12 items-center justify-between px-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Database Connection Settings</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConnect} className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[80vh]">
          {/* Status Indicators */}
          {statusMsg && (
            <div className={`flex items-start gap-2 p-3 rounded border text-xs leading-relaxed ${
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

          {/* Load Saved Connection Dropdown */}
          {savedConnections.length > 0 && !showDecryptPrompt && (
            <div className="p-3 border border-border/40 rounded bg-accent/10 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Saved Connection Profiles
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
                  <option value="">-- select profile to load --</option>
                  {savedConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectedSavedId && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSaved(selectedSavedId, e)}
                    className="p-1.5 rounded border border-red-500/20 text-red-500 hover:bg-red-500/5 cursor-pointer"
                    title="Delete connection profile"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Decryption Passphrase Prompt */}
          {showDecryptPrompt && (
            <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 rounded space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-500">
                <Shield className="h-4 w-4" />
                <span>Enter Decryption Passphrase</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                To load these credentials, type the passphrase used to encrypt them.
              </p>
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

          {/* Database Driver Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Database Engine</label>
            <select
              value={driver}
              onChange={(e) => setDriver(e.target.value as any)}
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="sqlite">Demo DB (Local in-browser SQLite WASM)</option>
              <option value="postgres">PostgreSQL (Remote Connection)</option>
              <option value="mysql">MySQL (Remote Connection)</option>
            </select>
          </div>

          {/* SQLite WASM Helper Note */}
          {driver === "sqlite" && (
            <div className="flex gap-2 p-3 rounded border border-border/30 bg-accent/10 text-xs leading-relaxed text-muted-foreground">
              <Info className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
              <p>
                The <strong>Demo DB</strong> runs client-side in your browser. Seeding populates default tables. No connection credentials or server-side ports are required.
              </p>
            </div>
          )}

          {/* Connection Parameters (Remote Postgres/MySQL Only) */}
          {driver !== "sqlite" && (
            <div className="space-y-3.5">
              {/* Host and Port */}
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

              {/* Username and Password */}
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

              {/* Database Name & SSL Checkbox */}
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

              {/* Encryption & Local Storage Saving */}
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
                    Save Connection Profile (Client Encrypted)
                  </span>
                </label>

                {saveConnection && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Key className="h-3 w-3" />
                      <span>Passphrase to Encrypt Credentials</span>
                    </div>
                    <input
                      type="password"
                      required={saveConnection}
                      placeholder="Passphrase"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted-foreground/80 leading-normal">
                      We never store credentials raw. The connection is encrypted on your machine using this passphrase. You will need to enter it when loading this profile.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex gap-2 pt-4 border-t border-border/40 shrink-0">
            {driver !== "sqlite" && (
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === "testing" || connectStatus === "connecting"}
                className="flex-1 text-xs font-semibold py-2 px-3 rounded border border-border bg-background hover:bg-accent disabled:opacity-50 cursor-pointer transition-colors"
              >
                {testStatus === "testing" ? "Testing..." : "Test Connection"}
              </button>
            )}
            <button
              type="submit"
              disabled={connectStatus === "connecting" || testStatus === "testing"}
              className="flex-grow flex items-center justify-center gap-1.5 text-xs font-bold py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
            >
              {connectStatus === "connecting" ? "Connecting..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Re-expose Trash2 for saved connection delete button compatibility
const Trash2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
