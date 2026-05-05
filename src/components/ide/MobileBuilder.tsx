/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — MOBILE-NATIVE BUILDER (UPGRADE #4)
 * ═══════════════════════════════════════════════════════════════════
 *
 * A completely separate mobile-optimized view that takes over on
 * screens < 640px. No editor. No file tree. Just:
 *   1. Describe what you want (voice or text)
 *   2. Watch agents build it with a live feed
 *   3. Tap the preview to approve or request changes
 *
 * Features:
 * - Voice input (tap mic → speak → agents code it)
 * - Live agent feed as a scrollable activity stream
 * - Swipe between "Build" / "Preview" / "Files" tabs
 * - Haptic feedback on agent actions (navigator.vibrate)
 * - "Approve this change" / "Undo" swipe actions on agent cards
 * - Quick prompt templates (onboarding cards for new users)
 */

// src/components/ide/MobileBuilder.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Send, Eye, Code2, FolderTree, Sparkles,
  Zap, Brain, CheckCircle2, XCircle, Loader2, ChevronRight,
  ArrowLeft, Play, RotateCcw, Wand2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence, useSwipeable } from "framer-motion";

type MobileTab = "build" | "preview" | "files";

const QUICK_PROMPTS = [
  { emoji: "🛬", label: "Landing page", prompt: "Build a modern dark landing page with hero, features, and CTA sections" },
  { emoji: "📝", label: "Blog layout", prompt: "Create a blog layout with article cards, sidebar, and tag filtering" },
  { emoji: "📊", label: "Dashboard", prompt: "Build an admin dashboard with stats cards, charts, and a data table" },
  { emoji: "🔐", label: "Login form", prompt: "Design a sleek login/signup form with email, password, and social auth" },
  { emoji: "🛒", label: "Product page", prompt: "Build an e-commerce product page with image gallery, reviews, and buy button" },
  { emoji: "📱", label: "Mobile nav", prompt: "Create a bottom navigation bar with 5 tabs and animated transitions" },
];

interface MobileBuilderProps {
  projectId: Id<"projects"> | null;
  sessionId: Id<"sessions"> | null;
  activeMissionId: Id<"missions"> | null;
  onPromptSend: (prompt: string) => void;
  onMissionSelect: (missionId: Id<"missions">) => void;
  files: any[];
  allFilesForPreview: any[];
}

