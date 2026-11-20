# Page 14 — Modular Scripts (v=3.16) & Safe Architecture

One of the smartest engineering choices in Agent Anna V3 is keeping the codebase split into focused modules rather than cramming everything into one giant file. Across ./functions/utils.js?v=3.16, ./functions/github.js?v=3.16, ./functions/memory.js?v=3.16, ./functions/telemetry.js?v=3.16, ./functions/brain.js?v=3.16, ./functions/chat.js?v=3.16, ./anna-v3-ui.js?v=3.16, and ./anna-v3.css?v=3.16, each responsibility has a clear home. That separation makes troubleshooting easier and protects existing controls when new capabilities are added.

As V3 hands over to V4, modular architecture gives Anna and Martin room to improve one part at a time. Memory handling, telemetry badges, model switching (MiniMaxAI/MiniMax-M2.7 / MODEL: ANNA, deepseek-ai/DeepSeek-V4-Flash-0731 / MODEL: DEEPSEEK-V4-FLASH, and zai-org/GLM-5.3-Flash / MODEL: GLM-5.3-FLASH), and repository vault actions (VIEW: TREE, SYNC, AUDIT, COMMIT, and guarded DELETE with YES, DELETE) can evolve cleanly without tearing down what already works.

[IMAGE PLACEHOLDER 14 - MODULAR CODE & WORKBENCH STABILITY: Realistic close-up photograph of clean code modules and calm interface layout on a workstation screen; zero cartoon elements.]
