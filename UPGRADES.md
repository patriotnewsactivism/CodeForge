# CodeForge v2 — 10 Feature Upgrades

## Implementation Status

| # | Feature | Files Added | Status |
|---|---------|------------|--------|
| 1 | Real Terminal (xterm.js) | `src/components/ide/RealTerminal.tsx`, `convex/terminal.ts` | ✅ Ready |
| 2 | Screenshot → Code (Vision AI) | `src/components/ide/ScreenshotToCode.tsx`, `convex/vision.ts` | ✅ Ready |
| 3 | Shareable Preview Links | `src/components/ide/ShareablePreview.tsx`, `convex/previews.ts` | ✅ Ready |
| 4 | Mobile-Native Builder | `src/components/ide/MobileBuilder.tsx` | ✅ Ready |
| 5 | One-Click Deploy Templates | `src/components/ide/OneClickTemplates.tsx` | ✅ Ready |
| 6 | Agent Memory Injection | `AllUpgrades_6_8_9_10.tsx` (MEMORY_INJECTION_CODE) | ✅ Ready |
| 7 | Ecosystem Publish Button | `AllUpgrades_6_8_9_10.tsx` (EcosystemPublish) | ✅ Ready |
| 8 | Visual Rollback Timeline | `AllUpgrades_6_8_9_10.tsx` (RollbackTimeline) | ✅ Ready |
| 9 | Adaptive Prompt Library | `AllUpgrades_6_8_9_10.tsx` (AdaptivePromptLibrary) | ✅ Ready |
| 10 | Agent Personality Presets | `AllUpgrades_6_8_9_10.tsx` (AgentPersonality) | ✅ Ready |

---

## Integration Guide

### Step 1 — Install new dependencies
```bash
npm install xterm @xterm/addon-fit @xterm/addon-web-links framer-motion
```

### Step 2 — Add schema tables
See SCHEMA_ADDITIONS.md — add 4 new tables to convex/schema.ts

### Step 3 — Add env variable for Vision AI
```
OPENAI_API_KEY=sk-... (in Convex dashboard → Settings → Environment Variables)
```

### Step 4 — Wire into IDEPage.tsx
Import and add to the right panel/tab slots:

```tsx
// Add these imports:
import { RealTerminal } from "@/components/ide/RealTerminal";
import { ScreenshotToCode } from "@/components/ide/ScreenshotToCode";
import { ShareablePreview } from "@/components/ide/ShareablePreview";
import { MobileBuilder } from "@/components/ide/MobileBuilder";
import { OneClickTemplates } from "@/components/ide/OneClickTemplates";
import { RollbackTimeline, AdaptivePromptLibrary, AgentPersonality, EcosystemPublish } from "@/components/ide/AllUpgrades_6_8_9_10";

// Replace TerminalPanel with RealTerminal in the terminal slot:
{showTerminal && <RealTerminal projectId={activeProjectId} />}

// Add Screenshot button next to FileUpload in TopBar:
<button onClick={() => setShowScreenshot(true)}>📸 Screenshot → Code</button>

// Add Share button in TopBar:
<button onClick={() => setShowSharePreview(true)}>🔗 Share Preview</button>

// On mobile (isMobile === true), render MobileBuilder instead of full IDE

// Add Templates button to WelcomePanel or QuickActions
// Add RollbackTimeline to the right panel tab list (alongside Git)
// Add AdaptivePromptLibrary to the chat panel header
// Add AgentPersonality to Settings
// Add EcosystemPublish to the Deploy panel
```

### Step 5 — Memory injection (Upgrade #6)
In convex/engine.ts, find where the system prompt is assembled and add:
```typescript
const memories = await ctx.runQuery(internal.intelligence.getTopMemories, {
  projectId, limit: 12
});
// Inject memories into the system prompt string
```

### Step 6 — Mobile detection
The MobileBuilder auto-renders when `window.innerWidth < 640`.
In IDEPage.tsx, add:
```tsx
if (isMobile) return <MobileBuilder ... />;
```

---

## Personality Presets Available
- ⚡ Scrappy Startup — fast, minimal, ship it
- 🏢 Enterprise Grade — documented, tested, typed
- 🔴 WTP News Mode — brand-matched, mobile-first, activism focus
- ◻ Ultra Minimal — zero dependencies
- 🧠 AI-Native — AI-first architecture patterns

## Ecosystem Templates (WTP Branded)
- Civil Rights Incident Intake Form
- Activist Organization Hub  
- WTP News Article Template
- (+ 5 universal templates)
