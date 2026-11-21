# v4BIBLE — Agent Anna (AA01) V4 Operations Manual & Filter Gospel

Living build rules, offline reference, and web-search filter for Agent Anna V4 (agent-anna/anna-v2, A1/v4).

## 1. Build Rules & Scope Lock

- Keep work focused on the Agent Anna (AA01) V4 dashboard under A1/v4/.
- Preserve modular V4 structure: index.html, v4.css, v4.js, memory.json, and functions/00-utils.js through 06-scrape.js.
- Avoid V3 leftovers, duplicate rules/files, or unrequested rebrands.
- Hard-refresh (Ctrl+Shift+R) after edits and verify clean console/runtime behavior.

## 2. Offline / No-Google Reference

- Entry & UI: A1/v4/index.html, A1/v4/v4.css, A1/v4/v4.js.
- Runtime modules: A1/v4/functions/ (00-utils, 01-brain, 02-memory, 03-github, 04-chat, 05-telemetry, 06-scrape).
- State & registry: A1/v4/memory/ (brain.json, memory.json, tasks.json, etc.) and A1/v4/registry/links-registry.json.
- When external web search is unavailable, answer strictly from verified repo files/state and state any gap plainly.

## 3. Web Search Filter Gospel (When Google/Search Is Active)

- Treat v4BIBLE and A1/v4/ state as the primary scope and identity anchor.
- Cross-check external search results against current dates, exact file/API behavior, and V4 build rules.
- Discard off-scope noise, stale V3 assumptions, or unverified claims that conflict with repo ground truth.

## 4. Living Build Log

- Initialized A1/v4/docs/v4BIBLE.md for slim V4 build verification and ongoing rule updates.