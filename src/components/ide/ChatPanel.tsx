/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — CHAT PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * The main chat interface. Uses the new api.chat.send action which:
 *  - Simple questions → direct AI response
 *  - Code requests → launches a full mission with agents
 *
 * Shows mission status inline when agents are working.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QuickActions } from "./QuickActions";
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Zap,
  Brain,
  Sparkles,
  Rocket,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
interface Session {
  _id: Id<"sessions">;
  model: string;
  totalCost?: number;
}

interface Message {
  _id: Id<"messages">;
  _creationTime: number;
  role: "user" | "assistant" | "system" | "tool_summary";
  content: string;
  model?: string;
  cost?: number;
  missionId?: Id<"missions">;
}

interface FileContent {
  _id: Id<"files">;
  path: string;
  name: string;
  content: string | null;
  language: string | null;
}

const MODELS = [
  { id: "deepseek-v3.2", name: "DeepSeek V3.2", icon: Zap, color: "text-emerald-400", desc: "Fast coder" },
  { id: "grok-4.1-fast", name: "Grok 4.1 Fast", icon: Brain, color: "text-amber-400", desc: "Deep reasoning" },
  { id: "kimi-k2.6", name: "Kimi K2.6", icon: Sparkles, color: "text-purple-400", desc: "Quick tasks" },
];

// ─── Markdown Renderer ──────────────────────────────────────────
function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3).split("\n");
      const lang = lines[0]?.trim() || "";
      const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
      return (
        <div key={i} className="my-2 rounded-md overflow-hidden border border-white/5">
          {lang && (
            <div className="bg-white/5 px-3 py-1 text-[10px] text-white/40 border-b border-white/5 font-mono">
              {lang}
            </div>
          )}
          <pre className="bg-black/30 p-3 overflow-x-auto text-[12px] leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    // Bold + inline code
    const segments = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {segments.map((seg, j) => {
          if (seg.startsWith("`") && seg.endsWith("`")) {
            return (
              <code key={j} className="bg-white/10 px-1 py-0.5 rounded text-[12px] text-emerald-400 font-mono">
                {seg.slice(1, -1)}
              </code>
            );
          }
          // Bold with ** or *
          const bolded = seg.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
          return bolded.map((b, k) => {
            if (b.startsWith("**") && b.endsWith("**")) {
              return <strong key={`${j}-${k}`} className="font-semibold text-white">{b.slice(2, -2)}</strong>;
            }
            if (b.startsWith("*") && b.endsWith("*") && !b.startsWith("**")) {
              return <em key={`${j}-${k}`} className="text-white/90">{b.slice(1, -1)}</em>;
            }
            return <span key={`${j}-${k}`}>{b}</span>;
          });
        })}
      </span>
    );
  });
}

