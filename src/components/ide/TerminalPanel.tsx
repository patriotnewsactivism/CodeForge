/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — TERMINAL / CONSOLE PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Live console output panel that shows:
 * - Agent execution logs
 * - Preview console errors/warnings
 * - Build output
 * - User commands (simulated shell)
 *
 * This is a client-side terminal emulator — doesn't connect to
 * a real shell, but captures preview console output and agent logs.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Terminal,
  Trash2,
  Download,
  AlertTriangle,
  Info,
  XCircle,
  Bug,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogEntry {
  id: string;
  timestamp: number;
  type: "info" | "warn" | "error" | "success" | "command" | "output";
  message: string;
  source?: string;
}

interface TerminalPanelProps {
  projectId: Id<"projects"> | null;
  missionId?: Id<"missions"> | null;
}

const TYPE_STYLES: Record<LogEntry["type"], { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: "text-blue-400/60" },
  warn: { icon: AlertTriangle, color: "text-yellow-400/60" },
  error: { icon: XCircle, color: "text-red-400/60" },
  success: { icon: Info, color: "text-emerald-400/60" },
  command: { icon: ChevronRight, color: "text-purple-400/60" },
  output: { icon: Terminal, color: "text-white/30" },
};

export function TerminalPanel({ projectId, missionId }: TerminalPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "welcome",
      timestamp: Date.now(),
      type: "info",
      message: "CodeForge Terminal v2.0 — Ready",
      source: "system",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Watch agent tool calls for live logs
  const toolCalls = useQuery(
    api.toolCalls?.listByMission ?? (null as any),
    missionId ? { missionId } : "skip"
  );

  // Watch agent thoughts
  const thoughts = useQuery(
    api.agentThoughts?.listByMission ?? (null as any),
    missionId ? { missionId } : "skip"
  );

  // Add agent activity to logs
  useEffect(() => {
    if (!toolCalls) return;

    const newLogs: LogEntry[] = toolCalls.map((tc: any) => ({
      id: `tc-${tc._id}`,
      timestamp: tc._creationTime,
      type: tc.status === "error" ? "error" as const : "success" as const,
      message: `[${tc.tool}] ${tc.args ? JSON.stringify(tc.args).slice(0, 120) : ""}${tc.result ? ` → ${String(tc.result).slice(0, 80)}` : ""}`,
      source: tc.agentRole || "agent",
    }));

    setLogs((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const unique = newLogs.filter((l) => !existingIds.has(l.id));
      if (unique.length === 0) return prev;
      return [...prev, ...unique].slice(-500);
    });
  }, [toolCalls]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle commands
  const handleCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);

      // Add command log
      const cmdLog: LogEntry = {
        id: `cmd-${Date.now()}`,
        timestamp: Date.now(),
        type: "command",
        message: trimmed,
        source: "user",
      };

      let response: LogEntry;

      // Simple command interpreter
      switch (trimmed.toLowerCase()) {
        case "help":
          response = {
            id: `out-${Date.now()}`,
            timestamp: Date.now(),
            type: "info",
            message:
              "Available commands: help, clear, status, files, agents, version, date",
            source: "system",
          };
          break;
        case "clear":
          setLogs([]);
          setInputValue("");
          return;
        case "status":
          response = {
            id: `out-${Date.now()}`,
            timestamp: Date.now(),
            type: "success",
            message: `Project: ${projectId ? "Active" : "None"} | Mission: ${missionId ? "Running" : "Idle"} | Logs: ${logs.length}`,
            source: "system",
          };
          break;
        case "version":
          response = {
            id: `out-${Date.now()}`,
            timestamp: Date.now(),
            type: "info",
            message: "CodeForge v2.0.0 — Autonomous AI Coding Platform",
            source: "system",
          };
          break;
        case "date":
          response = {
            id: `out-${Date.now()}`,
            timestamp: Date.now(),
            type: "output",
            message: new Date().toString(),
            source: "system",
          };
          break;
        case "agents":
          response = {
            id: `out-${Date.now()}`,
            timestamp: Date.now(),
            type: "info",
            message: missionId
              ? `Active mission detected. Tool calls logged: ${toolCalls?.length || 0}`
              : "No active mission. Send a code request via chat to start one.",
            source: "system",
          };
          break;
        default:
          response = {
            id: `out-${Date.now()}`,
            timestamp: Date.now(),
            type: "warn",
            message: `Unknown command: ${trimmed}. Type 'help' for available commands.`,
            source: "system",
          };
      }

      setLogs((prev) => [...prev, cmdLog, response].slice(-500));
      setInputValue("");
    },
    [projectId, missionId, logs.length, toolCalls]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCommand(inputValue);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue("");
        } else {
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      }
    }
  };

  const handleClear = () => setLogs([]);
  const handleDownload = () => {
    const text = logs.map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.type}] ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codeforge-terminal.log";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add external console error
  const addExternalLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `ext-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        type,
        message,
        source: "preview",
      },
    ]);
  }, []);

  // Expose addExternalLog via window for preview panel integration
  useEffect(() => {
    (window as any).__codeforgeTerminal = { addLog: addExternalLog };
    return () => {
      delete (window as any).__codeforgeTerminal;
    };
  }, [addExternalLog]);

  return (
    <div
      className="flex flex-col h-full bg-[#0a0a0f] border-t border-white/5 font-mono text-xs"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-[#0d0d14]">
        <Terminal className="h-3.5 w-3.5 text-emerald-400/60" />
        <span className="text-[11px] font-semibold text-white/60">Terminal</span>
        <span className="text-[9px] text-white/15">{logs.length} lines</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-white/15 hover:text-white/30"
          onClick={handleDownload}
          title="Download logs"
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-white/15 hover:text-white/30"
          onClick={handleClear}
          title="Clear"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Log output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {logs.map((log) => {
          const style = TYPE_STYLES[log.type];
          const Icon = style.icon;

          return (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed">
              <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", style.color)} />
              <span className="text-[9px] text-white/10 shrink-0 w-16">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.source && (
                <span className="text-[8px] text-white/15 shrink-0 w-12 truncate">
                  [{log.source}]
                </span>
              )}
              <span
                className={cn(
                  "text-[11px] break-all",
                  log.type === "error"
                    ? "text-red-400/80"
                    : log.type === "warn"
                    ? "text-yellow-400/70"
                    : log.type === "success"
                    ? "text-emerald-400/70"
                    : log.type === "command"
                    ? "text-purple-300/80"
                    : "text-white/40"
                )}
              >
                {log.message}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/5 bg-[#0d0d14]">
        <ChevronRight className="h-3 w-3 text-emerald-400/60 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          className="flex-1 bg-transparent text-[11px] text-white/60 outline-none placeholder:text-white/10"
        />
      </div>
    </div>
  );
}
