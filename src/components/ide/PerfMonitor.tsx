/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — PERFORMANCE MONITOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Real-time performance metrics: bundle size, render counts,
 * memory usage, and network requests.
 */
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Gauge,
  Cpu,
  MemoryStick,
  Timer,
  Wifi,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PerfMetrics {
  fps: number;
  memoryUsed: number; // MB
  memoryTotal: number; // MB
  renderCount: number;
  loadTime: number; // ms
  domNodes: number;
}

function usePerfMetrics(): PerfMetrics {
  const [metrics, setMetrics] = useState<PerfMetrics>({
    fps: 60,
    memoryUsed: 0,
    memoryTotal: 0,
    renderCount: 0,
    loadTime: 0,
    domNodes: 0,
  });
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current++;

    let rafId: number;
    const measureFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastTimeRef.current = now;

        const memory = (performance as any).memory;
        const navEntry = performance.getEntriesByType("navigation")[0] as any;

        setMetrics({
          fps,
          memoryUsed: memory
            ? Math.round(memory.usedJSHeapSize / 1024 / 1024)
            : 0,
          memoryTotal: memory
            ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
            : 0,
          renderCount: renderCountRef.current,
          loadTime: navEntry
            ? Math.round(navEntry.loadEventEnd - navEntry.startTime)
            : 0,
          domNodes: document.querySelectorAll("*").length,
        });
      }

      rafId = requestAnimationFrame(measureFPS);
    };

    rafId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return metrics;
}

interface PerfMonitorProps {
  className?: string;
}

export function PerfMonitor({ className }: PerfMonitorProps) {
  const metrics = usePerfMetrics();
  const [expanded, setExpanded] = useState(false);

  const fpsColor =
    metrics.fps >= 50
      ? "text-emerald-400"
      : metrics.fps >= 30
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div
      className={cn(
        "border border-white/5 rounded-lg bg-[#0a0a0f] overflow-hidden",
        className
      )}
    >
      {/* Compact bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-white/[0.02] transition-colors"
      >
        <Gauge className="h-3 w-3 text-white/20" />
        <span className="text-[10px] text-white/30 font-medium">Perf</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className={cn("text-[10px] font-mono font-bold", fpsColor)}>
            {metrics.fps} FPS
          </span>
          {metrics.memoryUsed > 0 && (
            <span className="text-[9px] text-white/20 font-mono">
              {metrics.memoryUsed}MB
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-3 w-3 text-white/10 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 border-t border-white/5 grid grid-cols-2 gap-2">
          <MetricCard
            icon={Cpu}
            label="FPS"
            value={`${metrics.fps}`}
            color={fpsColor}
          />
          <MetricCard
            icon={MemoryStick}
            label="Memory"
            value={
              metrics.memoryUsed > 0
                ? `${metrics.memoryUsed}/${metrics.memoryTotal}MB`
                : "N/A"
            }
            color="text-blue-400/60"
          />
          <MetricCard
            icon={Timer}
            label="Load Time"
            value={metrics.loadTime > 0 ? `${metrics.loadTime}ms` : "N/A"}
            color="text-purple-400/60"
          />
          <MetricCard
            icon={Wifi}
            label="DOM Nodes"
            value={`${metrics.domNodes.toLocaleString()}`}
            color="text-orange-400/60"
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded bg-white/[0.02]">
      <Icon className={cn("h-3 w-3 shrink-0", color)} />
      <div>
        <div className="text-[8px] text-white/15 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-[10px] text-white/40 font-mono font-medium">
          {value}
        </div>
      </div>
    </div>
  );
}
