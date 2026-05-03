/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — AI INLINE AUTOCOMPLETE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Copilot-style ghost text suggestions in the editor.
 * Uses the AI to predict next code based on cursor context.
 *
 * Integration: Call registerInlineCompletion(editor, monaco) after
 * the Monaco editor mounts. Uses Azure AI for suggestions.
 */
import type { editor as monacoEditor, languages as monacoLanguages, Position } from "monaco-editor";

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Register inline completion provider with Monaco.
 * Call once when the editor mounts.
 *
 * @param monacoInstance - The monaco namespace
 * @param getApiKey - Function returning the Azure API key
 * @param getEndpoint - Function returning the Azure endpoint
 */
export function registerInlineCompletion(
  monacoInstance: any,
  options: {
    getApiKey: () => string;
    getEndpoint: () => string;
    model?: string;
    enabled?: () => boolean;
  }
) {
  const { getApiKey, getEndpoint, model = "DeepSeek-V3-0324", enabled } = options;

  // Track the latest suggestion to avoid flicker
  let lastSuggestion = "";
  let lastPosition = "";

  const provider: any = {
    provideInlineCompletions: async (
      editorModel: monacoEditor.ITextModel,
      position: any,
      context: any,
      token: any
    ) => {
      // Check if enabled
      if (enabled && !enabled()) return { items: [] };

      const posKey = `${position.lineNumber}:${position.column}`;

      // Get context around cursor
      const lineCount = editorModel.getLineCount();
      const startLine = Math.max(1, position.lineNumber - 20);
      const endLine = Math.min(lineCount, position.lineNumber + 5);
      const prefix = editorModel.getValueInRange({
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const suffix = editorModel.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: endLine,
        endColumn: editorModel.getLineMaxColumn(endLine),
      });

      // Skip if too little context
      if (prefix.trim().length < 5) return { items: [] };

      try {
        const apiKey = getApiKey();
        const endpoint = getEndpoint();
        if (!apiKey || !endpoint) return { items: [] };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are a code completion engine. Given the code context, predict the next 1-3 lines of code. Return ONLY the completion text, no explanation, no markdown, no code fences. If unsure, return empty string.",
              },
              {
                role: "user",
                content: `Complete the following code. Only return the completion, nothing else.\n\n${prefix}█${suffix}`,
              },
            ],
            max_tokens: 100,
            temperature: 0.1,
            stop: ["\n\n", "```"],
          }),
          signal: token.isCancellationRequested
            ? AbortSignal.abort()
            : AbortSignal.timeout(3000),
        });

        if (!response.ok) return { items: [] };

        const data = await response.json();
        const completion = data.choices?.[0]?.message?.content?.trim() || "";

        if (!completion || completion.length < 2) return { items: [] };

        lastSuggestion = completion;
        lastPosition = posKey;

        return {
          items: [
            {
              insertText: completion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            },
          ],
        };
      } catch {
        return { items: [] };
      }
    },

    freeInlineCompletions: () => {},
  };

  // Register the provider for all languages
  const disposable = monacoInstance.languages.registerInlineCompletionsProvider(
    { pattern: "**" },
    provider
  );

  return disposable;
}