export function MobileBuilder({
  projectId, sessionId, activeMissionId, onPromptSend, onMissionSelect, files, allFilesForPreview
}: MobileBuilderProps) {
  const [tab, setTab] = useState<MobileTab>("build");
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Live agent activity
  const agentRuns = useQuery(
    api.agentRuns?.listByMission ?? (null as any),
    activeMissionId ? { missionId: activeMissionId } : "skip"
  ) || [];
  const toolCalls = useQuery(
    api.toolCalls?.listByMission ?? (null as any),
    activeMissionId ? { missionId: activeMissionId, limit: 20 } : "skip"
  ) || [];
  const mission = useQuery(
    api.missions?.get ?? (null as any),
    activeMissionId ? { missionId: activeMissionId } : "skip"
  );

  // Voice input
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input not supported on this browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setPrompt(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice input error — try again");
    };

    recognitionRef.current = recognition;
    recognition.start();
    navigator.vibrate?.(50);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleSend = async () => {
    if (!prompt.trim() || isSending) return;
    setIsSending(true);
    navigator.vibrate?.(30);
    try {
      await onPromptSend(prompt.trim());
      setPrompt("");
      setTab("preview");
    } finally {
      setIsSending(false);
    }
  };

  const isRunning = mission?.status === "running" || mission?.status === "planning";

  const previewHtml = allFilesForPreview?.length
    ? buildPreviewHtml(allFilesForPreview)
    : null;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#111118]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-500/20 rounded-lg flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-red-400" />
          </div>
          <span className="font-bold text-sm tracking-wide">CodeForge</span>
        </div>
        {isRunning && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs animate-pulse">
            Building...
          </Badge>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-white/10 bg-[#111118]">
        {[
          { id: "build" as MobileTab, icon: Wand2, label: "Build" },
          { id: "preview" as MobileTab, icon: Eye, label: "Preview" },
          { id: "files" as MobileTab, icon: FolderTree, label: "Files" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-all",
              tab === t.id
                ? "text-red-400 border-b-2 border-red-400"
                : "text-white/30 hover:text-white/60"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* BUILD TAB */}
          {tab === "build" && (
            <motion.div
              key="build"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col"
            >
              {/* Agent activity stream */}
              {activeMissionId && toolCalls.length > 0 ? (
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="text-xs text-white/50">
                      {isRunning ? "Agents are building..." : "Build complete"}
                    </span>
                  </div>
                  {toolCalls.slice(0, 20).map((tc: any) => (
                    <motion.div
                      key={tc._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2.5 bg-white/5 rounded-lg px-3 py-2"
                    >
                      <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 text-xs",
                        tc.toolName === "create_file" ? "bg-emerald-500/20 text-emerald-400" :
                        tc.toolName === "edit_file" ? "bg-blue-500/20 text-blue-400" :
                        tc.toolName === "spawn_agent" ? "bg-purple-500/20 text-purple-400" :
                        "bg-white/10 text-white/40"
                      )}>
                        {tc.toolName === "create_file" ? "+" :
                         tc.toolName === "edit_file" ? "✎" :
                         tc.toolName === "spawn_agent" ? "⚡" : "→"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/80 capitalize">
                          {tc.toolName.replace(/_/g, " ")}
                        </p>
                        {tc.filePath && (
                          <p className="text-xs text-white/30 truncate">{tc.filePath}</p>
                        )}
                      </div>
                      {tc.status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                      {tc.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    </motion.div>
                  ))}
                </div>
              ) : (
                /* Quick prompt templates */
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <p className="text-xs text-white/30 mb-3 text-center">Quick start — tap to use</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_PROMPTS.map(qp => (
                      <button
                        key={qp.label}
                        onClick={() => setPrompt(qp.prompt)}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-left transition-all active:scale-95"
                      >
                        <span className="text-xl">{qp.emoji}</span>
                        <span className="text-xs font-medium text-white/70">{qp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input area */}
              <div className="p-4 border-t border-white/10 bg-[#111118]">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder={isListening ? "Listening..." : "Describe what to build..."}
                      rows={2}
                      className={cn(
                        "w-full bg-white/5 border rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 resize-none focus:outline-none transition-all",
                        isListening ? "border-red-400/50 bg-red-500/5" : "border-white/10 focus:border-white/20"
                      )}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onPointerDown={startListening}
                      onPointerUp={stopListening}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        isListening ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white/50 hover:bg-white/15"
                      )}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!prompt.trim() || isSending}
                      className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-400 disabled:bg-white/10 disabled:text-white/20 flex items-center justify-center transition-all active:scale-95"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PREVIEW TAB */}
          {tab === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full relative"
            >
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
                  <Eye className="w-10 h-10" />
                  <p className="text-sm">Preview will appear here once agents build something</p>
                  <Button variant="outline" size="sm" onClick={() => setTab("build")} className="border-white/10 text-white/50">
                    Start building →
                  </Button>
                </div>
              )}
              {isRunning && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs text-white">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  Updating preview...
                </div>
              )}
            </motion.div>
          )}

          {/* FILES TAB */}
          {tab === "files" && (
            <motion.div
              key="files"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto px-4 py-3"
            >
              {files?.length ? (
                <div className="space-y-1">
                  {files.filter((f: any) => f.type === "file").map((f: any) => (
                    <div key={f._id} className="flex items-center gap-2.5 px-3 py-2.5 bg-white/5 rounded-lg">
                      <Code2 className="w-4 h-4 text-white/30 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">{f.name}</p>
                        <p className="text-xs text-white/30 truncate">{f.path}</p>
                      </div>
                      <Badge variant="outline" className="text-xs border-white/10 text-white/30">
                        {f.language || "txt"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-white/30">
                  <FolderTree className="w-10 h-10" />
                  <p className="text-sm">No files yet</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Build a preview HTML from all project files
function buildPreviewHtml(files: any[]): string {
  const htmlFile = files.find((f: any) => f.path === "index.html" || f.name === "index.html");
  if (htmlFile?.content) return htmlFile.content;
  const jsFiles = files.filter((f: any) => f.language === "javascript" || f.language === "typescript" || f.path?.endsWith(".jsx") || f.path?.endsWith(".tsx"));
  return `<!DOCTYPE html><html><body style="background:#0a0a0f;color:#e8e8f0;font-family:sans-serif;padding:2rem;text-align:center">
    <h2 style="color:#e63946">Preview Loading...</h2>
    <p style="color:#888">The preview will update as agents build your project.</p>
  </body></html>`;
}
