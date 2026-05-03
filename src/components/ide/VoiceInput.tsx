/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — VOICE INPUT
 * ═══════════════════════════════════════════════════════════════════
 *
 * Speech-to-code input using Web Speech API.
 * Hold the mic button or press V to dictate code instructions.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInput({ onTranscript, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  // Check for browser support
  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript(final + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        toast.error(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript("");
    toast.info("🎤 Listening... Speak your instructions");
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);

    // Send the transcript
    if (transcript.trim()) {
      onTranscript(transcript.trim());
      toast.success("Voice command sent!");
    }
    setTranscript("");
  }, [transcript, onTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isSupported) return null;

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 p-0 transition-colors relative",
          isListening
            ? "text-red-400 hover:text-red-300 bg-red-500/10"
            : "text-white/30 hover:text-white/60"
        )}
        onClick={toggleListening}
        title={isListening ? "Stop listening" : "Voice input (speak your code request)"}
      >
        {isListening ? (
          <>
            <MicOff className="h-3.5 w-3.5" />
            {/* Pulsing ring */}
            <span className="absolute inset-0 rounded-md border-2 border-red-400/30 animate-ping" />
          </>
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </Button>

      {/* Live transcript overlay */}
      {isListening && transcript && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 max-w-xs p-2 bg-[#0d0d14] border border-white/10 rounded-lg shadow-xl">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[9px] text-red-400/70 font-semibold uppercase">
              Listening
            </span>
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">
            {transcript}
          </p>
        </div>
      )}
    </div>
  );
}
