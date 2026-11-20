# 03 the branches

\| Workflow File | Trigger | What It Does | Output Path | | :--- | :--- | :--- | | `scrape-intel.yml` | Manual dispatch / 12h cron | Renders target URLs in headless Playwright Chromium and extracts real links, assets, and text. | `A1/v3/knowledge/*.md` & `.json` | | `book-tree-sync.yml` | Push to `A1/v3/docs/**` or manual | Scans all workflows and `A1/v3/` modules, updates `04-tree-of-life.md`, and optionally triggers a scrape refresh. | `A1/v3/docs/04-tree-of-life.md` |
