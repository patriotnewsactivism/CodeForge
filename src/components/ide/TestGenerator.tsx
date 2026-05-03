/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — AUTO TEST GENERATOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * AI-powered test generation panel:
 * - Analyzes current file for testable functions/components
 * - Generates unit tests with Vitest syntax
 * - Shows test coverage estimate
 * - One-click "Add tests" to create test file
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  Play,
  Plus,
  CheckCircle2,
  XCircle,
  Code,
  FileCode,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  TestTubes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TestGeneratorProps {
  projectId: Id<"projects"> | null;
  activeFile?: {
    _id: Id<"files">;
    path: string;
    name: string;
    content: string | null;
    language: string | null;
  } | null;
}

interface TestableItem {
  name: string;
  type: "function" | "component" | "hook" | "class" | "constant";
  line: number;
  params: string[];
  exported: boolean;
}

interface GeneratedTest {
  name: string;
  code: string;
  type: "unit" | "render" | "snapshot";
}

function detectTestableItems(content: string, path: string): TestableItem[] {
  const items: TestableItem[] = [];
  const lines = content.split("\n");
  const isReact = path.endsWith(".tsx") || path.endsWith(".jsx");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Exported functions
    const funcMatch = line.match(
      /^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/
    );
    if (funcMatch) {
      const name = funcMatch[1];
      const params = funcMatch[2]
        .split(",")
        .map((p) => p.trim().split(":")[0].trim())
        .filter(Boolean);

      // Is it a React component? (starts with uppercase)
      if (isReact && /^[A-Z]/.test(name)) {
        items.push({ name, type: "component", line: lineNum, params, exported: true });
      } else if (name.startsWith("use") && isReact) {
        items.push({ name, type: "hook", line: lineNum, params, exported: true });
      } else {
        items.push({ name, type: "function", line: lineNum, params, exported: true });
      }
      continue;
    }

    // Arrow function exports
    const arrowMatch = line.match(
      /^export\s+(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?:=>|:)/
    );
    if (arrowMatch) {
      const name = arrowMatch[1];
      const params = arrowMatch[2]
        .split(",")
        .map((p) => p.trim().split(":")[0].trim())
        .filter(Boolean);

      if (isReact && /^[A-Z]/.test(name)) {
        items.push({ name, type: "component", line: lineNum, params, exported: true });
      } else if (name.startsWith("use") && isReact) {
        items.push({ name, type: "hook", line: lineNum, params, exported: true });
      } else {
        items.push({ name, type: "function", line: lineNum, params, exported: true });
      }
      continue;
    }

    // Exported classes
    const classMatch = line.match(/^export\s+(?:default\s+)?class\s+(\w+)/);
    if (classMatch) {
      items.push({ name: classMatch[1], type: "class", line: lineNum, params: [], exported: true });
      continue;
    }

    // Exported constants (non-function)
    const constMatch = line.match(/^export\s+const\s+(\w+)\s*=\s*(?!.*(?:=>|\bfunction\b))/);
    if (constMatch && !constMatch[0].includes("(")) {
      items.push({ name: constMatch[1], type: "constant", line: lineNum, params: [], exported: true });
    }
  }

  return items;
}

