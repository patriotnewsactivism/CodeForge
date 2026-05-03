/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — KEYBOARD SHORTCUTS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows all available shortcuts in a dialog.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  {
    category: "General",
    items: [
      { keys: "Ctrl+K", description: "Open Command Palette" },
      { keys: "Ctrl+S", description: "Save current file" },
      { keys: "Ctrl+Shift+F", description: "Search across files" },
      { keys: "Ctrl+\\", description: "Toggle sidebar" },
      { keys: "?", description: "Show keyboard shortcuts" },
    ],
  },
  {
    category: "Editor",
    items: [
      { keys: "Ctrl+D", description: "Select next occurrence" },
      { keys: "Ctrl+Shift+K", description: "Delete line" },
      { keys: "Alt+↑/↓", description: "Move line up/down" },
      { keys: "Ctrl+/", description: "Toggle comment" },
      { keys: "Ctrl+]", description: "Indent line" },
      { keys: "Ctrl+[", description: "Outdent line" },
      { keys: "Ctrl+Shift+\\", description: "Jump to matching bracket" },
      { keys: "F2", description: "Rename symbol" },
    ],
  },
  {
    category: "Panels",
    items: [
      { keys: "Ctrl+B", description: "Toggle AI Chat" },
      { keys: "Ctrl+Shift+P", description: "Toggle Preview" },
      { keys: "Ctrl+Shift+A", description: "Toggle Agent Activity" },
      { keys: "Ctrl+Shift+G", description: "Toggle Git Panel" },
      { keys: "Ctrl+Shift+I", description: "Toggle Suggestions" },
    ],
  },
  {
    category: "AI",
    items: [
      { keys: "Ctrl+Enter", description: "Send message to AI" },
      { keys: "Ctrl+Shift+R", description: "AI: Review code" },
      { keys: "Ctrl+Shift+O", description: "AI: Optimize" },
    ],
  },
];

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-emerald-400" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {SHORTCUTS.map((group) => (
            <div key={group.category}>
              <h3 className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">
                {group.category}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.03]"
                  >
                    <span className="text-xs text-white/50">{item.description}</span>
                    <kbd className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
