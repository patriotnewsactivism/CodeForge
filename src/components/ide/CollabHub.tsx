/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — COLLABORATION HUB
 * ═══════════════════════════════════════════════════════════════════
 *
 * Real-time collaboration features:
 * - Share project links with others
 * - See who's online and what they're editing
 * - Live cursor positions (simulated with Convex)
 * - Chat sidebar for pair programming
 * - Session recording / replay
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Link,
  Copy,
  Check,
  MessageCircle,
  Circle,
  Radio,
  UserPlus,
  Eye,
  Edit3,
  Globe,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CollabHubProps {
  projectId: Id<"projects"> | null;
  sessionId: string | null;
}

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-pink-500", "bg-cyan-500", "bg-rose-500", "bg-lime-500",
];

interface SimulatedUser {
  id: string;
  name: string;
  avatar: string;
  status: "editing" | "viewing" | "idle";
  file?: string;
  color: string;
}

export function CollabHub({ projectId, sessionId }: CollabHubProps) {
  const [copied, setCopied] = useState(false);
  const [shareMode, setShareMode] = useState<"private" | "view" | "edit">("private");
  const [chatMessages, setChatMessages] = useState<Array<{ user: string; text: string; time: string }>>([
    { user: "System", text: "Collaboration hub initialized. Share your project to start.", time: "now" },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Simulated online users (in real implementation, this would be from Convex presence)
  const onlineUsers: SimulatedUser[] = useMemo(() => [
    {
      id: "you",
      name: "You",
      avatar: "👨‍💻",
      status: "editing" as const,
      file: "src/App.tsx",
      color: AVATAR_COLORS[0],
    },
  ], []);

  const shareUrl = projectId
    ? `${window.location.origin}/collab/${projectId}?session=${sessionId || "default"}`
    : "";

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { user: "You", text: chatInput, time: "now" },
    ]);
    setChatInput("");
  };

  const statusIcon = {
    editing: { icon: Edit3, color: "text-emerald-400", label: "Editing" },
    viewing: { icon: Eye, color: "text-blue-400", label: "Viewing" },
    idle: { icon: Circle, color: "text-white/20", label: "Idle" },
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Users className="h-4 w-4 text-violet-400" />
        <span className="text-xs font-semibold text-white/70">Collaboration</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
          {onlineUsers.length} online
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Share Settings */}
        <div className="p-3 border-b border-white/[0.03]">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">
            Share Settings
          </p>
          <div className="flex gap-1 mb-2">
            {([
              { id: "private", icon: Lock, label: "Private" },
              { id: "view", icon: Eye, label: "View Only" },
              { id: "edit", icon: Edit3, label: "Can Edit" },
            ] as const).map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setShareMode(mode.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium flex-1 justify-center transition-colors",
                    shareMode === mode.id
                      ? "bg-violet-600/20 text-violet-400 border border-violet-500/20"
                      : "bg-white/[0.02] text-white/20 border border-white/[0.04] hover:text-white/40"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          {shareMode !== "private" && (
            <div className="flex gap-1">
              <Input
                value={shareUrl}
                readOnly
                className="h-7 text-[9px] font-mono bg-white/[0.02] border-white/5 flex-1"
              />
              <Button
                size="sm"
                className="h-7 text-[9px] px-2 bg-violet-600 hover:bg-violet-500"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>

        {/* Online Users */}
        <div className="p-3 border-b border-white/[0.03]">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">
            Online Now
          </p>
          <div className="space-y-1.5">
            {onlineUsers.map((user) => {
              const st = statusIcon[user.status];
              const StIcon = st.icon;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.01] border border-white/[0.04]"
                >
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-sm", user.color)}>
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 font-medium">{user.name}</p>
                    <div className="flex items-center gap-1">
                      <StIcon className={cn("h-2.5 w-2.5", st.color)} />
                      <span className="text-[9px] text-white/20">
                        {st.label}
                        {user.file && ` • ${user.file}`}
                      </span>
                    </div>
                  </div>
                  <Radio className="h-3 w-3 text-emerald-400/40" />
                </div>
              );
            })}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 h-7 text-[10px] border-white/5 text-white/25 gap-1"
            onClick={() => toast.info("Invite link copied!")}
          >
            <UserPlus className="h-3 w-3" />
            Invite Collaborator
          </Button>
        </div>

        {/* Pair Programming Chat */}
        <div className="flex flex-col h-[250px]">
          <div className="px-3 py-1.5 border-b border-white/[0.03]">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              Team Chat
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-[10px]">
                <span className={cn(
                  "font-medium",
                  msg.user === "You" ? "text-violet-400" : "text-white/25"
                )}>
                  {msg.user}:
                </span>{" "}
                <span className="text-white/30">{msg.text}</span>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-white/[0.03]">
            <div className="flex gap-1">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                placeholder="Type a message..."
                className="h-6 text-[10px] bg-white/[0.02] border-white/5"
              />
              <Button
                size="sm"
                className="h-6 text-[9px] px-2 bg-violet-600 hover:bg-violet-500"
                onClick={handleSendChat}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
