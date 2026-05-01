import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Lightbulb,
  Loader2,
  RefreshCw,
  X,
  Zap,
  Bug,
  Gauge,
  Palette,
  Shield,
  Sparkles,
  Play,
  Check,
} from "lucide-react";

interface SuggestionsProps {
  projectId: Id<"projects"> | null;
  onExecuteSuggestion: (prompt: string) => void;
}

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof Lightbulb; color: string; label: string }
> = {
  feature: { icon: Sparkles, color: "text-chart-3", label: "Feature" },
  fix: { icon: Bug, color: "text-red-400", label: "Fix" },
  performance: { icon: Gauge, color: "text-yellow-400", label: "Performance" },
  style: { icon: Palette, color: "text-purple-400", label: "Style" },
  security: { icon: Shield, color: "text-orange-400", label: "Security" },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function SuggestionsPanel({
  projectId,
  onExecuteSuggestion,
}: SuggestionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const suggestions = useQuery(
    api.suggestions.listByProject,
    projectId ? { projectId } : "skip"
  );
  const generateAction = useAction(api.suggestions.generate);
  const dismissMutation = useMutation(api.suggestions.dismiss);
  const markInProgress = useMutation(api.suggestions.markInProgress);

  const activeSuggestions = (suggestions || []).filter(
    (s) => s.status === "pending" || s.status === "in_progress"
  );

  const handleGenerate = async () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }
    setIsGenerating(true);
    try {
      const count = await generateAction({ projectId });
      if (count > 0) {
        toast.success(`Generated ${count} suggestions`);
      } else {
        toast.info("No suggestions generated — add some files first");
      }
    } catch (e) {
      toast.error("Failed to generate suggestions");
      console.error(e);
    }
    setIsGenerating(false);
  };

  const handleExecute = async (
    suggestionId: Id<"suggestions">,
    prompt: string
  ) => {
    setExecutingId(suggestionId);
    await markInProgress({ suggestionId });
    onExecuteSuggestion(prompt);
    // Reset after a moment (the chat will handle the actual execution)
    setTimeout(() => setExecutingId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-card/30 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-semibold">Smart Suggestions</span>
          {activeSuggestions.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[9px] h-4 px-1.5 bg-yellow-500/20 text-yellow-400"
            >
              {activeSuggestions.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={handleGenerate}
          disabled={isGenerating || !projectId}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {isGenerating ? "Analyzing..." : "Analyze"}
        </Button>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!projectId && (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">Select a project to get suggestions</p>
          </div>
        )}

        {projectId && activeSuggestions.length === 0 && !isGenerating && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs font-medium mb-1">No suggestions yet</p>
            <p className="text-[10px] opacity-60 mb-3">
              Click "Analyze" to scan your project for improvements
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <Zap className="h-3 w-3" />
              Analyze Project
            </Button>
          </div>
        )}

        {isGenerating && activeSuggestions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-30" />
            <p className="text-xs font-medium">Analyzing your project...</p>
            <p className="text-[10px] opacity-60">
              AI is reviewing your code for improvements
            </p>
          </div>
        )}

        {activeSuggestions.map((suggestion) => {
          const catConfig = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.feature;
          const CatIcon = catConfig.icon;
          const isExecuting = executingId === suggestion._id;

          return (
            <div
              key={suggestion._id}
              className={cn(
                "rounded-lg border border-border bg-card/60 p-3 transition-all hover:border-chart-3/30",
                suggestion.status === "in_progress" && "border-chart-3/50 bg-chart-3/5"
              )}
            >
              {/* Top row: category + priority */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <CatIcon className={cn("h-3.5 w-3.5", catConfig.color)} />
                  <span className={cn("text-[10px] font-medium", catConfig.color)}>
                    {catConfig.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[8px] h-4 px-1 border",
                      PRIORITY_COLORS[suggestion.priority]
                    )}
                  >
                    {suggestion.priority}
                  </Badge>
                  <button
                    onClick={() => dismissMutation({ suggestionId: suggestion._id })}
                    className="h-4 w-4 rounded hover:bg-destructive/20 flex items-center justify-center transition-colors"
                  >
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Title */}
              <h4 className="text-[13px] font-semibold mb-1 leading-tight">
                {suggestion.title}
              </h4>

              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                {suggestion.description}
              </p>

              {/* Action button */}
              <Button
                size="sm"
                className={cn(
                  "h-7 w-full text-xs gap-1.5",
                  suggestion.status === "in_progress"
                    ? "bg-chart-3/20 text-chart-3"
                    : ""
                )}
                variant={suggestion.status === "in_progress" ? "outline" : "default"}
                onClick={() =>
                  handleExecute(suggestion._id, suggestion.prompt)
                }
                disabled={isExecuting || suggestion.status === "in_progress"}
              >
                {suggestion.status === "in_progress" ? (
                  <>
                    <Check className="h-3 w-3" />
                    Sent to AI
                  </>
                ) : isExecuting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Do it
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