function generateTests(items: TestableItem[], filePath: string): GeneratedTest[] {
  const tests: GeneratedTest[] = [];
  const importPath = filePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  const importNames = items.filter((i) => i.exported).map((i) => i.name);

  for (const item of items) {
    if (item.type === "component") {
      tests.push({
        name: `renders ${item.name} without crashing`,
        type: "render",
        code: `test('renders ${item.name} without crashing', () => {
  render(<${item.name} ${item.params.map((p) => `${p}={/* TODO */}`).join(" ")} />);
  expect(screen.getByRole('main') || document.body.firstChild).toBeTruthy();
});`,
      });

      tests.push({
        name: `${item.name} snapshot`,
        type: "snapshot",
        code: `test('${item.name} matches snapshot', () => {
  const { container } = render(<${item.name} ${item.params.map((p) => `${p}={/* TODO */}`).join(" ")} />);
  expect(container).toMatchSnapshot();
});`,
      });
    } else if (item.type === "function") {
      tests.push({
        name: `${item.name} returns expected result`,
        type: "unit",
        code: `test('${item.name} returns expected result', () => {
  const result = ${item.name}(${item.params.map(() => "/* TODO */").join(", ")});
  expect(result).toBeDefined();
  // TODO: Add specific assertions
});`,
      });

      if (item.params.length > 0) {
        tests.push({
          name: `${item.name} handles edge cases`,
          type: "unit",
          code: `test('${item.name} handles edge cases', () => {
  // Empty / null / undefined inputs
  ${item.params.map((p) => `// expect(${item.name}(${item.params.map((_, j) => j === 0 ? "null" : "/* TODO */").join(", ")})).toThrow();`).join("\n  ")}
  // TODO: Test with boundary values
});`,
        });
      }
    } else if (item.type === "hook") {
      tests.push({
        name: `${item.name} returns valid state`,
        type: "unit",
        code: `test('${item.name} returns valid state', () => {
  const { result } = renderHook(() => ${item.name}(${item.params.map(() => "/* TODO */").join(", ")}));
  expect(result.current).toBeDefined();
});`,
      });
    } else if (item.type === "class") {
      tests.push({
        name: `${item.name} can be instantiated`,
        type: "unit",
        code: `test('${item.name} can be instantiated', () => {
  const instance = new ${item.name}(/* TODO */);
  expect(instance).toBeInstanceOf(${item.name});
});`,
      });
    }
  }

  return tests;
}

function buildTestFile(tests: GeneratedTest[], items: TestableItem[], filePath: string): string {
  const importPath = "./" + filePath.replace(/^src\//, "").replace(/\.(ts|tsx|js|jsx)$/, "");
  const names = items.filter((i) => i.exported).map((i) => i.name);
  const hasComponents = items.some((i) => i.type === "component");
  const hasHooks = items.some((i) => i.type === "hook");

  let code = `import { describe, test, expect } from 'vitest';\n`;

  if (hasComponents) {
    code += `import { render, screen } from '@testing-library/react';\n`;
  }
  if (hasHooks) {
    code += `import { renderHook } from '@testing-library/react';\n`;
  }

  code += `import { ${names.join(", ")} } from '${importPath}';\n\n`;
  code += `describe('${filePath.split("/").pop()}', () => {\n`;

  for (const t of tests) {
    code += `  ${t.code}\n\n`;
  }

  code += `});\n`;
  return code;
}

export function TestGenerator({ projectId, activeFile }: TestGeneratorProps) {
  const createFile = useMutation(api.files.create);
  const [copiedTest, setCopiedTest] = useState<string | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const analysis = useMemo(() => {
    if (!activeFile?.content) return null;
    const items = detectTestableItems(activeFile.content, activeFile.path);
    const tests = generateTests(items, activeFile.path);
    const fullFile = tests.length > 0 ? buildTestFile(tests, items, activeFile.path) : "";
    return { items, tests, fullFile };
  }, [activeFile]);

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedTest(id);
    setTimeout(() => setCopiedTest(null), 2000);
  };

  const handleCreateTestFile = async () => {
    if (!projectId || !activeFile || !analysis?.fullFile) return;
    const testPath = activeFile.path.replace(
      /\.(ts|tsx|js|jsx)$/,
      ".test.$1"
    );
    try {
      await createFile({
        projectId,
        name: testPath.split("/").pop() || "test.ts",
        path: testPath,
        type: "file",
        content: analysis.fullFile,
        language: activeFile.language || "typescript",
      });
      toast.success(`Created ${testPath}`);
    } catch (err) {
      toast.error("Failed to create test file");
    }
  };

  if (!projectId || !activeFile) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-white/30">
        <p className="text-sm">Open a file to generate tests</p>
      </div>
    );
  }

  if (!analysis || analysis.items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0a0a0f] text-white/20 p-4">
        <FlaskConical className="h-10 w-10 opacity-50" />
        <p className="text-xs text-center">
          No testable exports found in this file.
          <br />
          Open a file with exported functions or components.
        </p>
      </div>
    );
  }

  const testCoverage = Math.min(
    100,
    Math.round((analysis.tests.length / Math.max(1, analysis.items.length * 2)) * 100)
  );

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <FlaskConical className="h-4 w-4 text-yellow-400" />
        <span className="text-xs font-semibold text-white/70">Test Generator</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
          {analysis.tests.length} tests
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* File Info + Coverage */}
        <div className="p-3 border-b border-white/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="h-3.5 w-3.5 text-white/30" />
            <span className="text-[11px] text-white/50 truncate">{activeFile.path}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-white/70">{analysis.items.length}</p>
              <p className="text-[9px] text-white/25">Exports</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-400">{analysis.tests.length}</p>
              <p className="text-[9px] text-white/25">Tests</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{testCoverage}%</p>
              <p className="text-[9px] text-white/25">Coverage</p>
            </div>
          </div>

          <Button
            className="w-full h-7 text-[11px] bg-yellow-600 hover:bg-yellow-500 text-white gap-1.5"
            onClick={handleCreateTestFile}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Test File
          </Button>
        </div>

        {/* Detected Exports */}
        <div className="px-3 py-2 border-b border-white/[0.03]">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">
            Detected Exports
          </p>
          <div className="flex flex-wrap gap-1">
            {analysis.items.map((item) => (
              <Badge
                key={item.name}
                variant="outline"
                className={cn(
                  "text-[9px] px-1.5 py-0",
                  item.type === "component"
                    ? "border-blue-500/20 text-blue-400"
                    : item.type === "hook"
                    ? "border-purple-500/20 text-purple-400"
                    : item.type === "function"
                    ? "border-emerald-500/20 text-emerald-400"
                    : "border-white/10 text-white/30"
                )}
              >
                {item.type === "component" ? "⚛️" : item.type === "hook" ? "🪝" : "ƒ"}{" "}
                {item.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Generated Tests */}
        <div className="p-2 space-y-1">
          {analysis.tests.map((test) => {
            const isExpanded = expandedTest === test.name;
            return (
              <div
                key={test.name}
                className="rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedTest(isExpanded ? null : test.name)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/[0.015] transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-white/20" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-white/20" />
                  )}
                  <TestTubes className="h-3 w-3 text-yellow-400/60" />
                  <span className="text-[11px] text-white/50 flex-1 truncate">{test.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[8px] px-1 py-0",
                      test.type === "unit"
                        ? "border-emerald-500/20 text-emerald-400"
                        : test.type === "render"
                        ? "border-blue-500/20 text-blue-400"
                        : "border-purple-500/20 text-purple-400"
                    )}
                  >
                    {test.type}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.03] bg-[#080810] relative">
                    <button
                      onClick={() => handleCopy(test.code, test.name)}
                      className="absolute top-1 right-1 p-1 rounded hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors z-10"
                    >
                      {copiedTest === test.name ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <pre className="text-[10px] text-white/40 p-2.5 overflow-x-auto font-mono leading-relaxed">
                      {test.code}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
