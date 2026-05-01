import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
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
import { AgentDashboard } from "./AgentDashboard";
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Zap,
  Brain,
  Cpu,
  Users,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";

interface Session {
  _id: Id<"sessions">;
  model: string;
  totalCost?: number;
}

interface Message {
  _id: Id<"messages">;
  _creationTime: number;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  fileContext?: string;
}

interface FileContent {
  _id: Id<"files">;
  path: string;
  name: string;
  content: string | null;
  language: string | null;
}

const MODELS = [
  {
    id: "deepseek-v3.2",
    name: "DeepSeek V3.2",
    icon: Zap,
    color: "text-chart-3",
    desc: "$0.28/$0.42 per 1M tokens",
  },
  {
    id: "grok-4.1-fast",
    name: "Grok 4.1 Fast",
    icon: Brain,
    color: "text-chart-2",
    desc: "$0.20/$0.50 per 1M tokens",
  },
  {
    id: "kimi-k2.6",
    name: "Kimi K2.6",
    icon: Sparkles,
    color: "text-purple-400",
    desc: "$0.15/$0.35 per 1M tokens",
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    icon: Cpu,
    color: "text-chart-4",
    desc: "$2.00/$4.00 per 1M tokens",
  },
];

function renderMessageContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3).split("\n");
      const langLine = lines[0]?.trim() || "";
      // Handle lang:path format — show the path as header
      const hasPath = langLine.includes(":");
      const displayLabel = hasPath ? langLine : langLine;
      const code = langLine ? lines.slice(1).join("\n") : lines.join("\n");
      return (
        <div
          key={i}
          className="my-2 rounded-md overflow-hidden border border-border"
        >
          {displayLabel && (
            <div className="bg-card/80 px-3 py-1 text-[10px] text-muted-foreground border-b border-border font-mono">
              {hasPath ? `📄 ${langLine.split(":").slice(1).join(":")}` : displayLabel}
            </div>
          )}
          <pre className="bg-card/40 p-3 overflow-x-auto text-[12px] leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    // Inline code
    const inlined = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlined.map((segment, j) => {
          if (segment.startsWith("`") && segment.endsWith("`")) {
            return (
              <code
                key={j}
                className="bg-card/60 px-1 py-0.5 rounded text-[12px] text-chart-3 font-mono"
              >
                {segment.slice(1, -1)}
              </code>
            );
          }
          const bolded = segment.split(/(\*\*[^*]+\*\*)/g);
          return bolded.map((b, k) => {
            if (b.startsWith("**") && b.endsWith("**")) {
              return (
                <strong key={`${j}-${k}`} className="font-semibold">
                  {b.slice(2, -2)}
                </strong>
              );
            }
            return <span key={`${j}-${k}`}>{b}</span>;
          });
        })}
      </span>
    );
  });
}

