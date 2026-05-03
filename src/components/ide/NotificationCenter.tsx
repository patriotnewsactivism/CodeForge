/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — NOTIFICATION CENTER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Notification bell with activity feed.
 * Shows mission completions, errors, deploy status, etc.
 */
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bell,
  Check,
  AlertTriangle,
  Rocket,
  Zap,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface Notification {
  id: string;
  type: "success" | "error" | "info" | "deploy";
  title: string;
  description?: string;
  timestamp: number;
  read: boolean;
}

const TYPE_STYLES: Record<
  Notification["type"],
  { icon: typeof Check; color: string; bg: string }
> = {
  success: { icon: Check, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  error: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  info: { icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10" },
  deploy: { icon: Rocket, color: "text-purple-400", bg: "bg-purple-500/10" },
};

// Global notification state (simple — in production use Zustand/Jotai)
let globalNotifications: Notification[] = [];
let globalListeners: (() => void)[] = [];

export function pushNotification(n: Omit<Notification, "id" | "timestamp" | "read">) {
  const notification: Notification = {
    ...n,
    id: `notif-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    read: false,
  };
  globalNotifications = [notification, ...globalNotifications].slice(0, 50);
  globalListeners.forEach((fn) => fn());
  toast[n.type === "error" ? "error" : "success"](n.title, {
    description: n.description,
  });
}

function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(globalNotifications);

  useEffect(() => {
    const listener = () => setNotifications([...globalNotifications]);
    globalListeners.push(listener);
    return () => {
      globalListeners = globalListeners.filter((l) => l !== listener);
    };
  }, []);

  const markRead = (id: string) => {
    globalNotifications = globalNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications([...globalNotifications]);
  };

  const markAllRead = () => {
    globalNotifications = globalNotifications.map((n) => ({ ...n, read: true }));
    setNotifications([...globalNotifications]);
  };

  const clearAll = () => {
    globalNotifications = [];
    setNotifications([]);
  };

  return { notifications, markRead, markAllRead, clearAll };
}

export function NotificationCenter() {
  const { notifications, markRead, markAllRead, clearAll } = useNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 relative text-white/30 hover:text-white/60"
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 text-[8px] font-bold flex items-center justify-center text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 max-h-96 overflow-hidden flex flex-col"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <span className="text-xs font-semibold text-white/60">
            Notifications
          </span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[9px] px-1.5"
                onClick={markAllRead}
              >
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-white/20"
                onClick={clearAll}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-white/15 text-xs">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-20" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((n) => {
              const style = TYPE_STYLES[n.type];
              const Icon = style.icon;

              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors",
                    !n.read && "bg-white/[0.02]"
                  )}
                >
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      style.bg
                    )}
                  >
                    <Icon className={cn("h-3 w-3", style.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[11px] font-medium truncate",
                          n.read ? "text-white/40" : "text-white/70"
                        )}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>
                    {n.description && (
                      <p className="text-[10px] text-white/20 mt-0.5 line-clamp-2">
                        {n.description}
                      </p>
                    )}
                    <span className="text-[9px] text-white/10 mt-0.5 block">
                      {new Date(n.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
