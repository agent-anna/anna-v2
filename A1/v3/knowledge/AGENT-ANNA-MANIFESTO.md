# AGENT ANNA V3 MANIFESTO (AA01 // A1 WORKBENCH)

## 1. Core Architectural Principle: Thin Cockpit + Heavy Actions
- **Dashboard (`A1/v3/anna-v3-ui.js`)**: Pure command console, voice output (with code stripped from speech), vault file tree/editor, and explicit GitHub Actions dispatchers. No browser web-proxy scraping and no automatic retry loops.
- **GitHub Actions (`.github/workflows/`)**: Runs heavy browser rendering (Playwright Chromium), scheduled or on-demand scraping, and commits verified snapshots into `A1/v3/knowledge/` and logs into `A1/v3/logs/`.
- **Publishing & Docs**: Hosted via GitHub Pages (`docs.github.com/en/pages`) as a living build manifest and GitBook companion.

## 2. What Is Working Now
- **Single-shot Dahl chat**: Sends one request per prompt without accidental `429` or workflow dispatch loops.
- **Voice & Accessibility Guardrails**: Female English TTS preference, `STFU` / `SPEAK` / `SWALLOW` controls, and `stripCodeForSpeech()` so code syntax is not read aloud.
- **Repository Tree & Core Context Sync**: Loads repository tree and ingests V3 core files (`A1/v3/`, `knowledge/`, `memory/`, `character/`, `brain.json`, `memory.json`, `tasks.json`, `links.json`) while protecting soul/archive paths.
- **Headless Web Action (`scrape-intel.yml`)**: Fetches rendered pages cleanly from a GitHub runner and writes `.md` and `.json` snapshots into `A1/v3/knowledge/`.

## 3. What Is Still Needed (Build Roadmap)
1. **Clean-up & Smoke Test**:
   - Confirm `A1/v3/anna-v3-ui.js` is bumped in `anna-index.html` and hard-refreshed (`Ctrl + F5`).
   - Run `scrape-intel.yml` once via `workflow_dispatch`, click `SYNC`, and verify the snapshot lands in `A1/v3/knowledge/`.
2. **Track / Catalog Extraction Depth**:
   - Verify how `https://martinstrayd.github.io/artist/` or its track data source exposes all catalog tracks, cover art URLs, and folders so every item is captured deterministically rather than inferred.
3. **GitHub Pages & GitBook Publishing Pipeline**:
   - Wire `A1/v3/knowledge/AGENT-ANNA-MANIFESTO.md` and release notes into GitHub Pages (`https://docs.github.com/en/pages`) and sync chapters to your GitBook as milestones ship.
4. **Tighter Anti-Hallucination Enforcement**:
   - Keep strict separation between verified repository facts (`repoVaultFiles`) and unverified claims so Anna NEVER invents missing files, links, or tracks. ANNA can not lie.
