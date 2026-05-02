/**
 * RAG PANEL — Search and explore the codebase index
 *
 * Shows indexing stats, allows searching across the codebase,
 * and displays relevant code chunks with syntax highlighting.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import {
  Search,
  Database,
  FileCode,
  RefreshCw,
  Loader2,
  Hash,
  Layers,
} from "lucide-react";

interface RAGPanelProps {
  projectId: Id<"projects"> | null;
}

export function RAGPanel({ projectId }: RAGPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);

  const stats = useQuery(
    api.rag.getStats,
    projectId ? { projectId } : "skip"
  );

  const searchResults = useQuery(
    api.rag.search,
    projectId && searchQuery.length >= 2
      ? { projectId, query: searchQuery, limit: 10 }
      : "skip"
  );

  const indexProject = useAction(api.rag.indexProject);

  const handleReindex = useCallback(async () => {
    if (!projectId) return;
    setIsIndexing(true);
    try {
      await indexProject({ projectId });
    } catch (e) {
      console.error("Indexing failed:", e);
    } finally {
      setIsIndexing(false);
    }
  }, [projectId, indexProject]);

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Select a project to search code</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-chart-3" />
          <span className="text-sm font-semibold">Code Search</span>
        </div>
        <button
          onClick={handleReindex}
          disabled={isIndexing}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
        >
          {isIndexing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {isIndexing ? "Indexing..." : "Re-index"}
        </button>
      </div>

      {/* Stats bar */}
      {stats && stats.totalChunks > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/50 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {stats.totalChunks} chunks
          </span>
          <span className="flex items-center gap-1">
            <FileCode className="h-3 w-3" />
            {stats.filesIndexed} files
          </span>
          {stats.languages && Object.keys(stats.languages as Record<string, number>).slice(0, 3).map((lang) => (
            <Badge key={lang} variant="outline" className="text-[9px] h-4 px-1">
              {lang}
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search functions, components, APIs..."
            className="w-full bg-background border border-border rounded-md pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-chart-3 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {stats && stats.totalChunks === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Database className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-xs font-medium">Not indexed yet</p>
              <p className="text-[10px] text-center mt-1">
                Click "Re-index" or launch a mission — indexing happens automatically
              </p>
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-xs">Type to search your codebase</p>
              <p className="text-[10px] mt-1">Agents use this to understand your code</p>
            </div>
          ) : !searchResults || searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <p className="text-xs">No results for "{searchQuery}"</p>
            </div>
          ) : (
            searchResults.map((result) => (
              <div
                key={result._id}
                className="rounded-lg border border-border/50 overflow-hidden"
              >
                {/* File header */}
                <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileCode className="h-3 w-3 text-chart-3 shrink-0" />
                    <span className="text-[11px] font-medium text-foreground truncate">
                      {result.filePath}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      {result.chunkType}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Hash className="h-2.5 w-2.5" />
                      L{result.startLine}-{result.endLine}
                    </span>
                    <span className="text-[9px] text-chart-2">
                      {result.score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Symbol name */}
                {result.symbolName && (
                  <div className="px-2 py-0.5 bg-muted/20 border-b border-border/30">
                    <span className="text-[10px] font-mono text-chart-3">
                      {result.symbolName}
                    </span>
                  </div>
                )}

                {/* Code content */}
                <pre className="px-2 py-1.5 text-[10px] font-mono text-foreground/70 whitespace-pre-wrap break-words max-h-36 overflow-hidden leading-relaxed">
                  {result.content.slice(0, 500)}{result.content.length > 500 ? "\n..." : ""}
                </pre>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
