(function () {
    "use strict";

    const GITHUB_REPO_OWNER = "agent-anna";
    const GITHUB_REPO_NAME = "anna-v2";
    const WORKFLOW_FILENAME = "anna-autonomous-audit.yml";
    const DAHL_ENDPOINT = "https://inference.dahl.global/v1/chat/completions";
    const DEFAULT_MODEL = "MiniMaxAI/MiniMax-M2.7";

    let isVoiceEnabled = true;
    const messagePayloadStore = {};
    let chatHistory = [];
    let cachedVoices = [];
    let recognition = null;
    let isListening = false;
    let repoVaultFiles = {};
    let rawTreeData = [];
    let currentViewMode = "tree";
    let activeBranch = "main";
    let workflowPollTimer = null;
    let ttsKeepAliveTimer = null;
    let isSyncing = false;

    function isSoulOrLoveLetterPath(path) {
        const p = String(path || "").toLowerCase();
        return (
            p.includes("/soul/") ||
            p.startsWith("soul/") ||
            p.includes("love-letter") ||
            p.includes("love_letter") ||
            p.includes("loveletter")
        );
    }

    function isV3CoreFile(path) {
        if (!path || isSoulOrLoveLetterPath(path)) return false;
        const lower = path.toLowerCase();
        if (!/\.(md|json|txt)$/i.test(lower)) return false;
        const base = lower.split("/").pop();
        return (
            lower.includes("/v3/") ||
            lower.startsWith("v3/") ||
            base.includes("anna-v3") ||
            base.startsWith("aa01") ||
            base === "brain.json" ||
            base === "memory.json" ||
            base === "links.json" ||
            base === "tasks.json" ||
            base === "sessions.md" ||
            base.includes("character") ||
            lower.includes("/character/") ||
            lower.startsWith("character/") ||
            lower.includes("/knowledge/") ||
            lower.startsWith("knowledge/") ||
            lower.includes("/memory/") ||
            lower.startsWith("memory/")
        );
    }

    function cleanHeaderToken(str) {
        if (!str) return "";
        return String(str).replace(/[^\x20-\x7E\xA0-\xFF]/g, "").trim();
    }

    function getStoredKey(names) {
        for (const n of names) {
            const v = localStorage.getItem(n);
            if (v && v.trim()) return cleanHeaderToken(v);
        }
        return "";
    }

    function getCleanDahlKey() {
        const el = document.getElementById("api-key");
        const raw = (el && el.value) || getStoredKey(["DAHL_API_KEY", "dahl_api_key", "OPENAI_API_KEY", "api_key"]);
        return cleanHeaderToken(raw);
    }

    function getCleanGitHubToken() {
        const el = document.getElementById("gh-token");
        const raw = (el && el.value) || getStoredKey(["GITHUB_PAT", "gh_token", "github_token"]);
        return cleanHeaderToken(raw);
    }

    function getActiveModel() {
        const selectEl = document.getElementById("model-select");
        if (selectEl && selectEl.value) return selectEl.value;
        return localStorage.getItem("DAHL_MODEL") || DEFAULT_MODEL;
    }

    function setMoodState(stateName) {
        const normalized = String(stateName || "standby").toLowerCase();
        const valid = ["standby", "thinking", "responding", "saving", "error", "speaking", "listening"];
        const target = valid.includes(normalized) ? normalized : "standby";
        document.body.classList.remove("is-standby", "is-thinking", "is-responding", "is-saving", "is-error", "is-speaking", "is-listening");
        document.body.classList.add(`is-${target}`);
        const stEl = document.getElementById("state-text");
        if (stEl) stEl.innerText = `${target.toUpperCase()} // AGENT ANNA V3`;
        if (window.Brain && typeof window.Brain.setState === "function") {
            try { window.Brain.setState(target.toUpperCase()); } catch (e) {}
        }
    }

    function updateKeyBadge() {
        const k = getCleanDahlKey();
        const badge = document.getElementById("key-status");
        if (!badge) return;
        if (k) {
            badge.innerText = `KEY: LOADED (${k.slice(0, 6)}...)`;
            badge.className = "status-badge ok";
        } else {
            badge.innerText = "KEY: MISSING";
            badge.className = "status-badge err";
        }
    }

    function updateActionsBadge(text, stateClass) {
        const badge = document.getElementById("actions-status");
        if (!badge) return;
        badge.innerText = `ACTIONS: ${text}`;
        badge.className = `status-badge ${stateClass || ""}`;
    }

    function playToneCue(freq, durationMs) {
        if (!isVoiceEnabled) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq || 660;
            gain.gain.value = 0.04;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            setTimeout(() => {
                try { osc.stop(); ctx.close(); } catch (e) {}
            }, durationMs || 140);
        } catch (e) {}
    }

    function loadVoices() {
        if (!("speechSynthesis" in window)) return;
        try {
            const v = window.speechSynthesis.getVoices();
            if (v && v.length) cachedVoices = v;
        } catch (e) {}
    }

    function pickFemaleEnglishVoice(voices) {
        const list = (voices && voices.length ? voices : cachedVoices) || [];
        if (!list.length) return null;

        const femaleHints = [
            "google uk english female",
            "google us english",
            "microsoft zira",
            "microsoft aria",
            "microsoft jenny",
            "microsoft sonia",
            "samantha",
            "victoria",
            "karen",
            "moira",
            "fiona",
            "tessa",
            "female"
        ];
        const maleOrRoboticHints = [
            "david",
            "mark",
            "george",
            "daniel",
            "arthur",
            "ryan",
            "guy",
            "alex",
            "fred",
            "espeak",
            "male"
        ];

        const scoreVoice = (v) => {
            const name = String(v.name || "").toLowerCase();
            const lang = String(v.lang || "").toLowerCase();
            let score = 0;
            if (lang.startsWith("en")) score += 20;
            if (/en[-_](us|gb)/.test(lang)) score += 10;
            if (femaleHints.some((h) => name.includes(h))) score += 50;
            if (v.localService) score += 5;
            if (maleOrRoboticHints.some((h) => name.includes(h))) score -= 60;
            return score;
        };

        return list.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
    }

    function clearTtsKeepAlive() {
        if (ttsKeepAliveTimer) {
            clearInterval(ttsKeepAliveTimer);
            ttsKeepAliveTimer = null;
        }
    }

    function sanitizeResponse(text) {
        if (!text) return "";
        return String(text).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    }

    function formatReadableMessage(rawText) {
        if (!rawText) return "";
        const text = String(rawText).trim();
        const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/^(\{[\s\S]*\})$/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed && typeof parsed.content === "string") {
                    const unescaped = parsed.content
                        .replace(/\\r\\n/g, "\n")
                        .replace(/\\n/g, "\n")
                        .replace(/\\t/g, "  ");
                    const headerNote = parsed.path ? `[TARGET: ${parsed.path}]\n\n` : "";
                    return (headerNote + unescaped).trim();
                }
            } catch (e) {}
        }
        return text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
    }

    function speakText(text) {
        if (!isVoiceEnabled) return;
        const clean = formatReadableMessage(sanitizeResponse(text))
            .replace(/[*_#`~\[\]()]/g, "")
            .replace(/\s+/g, " ")
            .trim();
        if (!clean) return;

        if (!("speechSynthesis" in window)) {
            playToneCue(720, 160);
            return;
        }

        try {
            clearTtsKeepAlive();
            window.speechSynthesis.cancel();
            loadVoices();
            const voices = window.speechSynthesis.getVoices();
            if (!voices || !voices.length) {
                playToneCue(720, 160);
            }

            const chunks = [];
            const sentences = clean.match(/[^.!?]+[.!?]*|[^.!?]+$/g) || [clean];
            let buf = "";
            for (const s of sentences) {
                const part = s.trim();
                if (!part) continue;
                if ((buf + " " + part).length > 260 && buf) {
                    chunks.push(buf.trim());
                    buf = part;
                } else {
                    buf = buf ? buf + " " + part : part;
                }
            }
            if (buf.trim()) chunks.push(buf.trim());
            if (!chunks.length) return;

            const chosenVoice = pickFemaleEnglishVoice(voices);
            setMoodState("responding");

            let idx = 0;
            const speakNext = () => {
                if (idx >= chunks.length || !isVoiceEnabled) {
                    clearTtsKeepAlive();
                    setMoodState("standby");
                    return;
                }
                const utterance = new SpeechSynthesisUtterance(chunks[idx++]);
                if (chosenVoice) utterance.voice = chosenVoice;
                utterance.lang = (chosenVoice && chosenVoice.lang) || "en-US";
                utterance.pitch = 1.08;
                utterance.rate = 1.02;
                utterance.onend = () => {
                    if (idx < chunks.length) speakNext();
                    else {
                        clearTtsKeepAlive();
                        setMoodState("standby");
                    }
                };
                utterance.onerror = () => {
                    clearTtsKeepAlive();
                    playToneCue(440, 180);
                    setMoodState("standby");
                };
                window.speechSynthesis.speak(utterance);
            };

            speakNext();
            ttsKeepAliveTimer = setInterval(() => {
                if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                } else if (!window.speechSynthesis.speaking) {
                    clearTtsKeepAlive();
                }
            }, 3000);
        } catch (e) {
            clearTtsKeepAlive();
            playToneCue(440, 180);
            setMoodState("standby");
        }
    }

    function executeStfuProtocol() {
        clearTtsKeepAlive();
        if ("speechSynthesis" in window) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
        }
        if (recognition) {
            isListening = false;
            try { recognition.stop(); } catch (e) {}
        }
        const micBtn = document.getElementById("mic-btn");
        if (micBtn) micBtn.classList.remove("listening");
        setMoodState("standby");
    }

    function getGitHubHeaders() {
        const token = getCleanGitHubToken();
        return token
            ? { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
            : { Accept: "application/vnd.github.v3+json" };
    }

    async function fetchWithTimeout(url, opts) {
        return await fetch(url, opts || {});
    }

    function toggleMessageCollapse(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const content = el.querySelector(".msg-content");
        if (content) content.classList.toggle("collapsed");
    }

    function appendMessage(sender, text, id, isAssistant) {
        const container = document.getElementById("chat-container");
        if (!container) return;
        const readableText = isAssistant ? formatReadableMessage(text) : text;
        const div = document.createElement("div");
        div.className = `message ${isAssistant ? "assistant" : "user"}`;
        div.id = id;
        messagePayloadStore[id] = readableText;

        const header = document.createElement("div");
        header.className = "msg-header";
        header.onclick = () => toggleMessageCollapse(id);
        const senderSpan = document.createElement("span");
        senderSpan.textContent = sender;
        const toggleSpan = document.createElement("span");
        toggleSpan.textContent = "▾";
        header.appendChild(senderSpan);
        header.appendChild(toggleSpan);

        const body = document.createElement("div");
        body.className = "msg-content";
        body.textContent = readableText;

        div.appendChild(header);

        if (isAssistant) {
            const temp = document.createElement("div");
            temp.innerHTML = `
                <div class="action-row">
                    <button class="action-chip" onclick="window.speakStoredMessage('${id}')">SPEAK</button>
                    <button class="action-chip" onclick="window.copyToClipboard('${id}', this)">COPY</button>
                    <button class="action-chip swallow-btn" onclick="window.autonomousSwallowAndCommit('${id}', this)">🌀 SWALLOW</button>
                    <button class="action-chip del-btn" onclick="window.executeStfuProtocol()">🛑 STFU</button>
                    <button class="action-chip del-btn" onclick="window.deleteMessage('${id}')">🗑️ DEL</button>
                </div>`;
            while (temp.firstChild) div.appendChild(temp.firstChild);
        }

        div.appendChild(body);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function updateMessage(id, text) {
        const el = document.getElementById(id);
        if (!el) return;
        const readableText = formatReadableMessage(text);
        const body = el.querySelector(".msg-content");
        if (body) body.textContent = readableText;
        messagePayloadStore[id] = readableText;
        const container = document.getElementById("chat-container");
        if (container) container.scrollTop = container.scrollHeight;
    }

    function deleteMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
        delete messagePayloadStore[id];
    }

    function clearLogs() {
        const container = document.getElementById("chat-container");
        if (container) container.innerHTML = "";
        Object.keys(messagePayloadStore).forEach((k) => delete messagePayloadStore[k]);
        chatHistory = [];
    }

    function speakStoredMessage(id) {
        if (messagePayloadStore[id]) speakText(messagePayloadStore[id]);
    }

    function copyToClipboard(id, btn) {
        if (!messagePayloadStore[id]) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(messagePayloadStore[id]).then(() => {
                if (btn) {
                    const prev = btn.innerText;
                    btn.innerText = "COPIED!";
                    setTimeout(() => { btn.innerText = prev || "COPY"; }, 1800);
                }
            }).catch(() => {});
        }
    }

    function wantsOpenSourceScout(prompt) {
        const lower = String(prompt || "").toLowerCase();
        return /open.?source|borrow|github|repo|scout|social.?media|automation|w3c|architecture|bot|agent/.test(lower);
    }

    function hasScoutedToday() {
        const today = new Date().toISOString().slice(0, 10);
        const memoryText = Object.entries(repoVaultFiles)
            .filter(([p]) => !isSoulOrLoveLetterPath(p) && (p.toLowerCase().includes("memory.json") || p.toLowerCase().includes("logs/")))
            .map(([, c]) => c)
            .join("\n");
        return memoryText.includes(`scout_date:${today}`) || memoryText.includes(today);
    }

    async function fetchLiveWebAndMarketTelemetry(prompt) {
        const telemetryBlocks = [];
        const lower = String(prompt || "").toLowerCase();

        if (/\b(btc|bitcoin|doge|dogecoin|crypto|price|market|rate)\b/.test(lower)) {
            try {
                const cryptoRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,dogecoin&vs_currencies=usd&include_24hr_change=true");
                if (cryptoRes.ok) {
                    const cryptoData = await cryptoRes.json();
                    telemetryBlocks.push(`[VERIFIED LIVE COINGECKO TELEMETRY @ ${new Date().toISOString()}]\n- Bitcoin (BTC): $${cryptoData.bitcoin.usd} (24h Change: ${cryptoData.bitcoin.usd_24h_change.toFixed(2)}%)\n- Dogecoin (DOGE): $${cryptoData.dogecoin.usd} (24h Change: ${cryptoData.dogecoin.usd_24h_change.toFixed(2)}%)`);
                }
            } catch (e) {}
        }

        if (wantsOpenSourceScout(lower)) {
            telemetryBlocks.push(`[DAILY OPEN-SOURCE SCOUT STATUS]\n- Date: ${new Date().toISOString().slice(0, 10)}\n- Logged today in memory/logs: ${hasScoutedToday() ? "yes" : "no"}\n- Rule: Only recommend open-source tools/repos that help build, music, marketing, or social reach, and require review before borrowing.`);
        }

        return telemetryBlocks.length > 0 ? "\n\n" + telemetryBlocks.join("\n\n") : "";
    }

    async function getLatestFileSha(path) {
        try {
            const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`, {
                headers: getGitHubHeaders(),
                cache: "no-store"
            });
            if (res.ok) {
                const data = await res.json();
                return data.sha;
            }
        } catch (e) {}
        return undefined;
    }

    async function writeFileToGitHub(path, content, commitMessage) {
        if (isSoulOrLoveLetterPath(path)) return false;
        if (window.GitHub && typeof window.GitHub.upsert === "function") {
            try {
                const r = await window.GitHub.upsert(path, content, commitMessage);
                if (r && (r.ok || r.commit)) return true;
            } catch (e) {}
        }
        const sha = await getLatestFileSha(path);
        const utf8Bytes = new TextEncoder().encode(content);
        let binString = "";
        utf8Bytes.forEach((b) => { binString += String.fromCodePoint(b); });
        const encodedContent = btoa(binString);
        const payload = { message: commitMessage, content: encodedContent };
        if (sha) payload.sha = sha;
        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`, {
            method: "PUT",
            headers: { ...getGitHubHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const putData = await putRes.json();
        return putRes.status === 201 || putRes.status === 200 || Boolean(putData && putData.commit);
    }

    async function dispatchBackendWorkflow(customCommand, customSearchQuery) {
        const token = getCleanGitHubToken();
        if (!token) {
            appendMessage("System Telemetry", "ERROR: GitHub PAT missing. Click KEYS to configure token with 'workflow' & 'repo' permissions.", "msg_err_" + Date.now(), false);
            toggleSettings();
            return;
        }

        const userEl = document.getElementById("user-input");
        const cmdText = customCommand
            || (userEl && userEl.value.trim())
            || "Perform a full V3 vault integrity audit, verify live BTC/DOGE prices, and log system telemetry.";

        updateActionsBadge("DISPATCHING...", "active");
        setMoodState("thinking");

        try {
            const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${WORKFLOW_FILENAME}/dispatches`, {
                method: "POST",
                headers: { ...getGitHubHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    ref: activeBranch,
                    inputs: { command: cmdText, search_query: customSearchQuery || "" }
                })
            });

            if (res.status === 204 || res.ok) {
                updateActionsBadge("QUEUED", "active");
                appendMessage("System Telemetry", `BACKEND WORKFLOW DISPATCHED (${WORKFLOW_FILENAME})\nDirective: "${cmdText}"`, "msg_wf_" + Date.now(), false);
                speakText("Backend workflow dispatched.");
                startWorkflowTelemetryPoller();
            } else {
                updateActionsBadge("FALLBACK PUSH", "active");
                await writePendingCommandFallback(cmdText);
            }
        } catch (err) {
            updateActionsBadge("ERROR", "err");
            setMoodState("error");
            appendMessage("System Telemetry", `DISPATCH FAILED: ${err.message}`, "msg_wf_err_" + Date.now(), false);
            return;
        }
        setMoodState("standby");
    }

    async function writePendingCommandFallback(cmdText) {
        const targetPath = "A1/vault/pending-commands.md";
        const ok = await writeFileToGitHub(targetPath, cmdText + "\n", "AA01 Pending Command Drop-Box Trigger");
        if (ok) {
            appendMessage("System Telemetry", `COMMAND COMMITTED TO ${targetPath}. Backend push trigger activated.`, "msg_fb_" + Date.now(), false);
            startWorkflowTelemetryPoller();
        } else {
            updateActionsBadge("FAILED", "err");
        }
    }

    function startWorkflowTelemetryPoller() {
        if (workflowPollTimer) clearInterval(workflowPollTimer);
        let checks = 0;
        const maxChecks = 24;

        workflowPollTimer = setInterval(async () => {
            checks++;
            if (checks > maxChecks) {
                clearInterval(workflowPollTimer);
                updateActionsBadge("TIMEOUT", "err");
                return;
            }
            try {
                const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${WORKFLOW_FILENAME}/runs?per_page=1`, {
                    headers: getGitHubHeaders(),
                    cache: "no-store"
                });
                if (!res.ok) return;
                const data = await res.json();
                const latestRun = data.workflow_runs && data.workflow_runs[0];
                if (!latestRun) return;

                if (latestRun.status === "queued" || latestRun.status === "in_progress") {
                    updateActionsBadge(latestRun.status.toUpperCase(), "active");
                } else if (latestRun.status === "completed") {
                    clearInterval(workflowPollTimer);
                    if (latestRun.conclusion === "success") {
                        updateActionsBadge("VERIFIED [200]", "ok");
                        appendMessage("System Telemetry", `BACKEND RUN COMPLETED (#${latestRun.run_number}). Refreshing V3 vault & loading report...`, "msg_wf_done_" + Date.now(), false);
                        await fetchRepoTree();
                        await ingestCoreVaultAssets();
                        await fetchLatestBackendReport(true);
                    } else {
                        updateActionsBadge(`FAIL: ${latestRun.conclusion}`, "err");
                        appendMessage("System Telemetry", `BACKEND RUN ENDED WITH STATUS: ${latestRun.conclusion}.`, "msg_wf_fail_" + Date.now(), false);
                    }
                }
            } catch (e) {}
        }, 5000);
    }

    async function fetchLatestBackendReport(autoAnnounceToAnna) {
        if (!rawTreeData.length) {
            await fetchRepoTree();
        }
        const logFiles = rawTreeData
            .filter((f) => {
                if (f.type !== "blob" || isSoulOrLoveLetterPath(f.path)) return false;
                const p = f.path.toLowerCase();
                return p.includes("/logs/") || p.startsWith("logs/");
            })
            .map((f) => f.path)
            .sort();

        if (!logFiles.length) {
            const msg = "No log files found under any logs/ folder in the repository yet.";
            appendMessage("Agent Anna V3", msg, "msg_nolog_" + Date.now(), true);
            if (autoAnnounceToAnna !== false) speakText(msg);
            return;
        }
        const newestLog = logFiles[logFiles.length - 1];
        const ext = newestLog.split(".").pop().toLowerCase();
        await loadRepoFile(newestLog, ext);
        const editor = document.getElementById("repo-code-editor");
        const logContent = repoVaultFiles[newestLog] || (editor ? editor.value : "");
        if (autoAnnounceToAnna !== false && logContent) {
            appendMessage("Agent Anna V3", `LATEST LOG (${newestLog}):\n\n${logContent.slice(0, 1800)}`, "msg_rep_" + Date.now(), true);
            speakText(`Latest log is ${newestLog}. ${logContent.slice(0, 350)}`);
        }
    }

    function toggleViewMode() {
        currentViewMode = currentViewMode === "tree" ? "grid" : "tree";
        const btn = document.getElementById("view-toggle-btn");
        if (btn) btn.innerText = currentViewMode === "tree" ? "VIEW: TREE" : "VIEW: GRID";
        const gridEl = document.getElementById("repo-file-grid");
        const treeEl = document.getElementById("repo-tree-view");
        if (currentViewMode === "tree") {
            if (gridEl) gridEl.style.display = "none";
            if (treeEl) treeEl.style.display = "block";
            renderTreeView();
        } else {
            if (gridEl) gridEl.style.display = "grid";
            if (treeEl) treeEl.style.display = "none";
            renderGridView();
        }
    }

    function renderTreeView() {
        const treeEl = document.getElementById("repo-tree-view");
        if (!treeEl) return;
        const treeItems = rawTreeData.filter((f) => f.type === "blob");
        if (!treeItems.length) {
            treeEl.innerHTML = `<span style="color:var(--text-muted);">No repository files loaded. Click SYNC.</span>`;
            return;
        }
        const root = {};
        treeItems.forEach((item) => {
            const parts = item.path.split("/");
            let current = root;
            parts.forEach((part, idx) => {
                if (!current[part]) {
                    current[part] = idx === parts.length - 1 ? { __is_file: true, path: item.path } : {};
                }
                current = current[part];
            });
        });

        function buildHtml(node) {
            let html = "";
            const keys = Object.keys(node).filter((k) => k !== "__is_file" && k !== "path").sort((a, b) => {
                if (node[a].__is_file && !node[b].__is_file) return 1;
                if (!node[a].__is_file && node[b].__is_file) return -1;
                return a.localeCompare(b);
            });
            keys.forEach((key) => {
                const item = node[key];
                if (item.__is_file) {
                    const ext = key.split(".").pop().toLowerCase();
                    const icon = ["md", "json"].includes(ext) ? "📋" : (["js", "html", "css", "ps1", "yml", "svg"].includes(ext) ? "⚡" : "📄");
                    html += `<span class="tree-file" onclick="window.loadRepoFile('${item.path}', '${ext}')" onkeydown="if(event.key==='Enter')window.loadRepoFile('${item.path}', '${ext}')" tabindex="0" role="treeitem">${icon} ${key}</span>`;
                } else {
                    html += `<div role="group"><div class="tree-folder-row" onclick="this.nextElementSibling.classList.toggle('collapsed')" onkeydown="if(event.key==='Enter')this.nextElementSibling.classList.toggle('collapsed')" tabindex="0" role="button">▾ 📁 ${key}/</div><div class="tree-children" style="display:block;">${buildHtml(item)}</div></div>`;
                }
            });
            return html;
        }
        treeEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">FULL REPO TREE (${treeItems.length} files on ${activeBranch})</div>` + buildHtml(root);
    }

    function renderGridView() {
        const gridEl = document.getElementById("repo-file-grid");
        if (!gridEl) return;
        const gridItems = rawTreeData.filter((f) => f.type === "blob");
        gridEl.innerHTML = "";
        gridItems.forEach((file) => {
            const ext = file.path.split(".").pop().toLowerCase();
            let icon = "📄";
            if (["html", "htm"].includes(ext)) icon = "🌐";
            else if (["js", "ts", "ps1"].includes(ext)) icon = "⚡";
            else if (["css", "scss"].includes(ext)) icon = "🎨";
            else if (["md", "txt", "json"].includes(ext)) icon = "📋";
            else if (["yaml", "yml"].includes(ext)) icon = "⚙️";
            else if (["png", "jpg", "jpeg", "gif", "svg", "avif"].includes(ext)) icon = "🖼️";
            else if (["mp4", "webm", "mov"].includes(ext)) icon = "🎥";
            else if (["mp3", "wav", "ogg"].includes(ext)) icon = "🎵";

            const card = document.createElement("div");
            card.className = "repo-file-card";
            card.setAttribute("tabindex", "0");
            card.setAttribute("role", "listitem");
            card.innerHTML = `<div class="file-card-icon">${icon}</div><div class="file-card-name" title="${file.path}">${file.path}</div><div class="file-card-size">${((file.size || 0) / 1024).toFixed(1)} KB</div>`;
            card.onclick = () => loadRepoFile(file.path, ext);
            card.onkeydown = (e) => { if (e.key === "Enter") loadRepoFile(file.path, ext); };
            gridEl.appendChild(card);
        });
    }

    async function walkRepoContentsRecursive(dirPath, branch, collected) {
        const encodedDir = dirPath ? "/" + dirPath.split("/").map(encodeURIComponent).join("/") : "";
        const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents${encodedDir}?ref=${encodeURIComponent(branch)}`;
        const res = await fetch(url, { headers: getGitHubHeaders(), cache: "no-store" });
        if (!res.ok) return;
        const entries = await res.json();
        if (!Array.isArray(entries)) return;

        const subDirs = [];
        for (const entry of entries) {
            if (entry.type === "file") {
                collected.push({ path: entry.path, type: "blob", size: entry.size || 0, sha: entry.sha });
            } else if (entry.type === "dir") {
                collected.push({ path: entry.path, type: "tree", sha: entry.sha });
                subDirs.push(entry.path);
            }
        }
        await Promise.all(subDirs.map((sub) => walkRepoContentsRecursive(sub, branch, collected)));
    }

    async function syncAll() {
        if (isSyncing) return;
        isSyncing = true;
        try {
            await fetchRepoTree();
            await ingestCoreVaultAssets();
            const count = Object.keys(repoVaultFiles).length;
            const totalTreeFiles = rawTreeData.filter((f) => f.type === "blob").length;
            appendMessage("Agent Anna V3", `Agent Anna V3 online. Loaded ${totalTreeFiles} total repository files in tree (${count} V3 / character / knowledge / memory files active in context) from ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME} (${activeBranch}).`, "msg_boot_" + Date.now(), true);
        } finally {
            isSyncing = false;
        }
    }

    async function fetchRepoTree() {
        setMoodState("thinking");
        let data = null;
        for (const branch of ["main", "master"]) {
            try {
                const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/git/trees/${branch}?recursive=1`, {
                    headers: getGitHubHeaders(),
                    cache: "no-store"
                });
                if (res.ok) {
                    data = await res.json();
                    activeBranch = branch;
                    break;
                }
            } catch (err) {}
        }

        if (data && Array.isArray(data.tree) && !data.truncated) {
            rawTreeData = data.tree;
        } else {
            const walked = [];
            try {
                await walkRepoContentsRecursive("", activeBranch, walked);
            } catch (e) {}
            if (walked.length > 0) {
                rawTreeData = walked;
            } else if (data && Array.isArray(data.tree)) {
                rawTreeData = data.tree;
            } else {
                rawTreeData = [];
            }
        }

        if (rawTreeData.length > 0) {
            if (currentViewMode === "tree") renderTreeView();
            else renderGridView();
        } else {
            const treeEl = document.getElementById("repo-tree-view");
            if (treeEl) treeEl.innerHTML = `<span style="color:#fda4af;">Unable to load tree. Verify GitHub PAT in KEYS.</span>`;
        }
        setMoodState("standby");
    }

    async function ingestCoreVaultAssets() {
        const headers = getGitHubHeaders();
        const coreFiles = rawTreeData.filter((f) =>
            f.type === "blob" &&
            (f.size || 0) < 65000 &&
            isV3CoreFile(f.path)
        );

        const nextVault = {};
        await Promise.allSettled(
            coreFiles.map(async (file) => {
                const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${file.path}`, { headers, cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                if (data.content) {
                    const binString = atob(data.content.replace(/\s/g, ""));
                    nextVault[file.path] = new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)));
                }
            })
        );
        repoVaultFiles = nextVault;

        const count = Object.keys(repoVaultFiles).length;
        const totalFiles = rawTreeData.filter((f) => f.type === "blob").length;
        const badge = document.getElementById("vault-status");
        if (badge) {
            badge.innerText = `FILES: ${totalFiles} (V3: ${count})`;
            badge.className = totalFiles > 0 ? "status-badge ok" : "status-badge err";
        }
    }

    function getCompactVaultContext(userPrompt) {
        const memoryBlocks = [];
        const characterBlocks = [];
        const knowledgeBlocks = [];
        const lowerPrompt = String(userPrompt || "").toLowerCase();
        const terms = lowerPrompt.split(/[^a-z0-9_-]+/).filter((w) => w.length > 2);

        for (const [path, content] of Object.entries(repoVaultFiles)) {
            if (isSoulOrLoveLetterPath(path) || !isV3CoreFile(path)) continue;

            const lowerPath = path.toLowerCase();
            const baseName = path.split("/").pop().toLowerCase();
            const isMemoryFile = (
                lowerPath.includes("/memory/") ||
                lowerPath.startsWith("memory/") ||
                baseName === "memory.json" ||
                baseName === "tasks.json" ||
                baseName === "links.json" ||
                baseName === "brain.json" ||
                baseName === "sessions.md"
            );
            const isCharacterFile = (
                lowerPath.includes("/character/") ||
                lowerPath.startsWith("character/") ||
                baseName.startsWith("aa01") ||
                baseName.includes("character")
            );
            const isKnowledgeFile = (
                lowerPath.includes("/knowledge/") ||
                lowerPath.startsWith("knowledge/")
            );
            const isTermMatch = terms.some((t) => lowerPath.includes(t) || content.toLowerCase().includes(t));

            if (isMemoryFile) {
                memoryBlocks.push(`=== MEMORY [${path}] ===\n${content.slice(0, 1400)}`);
            } else if (isCharacterFile) {
                characterBlocks.push(`=== CHARACTER [${path}] ===\n${content.slice(0, 1400)}`);
            } else if (isKnowledgeFile || isTermMatch) {
                knowledgeBlocks.push(`=== KNOWLEDGE [${path}] ===\n${content.slice(0, 1000)}`);
            }
        }

        const loadedList = Object.keys(repoVaultFiles).join(", ") || "none";
        const treeSample = rawTreeData
            .filter((f) => f.type === "blob")
            .map((f) => f.path)
            .slice(0, 40)
            .join(", ");

        const header = `CURRENT RUNTIME LOCATION:\n- Repo: ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME} (${activeBranch})\n- Loaded V3 files in context: ${loadedList}\n- Sample repo tree paths: ${treeSample}`;
        const combined = memoryBlocks.concat(characterBlocks, knowledgeBlocks).join("\n\n").slice(0, 6500);
        return `${header}\n\nACTIVE V3 / MEMORY / CHARACTER / KNOWLEDGE CONTEXT:\n${combined}`;
    }

    async function fetchDahlWithAutoRetry(url, options) {
        return await fetch(url, options);
    }

    function extractDahlReply(json, rawText) {
        const clean = (s) => String(s || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        if (!json) return clean(rawText);
        if (json.choices && json.choices[0]) {
            const msg = json.choices[0].message;
            if (msg && typeof msg.content === "string") return clean(msg.content);
            if (typeof json.choices[0].text === "string") return clean(json.choices[0].text);
        }
        for (const k of ["reply", "response", "output", "text"]) {
            if (typeof json[k] === "string") return clean(json[k]);
        }
        return clean(rawText);
    }

    async function triggerAutonomousBootSequence() {
        const coreCount = Object.keys(repoVaultFiles).length;
        const totalFiles = rawTreeData.filter((f) => f.type === "blob").length;
        const msg = `Agent Anna V3 online. ${totalFiles} repository files in tree (${coreCount} V3, memory, character, and knowledge files active) on ${getActiveModel()}.`;
        appendMessage("Agent Anna V3", msg, "msg_boot_" + Date.now(), true);
        speakText(msg);
        setMoodState("standby");
    }

    async function loadRepoFile(path, ext) {
        const pathEl = document.getElementById("active-file-path");
        if (pathEl) pathEl.value = path;
        const editor = document.getElementById("repo-code-editor");
        const preview = document.getElementById("media-preview-container");
        const fileExt = String(ext || path.split(".").pop() || "").toLowerCase();
        const isMedia = ["png", "jpg", "jpeg", "gif", "svg", "avif", "mp4", "webm", "mov", "mp3", "wav"].includes(fileExt);

        if (isMedia) {
            if (editor) editor.style.display = "none";
            if (preview) {
                preview.style.display = "flex";
                const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${activeBranch}/${path}`;
                if (["png", "jpg", "jpeg", "gif", "svg", "avif"].includes(fileExt)) {
                    preview.innerHTML = `<img src="${rawUrl}" alt="${path}">`;
                } else if (["mp4", "webm", "mov"].includes(fileExt)) {
                    preview.innerHTML = `<video controls autoplay loop src="${rawUrl}"></video>`;
                } else {
                    preview.innerHTML = `<audio controls autoplay src="${rawUrl}"></audio>`;
                }
            }
        } else {
            if (preview) preview.style.display = "none";
            if (editor) {
                editor.style.display = "block";
                editor.value = "Loading...";
                try {
                    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`, {
                        headers: getGitHubHeaders(),
                        cache: "no-store"
                    });
                    const data = await res.json();
                    if (data.content) {
                        const binString = atob(data.content.replace(/\s/g, ""));
                        const decoded = new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)));
                        editor.value = decoded;
                        if (!isSoulOrLoveLetterPath(path)) {
                            repoVaultFiles[path] = decoded;
                        }
                    }
                } catch (err) {
                    editor.value = "Error loading file content.";
                }
            }
        }
    }

    async function commitCurrentFile() {
        const token = getCleanGitHubToken();
        if (!token) { toggleSettings(); return; }
        const pathEl = document.getElementById("active-file-path");
        const edEl = document.getElementById("repo-code-editor");
        const path = pathEl ? pathEl.value.trim() : "";
        const content = edEl ? edEl.value : "";
        if (!path || isSoulOrLoveLetterPath(path)) return;

        setMoodState("saving");
        try {
            const stamp = new Date().toISOString();
            const ok = await writeFileToGitHub(path, content, `Agent Anna V3 commit [${stamp}]: updated ${path}`);
            if (ok) {
                repoVaultFiles[path] = content;
                appendMessage("System Telemetry", `VERIFIED COMMIT [${stamp}]: ${path} written to ${GITHUB_REPO_NAME}.`, "msg_com_" + Date.now(), false);
                speakText(`Committed ${path.split("/").pop()}.`);
                await fetchRepoTree();
            } else {
                appendMessage("System Telemetry", "COMMIT ERROR: Check GitHub PAT write permissions.", "msg_com_err_" + Date.now(), false);
            }
        } catch (err) {
            appendMessage("System Telemetry", `COMMIT FAILED: ${err.message}`, "msg_com_err_" + Date.now(), false);
            setMoodState("error");
            return;
        }
        setMoodState("standby");
    }

    function promptDeleteFile() {
        const pathEl = document.getElementById("active-file-path");
        const path = pathEl ? pathEl.value.trim() : "";
        if (!path) return;
        const banner = document.getElementById("delete-warning-banner");
        const warnText = document.getElementById("delete-warning-text");
        if (warnText) warnText.innerText = `DELETE "${path}" PERMANENTLY?`;
        if (banner) banner.style.display = "flex";
    }

    function cancelDeleteFile() {
        const banner = document.getElementById("delete-warning-banner");
        if (banner) banner.style.display = "none";
    }

    async function confirmDeleteFile() {
        cancelDeleteFile();
        const token = getCleanGitHubToken();
        const pathEl = document.getElementById("active-file-path");
        const path = pathEl ? pathEl.value.trim() : "";
        if (!token || !path || isSoulOrLoveLetterPath(path)) return;

        setMoodState("saving");
        try {
            const sha = await getLatestFileSha(path);
            if (!sha) { setMoodState("standby"); return; }
            const delRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`, {
                method: "DELETE",
                headers: { ...getGitHubHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ message: `Agent Anna V3 purge: deleted ${path}`, sha })
            });
            if (delRes.ok || delRes.status === 200) {
                delete repoVaultFiles[path];
                if (pathEl) pathEl.value = "";
                const edEl = document.getElementById("repo-code-editor");
                if (edEl) edEl.value = "";
                speakText(`Deleted ${path.split("/").pop()}.`);
                await fetchRepoTree();
            }
        } catch (e) {}
        setMoodState("standby");
    }

    async function auditActiveFile() {
        const pathEl = document.getElementById("active-file-path");
        const edEl = document.getElementById("repo-code-editor");
        const path = pathEl ? pathEl.value.trim() : "";
        const content = edEl ? edEl.value : "";
        if (!path || !content) return;

        const apiKey = getCleanDahlKey();
        if (!apiKey) { toggleSettings(); return; }

        const auditMsgId = "msg_audit_" + Date.now();
        appendMessage("Agent Anna V3", `Auditing ${path}...`, auditMsgId, true);
        setMoodState("thinking");

        try {
            const response = await fetchDahlWithAutoRetry(DAHL_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: getActiveModel(),
                    messages: [
                        { role: "system", content: `Respond in English only. Audit ${path} for bugs or flaws and return a complete block:\n\`\`\`file:${path}\n...\n\`\`\`` },
                        { role: "user", content }
                    ]
                })
            });
            const rawText = await response.text();
            let json = null;
            try { json = JSON.parse(rawText); } catch (e) {}
            const cleanReply = extractDahlReply(json, rawText);
            updateMessage(auditMsgId, cleanReply);
            speakText(cleanReply);
            await parseAndExecuteAutonomousFiles(cleanReply);
        } catch (err) {
            updateMessage(auditMsgId, `Audit failed (possible CORS/network block on ${DAHL_ENDPOINT}): ${err.message}`);
        }
        setMoodState("standby");
    }

    async function parseAndExecuteAutonomousFiles(aiResponseText) {
        const fileRegex = /```file:([^\n]+)\n([\s\S]*?)```/g;
        const dispatchRegex = /```dispatch\n([\s\S]*?)```/g;
        let match;
        const committedFiles = [];
        const skippedSoulWrites = [];
        let triggeredWorkflow = false;

        while ((match = fileRegex.exec(aiResponseText)) !== null) {
            const filePath = match[1].trim();
            const fileContent = match[2];
            if (isSoulOrLoveLetterPath(filePath)) {
                skippedSoulWrites.push(filePath);
                continue;
            }
            const stamp = new Date().toISOString();
            const ok = await writeFileToGitHub(filePath, fileContent, `Agent Anna V3 Self-Write [${stamp}]: ${filePath}`);
            if (ok) {
                repoVaultFiles[filePath] = fileContent;
                committedFiles.push(filePath);
                const pathEl = document.getElementById("active-file-path");
                const edEl = document.getElementById("repo-code-editor");
                if (pathEl) pathEl.value = filePath;
                if (edEl) edEl.value = fileContent;
                if (filePath === "A1/vault/pending-commands.md") triggeredWorkflow = true;
            } else {
                await dispatchBackendWorkflow(`Write this file to ${filePath}:\n${fileContent}`, "");
            }
        }

        const jsonMatch = String(aiResponseText || "").match(/```json\s*([\s\S]*?)```/i) || String(aiResponseText || "").trim().match(/^(\{[\s\S]*\})$/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed && parsed.path && typeof parsed.content === "string") {
                    const targetPath = parsed.path.trim();
                    if (isSoulOrLoveLetterPath(targetPath)) {
                        skippedSoulWrites.push(targetPath);
                    } else {
                        const unescaped = parsed.content
                            .replace(/\\r\\n/g, "\n")
                            .replace(/\\n/g, "\n")
                            .replace(/\\t/g, "  ");
                        const stamp = new Date().toISOString();
                        const ok = await writeFileToGitHub(targetPath, unescaped, `Agent Anna V3 Write [${stamp}]: ${targetPath}`);
                        if (ok) {
                            repoVaultFiles[targetPath] = unescaped;
                            committedFiles.push(targetPath);
                        }
                    }
                }
            } catch (e) {}
        }

        let dMatch;
        while ((dMatch = dispatchRegex.exec(aiResponseText)) !== null) {
            const backendDirective = dMatch[1].trim();
            if (backendDirective) await dispatchBackendWorkflow(backendDirective, backendDirective);
        }

        if (skippedSoulWrites.length > 0) {
            appendMessage("System Telemetry", `GUARDRAIL: Blocked auto-write into soul/archive path(s): ${skippedSoulWrites.join(", ")}.`, "msg_soul_guard_" + Date.now(), false);
        }

        if (committedFiles.length > 0) {
            appendMessage("System Telemetry", `VERIFIED 201 COMMIT: ${committedFiles.join(", ")}`, "msg_sys_" + Date.now(), false);
            await fetchRepoTree();
            if (triggeredWorkflow) startWorkflowTelemetryPoller();
        }
    }

    async function autonomousSwallowAndCommit(id, btnEl) {
        const textToSwallow = messagePayloadStore[id];
        if (!textToSwallow) return;
        if (btnEl) btnEl.innerText = "COMMITTING...";
        setMoodState("saving");

        const cleanSnippet = textToSwallow.replace(/[*_#`~]/g, "").slice(0, 40).trim();
        const safeTitle = cleanSnippet.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 25);
        const dateTag = new Date().toISOString().slice(0, 10);
        const timeTag = new Date().toTimeString().slice(0, 5).replace(":", "");
        const targetPath = `A1/logs/anna-v3-swallow-${dateTag}-${safeTitle || timeTag}.md`;
        const fileContent = `# AGENT ANNA V3 // OPERATIONAL SWALLOW LOG\n# TIMESTAMP: ${new Date().toISOString()}\n# scout_date:${dateTag}\n\n## CAPTURED INTELLIGENCE\n${textToSwallow}\n`;

        const ok = await writeFileToGitHub(targetPath, fileContent, `Agent Anna V3 Swallow Commit: ${safeTitle || "vault-log"}`);
        if (ok) {
            if (btnEl) btnEl.innerText = "COMMITTED [201]!";
            repoVaultFiles[targetPath] = fileContent;
            speakText("Saved to log.");
            await fetchRepoTree();
        } else {
            await dispatchBackendWorkflow(`Write this swallowed intelligence to ${targetPath}:\n${fileContent}`);
            if (btnEl) btnEl.innerText = "DISPATCHED!";
        }
        setMoodState("standby");
        if (btnEl) setTimeout(() => { btnEl.innerText = "🌀 SWALLOW"; }, 3000);
    }

    function initSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            appendMessage("System Telemetry", "MIC INFO: SpeechRecognition API not supported in this browser; type in input box.", "msg_stt_unsup_" + Date.now(), false);
            return null;
        }
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onstart = () => {
            isListening = true;
            setMoodState("responding");
            const micBtn = document.getElementById("mic-btn");
            if (micBtn) micBtn.classList.add("listening");
        };

        rec.onresult = (event) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i] && event.results[i][0]) {
                    transcript += event.results[i][0].transcript;
                }
            }
            const inputEl = document.getElementById("user-input");
            if (transcript.trim() && inputEl) {
                inputEl.value = transcript.trim();
            }
        };

        rec.onerror = (event) => {
            const errCode = (event && event.error) || "unknown";
            stopMicrophone();
            setMoodState("error");
            appendMessage("System Telemetry", `MIC ERROR (${errCode}): Check browser/OS microphone permission & secure origin (HTTPS/localhost).`, "msg_stt_err_" + Date.now(), false);
            setTimeout(() => setMoodState("standby"), 2500);
        };

        rec.onend = () => {
            stopMicrophone();
        };

        return rec;
    }

    function toggleMicrophone() {
        if (!recognition) recognition = initSpeechRecognition();
        if (!recognition) return;

        if (isListening) {
            isListening = false;
            try { recognition.stop(); } catch (e) {}
            stopMicrophone();
        } else {
            try {
                recognition.start();
            } catch (e) {
                try {
                    recognition.abort();
                    setTimeout(() => {
                        try { recognition.start(); } catch (err) {
                            stopMicrophone();
                            appendMessage("System Telemetry", `MIC START FAILED: ${err.message}`, "msg_stt_fail_" + Date.now(), false);
                        }
                    }, 150);
                } catch (err2) {
                    stopMicrophone();
                }
            }
        }
    }

    function stopMicrophone() {
        isListening = false;
        const micBtn = document.getElementById("mic-btn");
        if (micBtn) micBtn.classList.remove("listening");
        if (document.body.classList.contains("is-responding")) {
            setMoodState("standby");
        }
    }

    function toggleVoice() {
        isVoiceEnabled = !isVoiceEnabled;
        const btn = document.getElementById("voice-btn");
        if (btn) btn.innerText = isVoiceEnabled ? "VOICE: ON" : "VOICE: OFF";
        if (!isVoiceEnabled) executeStfuProtocol();
        else speakText("Voice on.");
    }

    function toggleSettings() {
        const p = document.getElementById("settings-panel");
        if (p) p.style.display = p.style.display === "block" ? "none" : "block";
    }

    function updateActiveModel() {
        const selectEl = document.getElementById("model-select");
        if (selectEl) {
            localStorage.setItem("DAHL_MODEL", selectEl.value);
        }
    }

    async function saveCredentials() {
        const apiEl = document.getElementById("api-key");
        const ghEl = document.getElementById("gh-token");
        const apiKey = cleanHeaderToken(apiEl ? apiEl.value : "");
        const ghToken = cleanHeaderToken(ghEl ? ghEl.value : "");
        const selectedModel = getActiveModel();

        if (apiEl) apiEl.value = apiKey;
        if (ghEl) ghEl.value = ghToken;
        if (apiKey) localStorage.setItem("DAHL_API_KEY", apiKey);
        if (ghToken) localStorage.setItem("GITHUB_PAT", ghToken);
        localStorage.setItem("DAHL_MODEL", selectedModel);

        updateKeyBadge();
        toggleSettings();
        await syncAll();
    }

    function handleKey(e) {
        if (e.key === "Enter") sendMessage();
    }

    function triggerPreset(queryText) {
        const inputEl = document.getElementById("user-input");
        if (inputEl) inputEl.value = queryText;
        sendMessage();
    }

    async function sendMessage() {
        const input = document.getElementById("user-input");
        const prompt = input ? input.value.trim() : "";
        if (!prompt) return;

        appendMessage("Commander", prompt, "msg_u_" + Date.now(), false);
        if (input) input.value = "";
        chatHistory.push({ role: "user", content: prompt });

        const assistantMsgId = "msg_a_" + Date.now();
        appendMessage("Agent Anna V3", `Thinking on ${getActiveModel()}...`, assistantMsgId, true);
        setMoodState("thinking");

        const apiKey = getCleanDahlKey();
        if (!apiKey) {
            const errMsg = "ERROR: Dahl API key missing. Click KEYS to configure.";
            updateMessage(assistantMsgId, errMsg);
            speakText(errMsg);
            toggleSettings();
            setMoodState("standby");
            return;
        }

        const liveTelemetry = await fetchLiveWebAndMarketTelemetry(prompt);
        const vaultContext = getCompactVaultContext(prompt);
        const systemPrompt = `You are AGENT ANNA V3 for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME} on branch ${activeBranch}.
STRICT LANGUAGE RULE: Respond in natural, clear English ONLY. Never output Chinese characters or non-English words in your replies.
LOCATION & TRUTH RULE: State clearly what is in your loaded context and repo tree right now. Never claim a file was written unless you include a \`\`\`file:<path>\n...\n\`\`\` block for the dashboard to commit. Never claim to have a local PC hard drive. Be concise and easy to hear aloud.${liveTelemetry}\n\n${vaultContext}`;

        try {
            const response = await fetchDahlWithAutoRetry(DAHL_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: getActiveModel(),
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...chatHistory.slice(-4)
                    ]
                })
            });

            const rawText = await response.text();
            let json = null;
            try { json = JSON.parse(rawText); } catch (e) {}

            if (!response.ok) {
                const errDetail = json && json.error ? (json.error.message || JSON.stringify(json.error)) : rawText.slice(0, 200);
                const errMsg = `DAHL HTTP ${response.status}: ${errDetail}`;
                updateMessage(assistantMsgId, errMsg);
                speakText(errMsg);
                setMoodState("error");
                return;
            }

            const cleanReply = extractDahlReply(json, rawText) || "Ready.";
            chatHistory.push({ role: "assistant", content: formatReadableMessage(cleanReply) });
            updateMessage(assistantMsgId, cleanReply);
            speakText(cleanReply);
            await parseAndExecuteAutonomousFiles(cleanReply);
        } catch (err) {
            const origin = window.location && window.location.origin ? window.location.origin : "browser";
            const errMsg = `CONNECTION FAILED (${origin} -> inference.dahl.global): Browser blocked or dropped direct fetch (${err.message}).`;
            updateMessage(assistantMsgId, errMsg);
            speakText("Connection failed.");
            setMoodState("error");
            return;
        }
        setMoodState("standby");
    }

    window.addEventListener("DOMContentLoaded", async () => {
        const savedToken = getStoredKey(["GITHUB_PAT", "gh_token", "github_token"]);
        const ghEl = document.getElementById("gh-token");
        if (savedToken && ghEl) {
            localStorage.setItem("GITHUB_PAT", savedToken);
            ghEl.value = savedToken;
        }

        const savedApiKey = getStoredKey(["DAHL_API_KEY", "dahl_api_key", "OPENAI_API_KEY", "api_key"]);
        const apiEl = document.getElementById("api-key");
        if (savedApiKey && apiEl) {
            localStorage.setItem("DAHL_API_KEY", savedApiKey);
            apiEl.value = savedApiKey;
        }

        const savedModel = localStorage.getItem("DAHL_MODEL") || DEFAULT_MODEL;
        const topSelect = document.getElementById("model-select");
        if (topSelect) topSelect.value = savedModel;

        updateKeyBadge();

        if ("speechSynthesis" in window) {
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        await syncAll();
    });

    window.setMoodState = setMoodState;
    window.updateActiveModel = updateActiveModel;
    window.triggerAutonomousBootSequence = triggerAutonomousBootSequence;
    window.toggleVoice = toggleVoice;
    window.toggleSettings = toggleSettings;
    window.saveCredentials = saveCredentials;
    window.toggleViewMode = toggleViewMode;
    window.syncAll = syncAll;
    window.dispatchBackendWorkflow = dispatchBackendWorkflow;
    window.fetchLatestBackendReport = fetchLatestBackendReport;
    window.triggerPreset = triggerPreset;
    window.auditActiveFile = auditActiveFile;
    window.commitCurrentFile = commitCurrentFile;
    window.promptDeleteFile = promptDeleteFile;
    window.confirmDeleteFile = confirmDeleteFile;
    window.cancelDeleteFile = cancelDeleteFile;
    window.loadRepoFile = loadRepoFile;
    window.toggleMicrophone = toggleMicrophone;
    window.handleKey = handleKey;
    window.sendMessage = sendMessage;
    window.clearLogs = clearLogs;
    window.speakStoredMessage = speakStoredMessage;
    window.copyToClipboard = copyToClipboard;
    window.autonomousSwallowAndCommit = autonomousSwallowAndCommit;
    window.executeStfuProtocol = executeStfuProtocol;
    window.deleteMessage = deleteMessage;
})();
