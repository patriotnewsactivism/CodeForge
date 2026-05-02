# CodeForge v2 — Architecture

## Core Principle
**Agents use tools, not text parsing.** Instead of generating markdown and parsing it with regex, the AI calls structured functions (`create_file`, `edit_file`, `run_command`, `spawn_agent`) via the OpenAI function-calling API. Every tool call executes immediately, the agent sees the result, and continues until done.

## Stack
- **Frontend**: React + Vite + Tailwind + Monaco Editor + xterm.js
- **Backend**: Convex (real-time DB, auth, subscriptions)
- **AI**: Azure AI Foundry (DeepSeek V3.2, Grok 4.1 Fast, Kimi K2.6) via function-calling
- **Deploy**: Railway (frontend) + Convex Cloud (backend)

## Agent Engine (Tool-Calling Loop)

```
User sends prompt
    → Orchestrator agent spawns
        → Calls AI with tools: [create_file, edit_file, delete_file, read_file, list_files, spawn_agent, send_message, complete_task]
        → AI returns tool_calls
        → Each tool call is executed, result returned to AI
        → AI continues (more tool calls, or final response)
        → If spawning children: each child runs the same loop
        → When all children complete: orchestrator reviews and finalizes
```

### Tools Available to Agents
| Tool | Description |
|------|-------------|
| `create_file` | Create a new file with content |
| `edit_file` | Replace content in an existing file |
| `delete_file` | Remove a file |
| `read_file` | Read a file's content |
| `list_files` | List project files |
| `search_files` | Search for patterns in files |
| `spawn_agent` | Create a child agent with a sub-task |
| `send_message` | Send a message to another agent |
| `git_commit` | Commit current changes to a branch |
| `complete_task` | Signal task completion with summary |

### Agent Roles
- **Orchestrator**: Decomposes missions, spawns specialists, reviews results
- **Architect**: Designs file structure and system architecture
- **Coder**: Writes implementation code
- **Reviewer**: Reviews code for bugs, style, security
- **Debugger**: Finds and fixes issues
- **Tester**: Writes and validates tests

### Model Assignment
- Grok 4.1 Fast → Orchestrator, Architect (complex reasoning)
- DeepSeek V3.2 → Coder (best at code generation)
- Kimi K2.6 → Worker tasks, Reviews (cost-effective)

## Schema (Simplified)

### Core Tables
- `users` (via @convex-dev/auth)
- `projects` — user's projects
- `files` — project files (content stored directly)
- `sessions` — chat sessions
- `messages` — chat messages

### Agent System
- `missions` — top-level user requests
- `agentRuns` — individual agent executions
- `toolCalls` — every tool call an agent makes (full audit trail)
- `agentMessages` — inter-agent communication

### Intelligence
- `memories` — persistent learnings per project
- `retrospectives` — post-mission analysis

## Frontend Architecture

### Layout (Mobile-First)
```
┌─────────────────────────────┐
│         Top Bar              │
├────────┬────────────────────┤
│ Files  │  Monaco Editor     │
│ Tree   │  (tabbed files)    │
│        ├────────────────────┤
│        │  Terminal / Output  │
├────────┴────────────────────┤
│  Agent Activity Stream       │
│  (live tool calls, thoughts) │
├─────────────────────────────┤
│  Chat Input                  │
└─────────────────────────────┘
```

Mobile: Swipeable tabs (Chat, Files, Editor, Agents, Terminal)

### Key Frontend Changes from v1
1. Monaco Editor replaces basic textarea code editor
2. Live terminal showing agent actions as they happen
3. Tool call stream replaces the activity log
4. File tree updates in real-time as agents create files
5. Agent tree visualizer shows spawning in real-time
