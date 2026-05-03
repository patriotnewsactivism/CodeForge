/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — LOADING / SPLASH SCREEN
 * ═══════════════════════════════════════════════════════════════════
 *
 * Animated loading screen shown during auth check and initial load.
 */
import { useState, useEffect } from "react";

const LOADING_MESSAGES = [
  "Initializing agent swarm...",
  "Loading AI models...",
  "Preparing workspace...",
  "Connecting to Convex...",
  "Ready to build.",
];

export function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1200);

    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 95));
    }, 300);

    return () => {
      clearInterval(msgTimer);
      clearInterval(progressTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#06060a] flex items-center justify-center z-50">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(16,185,129,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(16,185,129,0.3) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-emerald-400/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10 mb-4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-8 h-8 text-emerald-400"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 3L4 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 3l-4 11" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="19" r="2" fill="currentColor" opacity="0.3" />
              <path d="M7 19h10" strokeLinecap="round" opacity="0.3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white/90 tracking-tight">
            Code<span className="text-emerald-400">Forge</span>
          </h1>
          <p className="text-xs text-white/20 mt-1">Autonomous AI Coding Platform</p>
        </div>

        {/* Progress bar */}
        <div className="w-48 mx-auto mb-4">
          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500/50 to-emerald-400/80 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Loading message */}
        <p className="text-[11px] text-white/20 h-4 transition-opacity duration-300">
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
