/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — SETTINGS PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Editor preferences and project settings.
 * Persisted in localStorage.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Type, MonitorSmartphone, Wrench, Palette } from "lucide-react";
import { EDITOR_THEMES } from "./ThemeSelector";

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  bracketPairs: boolean;
  formatOnSave: boolean;
  autoFixEnabled: boolean;
  theme: string;
}

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,
  bracketPairs: true,
  formatOnSave: true,
  autoFixEnabled: true,
  theme: "cf-dark",
};

const STORAGE_KEY = "codeforge-editor-settings";

export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (partial: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { settings, updateSettings };
}

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: EditorSettings;
  onUpdateSettings: (partial: Partial<EditorSettings>) => void;
}

export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
}: SettingsPanelProps) {
  const SettingRow = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-2">
      <Label className="text-xs text-white/60">{label}</Label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-400" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Editor */}
          <div>
            <h3 className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" /> Editor
            </h3>
            <div className="space-y-1 border rounded-lg border-white/5 p-3">
              <SettingRow label="Font Size">
                <Select
                  value={String(settings.fontSize)}
                  onValueChange={(v) => onUpdateSettings({ fontSize: parseInt(v) })}
                >
                  <SelectTrigger className="w-20 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 11, 12, 13, 14, 15, 16, 18, 20].map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Tab Size">
                <Select
                  value={String(settings.tabSize)}
                  onValueChange={(v) => onUpdateSettings({ tabSize: parseInt(v) })}
                >
                  <SelectTrigger className="w-20 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 8].map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Word Wrap">
                <Switch
                  checked={settings.wordWrap}
                  onCheckedChange={(v) => onUpdateSettings({ wordWrap: v })}
                />
              </SettingRow>

              <SettingRow label="Minimap">
                <Switch
                  checked={settings.minimap}
                  onCheckedChange={(v) => onUpdateSettings({ minimap: v })}
                />
              </SettingRow>

              <SettingRow label="Line Numbers">
                <Switch
                  checked={settings.lineNumbers}
                  onCheckedChange={(v) => onUpdateSettings({ lineNumbers: v })}
                />
              </SettingRow>

              <SettingRow label="Bracket Pairs">
                <Switch
                  checked={settings.bracketPairs}
                  onCheckedChange={(v) => onUpdateSettings({ bracketPairs: v })}
                />
              </SettingRow>
            </div>
          </div>

          {/* AI */}
          <div>
            <h3 className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> AI
            </h3>
            <div className="space-y-1 border rounded-lg border-white/5 p-3">
              <SettingRow label="Auto-Fix Errors">
                <Switch
                  checked={settings.autoFixEnabled}
                  onCheckedChange={(v) => onUpdateSettings({ autoFixEnabled: v })}
                />
              </SettingRow>
              <SettingRow label="Format on Save">
                <Switch
                  checked={settings.formatOnSave}
                  onCheckedChange={(v) => onUpdateSettings({ formatOnSave: v })}
                />
              </SettingRow>
            </div>
          </div>

          {/* Theme */}
          <div>
            <h3 className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Theme
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {EDITOR_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    settings.theme === t.id
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div
                    className="h-6 w-6 rounded border border-white/10"
                    style={{ backgroundColor: t.preview.bg }}
                  >
                    <div
                      className="h-1.5 w-1.5 rounded-full m-auto mt-2"
                      style={{ backgroundColor: t.preview.accent }}
                    />
                  </div>
                  <span className="text-[10px] text-white/50">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
