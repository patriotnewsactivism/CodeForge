import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  FilePlus,
  FolderPlus,
  Folder,
  FolderOpen,
  Trash2,
} from "lucide-react";

interface FileItem {
  _id: Id<"files">;
  path: string;
  name: string;
  type: "file" | "folder";
  language?: string;
  size?: number;
  isModified?: boolean;
}

interface FileTreeProps {
  files: FileItem[];
  activeFileId: Id<"files"> | null;
  onFileSelect: (id: Id<"files">, name: string, path: string) => void;
  projectId: Id<"projects"> | null;
}

// File icon based on language/extension
function FileIcon({ name }: { name: string; language?: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (
    ["ts", "tsx", "js", "jsx", "py", "rb", "go", "rs", "java", "cpp", "c", "cs", "php", "swift", "kt"].includes(ext || "")
  )
    return <FileCode className="h-3.5 w-3.5 text-chart-3 shrink-0" />;
  if (["json", "yaml", "yml", "toml"].includes(ext || ""))
    return <FileJson className="h-3.5 w-3.5 text-chart-2 shrink-0" />;
  if (["md", "txt", "rst"].includes(ext || ""))
    return <FileText className="h-3.5 w-3.5 text-chart-5 shrink-0" />;
  if (["html", "css", "scss", "less", "svg"].includes(ext || ""))
    return <FileCode className="h-3.5 w-3.5 text-chart-4 shrink-0" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

// Build tree structure from flat files
interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  fileId?: Id<"files">;
  language?: string;
  isModified?: boolean;
  children: TreeNode[];
}

function buildTree(files: FileItem[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();

  // Sort: folders first, then by name
  const sorted = [...files].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sorted) {
    const parts = file.path.split("/");
    const node: TreeNode = {
      name: file.name,
      path: file.path,
      type: file.type,
      fileId: file._id,
      language: file.language,
      isModified: file.isModified,
      children: [],
    };

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = map.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }
    map.set(file.path, node);
  }

  // Sort children: folders first, then alphabetical
  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) sortChildren(n.children);
  }
  sortChildren(root);
  return root;
}

function TreeItem({
  node,
  depth,
  activeFileId,
  onFileSelect,
  expandedFolders,
  toggleFolder,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  activeFileId: Id<"files"> | null;
  onFileSelect: (id: Id<"files">, name: string, path: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  onDelete: (id: Id<"files">) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isActive = node.fileId === activeFileId;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <button
            className={cn(
              "flex w-full items-center gap-1 py-0.5 px-1 text-xs hover:bg-accent/50 rounded-sm transition-colors",
              isActive && "bg-accent text-accent-foreground"
            )}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            onClick={() => {
              if (node.type === "folder") {
                toggleFolder(node.path);
              } else if (node.fileId) {
                onFileSelect(node.fileId, node.name, node.path);
              }
            }}
          >
            {node.type === "folder" ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-chart-2" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-chart-2" />
                )}
              </>
            ) : (
              <>
                <span className="w-3" />
                <FileIcon name={node.name} language={node.language} />
              </>
            )}
            <span className="truncate">{node.name}</span>
            {node.isModified && (
              <span className="ml-auto text-chart-2 text-[10px]">●</span>
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.fileId && (
            <ContextMenuItem
              onClick={() => node.fileId && onDelete(node.fileId)}
              className="text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {node.type === "folder" &&
        isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

export function FileTree({
  files,
  activeFileId,
  onFileSelect,
  projectId,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src", "convex", "server"])
  );
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName] = useState("");
  const createFile = useMutation(api.files.create);
  const deleteFile = useMutation(api.files.remove);

  const tree = useMemo(() => buildTree(files), [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleCreate = async (type: "file" | "folder") => {
    if (!newName.trim() || !projectId) return;
    try {
      await createFile({
        projectId,
        path: newName.trim(),
        name: newName.trim().split("/").pop() || newName.trim(),
        type,
        content: type === "file" ? "" : undefined,
      });
      setNewName("");
      setShowNewFile(false);
      setShowNewFolder(false);
      toast.success(`${type === "file" ? "File" : "Folder"} created`);
    } catch {
      toast.error("Failed to create");
    }
  };

  const handleDelete = async (fileId: Id<"files">) => {
    try {
      await deleteFile({ fileId });
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="flex h-full flex-col bg-card/50 border-r border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setShowNewFile(true)}
            disabled={!projectId}
          >
            <FilePlus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setShowNewFolder(true)}
            disabled={!projectId}
          >
            <FolderPlus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {tree.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No files yet.
              <br />
              Import a GitHub repo or create files.
            </div>
          ) : (
            tree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                activeFileId={activeFileId}
                onFileSelect={onFileSelect}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* New file/folder dialogs */}
      <Dialog
        open={showNewFile || showNewFolder}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewFile(false);
            setShowNewFolder(false);
            setNewName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              New {showNewFile ? "File" : "Folder"}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={showNewFile ? "src/example.ts" : "src/components"}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              handleCreate(showNewFile ? "file" : "folder")
            }
            autoFocus
          />
          <Button
            onClick={() => handleCreate(showNewFile ? "file" : "folder")}
          >
            Create
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
