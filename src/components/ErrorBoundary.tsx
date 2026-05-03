/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — ERROR BOUNDARY
 * ═══════════════════════════════════════════════════════════════════
 *
 * Catches unhandled React errors gracefully instead of blank-screening.
 * Shows user-friendly error UI with retry option.
 */
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Copy, Check, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[CodeForge Error]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleCopy = async () => {
    const { error, errorInfo } = this.state;
    const text = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;
    await navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex h-full items-center justify-center bg-[#0a0a0f] p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <Bug className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white/80 mb-2">Something went wrong</h2>
            <p className="text-sm text-white/40 mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>

            {/* Error details collapsible */}
            {this.state.error?.stack && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-white/25 cursor-pointer hover:text-white/40 transition-colors">
                  Show error details
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-red-500/[0.05] border border-red-500/10 text-[10px] text-red-400/60 overflow-auto max-h-40 font-mono">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={this.handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-sm font-medium transition-colors"
              >
                {this.state.copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {this.state.copied ? "Copied" : "Copy Error"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
