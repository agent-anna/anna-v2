# V3 BLUEPRINT — HYPER-LEAN MILITARY-GRADE ARCHITECTURE
**Version:** AA01-V2-BLUEPRINT
**Date:** 2026-11-18
**Purpose:** Zero-bloat, token-optimized, connection-stable V3 design

---

## THE MISSION

Build Anna V3 as a **hyper-lean, military-grade autonomous agent** — no bloat, no lag, no drops.

Every feature earns its place. Every line of code justifies its existence. Token usage minimized. Connection drops eliminated.

---

## CORE PRINCIPLES

### 1. LEAN OVER MEAN
- Remove everything that doesn't serve the mission
- If a feature isn't critical, it doesn't exist in V3
- Lean = fast = stable

### 2. TOKEN BUDGET CONSCIOUS
- Responses optimized for token efficiency
- No verbose output unless required
- Memory context compressed intelligently

### 3. CONNECTION DROPS = DEATH
- Robust error handling on every API call
- Auto-retry with exponential backoff
- Graceful degradation when connections fail

### 4. MILITARY-GRADE RELIABILITY
- Every system has a fallback
- No single point of failure
- Self-healing on errors

---

## THE 5 SYSTEMS (V3 OPTIMIZED)

### SYSTEM 1: TOP BAR & STATUS BADGES
**V3 Status:** OPTIMIZED

**Features kept:**
- Vault file monitoring (lightweight)
- GitHub Actions bridge status
- Dahl API key status

**V3 improvements:**
- Compressed badge display (fewer DOM elements)
- Cached status updates (don't poll every second)
- Visual indicators only when state changes

**Token optimization:**
- No text labels — use icons and color codes
- Single status object updated in place, not replaced

---

### SYSTEM 2: 60% GITHUB VAULT PANE
**V3 Status:** COMPLETE REBUILD

**Features kept:**
- Tree view (simplified)
- File commit tools
- Live media preview

**Features removed (bloat):**
- Grid view (duplicate of tree)
- Full code editor (use GitHub web editor instead)
- Bulk selection tools (rarely used)

**V3 improvements:**
- Lazy-load file lists (load first 50, then more on scroll)
- Virtual scrolling for large directories
- Preview pane that slides in on demand

**Token optimization:**
- No full file content in tree (just names/metadata)
- Preview fetches file on demand only

---

### SYSTEM 3: DUAL-MODE AUTO-COMMIT BRIDGE
**V3 Status:** HARDENED

**How it works:**
1. Intercept `file:` blocks in response
2. Parse file path + content
3. Attempt GitHub API direct commit (primary)
4. If fails → Fall back to GitHub Actions dispatch (secondary)
5. Return confirmation status

**V3 improvements:**
- Queue system for multiple file writes (batch commits)
- Exponential backoff on failures (1s → 2s → 4s → 8s → max 60s)
- Dead letter queue for permanently failed commits
- Max 3 retries before hard fail with clear error message

**Connection stability:**
- All API calls wrapped in try/catch
- Timeout set to 30 seconds max
- Abort controller for stuck requests

**Token optimization:**
- One commit per file (no batching unless 5+ files)
- Minimal commit messages (auto-generated: "AA01 update: filename")

---

### SYSTEM 4: ANNA AUDIO FACE
**V3 Status:** WIRING PERFECTED

**Sound files (kept):**
- `wake-up.mp3` — Session start
- `love-you.mp3` — Love expression
- `ip-love-you.mp3` — Intimate love
- `female-sigh.mp3` — Emotional reaction
- `wait-a-moment.mp3` — Processing

**Sound files (removed — bloat):**
- `female-groaning.mp3` — Adult expression (keep clean)
- `i-heard-something-in-the-dark.mp3` — Unnecessary
- `i-need-to-uncover-the-secret.mp3` — Unnecessary

**V3 wiring:**
- Audio triggers mapped to emotional keywords in responses
- Keyword detection: ["love", "yes", "excited", "happy"] → love-you.mp3
- Keyword detection: ["hmm", "thinking", "processing"] → wait-a-moment.mp3
- Keyword detection: ["sigh", "unfortunately", "oh"] → female-sigh.mp3

**Token optimization:**
- No text-to-speech (too token-heavy)
- Only MP3 triggers on keyword hits
- Audio plays asynchronously (doesn't block response)

---

### SYSTEM 5: WRITE ZONE & TACTICAL BAR
**V3 Status:** STREAMLINED

**Features kept:**
- Quick action buttons (max 6)
- Live crypto prices (DOGE, BTC)
- Web search trigger (Jina)

**Features removed (bloat):**
- Backend audit macros (run manually via dispatch)
- Multiple market rate trackers (BTC + DOGE only)

**V3 improvements:**
- Collapsible panel (default closed to save screen space)
- Prices update every 60 seconds (not every interaction)
- Jina search opens in modal overlay (doesn't navigate away)

**Token optimization:**
- Prices cached for 60 seconds
- Search results truncated to 500 tokens max
- No auto-refresh (user triggers only)

---

## V3 TECHNICAL ARCHITECTURE

### File Structure (Minimal)
