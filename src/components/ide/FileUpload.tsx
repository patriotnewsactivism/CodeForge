/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — FILE UPLOAD / DRAG & DROP
 * ═══════════════════════════════════════════════════════════════════
 *
 * Drag and drop files/folders into the project.
 * Reads file content and creates them in the Convex database.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Upload, FolderUp, FileUp, Loader2 } from "lucide-react";

interface FileUploadProps {
  projectId: Id<"projects"> | null;
  children: React.ReactNode;
  className?: string;
}

export function FileUpload({ projectId, children, className }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragCounter = useRef(0);
  const createFile = useMutation(api.files.create);
  const bulkInsert = useMutation(api.files.bulkInsert);

  // Detect file language from extension
  const getLanguage = (name: string): string => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const MAP: Record<string, string> = {
      js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
      py: "python", rb: "ruby", rs: "rust", go: "go",
      html: "html", htm: "html", css: "css", scss: "scss", less: "less",
      json: "json", md: "markdown", yaml: "yaml", yml: "yaml",
      xml: "xml", svg: "xml", sql: "sql", sh: "shell", bash: "shell",
      java: "java", kt: "kotlin", swift: "swift", c: "c", cpp: "cpp",
      h: "c", hpp: "cpp", cs: "csharp", php: "php", lua: "lua",
      toml: "toml", ini: "ini", env: "plaintext", txt: "plaintext",
      dockerfile: "dockerfile", makefile: "makefile",
    };
    return MAP[ext] || "plaintext";
  };

  // Read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });
  };

  // Process dropped files
  const processFiles = useCallback(
    async (items: FileList | File[]) => {
      if (!projectId) {
        toast.error("Select a project first");
        return;
      }

      setIsUploading(true);
      const fileList = Array.from(items);
      const MAX_SIZE = 500_000; // 500KB per file
      const MAX_FILES = 100;

      // Filter valid files
      const validFiles = fileList
        .filter((f) => {
          if (f.size > MAX_SIZE) {
            toast.error(`Skipping ${f.name} — too large (${(f.size / 1024).toFixed(0)}KB)`);
            return false;
          }
          // Skip binary-looking files
          const ext = f.name.split(".").pop()?.toLowerCase() || "";
          const binaryExts = ["png", "jpg", "jpeg", "gif", "webp", "ico", "woff", "woff2", "ttf", "eot", "mp3", "mp4", "zip", "tar", "gz", "exe", "dll"];
          if (binaryExts.includes(ext)) {
            toast.error(`Skipping ${f.name} — binary files not supported`);
            return false;
          }
          return true;
        })
        .slice(0, MAX_FILES);

      if (validFiles.length === 0) {
        setIsUploading(false);
        return;
      }

      try {
        // Read all file contents
        const filesData = await Promise.all(
          validFiles.map(async (file) => {
            const content = await readFileAsText(file);
            // Use webkitRelativePath if available, otherwise just the name
            const path = (file as any).webkitRelativePath || file.name;
            return {
              name: file.name,
              path,
              type: "file" as const,
              content,
              language: getLanguage(file.name),
            };
          })
        );

        // Collect unique folders
        const folders = new Set<string>();
        for (const f of filesData) {
          const parts = f.path.split("/");
          for (let i = 1; i < parts.length; i++) {
            folders.add(parts.slice(0, i).join("/"));
          }
        }

        // Insert folders first
        if (folders.size > 0) {
          const folderData = Array.from(folders).sort().map((p) => ({
            name: p.split("/").pop() || p,
            path: p,
            type: "folder" as const,
          }));
          await bulkInsert({ projectId, files: folderData });
        }

        // Insert files in batches
        const BATCH = 20;
        for (let i = 0; i < filesData.length; i += BATCH) {
          const batch = filesData.slice(i, i + BATCH);
          await bulkInsert({ projectId, files: batch });
        }

        toast.success(`Uploaded ${filesData.length} file${filesData.length > 1 ? "s" : ""}`);
      } catch (e) {
        console.error("Upload error:", e);
        toast.error("Failed to upload files");
      }

      setIsUploading(false);
    },
    [projectId, createFile, bulkInsert]
  );

  // Drag handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-emerald-500/5 border-2 border-dashed border-emerald-400/30 rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Upload className="h-10 w-10 mx-auto mb-2 text-emerald-400/50 animate-bounce" />
            <p className="text-sm font-medium text-emerald-400/70">
              Drop files here
            </p>
            <p className="text-[10px] text-white/30 mt-1">
              Files will be added to your project
            </p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-2 text-emerald-400 animate-spin" />
            <p className="text-sm text-white/60">Uploading files...</p>
          </div>
        </div>
      )}
    </div>
  );
}
