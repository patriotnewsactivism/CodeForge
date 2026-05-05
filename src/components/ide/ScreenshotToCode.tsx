/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — SCREENSHOT-TO-CODE (UPGRADE #2)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Drag in a screenshot (bug, design mockup, competitor UI, error)
 * → GPT-4o Vision interprets it
 * → Agents write the code to implement or fix it
 *
 * Features:
 * - Drag-and-drop OR paste from clipboard (Ctrl+V)
 * - Camera capture on mobile
 * - Three modes: "Build this UI", "Fix this bug", "Copy this design"
 * - Vision analysis shown before agents start
 * - Injects the prompt + image into the chat → mission launches
 */

// src/components/ide/ScreenshotToCode.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Upload, Clipboard, X, Eye, Code, Bug,
  Palette, Sparkles, ArrowRight, Loader2, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "build" | "fix" | "copy" | "analyze";

const MODES: { id: Mode; label: string; icon: typeof Code; desc: string; color: string }[] = [
  { id: "build", label: "Build this UI", icon: Code, desc: "Build this interface in React/Tailwind", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { id: "fix", label: "Fix this bug", icon: Bug, desc: "Analyze the error and fix my code", color: "text-red-400 border-red-500/30 bg-red-500/10" },
  { id: "copy", label: "Copy design", icon: Palette, desc: "Replicate this design for my project", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  { id: "analyze", label: "Analyze & suggest", icon: Eye, desc: "Describe what you see, suggest improvements", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
];

interface ScreenshotToCodeProps {
  projectId: Id<"projects"> | null;
  sessionId: Id<"sessions"> | null;
  onPromptReady: (prompt: string, imageBase64: string) => void;
  onClose: () => void;
}

export function ScreenshotToCode({ projectId, sessionId, onPromptReady, onClose }: ScreenshotToCodeProps) {
  const [image, setImage] = useState<{ base64: string; url: string; name: string } | null>(null);
  const [mode, setMode] = useState<Mode>("build");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "mode" | "review">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const analyzeImage = useAction(api.vision.analyzeScreenshot);

  // Clipboard paste
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await processImageFile(file);
          break;
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large (max 10MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImage({ base64, url: base64, name: file.name });
      setStep("mode");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processImageFile(file);
  }, []);

  const runAnalysis = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setStep("review");
    try {
      const result = await analyzeImage({
        imageBase64: image.base64,
        mode,
        projectId: projectId || undefined,
      });
      setAnalysis(result.analysis);
    } catch (e: any) {
      toast.error("Vision analysis failed: " + e.message);
      setAnalysis("Could not analyze image. You can still send it to the agents.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const launch = () => {
    if (!image) return;
    const modeConfig = MODES.find(m => m.id === mode)!;
    const prompt = customPrompt.trim() ||
      (analysis
        ? `${modeConfig.desc}.\n\nImage analysis:\n${analysis}`
        : modeConfig.desc);
    onPromptReady(prompt, image.base64);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Camera className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Screenshot → Code</h2>
              <p className="text-xs text-white/40">Drop a screenshot, get working code</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div
              ref={dropZoneRef}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer",
                isDragging
                  ? "border-purple-400 bg-purple-500/10"
                  : "border-white/15 hover:border-white/30 hover:bg-white/5"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center">
                  <Upload className="w-7 h-7 text-white/30" />
                </div>
                <div>
                  <p className="text-white font-medium">Drop screenshot here</p>
                  <p className="text-white/40 text-sm mt-0.5">or click to browse · Ctrl+V to paste</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs text-white/30 border-white/10">PNG</Badge>
                  <Badge variant="outline" className="text-xs text-white/30 border-white/10">JPG</Badge>
                  <Badge variant="outline" className="text-xs text-white/30 border-white/10">WebP</Badge>
                  <Badge variant="outline" className="text-xs text-white/30 border-white/10">GIF</Badge>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Mode selection */}
          {step === "mode" && image && (
            <>
              <div className="flex gap-4">
                <img
                  src={image.url}
                  alt="Screenshot"
                  className="w-36 h-28 object-cover rounded-lg border border-white/10 flex-shrink-0"
                />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-white/60">What do you want to do with this?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MODES.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={cn(
                          "p-2.5 rounded-lg border text-left transition-all",
                          mode === m.id ? m.color : "border-white/10 text-white/50 hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <m.icon className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">{m.label}</span>
                        </div>
                        <p className="text-xs opacity-60">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Add context (optional)</label>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Use our existing Tailwind theme, match the dark red color scheme..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setImage(null); setStep("upload"); }} className="flex-1 border-white/10">
                  ← Back
                </Button>
                <Button onClick={runAnalysis} className="flex-1 bg-purple-600 hover:bg-purple-500">
                  <Eye className="w-4 h-4 mr-1.5" /> Analyze with Vision
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Review & launch */}
          {step === "review" && image && (
            <>
              <div className="flex gap-4">
                <img
                  src={image.url}
                  alt="Screenshot"
                  className="w-28 h-20 object-cover rounded-lg border border-white/10 flex-shrink-0"
                />
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-white/50">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span className="text-sm">Vision AI analyzing screenshot...</span>
                  </div>
                ) : analysis ? (
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">Vision Analysis Complete</span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed line-clamp-4">{analysis}</p>
                  </div>
                ) : null}
              </div>

              {analysis && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-white/40 mb-1">Prompt being sent to agents:</p>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {customPrompt || MODES.find(m => m.id === mode)?.desc}
                    {analysis && `\n\n${analysis}`}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("mode")} className="flex-1 border-white/10">
                  ← Back
                </Button>
                <Button
                  onClick={launch}
                  disabled={isAnalyzing}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Launch Agents
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processImageFile(f); }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processImageFile(f); }}
        />
      </div>
    </motion.div>
  );
}
