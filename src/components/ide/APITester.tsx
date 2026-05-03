/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — API TESTER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Built-in REST API tester (like Postman):
 * - GET, POST, PUT, PATCH, DELETE methods
 * - Headers, body, query params
 * - Pretty-print JSON responses
 * - Response time, status code, size
 * - Save requests to collections
 * - Auto-detect API routes from project code
 */
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Globe,
  Plus,
  Trash2,
  Clock,
  Database,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  FolderOpen,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: string;
}

interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-400 bg-emerald-500/10",
  POST: "text-blue-400 bg-blue-500/10",
  PUT: "text-amber-400 bg-amber-500/10",
  PATCH: "text-purple-400 bg-purple-500/10",
  DELETE: "text-red-400 bg-red-500/10",
};

const STATUS_COLORS: Record<string, string> = {
  "2": "text-emerald-400",
  "3": "text-blue-400",
  "4": "text-amber-400",
  "5": "text-red-400",
};

export function APITester() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<Header[]>([
    { key: "Content-Type", value: "application/json", enabled: true },
  ]);
  const [body, setBody] = useState('{\n  \n}');
  const [response, setResponse] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"headers" | "body" | "params">("headers");
  const [saved, setSaved] = useState<SavedRequest[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cf-api-requests") || "[]");
    } catch {
      return [];
    }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSend = useCallback(async () => {
    if (!url.trim()) {
      toast.error("Enter a URL");
      return;
    }

    setLoading(true);
    const start = performance.now();

    try {
      const fetchHeaders: Record<string, string> = {};
      headers.filter((h) => h.enabled && h.key).forEach((h) => {
        fetchHeaders[h.key] = h.value;
      });

      const fetchOpts: RequestInit = {
        method,
        headers: fetchHeaders,
      };

      if (method !== "GET" && body.trim()) {
        fetchOpts.body = body;
      }

      const res = await fetch(url, fetchOpts);
      const elapsed = performance.now() - start;
      const text = await res.text();

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: text,
        time: Math.round(elapsed),
        size: new Blob([text]).size,
      });
    } catch (err: any) {
      setResponse({
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: err.message || "Failed to fetch. Check URL and CORS settings.",
        time: Math.round(performance.now() - start),
        size: 0,
      });
    }

    setLoading(false);
  }, [url, method, headers, body]);

  const handleSave = () => {
    const req: SavedRequest = {
      id: Date.now().toString(),
      name: new URL(url || "https://example.com").pathname || url,
      method,
      url,
      headers,
      body,
    };
    const updated = [...saved, req];
    setSaved(updated);
    localStorage.setItem("cf-api-requests", JSON.stringify(updated));
    toast.success("Request saved!");
  };

  const handleLoad = (req: SavedRequest) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers);
    setBody(req.body);
    setShowSaved(false);
    toast.info(`Loaded: ${req.name}`);
  };

  const handleDeleteSaved = (id: string) => {
    const updated = saved.filter((s) => s.id !== id);
    setSaved(updated);
    localStorage.setItem("cf-api-requests", JSON.stringify(updated));
  };

  const addHeader = () => setHeaders([...headers, { key: "", value: "", enabled: true }]);

  const formatJson = (text: string) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  const copyResponse = async () => {
    if (response) {
      await navigator.clipboard.writeText(formatJson(response.body));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Globe className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-semibold text-white/70">API Tester</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="p-1 rounded hover:bg-white/5 text-white/20"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleSave} className="p-1 rounded hover:bg-white/5 text-white/20">
            <Save className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Saved Requests Dropdown */}
      {showSaved && saved.length > 0 && (
        <div className="border-b border-white/[0.03] max-h-32 overflow-y-auto">
          {saved.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] cursor-pointer"
            >
              <Badge className={cn("text-[8px] px-1 py-0", METHOD_COLORS[req.method])}>{req.method}</Badge>
              <span
                className="text-[10px] text-white/30 flex-1 truncate"
                onClick={() => handleLoad(req)}
              >
                {req.url}
              </span>
              <button
                onClick={() => handleDeleteSaved(req.id)}
                className="text-white/10 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* URL Bar */}
      <div className="flex gap-1 p-2 border-b border-white/[0.03]">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className={cn(
            "h-8 px-2 rounded text-[10px] font-bold border-0 outline-none cursor-pointer",
            METHOD_COLORS[method]
          )}
        >
          {(["GET", "POST", "PUT", "PATCH", "DELETE"] as HttpMethod[]).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/v1/data"
          className="h-8 text-[11px] font-mono bg-white/[0.02] border-white/5 flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
        />
        <Button
          onClick={handleSend}
          disabled={loading}
          className="h-8 px-3 bg-orange-600 hover:bg-orange-500 text-[10px] gap-1"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Send
        </Button>
      </div>

      {/* Request Tabs */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex gap-1 px-2 py-1 border-b border-white/[0.03]">
          {(["headers", "body"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium capitalize",
                activeTab === tab ? "bg-white/10 text-white/50" : "text-white/15 hover:text-white/30"
              )}
            >
              {tab}
              {tab === "headers" && ` (${headers.filter((h) => h.enabled).length})`}
            </button>
          ))}
        </div>

        {/* Headers */}
        {activeTab === "headers" && (
          <div className="p-2 space-y-1">
            {headers.map((h, i) => (
              <div key={i} className="flex gap-1 items-center">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => {
                    const n = [...headers];
                    n[i].enabled = e.target.checked;
                    setHeaders(n);
                  }}
                  className="w-3 h-3 rounded border-white/10"
                />
                <Input
                  value={h.key}
                  onChange={(e) => {
                    const n = [...headers];
                    n[i].key = e.target.value;
                    setHeaders(n);
                  }}
                  placeholder="Key"
                  className="h-6 text-[10px] font-mono bg-white/[0.02] border-white/5 flex-1"
                />
                <Input
                  value={h.value}
                  onChange={(e) => {
                    const n = [...headers];
                    n[i].value = e.target.value;
                    setHeaders(n);
                  }}
                  placeholder="Value"
                  className="h-6 text-[10px] font-mono bg-white/[0.02] border-white/5 flex-1"
                />
                <button
                  onClick={() => setHeaders(headers.filter((_, j) => j !== i))}
                  className="text-white/10 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button onClick={addHeader} className="flex items-center gap-1 text-[10px] text-white/15 hover:text-white/30 mt-1">
              <Plus className="h-3 w-3" /> Add header
            </button>
          </div>
        )}

        {/* Body */}
        {activeTab === "body" && (
          <div className="p-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"key": "value"}'
              rows={6}
              className="w-full text-[10px] font-mono bg-white/[0.02] border border-white/5 rounded p-2 text-white/40 resize-none focus:outline-none focus:border-orange-500/30"
            />
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="border-t border-white/5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d14]">
              <span className="text-[10px] font-semibold text-white/30">Response</span>
              <Badge className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[String(response.status)[0]] || "text-white/30")}>
                {response.status} {response.statusText}
              </Badge>
              <div className="ml-auto flex items-center gap-2 text-[9px] text-white/15">
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" /> {response.time}ms
                </span>
                <span className="flex items-center gap-0.5">
                  <Database className="h-2.5 w-2.5" /> {formatSize(response.size)}
                </span>
                <button onClick={copyResponse} className="hover:text-white/30">
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
            <pre className="p-3 text-[10px] font-mono text-white/30 overflow-auto max-h-64 whitespace-pre-wrap">
              {formatJson(response.body)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
