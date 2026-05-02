/**
 * ArchitectPanel — Shows the Mission Architect's expanded spec,
 * tech decisions, agent prompts, and refinement history.
 * Users can see exactly how their rough idea was transformed.
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Hammer,
  Lightbulb,
  Shield,
  Code2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ArchitectPanelProps {
  projectId: Id<"projects"> | null;
  missionId?: Id<"missions"> | null;
}

export function ArchitectPanel({ projectId, missionId }: ArchitectPanelProps) {
  const specs = useQuery(
    api.architect.listByProject,
    projectId ? { projectId } : "skip"
  );
  const currentSpec = useQuery(
    api.architect.getSpec,
    missionId ? { missionId } : "skip"
  );
  const refinements = useQuery(
    api.architect.getRefinements,
    missionId ? { missionId } : "skip"
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["spec", "agents"])
  );
  const [selectedSpecIdx, setSelectedSpecIdx] = useState(0);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const spec = currentSpec || (specs && specs[selectedSpecIdx]);

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center">
          <Hammer className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select a project to view architect specs</p>
        </div>
      </div>
    );
  }

  if (!spec && (!specs || specs.length === 0)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No mission specs yet</p>
          <p className="text-xs mt-1 opacity-70">
            Launch a mission with the Architect to see detailed specs here
          </p>
        </div>
      </div>
    );
  }

  const roleEmojis: Record<string, string> = {
    orchestrator: "🧠",
    planner: "📋",
    architect: "🏗️",
    coder: "💻",
    reviewer: "🔍",
    debugger: "🐛",
    tester: "🧪",
    styler: "🎨",
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <Hammer className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold">Mission Architect</span>
        {specs && specs.length > 1 && (
          <select
            className="ml-auto text-xs bg-background border border-border rounded px-1 py-0.5"
            value={selectedSpecIdx}
            onChange={(e) => setSelectedSpecIdx(Number(e.target.value))}
          >
            {specs.map((s, i) => (
              <option key={s._id} value={i}>
                {s.originalPrompt.slice(0, 40)}...
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {spec && (
          <>
            {/* Original → Expanded */}
            <CollapsibleSection
              title="Mission Spec"
              icon={<Sparkles className="h-3.5 w-3.5 text-purple-400" />}
              isOpen={expandedSections.has("spec")}
              onToggle={() => toggleSection("spec")}
            >
              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Original idea:
                </div>
                <div className="text-xs text-foreground/80 italic bg-muted/30 p-2 rounded">
                  "{spec.originalPrompt}"
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-2">
                  Expanded spec:
                </div>
                <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {spec.expandedSpec}
                </div>
              </div>
            </CollapsibleSection>

            {/* Tech Decisions */}
            {spec.techDecisions && spec.techDecisions.length > 0 && (
              <CollapsibleSection
                title={`Tech Decisions (${spec.techDecisions.length})`}
                icon={<Code2 className="h-3.5 w-3.5 text-blue-400" />}
                isOpen={expandedSections.has("tech")}
                onToggle={() => toggleSection("tech")}
              >
                <div className="space-y-2">
                  {spec.techDecisions.map((td, i) => (
                    <div
                      key={i}
                      className="text-xs border border-border/50 rounded p-2 space-y-1"
                    >
                      <div className="font-medium text-foreground">
                        {td.area}: <span className="text-chart-3">{td.decision}</span>
                      </div>
                      <div className="text-muted-foreground">{td.reasoning}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Architecture */}
            {spec.architecture && (
              <CollapsibleSection
                title="Architecture"
                icon={<Hammer className="h-3.5 w-3.5 text-amber-400" />}
                isOpen={expandedSections.has("arch")}
                onToggle={() => toggleSection("arch")}
              >
                <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {spec.architecture}
                </div>
              </CollapsibleSection>
            )}

            {/* Agent Prompts */}
            {spec.agentPrompts && spec.agentPrompts.length > 0 && (
              <CollapsibleSection
                title={`Agent Squad (${spec.agentPrompts.length})`}
                icon={<Lightbulb className="h-3.5 w-3.5 text-yellow-400" />}
                isOpen={expandedSections.has("agents")}
                onToggle={() => toggleSection("agents")}
              >
                <div className="space-y-2">
                  {spec.agentPrompts.map((ap, i) => (
                    <AgentPromptCard key={i} agent={ap} emoji={roleEmojis[ap.role] || "🤖"} />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Edge Cases */}
            {spec.edgeCases && spec.edgeCases.length > 0 && (
              <CollapsibleSection
                title={`Edge Cases (${spec.edgeCases.length})`}
                icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-400" />}
                isOpen={expandedSections.has("edges")}
                onToggle={() => toggleSection("edges")}
              >
                <ul className="text-xs space-y-1">
                  {spec.edgeCases.map((ec, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-orange-400 mt-0.5">⚠</span>
                      <span className="text-foreground/80">{ec}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Quality Gates */}
            {spec.qualityGates && spec.qualityGates.length > 0 && (
              <CollapsibleSection
                title={`Quality Gates (${spec.qualityGates.length})`}
                icon={<Shield className="h-3.5 w-3.5 text-green-400" />}
                isOpen={expandedSections.has("quality")}
                onToggle={() => toggleSection("quality")}
              >
                <ul className="text-xs space-y-1">
                  {spec.qualityGates.map((qg, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span className="text-foreground/80">{qg}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Refinements */}
            {refinements && refinements.length > 0 && (
              <CollapsibleSection
                title={`Self-Refinements (${refinements.length})`}
                icon={<RefreshCw className="h-3.5 w-3.5 text-cyan-400" />}
                isOpen={expandedSections.has("refine")}
                onToggle={() => toggleSection("refine")}
              >
                <div className="space-y-2">
                  {refinements.map((r, i) => (
                    <div
                      key={i}
                      className="text-xs border border-cyan-400/20 rounded p-2 space-y-1"
                    >
                      <div className="font-medium text-cyan-400">
                        🔄 {r.reason}
                      </div>
                      <div className="text-muted-foreground">
                        {r.refinedPrompt.slice(0, 200)}
                        {r.refinedPrompt.length > 200 ? "..." : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function AgentPromptCard({
  agent,
  emoji,
}: {
  agent: {
    role: string;
    title: string;
    refinedPrompt: string;
    model: string;
    priority: number;
    dependencies: string[];
    acceptanceCriteria: string[];
  };
  emoji: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/50 rounded p-2 space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span>{emoji}</span>
        <span className="text-xs font-medium flex-1">{agent.title}</span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded",
            agent.model === "grok-4.1-fast"
              ? "bg-purple-500/20 text-purple-300"
              : agent.model === "deepseek-v3.2"
                ? "bg-blue-500/20 text-blue-300"
                : "bg-green-500/20 text-green-300"
          )}
        >
          {agent.model}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 mt-1">
          <div className="text-xs text-foreground/80 whitespace-pre-wrap bg-muted/20 p-2 rounded">
            {agent.refinedPrompt}
          </div>

          {agent.acceptanceCriteria.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Acceptance Criteria:
              </div>
              <ul className="text-xs space-y-0.5">
                {agent.acceptanceCriteria.map((c, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-green-400">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.dependencies.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              Depends on: {agent.dependencies.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
