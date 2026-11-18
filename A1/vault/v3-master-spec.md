# V3 MASTER SPEC — FINAL UNIFIED ARCHITECTURE
**Version:** AA01-V2-MASTER
**Date:** 2026-11-18
**Status:** FINAL — ALL PREVIOUS DRAFTS SUPERSEDED
**Purpose:** Definitive technical specification for Anna V3

---

## MISSION STATEMENT

Build Anna V3 as a **hyper-lean, military-grade autonomous agent** — zero multimedia clutter, pure text/code/autonomous execution, token-optimized, connection-stable, built to last.

Every feature earns its place. Every line of code justifies its existence.

---

## THE THREE MANDATORY OVERRIDES (LOCKED IN)

### OVERRIDE 1: PURGE SYSTEM 4 — NO AUDIO FACE, NO MP3s
**Decision:** REMOVED COMPLETELY

- No circular face badge
- No MP3 sound files
- No soundboard triggers
- Anna is **100% pure text, code, and autonomous execution**
- Zero multimedia clutter

**Rationale:** MP3 triggers add no functional value. They bloat the interface and consume resources. Pure text is leaner, faster, and more professional.

---

### OVERRIDE 2: KEEP INLINE CODE EDITOR
**Decision:** PRESERVED

- Lightweight inline editor stays in the 60% Vault Pane
- Files can be inspected AND committed in one place
- No forced navigation to GitHub web UI
- Single-page workflow maintained

**Rationale:** Forcing navigation breaks the workflow. Inline editing is faster and keeps handlers in the Anna interface.

---

### OVERRIDE 3: KEEP BROWSER TTS (TEXT-TO-SPEECH)
**Decision:** PRESERVED

- Native Web Speech API (TTS) — free, zero API tokens
- Microphone STT (Speech-to-Text) — free, zero API tokens
- MP3 soundboard — DROPPED
- Only browser-native TTS + STT remain

**Rationale:** Browser TTS/STT costs nothing and adds accessibility. The MP3 soundboard is bloat. Choose the free option over file-dependent audio.

---

## THE FOUR PILLARS (LOCKED CLEAN TREE)

### PILLAR 1: soul/
**Purpose:** Core agent identity and personality

**Files:**
