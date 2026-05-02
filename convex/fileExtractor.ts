// Robust file extraction from AI-generated content.
// Tries multiple patterns to extract file paths and contents from code blocks.

export interface ExtractedFile {
  path: string;
  name: string;
  content: string;
}

// Extract files from AI response content.
// Tries multiple patterns in priority order.
export function extractFiles(content: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const seenPaths = new Set<string>();

  // Pattern 1: ```lang:path/to/file.ext (our primary format)
  const pattern1 = /```([a-zA-Z0-9+#_-]*):([^\n`]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern1.exec(content)) !== null) {
    const filePath = match[2].trim();
    if (filePath && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      files.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        content: match[3],
      });
    }
  }

  // Pattern 2: ```lang filename="path" or ```lang file="path"
  const pattern2 = /```[a-zA-Z0-9+#_-]*\s+(?:file(?:name)?|path)=["']([^"']+)["']\s*\n([\s\S]*?)```/g;
  while ((match = pattern2.exec(content)) !== null) {
    const filePath = match[1].trim();
    if (filePath && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      files.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        content: match[2],
      });
    }
  }

  // Pattern 3: Header-style filenames before code blocks
  // Matches: ### `path/file.ext`, **path/file.ext:**, #### path/file.ext, `path/file.ext`:
  const pattern3 =
    /(?:^|\n)(?:#{1,4}\s+|(?:\*\*|`)?)([a-zA-Z0-9_/.-]+\.[a-zA-Z0-9]+)(?:\*\*|`)?:?\s*\n+```[a-zA-Z0-9+#_-]*\n([\s\S]*?)```/g;
  while ((match = pattern3.exec(content)) !== null) {
    const filePath = match[1].trim();
    // Must look like a real file path (has extension, no spaces)
    if (
      filePath &&
      !seenPaths.has(filePath) &&
      /\.[a-zA-Z0-9]+$/.test(filePath) &&
      !filePath.includes(" ")
    ) {
      seenPaths.add(filePath);
      files.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        content: match[2],
      });
    }
  }

  // Pattern 4: // File: path or /* path */ at the very start of a code block
  const pattern4 =
    /```([a-zA-Z0-9+#_-]*)\n(?:\/\/\s*(?:File|Path):\s*([^\n]+)|\/\*\s*([^\n*]+?)\s*\*\/)\n([\s\S]*?)```/g;
  while ((match = pattern4.exec(content)) !== null) {
    const filePath = (match[2] || match[3] || "").trim();
    if (
      filePath &&
      !seenPaths.has(filePath) &&
      /\.[a-zA-Z0-9]+$/.test(filePath)
    ) {
      seenPaths.add(filePath);
      // Include the comment line in content too since it was part of the file
      const fullContent = match[2]
        ? `// File: ${filePath}\n${match[4]}`
        : match[4];
      files.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        content: fullContent,
      });
    }
  }

  // Pattern 5: Bare code blocks with a detectable filename on the first line
  // e.g. ```tsx\n// src/components/App.tsx\n...```
  const pattern5 =
    /```([a-zA-Z0-9+#_-]+)\n\/\/\s*([a-zA-Z0-9_/.-]+\.[a-zA-Z0-9]+)\s*\n([\s\S]*?)```/g;
  while ((match = pattern5.exec(content)) !== null) {
    const filePath = match[2].trim();
    if (
      filePath &&
      !seenPaths.has(filePath) &&
      /\.[a-zA-Z0-9]+$/.test(filePath) &&
      !filePath.includes(" ")
    ) {
      seenPaths.add(filePath);
      files.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        content: `// ${filePath}\n${match[3]}`,
      });
    }
  }

  // If we found zero files with structured patterns, try last-resort:
  // Look for ANY code block that contains enough code (>3 lines) and try to
  // infer a filename from the language tag
  if (files.length === 0) {
    const langToExt: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      jsx: "jsx",
      tsx: "tsx",
      python: "py",
      html: "html",
      css: "css",
      scss: "scss",
      json: "json",
      yaml: "yaml",
      yml: "yml",
      markdown: "md",
      md: "md",
      sql: "sql",
      shell: "sh",
      bash: "sh",
      rust: "rs",
      go: "go",
      java: "java",
      ruby: "rb",
      php: "php",
      xml: "xml",
      toml: "toml",
      dockerfile: "Dockerfile",
      vue: "vue",
      svelte: "svelte",
    };

    const fallbackPattern = /```([a-zA-Z0-9+#_-]+)\n([\s\S]*?)```/g;
    let blockIndex = 0;
    while ((match = fallbackPattern.exec(content)) !== null) {
      const lang = match[1].toLowerCase();
      const blockContent = match[2];
      // Only create files for substantial code blocks (not just snippets)
      if (blockContent.split("\n").length >= 3 && lang in langToExt) {
        // Try to infer filename from content
        const inferredName = inferFileName(blockContent, lang, langToExt);
        const filePath =
          inferredName || `generated_${blockIndex}.${langToExt[lang]}`;
        if (!seenPaths.has(filePath)) {
          seenPaths.add(filePath);
          files.push({
            path: filePath,
            name: filePath.split("/").pop() || filePath,
            content: blockContent,
          });
          blockIndex++;
        }
      }
    }
  }

  return files;
}

// Try to infer a filename from code content.
function inferFileName(
  content: string,
  lang: string,
  langToExt: Record<string, string>
): string | null {
  // Look for common patterns:
  // - export default function ComponentName → ComponentName.tsx
  // - const express = require → server.js or app.js
  // - <!DOCTYPE html> → index.html
  // - @import or body { → styles.css
  // - "name": "..." in package.json format → package.json

  if (content.includes("<!DOCTYPE html>") || content.includes("<html")) {
    return "index.html";
  }
  if (content.startsWith("{") && content.includes('"name"')) {
    if (content.includes('"dependencies"') || content.includes('"scripts"')) {
      return "package.json";
    }
    if (content.includes('"compilerOptions"')) {
      return "tsconfig.json";
    }
  }
  if (
    lang === "css" ||
    lang === "scss" ||
    content.includes("@tailwind") ||
    content.includes("@import")
  ) {
    return lang === "scss" ? "styles.scss" : "styles.css";
  }
  if (content.includes("export default function App")) {
    return lang === "tsx" || lang === "jsx"
      ? `src/App.${langToExt[lang]}`
      : `App.${langToExt[lang]}`;
  }
  if (content.includes("createRoot") || content.includes("ReactDOM.render")) {
    return lang === "tsx" ? "src/main.tsx" : "src/main.jsx";
  }
  if (content.includes("express()") || content.includes("createServer")) {
    return `server.${langToExt[lang] || "js"}`;
  }
  if (content.includes("/** @type {import('tailwindcss').Config} */")) {
    return "tailwind.config.js";
  }
  if (content.includes("defineConfig")) {
    return `vite.config.${langToExt[lang] || "ts"}`;
  }

  // Try to find a component name
  const componentMatch = content.match(
    /export\s+(?:default\s+)?function\s+([A-Z][a-zA-Z0-9]+)/
  );
  if (componentMatch) {
    const ext = langToExt[lang] || "tsx";
    return `src/components/${componentMatch[1]}.${ext}`;
  }

  return null;
}
