/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — SHAREABLE LIVE PREVIEW (UPGRADE #3)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Generates a public URL for any project preview — no deploy needed.
 * Built using Convex + a public HTTP endpoint that serves the compiled
 * project files directly. Anyone with the link can open it.
 *
 * Features:
 * - One-click "Share Preview" button in TopBar
 * - Public URL: https://preview.codeforge.dev/p/{shareToken}
 * - Password protection option
 * - Expiry: 24h / 7 days / permanent
 * - QR code for mobile testing
 * - Inline "copy link" toast
 * - View count + last visited
 * - Revoke access button
 */

// src/components/ide/ShareablePreview.tsx
import { useState } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Copy, Check, X, Lock, Clock, Eye,
  QrCode, Trash2, RefreshCw, ExternalLink, Share2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Expiry = "24h" | "7d" | "never";

interface ShareablePreviewProps {
  projectId: Id<"projects"> | null;
  projectName: string;
  onClose: () => void;
}

const EXPIRY_OPTIONS: { value: Expiry; label: string; desc: string }[] = [
  { value: "24h", label: "24 hours", desc: "Link expires tomorrow" },
  { value: "7d", label: "7 days", desc: "Link expires next week" },
  { value: "never", label: "Permanent", desc: "Link never expires" },
];

export function ShareablePreview({ projectId, projectName, onClose }: ShareablePreviewProps) {
  const [expiry, setExpiry] = useState<Expiry>("7d");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const createShare = useAction(api.previews.createShareLink);
  const revokeShare = useMutation(api.previews.revokeShareLink);

  const existingShare = useQuery(
    api.previews.getShareLink,
    projectId ? { projectId } : "skip"
  );

  const shareUrl = existingShare?.token
    ? `https://preview.codeforge.dev/p/${existingShare.token}`
    : null;

  const handleCreate = async () => {
    if (!projectId) return;
    setIsCreating(true);
    try {
      await createShare({
        projectId,
        expiry,
        password: usePassword && password ? password : undefined,
      });
      toast.success("Share link created!");
    } catch (e: any) {
      toast.error(e.message || "Failed to create share link");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied to clipboard!");
  };

  const handleRevoke = async () => {
    if (!projectId || !existingShare?._id) return;
    await revokeShare({ shareId: existingShare._id });
    toast.success("Share link revoked");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="absolute top-12 right-0 z-50 w-96 bg-[#111118] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Share Preview</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/70">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {existingShare?.token ? (
          /* Active share link */
          <>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-400 font-medium mb-0.5">Preview is live</p>
                <p className="text-xs text-white/50 truncate">{shareUrl}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Eye, label: "Views", value: existingShare.viewCount || 0 },
                { icon: Clock, label: "Expires", value: existingShare.expiry === "never" ? "Never" : existingShare.expiresAt ? new Date(existingShare.expiresAt).toLocaleDateString() : "—" },
                { icon: Lock, label: "Protected", value: existingShare.hasPassword ? "Yes" : "No" },
              ].map(stat => (
                <div key={stat.label} className="bg-white/5 rounded-lg p-2 text-center">
                  <stat.icon className="w-3.5 h-3.5 text-white/30 mx-auto mb-1" />
                  <p className="text-xs font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/30">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* QR Code toggle */}
            {showQR && shareUrl && (
              <div className="flex flex-col items-center gap-2 py-2">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}&bgcolor=111118&color=e8e8f0&format=svg`}
                  alt="QR Code"
                  className="w-32 h-32 rounded-lg"
                />
                <p className="text-xs text-white/30">Scan to open on mobile</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white font-medium transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={shareUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white transition-all"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => setShowQR(v => !v)}
                className={cn(
                  "flex items-center justify-center px-3 py-2 rounded-lg text-sm transition-all",
                  showQR ? "bg-purple-500/20 text-purple-400" : "bg-white/10 text-white hover:bg-white/15"
                )}
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleRevoke}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Revoke link
            </button>
          </>
        ) : (
          /* Create new share */
          <>
            <div>
              <label className="text-xs text-white/40 mb-2 block">Link expiry</label>
              <div className="flex gap-1.5">
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setExpiry(opt.value)}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all",
                      expiry === opt.value
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                        : "border-white/10 text-white/40 hover:border-white/20"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/40">Password protection</label>
                <button
                  onClick={() => setUsePassword(v => !v)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-all relative",
                    usePassword ? "bg-emerald-500" : "bg-white/20"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    usePassword ? "left-4.5" : "left-0.5"
                  )} />
                </button>
              </div>
              {usePassword && (
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter a password..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                />
              )}
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !projectId}
              className="w-full bg-emerald-600 hover:bg-emerald-500"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Share2 className="w-4 h-4 mr-1.5" />
              )}
              {isCreating ? "Creating link..." : "Create Share Link"}
            </Button>

            <p className="text-xs text-white/25 text-center">
              Anyone with the link can view a live preview of your project
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