export function ChatPanel({
  session,
  messages,
  activeFile,
  projectId,
  externalPrompt,
  onExternalPromptConsumed,
}: {
  session: Session | null | undefined;
  messages: Message[];
  activeFile?: FileContent | null;
  projectId?: string | null;
  externalPrompt?: string | null;
  onExternalPromptConsumed?: () => void;
}) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("deepseek-v3.2");
  const [multiAgentMode, setMultiAgentMode] = useState(false);
  const [agentCount, setAgentCount] = useState(5);
  const [activeParentTaskId, setActiveParentTaskId] = useState<string | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatAction = useAction(api.ai.chat);
  const orchestrateAction = useAction(api.agents.orchestrate);
  const updateModel = useMutation(api.sessions.updateModel);
  const clearSession = useMutation(api.chatMessages.clearSession);

  // Auto-scroll to bottom
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
      // Auto-send after a beat
      setTimeout(() => {
        handleSendWithMessage(externalPrompt);
      }, 300);
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
      if (multiAgentMode && projectId) {
        // Multi-agent mode — agents run in parallel background
        toast.info(
          `Launching ${agentCount} agents in parallel...`,
          { duration: 3000 }
        );

        const result = await orchestrateAction({
          projectId: projectId as Id<"projects">,
          sessionId: session._id,
          userPrompt: message,
          agentCount,
        });

        setActiveParentTaskId(result.parentTaskId);
        toast.success(
          `${result.taskCount} agents launched! Watch the dashboard for real-time progress.`,
          { duration: 5000 }
        );
      } else {
        // Single agent mode
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const result = await chatAction({
          sessionId: session._id,
          projectId: (projectId as any) || undefined,
          userMessage: message,
          model: selectedModel,
          fileContext: activeFile?.path,
          fileContent: activeFile?.content || undefined,
          conversationHistory: history,
        });
        if (result.filesCreated > 0) {
          toast.success(
            `Created ${result.filesCreated} file${result.filesCreated > 1 ? "s" : ""} in your project`
          );
        }
      }
    } catch (e) {
      toast.error("Failed to get AI response");
      console.error(e);
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
    <div className="flex h-full flex-col bg-card/30 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50">
        <div className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-chart-3" />
          <span className="text-xs font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="h-6 text-[10px] w-36 border-none bg-transparent">
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
              className="h-5 w-5 p-0"
              onClick={() => {
                clearSession({ sessionId: session._id });
                setActiveParentTaskId(null);
                toast.success("Chat cleared");
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Multi-agent toggle bar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-card/30">
        <button
          onClick={() => setMultiAgentMode(!multiAgentMode)}
          className={cn(
            "flex items-center gap-1.5 text-[10px] font-medium transition-colors rounded-md px-2 py-0.5",
            multiAgentMode
              ? "text-chart-3 bg-chart-3/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3 w-3" />
          Multi-Agent
          {multiAgentMode && (
            <Badge
              variant="secondary"
              className="text-[8px] h-3.5 px-1 bg-chart-3/20 text-chart-3"
            >
              ON
            </Badge>
          )}
        </button>
        {multiAgentMode && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Agents:</span>
            <button
              onClick={() => setAgentCount(Math.max(2, agentCount - 1))}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-[11px] font-bold text-chart-3 w-4 text-center">
              {agentCount}
            </span>
            <button
              onClick={() => setAgentCount(Math.min(10, agentCount + 1))}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* File context indicator */}
      {activeFile && (
        <div className="px-3 py-1 border-b border-border bg-chart-3/5 text-[10px] text-chart-3 flex items-center gap-1">
          <span className="opacity-60">Context:</span>
          <span className="font-mono">{activeFile.path}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {messages.length === 0 && !activeParentTaskId && (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">Start a conversation</p>
              <p className="text-xs opacity-60">
                Ask me to write code, debug issues, or explain concepts.
                <br />
                Open a file for context-aware assistance.
              </p>
              {multiAgentMode && (
                <p className="text-xs text-chart-3 mt-2">
                  ⚡ Multi-Agent mode: {agentCount} agents will work in parallel
                </p>
              )}
            </div>
          )}

          {/* Agent Dashboard (if multi-agent was used) */}
          {activeParentTaskId && (
            <AgentDashboard
              sessionId={session?._id || null}
              parentTaskId={activeParentTaskId}
            />
          )}

          {messages.map((msg) => (
            <div
              key={msg._id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="mt-1 shrink-0">
                  <div className="h-5 w-5 rounded bg-chart-3/20 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-chart-3" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card/80 border border-border"
                )}
              >
                <div className="whitespace-pre-wrap break-words">
                  {renderMessageContent(msg.content)}
                </div>
                {msg.role === "assistant" && (msg.model || msg.cost) && (
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {msg.model && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-3.5 px-1"
                      >
                        {MODELS.find((m) => m.id === msg.model)?.name ||
                          msg.model}
                      </Badge>
                    )}
                    {msg.inputTokens !== undefined && (
                      <span>
                        {msg.inputTokens + (msg.outputTokens || 0)} tokens
                      </span>
                    )}
                    {msg.cost !== undefined && msg.cost > 0 && (
                      <span className="text-chart-2">
                        ${msg.cost.toFixed(5)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="mt-1 shrink-0">
                  <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded bg-chart-3/20 flex items-center justify-center mt-1 shrink-0">
                <Bot className="h-3 w-3 text-chart-3" />
              </div>
              <div className="bg-card/80 border border-border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-chart-3" />
                  <span className="text-xs">
                    {multiAgentMode
                      ? `Orchestrating ${agentCount} agents...`
                      : `Thinking with ${MODELS.find((m) => m.id === selectedModel)?.name}...`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border p-2 bg-card/50">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              multiAgentMode
                ? `Describe what to build — ${agentCount} agents will work on it...`
                : "Ask AI to write, debug, or explain code..."
            }
            className="min-h-[60px] max-h-32 resize-none text-sm bg-background"
            disabled={isLoading || !session}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <modelInfo.icon className={cn("h-3 w-3", modelInfo.color)} />
            <span>{modelInfo.name}</span>
            <span className="opacity-50">·</span>
            <span className="opacity-50">{modelInfo.desc}</span>
          </div>
          <Button
            size="sm"
            className={cn(
              "h-7 text-xs gap-1",
              multiAgentMode &&
                "bg-gradient-to-r from-chart-3 to-chart-2 hover:opacity-90"
            )}
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !session}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : multiAgentMode ? (
              <Users className="h-3 w-3" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {multiAgentMode ? `Launch ${agentCount} Agents` : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
