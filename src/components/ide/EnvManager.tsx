/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — ENVIRONMENT VARIABLES MANAGER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Manage project environment variables.
 * Stored as a special `.env` file in the project.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Lock,
} from "lucide-react";

interface EnvVar {
  key: string;
  value: string;
}

interface EnvManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects"> | null;
}

export function EnvManager({ open, onOpenChange, projectId }: EnvManagerProps) {
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [showValues, setShowValues] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);

  // Load .env file from project
  const files = useQuery(
    api.files.listByProject,
    projectId ? { projectId } : "skip"
  );
  const createFile = useMutation(api.files.create);
  const updateFile = useMutation(api.files.updateContent);

  const envFile = files?.find((f) => f.name === ".env" || f.path === ".env");
  const envContent = useQuery(
    api.files.getContent,
    envFile ? { fileId: envFile._id } : "skip"
  );

  // Parse .env on load
  useEffect(() => {
    if (envContent?.content) {
      const parsed = envContent.content
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"))
        .map((line) => {
          const eqIdx = line.indexOf("=");
          if (eqIdx === -1) return { key: line.trim(), value: "" };
          return {
            key: line.substring(0, eqIdx).trim(),
            value: line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, ""),
          };
        });
      setVars(parsed);
      setDirty(false);
    } else if (envContent === null || (files && !envFile)) {
      setVars([]);
      setDirty(false);
    }
  }, [envContent, files, envFile]);

  const addVar = () => {
    setVars([...vars, { key: "", value: "" }]);
    setDirty(true);
  };

  const removeVar = (index: number) => {
    setVars(vars.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updateVar = (index: number, field: "key" | "value", val: string) => {
    const updated = [...vars];
    updated[index] = { ...updated[index], [field]: val };
    setVars(updated);
    setDirty(true);
  };

  const toggleShow = (index: number) => {
    setShowValues((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSave = async () => {
    if (!projectId) return;

    const content = vars
      .filter((v) => v.key.trim())
      .map((v) => `${v.key}=${v.value}`)
      .join("\n");

    try {
      if (envFile) {
        await updateFile({ fileId: envFile._id, content });
      } else {
        await createFile({
          projectId,
          name: ".env",
          path: ".env",
          type: "file" as const,
          content,
          language: "plaintext",
        });
      }
      setDirty(false);
      toast.success("Environment variables saved");
    } catch {
      toast.error("Failed to save environment variables");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-400" />
            Environment Variables
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {vars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={v.key}
                onChange={(e) => updateVar(i, "key", e.target.value)}
                placeholder="KEY"
                className="h-8 text-xs font-mono w-[40%] bg-white/5 border-white/10"
              />
              <div className="relative flex-1">
                <Input
                  type={showValues.has(i) ? "text" : "password"}
                  value={v.value}
                  onChange={(e) => updateVar(i, "value", e.target.value)}
                  placeholder="value"
                  className="h-8 text-xs font-mono pr-8 bg-white/5 border-white/10"
                />
                <button
                  onClick={() => toggleShow(i)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40"
                >
                  {showValues.has(i) ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white/20 hover:text-red-400"
                onClick={() => removeVar(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {vars.length === 0 && (
            <div className="text-center py-6 text-white/20 text-xs">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>No environment variables yet</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={addVar}
          >
            <Plus className="h-3 w-3" />
            Add Variable
          </Button>
          <div className="flex-1" />
          {dirty && (
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleSave}
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
          )}
        </div>

        <p className="text-[10px] text-white/15 mt-2">
          Environment variables are stored as a .env file in your project. The AI agents can read these when building your app.
        </p>
      </DialogContent>
    </Dialog>
  );
}