// ─── Inline Mission Status ──────────────────────────────────────
function MissionStatus({ missionId }: { missionId: Id<"missions"> }) {
  const mission = useQuery(api.engine.getMission, { missionId });
  const agents = useQuery(api.engine.listMissionAgents, { missionId });
  const [expanded, setExpanded] = useState(true);

  if (!mission) return null;

  const statusIcon = {
    planning: <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />,
    running: <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    failed: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  }[mission.status] || <Clock className="h-3.5 w-3.5 text-white/40" />;

  const statusText = {
    planning: "Planning...",
    running: "Agents working...",
    completed: "Complete",
    failed: "Failed",
  }[mission.status] || mission.status;

  const running = agents?.filter((a) => a.status === "running").length || 0;
  const completed = agents?.filter((a) => a.status === "completed").length || 0;
  const total = agents?.length || 0;

  return (
    <div className="my-2 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-xs font-medium text-white/80">{statusText}</span>
          {total > 0 && (
            <span className="text-[10px] text-white/40">
              {completed}/{total} agents done
              {running > 0 && ` · ${running} running`}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
      </button>

      {expanded && agents && agents.length > 0 && (
        <div className="px-3 pb-2 space-y-1 border-t border-white/5 pt-2">
          {agents.map((agent) => (
            <div key={agent._id} className="flex items-center gap-2 text-[11px]">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                agent.status === "running" ? "bg-emerald-400 animate-pulse" :
                agent.status === "completed" ? "bg-emerald-400" :
                agent.status === "failed" ? "bg-red-400" :
                "bg-white/20"
              )} />
              <span className="text-white/60 capitalize shrink-0">{agent.role}</span>
              <span className="text-white/40 truncate">{agent.title}</span>
              {agent.status === "completed" && agent.filesCreated ? (
                <span className="text-emerald-400/60 text-[10px] ml-auto shrink-0">
                  {agent.filesCreated} files
                </span>
              ) : null}
              {agent.status === "running" && (
                <Loader2 className="h-3 w-3 text-emerald-400/50 animate-spin ml-auto shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export function ChatPanel({
  session,
  messages,
  activeFile,
  projectId,
  externalPrompt,
  onExternalPromptConsumed,
  onMissionStarted,
}: {
  session: Session | null | undefined;
  messages: Message[];
  activeFile?: FileContent | null;
  projectId?: string | null;
  externalPrompt?: string | null;
  onExternalPromptConsumed?: () => void;
  onMissionStarted?: (missionId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("deepseek-v3.2");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatSend = useAction(api.chat.send);
  const updateModel = useMutation(api.sessions.updateModel);
  const clearSession = useMutation(api.chatMessages.clearSession);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Sync model with session
  useEffect(() => {
    if (session?.model) setSelectedModel(session.model);
  }, [session?.model]);

  // Handle external prompt (from suggestions)
  useEffect(() => {
    if (externalPrompt && session && !isLoading) {
      setInput(externalPrompt);
      onExternalPromptConsumed?.();
      setTimeout(() => handleSendWithMessage(externalPrompt), 300);
    }
  }, [externalPrompt]);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (session) {
      updateModel({ sessionId: session._id, model }).catch(console.error);
    }
  };

  const handleSendWithMessage = async (message: string) => {
    if (!message.trim() || !session || isLoading) return;

    setInput("");
    setIsLoading(true);

    try {
      const result = await chatSend({
        sessionId: session._id,
        projectId: (projectId as Id<"projects">) || undefined,
        message,
        model: selectedModel,
      });

      if (result.mode === "mission" && result.missionId) {
        onMissionStarted?.(result.missionId);
        toast.success("🚀 Mission launched — agents are working!", { duration: 3000 });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`AI error: ${e.message?.slice(0, 100) || "Unknown error"}`);
    }

    setIsLoading(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => handleSendWithMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modelInfo = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] border-l border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-white/80">CodeForge AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="h-7 text-[10px] w-[140px] border-white/10 bg-white/5 text-white/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-1.5">
                    <m.icon className={cn("h-3 w-3", m.color)} />
                    <span>{m.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {session && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-white/30 hover:text-white/60"
              onClick={() => {
                clearSession({ sessionId: session._id });
                toast.success("Chat cleared");
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* File context indicator */}
      {activeFile && (
        <div className="px-3 py-1.5 border-b border-white/5 bg-emerald-500/5 text-[10px] text-emerald-400/80 flex items-center gap-1.5">
          <span className="opacity-60">Context:</span>
          <span className="font-mono">{activeFile.path}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <div className="h-14 w-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center">
                <Rocket className="h-7 w-7 text-emerald-400/50" />
              </div>
              <p className="text-sm font-medium text-white/50 mb-1">What do you want to build?</p>
              <p className="text-xs text-white/25 max-w-xs mx-auto">
                Describe what you want and autonomous agents will code it.
                Simple questions get instant answers. Complex tasks spawn a swarm.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg._id}>
              <div className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role !== "user" && (
                  <div className="mt-1 shrink-0">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  </div>
                )}
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 text-white"
                    : "bg-white/[0.04] border border-white/5 text-white/80"
                )}>
                  <div className="whitespace-pre-wrap break-words">
                    {renderContent(msg.content)}
                  </div>
                  {msg.role === "assistant" && (msg.model || msg.cost) && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-white/30">
                      {msg.model && (
                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-white/5 text-white/40 border-0">
                          {MODELS.find((m) => m.id === msg.model)?.name || msg.model}
                        </Badge>
                      )}
                      {msg.cost !== undefined && msg.cost > 0 && (
                        <span className="text-emerald-400/50">${msg.cost.toFixed(5)}</span>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="mt-1 shrink-0">
                    <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-white/60" />
                    </div>
                  </div>
                )}
              </div>
              {/* Show inline mission status if this message triggered one */}
              {msg.missionId && <MissionStatus missionId={msg.missionId} />}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mt-1 shrink-0">
                <Bot className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="bg-white/[0.04] border border-white/5 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  <span className="text-xs">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <QuickActions
        onAction={(prompt) => {
          setInput(prompt);
          setTimeout(() => handleSendWithMessage(prompt), 100);
        }}
        className="border-t border-white/5"
      />

      {/* Input area */}
      <div className="border-t border-white/5 p-3 bg-white/[0.02]">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what to build — agents will code it..."
            className="min-h-[72px] max-h-40 resize-none text-sm bg-white/[0.03] border-white/10 text-white/90 placeholder:text-white/20 rounded-xl pr-12"
            disabled={isLoading || !session}
          />
          <Button
            size="sm"
            className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !session}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <modelInfo.icon className={cn("h-3 w-3", modelInfo.color)} />
            <span>{modelInfo.name}</span>
            <span>·</span>
            <span>{modelInfo.desc}</span>
          </div>
          {session?.totalCost ? (
            <span className="text-[10px] text-emerald-400/40">
              ${session.totalCost.toFixed(4)} spent
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
