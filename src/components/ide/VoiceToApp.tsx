/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — VOICE-TO-APP
 * ═══════════════════════════════════════════════════════════════════
 *
 * Speak a description → AI scaffolds a full app:
 * - Web Speech API for voice recognition
 * - Real-time transcript with confidence score
 * - AI interprets description into project requirements
 * - Auto-launches a mission to build the app
 * - Shows progress as agents scaffold files
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Rocket,
  Loader2,
  Wand2,
  Volume2,
  CircleDot,
  StopCircle,
  RotateCcw,
  Send,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface VoiceToAppProps {
  projectId: Id<"projects"> | null;
  sessionId: string | null;
  onSendMessage?: (msg: string) => void;
}

interface TranscriptLine {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

const EXAMPLE_PROMPTS = [
  "Build me a task management app with drag-and-drop kanban board",
  "Create a real-time chat application with rooms and user presence",
  "Make a portfolio website with dark mode and project gallery",
  "Build a weather dashboard that shows 5-day forecasts with charts",
  "Create an e-commerce storefront with product cards and shopping cart",
  "Build a markdown note-taking app with folders and tags",
];

export function VoiceToApp({ projectId, sessionId, onSendMessage }: VoiceToAppProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [visualizerValues, setVisualizerValues] = useState<number[]>(Array(20).fill(0));
  const recognitionRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  // Audio visualizer animation
  useEffect(() => {
    if (isListening) {
      const animate = () => {
        setVisualizerValues((prev) =>
          prev.map(() => Math.random() * 0.6 + (isListening ? 0.2 : 0))
        );
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      cancelAnimationFrame(animFrameRef.current);
      setVisualizerValues(Array(20).fill(0));
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isListening]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      const newTranscripts: TranscriptLine[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newTranscripts.push({
            text: result[0].transcript,
            confidence: result[0].confidence,
            isFinal: true,
            timestamp: Date.now(),
          });
        } else {
          interim += result[0].transcript;
        }
      }

      if (newTranscripts.length) {
        setTranscript((prev) => [...prev, ...newTranscripts]);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        toast.error(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    toast.success("Listening... describe your app!");
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handleReset = () => {
    stopListening();
    setTranscript([]);
    setInterimText("");
  };

  const getFullTranscript = () => {
    return transcript.map((t) => t.text).join(" ").trim();
  };

  const handleBuildApp = async () => {
    const fullText = getFullTranscript();
    if (!fullText) {
      toast.error("No voice input recorded");
      return;
    }

    const prompt = `Build me an app based on this description: "${fullText}". Create all necessary files with a clean, modern UI using React, TypeScript, and Tailwind CSS. Include proper routing, state management, responsive design, and helpful comments.`;

    setIsProcessing(true);

    if (onSendMessage) {
      onSendMessage(prompt);
      toast.success("🚀 Mission launched! Check the chat for agent activity.");
    } else {
      toast.info("Copied prompt — paste into chat to launch mission");
      await navigator.clipboard.writeText(prompt);
    }

    setTimeout(() => setIsProcessing(false), 2000);
  };

  const avgConfidence = transcript.length
    ? Math.round((transcript.reduce((a, t) => a + t.confidence, 0) / transcript.length) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Mic className="h-4 w-4 text-pink-400" />
        <span className="text-xs font-semibold text-white/70">Voice → App</span>
        {isListening && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-red-500/20 text-red-400 animate-pulse">
            <CircleDot className="h-2.5 w-2.5 mr-1" />
            LIVE
          </Badge>
        )}
      </div>

      {!isSupported ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <MicOff className="h-8 w-8 text-white/10 mx-auto" />
            <p className="text-xs text-white/20">Speech recognition not supported</p>
            <p className="text-[10px] text-white/10">Try Chrome, Edge, or Safari</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Microphone Control */}
          <div className="flex flex-col items-center py-6 px-3 border-b border-white/[0.03]">
            {/* Audio Visualizer */}
            <div className="flex items-end gap-[2px] h-12 mb-4">
              {visualizerValues.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full transition-all duration-75",
                    isListening ? "bg-pink-500" : "bg-white/10"
                  )}
                  style={{
                    height: `${Math.max(4, v * 48)}px`,
                    opacity: isListening ? 0.3 + v * 0.7 : 0.15,
                  }}
                />
              ))}
            </div>

            {/* Big Mic Button */}
            <button
              onClick={isListening ? stopListening : startListening}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                isListening
                  ? "bg-red-500 shadow-lg shadow-red-500/30 scale-110"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              )}
            >
              {isListening ? (
                <StopCircle className="h-7 w-7 text-white" />
              ) : (
                <Mic className="h-7 w-7 text-white/40" />
              )}
            </button>
            <p className="text-[10px] text-white/15 mt-2">
              {isListening ? "Tap to stop" : "Tap to describe your app"}
            </p>
          </div>

          {/* Transcript */}
          <div className="p-3 border-b border-white/[0.03]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">
                Transcript
              </p>
              {transcript.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/15">{avgConfidence}% confident</span>
                  <button onClick={handleReset} className="text-white/15 hover:text-white/30">
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {transcript.length === 0 && !interimText ? (
              <div className="text-center py-4">
                <Volume2 className="h-5 w-5 text-white/10 mx-auto mb-1" />
                <p className="text-[10px] text-white/15">
                  Your spoken description will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {transcript.map((t, i) => (
                  <p key={i} className="text-[11px] text-white/40 leading-relaxed">
                    {t.text}
                  </p>
                ))}
                {interimText && (
                  <p className="text-[11px] text-white/20 italic">{interimText}...</p>
                )}
              </div>
            )}
          </div>

          {/* Build Button */}
          {transcript.length > 0 && (
            <div className="p-3 border-b border-white/[0.03]">
              <Button
                onClick={handleBuildApp}
                disabled={isProcessing}
                className="w-full h-10 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {isProcessing ? "Launching Mission..." : "Build My App"}
              </Button>
              <p className="text-[9px] text-white/10 text-center mt-1">
                Launches a multi-agent mission to scaffold your entire app
              </p>
            </div>
          )}

          {/* Example Prompts */}
          <div className="p-3">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">
              <Sparkles className="h-3 w-3 inline mr-1" />
              Or try an example
            </p>
            <div className="space-y-1">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setTranscript([{
                      text: prompt,
                      confidence: 1,
                      isFinal: true,
                      timestamp: Date.now(),
                    }]);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                >
                  <p className="text-[10px] text-white/25 leading-relaxed">{prompt}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
