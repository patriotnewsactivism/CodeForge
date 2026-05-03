/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — WORKSPACE SEARCH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Search across all files in a project. Regex support, replace all.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  FileCode,
  ChevronDown,
  ChevronRight,
  Replace,
  CaseSensitive,
  Regex,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchResult {
  fileId: string;
  fileName: string;
  filePath: string;
  matches: Array<{
    line: number;
    text: string;
    matchStart: number;
    matchEnd: number;
  }>;
}

interface SearchPanelProps {
  projectId: Id<"projects"> | null;
  onFileSelect: (fileId: string, name: string, path: string) => void;
}

export function SearchPanel({ projectId, onFileSelect }: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const files = useQuery(
    api.files.listWithContent,
    projectId ? { projectId } : "skip"
  );

  const results = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim() || !files) return [];

    const results: SearchResult[] = [];

    for (const file of files) {
      if (!file.content || file.type === "folder") continue;

      const lines = file.content.split("\n");
      const matches: SearchResult["matches"] = [];

      for (let i = 0; i < lines.length; i++) {
        try {
          let regex: RegExp;
          if (useRegex) {
            regex = new RegExp(searchQuery, caseSensitive ? "g" : "gi");
          } else {
            const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            regex = new RegExp(escaped, caseSensitive ? "g" : "gi");
          }

          let match;
          while ((match = regex.exec(lines[i])) !== null) {
            matches.push({
              line: i + 1,
              text: lines[i],
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
            if (!regex.global) break;
          }
        } catch {
          // Invalid regex — skip
        }
      }

      if (matches.length > 0) {
        results.push({
          fileId: file._id as string,
          fileName: file.name,
          filePath: file.path,
          matches,
        });
      }
    }

    return results;
  }, [searchQuery, files, caseSensitive, useRegex]);

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  const toggleFile = useCallback((fileId: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  // Auto-expand first results
  useMemo(() => {
    if (results.length > 0 && results.length <= 5) {
      setExpandedFiles(new Set(results.map((r) => r.fileId)));
    }
  }, [results]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-white/30 shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in files..."
            className="h-7 text-xs bg-white/5 border-white/10"
          />
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={cn(
              "p-1 rounded transition-colors shrink-0",
              caseSensitive ? "bg-emerald-500/20 text-emerald-400" : "text-white/20 hover:text-white/40"
            )}
            title="Case Sensitive"
          >
            <CaseSensitive className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={cn(
              "p-1 rounded transition-colors shrink-0",
              useRegex ? "bg-emerald-500/20 text-emerald-400" : "text-white/20 hover:text-white/40"
            )}
            title="Use Regex"
          >
            <Regex className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className={cn(
              "p-1 rounded transition-colors shrink-0",
              showReplace ? "bg-emerald-500/20 text-emerald-400" : "text-white/20 hover:text-white/40"
            )}
            title="Toggle Replace"
          >
            <Replace className="h-3.5 w-3.5" />
          </button>
        </div>

        {showReplace && (
          <div className="flex items-center gap-2">
            <Replace className="h-4 w-4 text-white/20 shrink-0" />
            <Input
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="h-7 text-xs bg-white/5 border-white/10"
            />
          </div>
        )}

        {searchQuery && (
          <div className="text-[10px] text-white/30 mt-1.5">
            {totalMatches} result{totalMatches !== 1 ? "s" : ""} in {results.length} file{results.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!searchQuery && (
          <div className="text-center py-12 text-white/15 text-xs">
            Type to search across all files
          </div>
        )}

        {searchQuery && results.length === 0 && (
          <div className="text-center py-12 text-white/15 text-xs">
            No results found
          </div>
        )}

        {results.map((result) => {
          const isExpanded = expandedFiles.has(result.fileId);
          return (
            <div key={result.fileId}>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.03] transition-colors"
                onClick={() => toggleFile(result.fileId)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-white/20 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-white/20 shrink-0" />
                )}
                <FileCode className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
                <span className="text-[11px] text-white/60 truncate flex-1">
                  {result.filePath}
                </span>
                <span className="text-[9px] text-white/20 shrink-0">
                  {result.matches.length}
                </span>
              </button>

              {isExpanded &&
                result.matches.slice(0, 50).map((match, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 pl-8 pr-3 py-1 text-left hover:bg-white/[0.03] transition-colors"
                    onClick={() =>
                      onFileSelect(
                        result.fileId,
                        result.fileName,
                        result.filePath
                      )
                    }
                  >
                    <span className="text-[9px] text-white/15 w-6 text-right shrink-0">
                      {match.line}
                    </span>
                    <span className="text-[11px] text-white/40 truncate font-mono">
                      {match.text.substring(0, match.matchStart)}
                      <span className="text-yellow-400 bg-yellow-400/10 rounded px-0.5">
                        {match.text.substring(match.matchStart, match.matchEnd)}
                      </span>
                      {match.text.substring(match.matchEnd)}
                    </span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
