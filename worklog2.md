
---
Task ID: 1
Agent: Main Agent
Task: Fix all mobile UI issues in the Aether app (dark mode, empty space, layout, bottom nav, long URLs)

Work Log:
- Fixed all 7 mobile UI issues across 10 files
- Key changes: globals.css (background colors), layout.tsx (force light mode), aether-store.ts (darkMode default false), AppShell.tsx (min-h-dvh, overflow), Dashboard.tsx (min-h-0, break-word), AskAether.tsx (h-full instead of h-[100dvh]), removed min-h-screen from Collections/Recaps/Settings/MemoryDetail

Stage Summary:
- Light mode is now the default theme with #FFFAF5 background
- Content areas properly fill viewport with min-h-dvh and flex-1
- Dark mode only activates when user explicitly enables it in settings
- Lint passes, no compilation errors
