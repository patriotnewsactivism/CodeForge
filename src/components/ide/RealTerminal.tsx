/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — REAL TERMINAL PANEL (UPGRADE #1)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Replaces the simulated terminal with a real xterm.js terminal
 * connected to a Convex action that executes shell commands via
 * a sandboxed Node.js child_process (or Deno on the server).
 *
 * Features:
 * - Real xterm.js rendering (same as VS Code)
 * - Tab support: multiple terminal instances
 * - Runs: npm install, npm run dev, git, node, python, etc.
 * - Streaming output back to client via Convex real-time
 * - Kill process button
 * - Command history (↑/↓)
 * - Copy/paste support
 * - Resize-aware (fits terminal to panel)
 */

// src/components/ide/RealTerminal.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Square, ChevronRight, Terminal, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

// NOTE: Install xterm in package.json:
// "xterm": "^5.3.0", "@xterm/addon-fit": "^0.8.0", "@xterm/addon-web-links": "^0.9.0"
// import { Terminal as XTerm } from "xterm";
// import { FitAddon } from "@xterm/addon-fit";
// import { WebLinksAddon } from "@xterm/addon-web-links";
// import "xterm/css/xterm.css";

interface TerminalTab {
  id: string;
  name: string;
  pid?: number;
  status: "running" | "idle" | "dead";
}

interface RealTerminalProps {
  projectId: Id<"projects"> | null;
  className?: string;
}

export function RealTerminal({ projectId, className }: RealTerminalProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "term-1", name: "bash", status: "idle" },
  ]);
  const [activeTab, setActiveTab] = useState("term-1");
  const terminalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const xtermInstances = useRef<Record<string, any>>({}); // XTerm instances
  const fitAddons = useRef<Record<string, any>>({});
  const [inputBuffer, setInputBuffer] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isReady, setIsReady] = useState(false);

  const execCommand = useAction(api.terminal.execute);
  const streamOutput = useQuery(
    api.terminal.getOutput,
    projectId ? { projectId, terminalId: activeTab } : "skip"
  );
  const clearOutput = useMutation(api.terminal.clearOutput);

  // Initialize xterm when tab mounts
  const initXterm = useCallback((tabId: string, container: HTMLDivElement | null) => {
    if (!container || xtermInstances.current[tabId]) return;
    
    // Dynamic import to avoid SSR issues
    import("xterm").then(({ Terminal: XTerm }) => {
      import("@xterm/addon-fit").then(({ FitAddon }) => {
        import("@xterm/addon-web-links").then(({ WebLinksAddon }) => {
          const term = new XTerm({
            theme: {
              background: "#0a0a0f",
              foreground: "#e8e8f0",
              cursor: "#e63946",
              selectionBackground: "rgba(230,57,70,0.3)",
              black: "#1a1a24",
              brightBlack: "#555566",
              red: "#e63946",
              brightRed: "#ff6b6b",
              green: "#4ade80",
              brightGreen: "#86efac",
              yellow: "#f4a832",
              brightYellow: "#fde68a",
              blue: "#60a5fa",
              brightBlue: "#93c5fd",
              magenta: "#a78bfa",
              brightMagenta: "#c4b5fd",
              cyan: "#34d399",
              brightCyan: "#6ee7b7",
              white: "#e8e8f0",
              brightWhite: "#ffffff",
            },
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: 13,
            lineHeight: 1.5,
            cursorBlink: true,
            cursorStyle: "bar",
            scrollback: 5000,
            allowProposedApi: true,
          });

          const fitAddon = new FitAddon();
          const webLinksAddon = new WebLinksAddon();
          term.loadAddon(fitAddon);
          term.loadAddon(webLinksAddon);
          term.open(container);
          fitAddon.fit();

          xtermInstances.current[tabId] = term;
          fitAddons.current[tabId] = fitAddon;

          // Welcome message
          term.writeln("\x1b[1;32m╔═══════════════════════════════════════╗\x1b[0m");
          term.writeln("\x1b[1;32m║  CodeForge Terminal v2  ─  Real Shell  ║\x1b[0m");
          term.writeln("\x1b[1;32m╚═══════════════════════════════════════╝\x1b[0m");
          term.writeln("");
          term.write("\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");

          // Handle input
          let lineBuffer = "";
          let localHistory: string[] = [];
          let localHistIdx = -1;

          term.onKey(({ key, domEvent }) => {
            const ev = domEvent;
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

            if (ev.keyCode === 13) {
              // Enter — run command
              term.writeln("");
              const cmd = lineBuffer.trim();
              if (cmd) {
                localHistory.unshift(cmd);
                localHistIdx = -1;
                runCommand(tabId, cmd, term);
              } else {
                term.write("\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");
              }
              lineBuffer = "";
            } else if (ev.keyCode === 8) {
              // Backspace
              if (lineBuffer.length > 0) {
                lineBuffer = lineBuffer.slice(0, -1);
                term.write("\b \b");
              }
            } else if (ev.keyCode === 38) {
              // Up arrow — history
              if (localHistIdx < localHistory.length - 1) {
                localHistIdx++;
                const histCmd = localHistory[localHistIdx];
                term.write("\x1b[2K\r\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m " + histCmd);
                lineBuffer = histCmd;
              }
            } else if (ev.keyCode === 40) {
              // Down arrow — history
              if (localHistIdx > 0) {
                localHistIdx--;
                const histCmd = localHistory[localHistIdx];
                term.write("\x1b[2K\r\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m " + histCmd);
                lineBuffer = histCmd;
              } else {
                localHistIdx = -1;
                term.write("\x1b[2K\r\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");
                lineBuffer = "";
              }
            } else if (ev.ctrlKey && ev.key === "c") {
              // Ctrl+C — kill
              term.writeln("^C");
              term.write("\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");
              lineBuffer = "";
              killProcess(tabId);
            } else if (ev.ctrlKey && ev.key === "l") {
              // Ctrl+L — clear
              term.clear();
              term.write("\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");
            } else if (printable) {
              lineBuffer += key;
              term.write(key);
            }
          });

          setIsReady(true);
          
          // Resize observer
          const ro = new ResizeObserver(() => {
            fitAddon.fit();
          });
          ro.observe(container);
        });
      });
    });
  }, []);

  // Stream output from Convex to xterm
  useEffect(() => {
    if (!streamOutput?.lines?.length) return;
    const term = xtermInstances.current[activeTab];
    if (!term) return;
    streamOutput.lines.forEach((line: { text: string; type: string }) => {
      if (line.type === "error") {
        term.writeln(`\x1b[31m${line.text}\x1b[0m`);
      } else if (line.type === "success") {
        term.writeln(`\x1b[32m${line.text}\x1b[0m`);
      } else {
        term.writeln(line.text);
      }
    });
    // Show prompt after command completes
    if (streamOutput.done) {
      term.write("\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, status: "idle" } : t));
    }
  }, [streamOutput, activeTab]);

  const runCommand = async (tabId: string, cmd: string, term: any) => {
    if (!projectId) {
      term.writeln("\x1b[31mNo project selected\x1b[0m");
      term.write("\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");
      return;
    }
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: "running" } : t));
    term.writeln(`\x1b[90m$ ${cmd}\x1b[0m`);
    try {
      await execCommand({ projectId, command: cmd, terminalId: tabId });
    } catch (e: any) {
      term.writeln(`\x1b[31mError: ${e.message}\x1b[0m`);
      term.write("\x1b[1;35m~/project\x1b[0m \x1b[1;31m❯\x1b[0m ");
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: "idle" } : t));
    }
  };

  const killProcess = async (tabId: string) => {
    // Signal backend to kill the process
    try {
      await execCommand({ projectId: projectId!, command: "__KILL__", terminalId: tabId });
    } catch {}
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: "idle" } : t));
  };

  const addTab = () => {
    const id = `term-${Date.now()}`;
    setTabs(prev => [...prev, { id, name: "bash", status: "idle" }]);
    setActiveTab(id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTab === tabId) {
      setActiveTab(tabs.find(t => t.id !== tabId)?.id || tabs[0].id);
    }
    delete xtermInstances.current[tabId];
  };

  return (
    <div className={cn("flex flex-col h-full bg-[#0a0a0f] border border-white/10 rounded-lg overflow-hidden", className)}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#111118] border-b border-white/10">
        <Terminal className="w-3.5 h-3.5 text-emerald-400 mr-1" />
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-all",
              activeTab === tab.id
                ? "bg-[#1a1a24] text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            )}
          >
            <span
              className={cn("w-1.5 h-1.5 rounded-full",
                tab.status === "running" ? "bg-emerald-400 animate-pulse" :
                tab.status === "dead" ? "bg-red-400" : "bg-white/20"
              )}
            />
            {tab.name}
            {tabs.length > 1 && (
              <X
                className="w-3 h-3 opacity-50 hover:opacity-100"
                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
              />
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          className="p-1 text-white/30 hover:text-white/70 hover:bg-white/5 rounded transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div className="ml-auto flex gap-1">
          {tabs.find(t => t.id === activeTab)?.status === "running" && (
            <button
              onClick={() => killProcess(activeTab)}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 rounded transition-all"
            >
              <Square className="w-3 h-3" /> Kill
            </button>
          )}
          <button
            onClick={() => clearOutput({ projectId: projectId!, terminalId: activeTab })}
            className="p-1 text-white/30 hover:text-white/70 rounded transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal containers */}
      {tabs.map(tab => (
        <div
          key={tab.id}
          ref={el => {
            terminalRefs.current[tab.id] = el;
            if (el && tab.id === activeTab) initXterm(tab.id, el);
          }}
          className={cn("flex-1 p-1", tab.id !== activeTab && "hidden")}
          style={{ minHeight: 0 }}
        />
      ))}
    </div>
  );
}
