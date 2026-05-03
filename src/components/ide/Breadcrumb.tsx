/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — FILE BREADCRUMB
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows the current file path as clickable breadcrumb segments.
 */
import { cn } from "@/lib/utils";
import { ChevronRight, FolderGit2 } from "lucide-react";

interface BreadcrumbProps {
  path: string;
  projectName?: string;
  className?: string;
}

export function Breadcrumb({ path, projectName, className }: BreadcrumbProps) {
  if (!path) return null;

  const segments = path.split("/").filter(Boolean);

  return (
    <div className={cn("flex items-center gap-0.5 px-3 py-1 bg-[#0a0a0f] border-b border-white/5 overflow-x-auto scrollbar-none", className)}>
      {projectName && (
        <>
          <span className="flex items-center gap-1 text-[10px] text-white/20 shrink-0">
            <FolderGit2 className="h-3 w-3" />
            {projectName}
          </span>
          <ChevronRight className="h-2.5 w-2.5 text-white/10 shrink-0" />
        </>
      )}
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center gap-0.5 shrink-0">
            <span
              className={cn(
                "text-[10px]",
                isLast ? "text-white/60 font-medium" : "text-white/20"
              )}
            >
              {segment}
            </span>
            {!isLast && (
              <ChevronRight className="h-2.5 w-2.5 text-white/10" />
            )}
          </span>
        );
      })}
    </div>
  );
}
