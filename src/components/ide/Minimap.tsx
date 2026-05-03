/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — CODE MINIMAP
 * ═══════════════════════════════════════════════════════════════════
 *
 * VS Code-style minimap showing a zoomed-out view of the current file.
 * Click to jump, drag to scroll.
 */
import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MinimapProps {
  content: string | null;
  visibleStartLine?: number;
  visibleEndLine?: number;
  totalLines?: number;
  onScrollTo?: (line: number) => void;
  className?: string;
}

// Simple syntax colorization for minimap pixels
function getLineColor(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("#")) {
    return "rgba(255,255,255,0.06)"; // comments
  }
  if (/^(import|export|from|require)/.test(trimmed)) {
    return "rgba(139,92,246,0.25)"; // imports — purple
  }
  if (/^(function|const|let|var|class|interface|type|enum|def)/.test(trimmed)) {
    return "rgba(16,185,129,0.3)"; // declarations — green
  }
  if (/^(if|else|for|while|switch|case|try|catch|return|throw)/.test(trimmed)) {
    return "rgba(234,179,8,0.2)"; // control flow — yellow
  }
  if (/^(async|await)/.test(trimmed)) {
    return "rgba(59,130,246,0.25)"; // async — blue
  }
  if (trimmed.startsWith("<") || trimmed.startsWith("/>") || trimmed.startsWith("</")) {
    return "rgba(239,68,68,0.15)"; // JSX — red
  }
  return "rgba(255,255,255,0.1)"; // normal code
}

export function Minimap({
  content,
  visibleStartLine = 0,
  visibleEndLine = 40,
  totalLines,
  onScrollTo,
  className,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const lines = useMemo(() => (content ? content.split("\n") : []), [content]);
  const lineCount = totalLines ?? lines.length;

  const LINE_HEIGHT = 2;
  const CANVAS_WIDTH = 60;
  const canvasHeight = Math.max(lineCount * LINE_HEIGHT, 100);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !lines.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, CANVAS_WIDTH, canvasHeight);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = i * LINE_HEIGHT;
      const indent = line.length - line.trimStart().length;
      const contentLength = Math.min(line.trim().length, 50);

      if (contentLength === 0) continue;

      const color = getLineColor(line);
      ctx.fillStyle = color;

      const x = Math.min(indent * 0.8, 20);
      const width = Math.min(contentLength * 0.9, CANVAS_WIDTH - x - 2);

      ctx.fillRect(x, y, width, LINE_HEIGHT - 0.5);
    }
  }, [lines, canvasHeight]);

  // Visible range highlight
  const viewportTop = visibleStartLine * LINE_HEIGHT;
  const viewportHeight = Math.max(
    (visibleEndLine - visibleStartLine) * LINE_HEIGHT,
    10
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current || !onScrollTo) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const scrollY = containerRef.current.scrollTop;
      const clickLine = Math.floor((y + scrollY) / LINE_HEIGHT);
      onScrollTo(Math.max(0, Math.min(clickLine, lineCount - 1)));
    },
    [onScrollTo, lineCount]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      handleClick(e);
    },
    [handleClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) handleClick(e);
    },
    [isDragging, handleClick]
  );

  useEffect(() => {
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, []);

  if (!content || lines.length < 20) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-[60px] overflow-hidden cursor-pointer bg-[#06060a] border-l border-white/5",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: canvasHeight }}
      />

      {/* Viewport indicator */}
      <div
        className="absolute left-0 right-0 bg-white/5 border-y border-white/10 pointer-events-none transition-[top] duration-75"
        style={{
          top: `${viewportTop}px`,
          height: `${viewportHeight}px`,
        }}
      />
    </div>
  );
}
