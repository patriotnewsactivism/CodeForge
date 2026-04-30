import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Zap, ArrowUpDown } from "lucide-react";

interface Session {
  _id: Id<"sessions">;
  model: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCost?: number;
}

export function CostBar({ session }: { session: Session | null | undefined }) {
  const totalTokens =
    (session?.totalInputTokens || 0) + (session?.totalOutputTokens || 0);
  const totalCost = session?.totalCost || 0;

  return (
    <div className="flex items-center gap-4 border-t border-border bg-card/50 px-3 py-1 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <Zap className="h-3 w-3 text-chart-3" />
        <span className="font-semibold text-foreground">CodeForge</span>
      </div>

      <div className="flex items-center gap-1">
        <ArrowUpDown className="h-2.5 w-2.5" />
        <span>
          {(session?.totalInputTokens || 0).toLocaleString()} in /{" "}
          {(session?.totalOutputTokens || 0).toLocaleString()} out
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span>Total: {totalTokens.toLocaleString()} tokens</span>
      </div>

      <div className="flex items-center gap-1">
        <DollarSign className="h-2.5 w-2.5 text-chart-2" />
        <span className={totalCost > 0 ? "text-chart-2 font-medium" : ""}>
          ${totalCost.toFixed(4)}
        </span>
        <span className="opacity-50">this session</span>
      </div>

      <div className="flex-1" />

      <Badge variant="secondary" className="text-[9px] h-3.5 px-1.5">
        {session?.model || "No model"}
      </Badge>
    </div>
  );
}
