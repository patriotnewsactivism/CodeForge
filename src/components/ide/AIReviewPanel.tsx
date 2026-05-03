/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — AI CODE REVIEW PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * AI-powered code review with inline annotations.
 * Reviews current file for: bugs, performance, security, best practices.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Bug,
  Zap,
  Lightbulb,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface ReviewItem {
  type: "bug" | "performance" | "security" | "suggestion" | "style";
  severity: "critical" | "warning" | "info";
  line?: number;
  title: string;
  description: string;
  suggestion?: string;
}

interface AIReviewPanelProps {
  projectId: Id<"projects"> | null;
  activeFile?: {
    _id: Id<"files">;
    name: string;
    path: string;
    content: string | null;
  } | null;
  onSendPrompt?: (prompt: string) => void;
}

const TYPE_CONFIG: Record<ReviewItem["type"], { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: "Bug", color: "text-red-400" },
  performance: { icon: Zap, label: "Performance", color: "text-yellow-400" },
  security: { icon: ShieldCheck, label: "Security", color: "text-orange-400" },
  suggestion: { icon: Lightbulb, label: "Suggestion", color: "text-blue-400" },
  style: { icon: AlertTriangle, label: "Style", color: "text-purple-400" },
};

const SEVERITY_CONFIG: Record<ReviewItem["severity"], { color: string; bg: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10" },
  warning: { color: "text-yellow-400", bg: "bg-yellow-500/10" },
  info: { color: "text-blue-400", bg: "bg-blue-500/10" },
};

export function AIReviewPanel({ projectId, activeFile, onSendPrompt }: AIReviewPanelProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [lastReviewedFile, setLastReviewedFile] = useState<string | null>(null);

  const sendChat = useAction(api.chat.send);

  const handleReview = useCallback(async () => {
    if (!activeFile?.content || !projectId) return;
    setIsReviewing(true);
    setReviews([]);
    setExpandedItems(new Set());
    setLastReviewedFile(activeFile.name);

    try {
      // Use the AI to review the code
      const reviewPrompt = `Review this code file "${activeFile.path}" for bugs, performance issues, security vulnerabilities, and best practice improvements. For each issue found, respond in this exact JSON format (nothing else, just the JSON array):
[
  {"type": "bug|performance|security|suggestion|style", "severity": "critical|warning|info", "line": <line_number_or_null>, "title": "<short title>", "description": "<detailed explanation>", "suggestion": "<code fix or recommendation>"}
]

If the code looks good, return: [{"type":"suggestion","severity":"info","title":"Code looks good!","description":"No issues found in this file."}]

Here's the code:
\`\`\`
${activeFile.content.slice(0, 8000)}
\`\`\``;

      const result = await sendChat({
        message: reviewPrompt,
        sessionId: undefined as any,
        projectId,
      });

      // Try to parse the AI response as JSON
      try {
        const responseText = typeof result === "string" ? result : (result as any)?.response || "";
        // Extract JSON from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as ReviewItem[];
          setReviews(parsed);
          // Auto-expand first 3
          setExpandedItems(new Set([0, 1, 2]));
        } else {
          // AI returned prose — create a single suggestion
          setReviews([
            {
              type: "suggestion",
              severity: "info",
              title: "Review Complete",
              description: responseText.slice(0, 500),
            },
          ]);
          setExpandedItems(new Set([0]));
        }
      } catch {
        setReviews([
          {
            type: "suggestion",
            severity: "info",
            title: "Review Complete",
            description: "The AI reviewed the file. Check the chat panel for detailed results.",
          },
        ]);
        setExpandedItems(new Set([0]));
      }
    } catch (e) {
      setReviews([
        {
          type: "bug",
          severity: "warning",
          title: "Review Failed",
          description: `Could not complete the review: ${e instanceof Error ? e.message : "Unknown error"}`,
        },
      ]);
    }

    setIsReviewing(false);
  }, [activeFile, projectId, sendChat]);

  const toggleItem = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleFixIssue = (item: ReviewItem) => {
    if (!onSendPrompt || !activeFile) return;
    const prompt = `Fix this ${item.type} issue in ${activeFile.path}:\n\n${item.title}\n${item.description}${item.suggestion ? `\n\nSuggested fix: ${item.suggestion}` : ""}`;
    onSendPrompt(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <ShieldCheck className="h-4 w-4 text-emerald-400/60" />
        <span className="text-xs font-semibold text-white/70">AI Review</span>
        <div className="flex-1" />
        <Button
          size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={handleReview}
          disabled={isReviewing || !activeFile?.content}
        >
          {isReviewing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Reviewing...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" />
              Review File
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {reviews.length === 0 && !isReviewing && (
          <div className="text-center py-12 text-white/15 text-xs">
            <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-20" />
            <p>Select a file and click "Review File"</p>
            <p className="mt-1 text-[10px]">
              AI will analyze for bugs, security, and performance
            </p>
          </div>
        )}

        {isReviewing && (
          <div className="text-center py-12">
            <Loader2 className="h-6 w-6 mx-auto mb-2 text-emerald-400 animate-spin" />
            <p className="text-xs text-white/40">
              Reviewing {activeFile?.name}...
            </p>
          </div>
        )}

        {lastReviewedFile && reviews.length > 0 && (
          <div className="text-[10px] text-white/20 px-1 mb-2">
            Reviewed: {lastReviewedFile} — {reviews.length} issue{reviews.length !== 1 ? "s" : ""}
          </div>
        )}

        {reviews.map((item, index) => {
          const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.suggestion;
          const severityConfig = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.info;
          const Icon = typeConfig.icon;
          const isExpanded = expandedItems.has(index);

          return (
            <div
              key={index}
              className={cn(
                "rounded-lg border p-2.5",
                severityConfig.bg,
                "border-white/5"
              )}
            >
              <button
                className="w-full flex items-start gap-2 text-left"
                onClick={() => toggleItem(index)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-white/20 mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-white/20 mt-0.5 shrink-0" />
                )}
                <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", typeConfig.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/60 font-medium truncate">
                      {item.title}
                    </span>
                    <Badge
                      className={cn(
                        "text-[8px] h-3.5 px-1 border-0",
                        severityConfig.bg,
                        severityConfig.color
                      )}
                    >
                      {item.severity}
                    </Badge>
                    {item.line && (
                      <span className="text-[9px] text-white/20">L{item.line}</span>
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-2 ml-7 space-y-2">
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    {item.description}
                  </p>
                  {item.suggestion && (
                    <div className="bg-black/30 rounded p-2">
                      <pre className="text-[10px] text-emerald-400/70 whitespace-pre-wrap font-mono">
                        {item.suggestion}
                      </pre>
                    </div>
                  )}
                  {onSendPrompt && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 text-[9px] px-2 gap-1"
                      onClick={() => handleFixIssue(item)}
                    >
                      <Zap className="h-2.5 w-2.5" />
                      Fix with AI
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
