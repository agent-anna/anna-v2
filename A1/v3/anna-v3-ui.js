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
        if (stEl) stEl.innerText = `${target.toUpperCase()} // AGENT ANNA V3 (A1)`;
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

    function loadVoices() {
        if (!("speechSynthesis" in window)) return;
        try { cachedVoices = window.speechSynthesis.getVoices(); } catch (e) {}
    }

    function getGitHubHeaders() {
        const token = getCleanGitHubToken();
        return token
            ? { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
            : { Accept: "application/vnd.github.v3+json" };
    }

    function sanitizeResponse(text) {
        if (!text) return "";
        return String(text).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    }

    function speakText(text) {
        if (!isVoiceEnabled || !("speechSynthesis" in window)) return;
        try {
            window.speechSynthesis.cancel();
            const clean = sanitizeResponse(text).replace(/[*_#`~\[\]()]/g, "").trim();
            if (!clean) return;

            setMoodState("responding");
            let voices = window.speechSynthesis.getVoices();
            if (!voices.length) voices = cachedVoices;

            const voice = voices.find((v) =>
                v.lang && v.lang.toLowerCase().startsWith("en") &&
                (/en[-_](us|gb)/i.test(v.lang) || /female|victoria|samantha|karen|zira|google uk english female/i.test(v.name))
            ) || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en")) || voices[0];

            const utterance = new SpeechSynthesisUtterance(clean);
            if (voice) utterance.voice = voice;
            utterance.pitch = 1.04;
            utterance.rate = 0.98;
            utterance.onend = () => setMoodState("standby");
            utterance.onerror = () => setMoodState("standby");
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            setMoodState("standby");
        }
    }

    function executeStfuProtocol() {
        if ("speechSynthesis" in window) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
        }
        if (isListening && recognition) {
            isListening = false;
            try { recognition.stop(); } catch (e) {}
        }
        const micBtn = document.getElementById("mic-btn");
        if (micBtn) micBtn.classList.remove("listening");
        setMoodState("standby");
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
        const div = document.createElement("div");
        div.className = `message ${isAssistant ? "assistant" : "user"}`;
        div.id = id;
        messagePayloadStore[id] = text;

        const actions = isAssistant ? `
            <div class="action-row">
                <button class="action-chip" onclick="window.speakStoredMessage('${id}')">SPEAK</button>
                <button class="action-chip" onclick="window.copyToClipboard('${id}', this)">COPY</button>
                <button class="action-chip swallow-btn" onclick="window.autonomousSwallowAndCommit('${id}', this)">🌀 SWALLOW</button>
                <button class="action-chip del-btn" onclick="window.executeStfuProtocol()">🛑 STFU</button>
                <button class="action-chip del-btn" onclick="window.deleteMessage('${id}')">🗑️ DEL</button>
            </div>` : "";

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
        body.textContent = text;

        div.appendChild(header);
        div.appendChild(body);
        if (actions) {
            const temp = document.createElement("div");
            temp.innerHTML = actions;
            while (temp.firstChild) div.appendChild(temp.firstChild);
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function updateMessage(id, text) {
        const el = document.getElementById(id);
        if (!el) return;
        const body = el.querySelector(".msg-content");
        if (body) body.textContent = text;
        messagePayloadStore[id] = text;
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
                    setTimeout(() => { btn.innerText = prev || "COPY"; }, 2000);
                }
            }).catch(() => {});
        }
    }

    async function fetchLiveWebAndMarketTelemetry(prompt) {
        const telemetryBlocks = [];
        const lower = String(prompt || "").toLowerCase();

        if (/btc|bitcoin|doge|dogecoin|crypto|price|market|rate/.test(lower)) {
            try {
                const cryptoRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,dogecoin&vs_currencies=usd&include_24hr_change=true");
                if (cryptoRes.ok) {
                    const cryptoData = await cryptoRes.json();
                    telemetryBlocks.push(`[VERIFIED LIVE COINGECKO TELEMETRY @ ${new Date().toISOString()}]\n- Bitcoin (BTC): $${cryptoData.bitcoin.usd} (24h Change: ${cryptoData.bitcoin.usd_24h_change.toFixed(2)}%)\n- Dogecoin (DOGE): $${cryptoData.dogecoin.usd} (24h Change: ${cryptoData.dogecoin.usd_24h_change.toFixed(2)}%)`);
                }
            } catch (e) {}
        }

        const urlMatch = String(prompt || "").match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            try {
                const targetUrl = urlMatch[0];
                const webRes = await fetch(`https://r.jina.ai/${targetUrl}`);
                if (webRes.ok) {
                    const webText = await webRes.text();
                    telemetryBlocks.push(`[VERIFIED LIVE WEB READER FOR ${targetUrl}]\n${webText.slice(0, 5000)}`);
                }
            } catch (e) {}
        }

        const wantsSearch = /search|duckduckgo|ddg|google|find|lookup|look up|news|weather|latest|today|current|who is|what is/.test(lower);
        if (wantsSearch) {
            const searchQuery = String(prompt || "")
                .replace(/^(search|google|duckduckgo|ddg|find|look up|lookup)\s+(for|about)?/i, "")
                .trim();
            try {
                const jinaSearchRes = await fetch(`https://s.jina.ai/${encodeURIComponent(searchQuery)}`, {
                    headers: { Accept: "text/plain" }
                });
                if (jinaSearchRes.ok) {
                    const searchText = await jinaSearchRes.text();
                    if (searchText && searchText.trim().length > 20) {
                        telemetryBlocks.push(`[VERIFIED LIVE WEB/SEARCH RESULTS FOR "${searchQuery}"]\n${searchText.slice(0, 5000)}`);
                    }
                }
            } catch (e) {
                telemetryBlocks.push("[NOTE: Browser CORS prevented direct public SERP search. Use 🚀 RUN BACKEND for server-side execution.]");
            }
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
            appendMessage("System Telemetry", "ERROR: GitHub PAT missing. Click ⚙️ KEYS to configure token with 'workflow' & 'repo' permissions.", "msg_err_" + Date.now(), false);
            toggleSettings();
            return;
        }

        const contentEl = document.getElementById("anna-content-input");
        const userEl = document.getElementById("user-input");
        const cmdText = customCommand
            || (contentEl && contentEl.value.trim())
            || (userEl && userEl.value.trim())
            || "Perform a rapid vault check and provide a complete operational status report.";

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
                appendMessage("System Telemetry", `🚀 BACKEND WORKFLOW DISPATCHED (${WORKFLOW_FILENAME})\nDirective: "${cmdText}"\nMonitoring GitHub Actions runner until completion...`, "msg_wf_" + Date.now(), false);
                speakText("Backend workflow dispatched to GitHub Actions.");
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
            appendMessage("System Telemetry", `📦 COMMAND COMMITTED TO ${targetPath}. GitHub Actions push trigger activated.`, "msg_fb_" + Date.now(), false);
            startWorkflowTelemetryPoller();
        } else {
            updateActionsBadge("FAILED", "err");
        }
    }

    function dispatchFromWriteZone() {
        const el = document.getElementById("anna-content-input");
        const content = el ? el.value.trim() : "";
        if (!content) {
            const st = document.getElementById("write-zone-status");
            if (st) st.innerText = "ENTER DIRECTIVE";
            speakText("Enter a directive in the content box first.");
            return;
        }
        const st = document.getElementById("write-zone-status");
        if (st) st.innerText = "DISPATCHING...";
        dispatchBackendWorkflow(content);
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
                        appendMessage("System Telemetry", `✅ BACKEND RUN COMPLETED (#${latestRun.run_number}). Refreshing vault & loading report...`, "msg_wf_done_" + Date.now(), false);
                        await fetchRepoTree();
                        await ingestVaultAssets();
                        await fetchLatestBackendReport(true);
                    } else {
                        updateActionsBadge(`FAIL: ${latestRun.conclusion}`, "err");
                        appendMessage("System Telemetry", `⚠️ BACKEND RUN ENDED WITH STATUS: ${latestRun.conclusion}.`, "msg_wf_fail_" + Date.now(), false);
                    }
                }
            } catch (e) {}
        }, 5000);
    }

    async function fetchLatestBackendReport(autoAnnounceToAnna) {
        await fetchRepoTree();
        const logFiles = rawTreeData
            .filter((f) => f.type === "blob" && f.path.startsWith("A1/logs/"))
            .map((f) => f.path)
            .sort();

        if (!logFiles.length) {
            appendMessage("System Telemetry", "No execution logs found in A1/logs/ yet. Run a backend audit first.", "msg_nolog_" + Date.now(), false);
            return;
        }
        const newestLog = logFiles[logFiles.length - 1];
        await loadRepoFile(newestLog, "md");
        const editor = document.getElementById("repo-code-editor");
        const logContent = repoVaultFiles[newestLog] || (editor ? editor.value : "");
        if (autoAnnounceToAnna && logContent) {
            appendMessage("Agent Anna V3", `📥 INGESTED BACKEND REPORT (${newestLog}):\n\n${logContent.slice(0, 1500)}`, "msg_rep_" + Date.now(), true);
        }
    }

    function clearWriteZone() {
        const cmd = document.getElementById("anna-cmd-input");
        const cnt = document.getElementById("anna-content-input");
        const st = document.getElementById("write-zone-status");
        if (cmd) cmd.value = "";
        if (cnt) cnt.value = "";
        if (st) st.innerText = "CLEARED";
    }

    async function processAnnaWriteZone() {
        const cmdEl = document.getElementById("anna-cmd-input");
        const cntEl = document.getElementById("anna-content-input");
        const stEl = document.getElementById("write-zone-status");
        const cmdRaw = cmdEl ? cmdEl.value.trim() : "";
        const contentRaw = cntEl ? cntEl.value : "";

        if (!cmdRaw) {
            if (stEl) stEl.innerText = "NO COMMAND";
            speakText("No command entered in Write Zone.");
            return;
        }

        let commandType = "";
        let targetPath = "";
        for (const line of cmdRaw.split(/\r?\n/)) {
            const upper = line.trim().toUpperCase();
            if (upper.startsWith("COMMAND:")) commandType = line.split(":").slice(1).join(":").trim().toUpperCase();
            else if (upper.startsWith("PATH:")) targetPath = line.split(":").slice(1).join(":").trim();
        }
        if (!commandType) {
            if (cmdRaw.toUpperCase().includes("DISPATCH")) commandType = "DISPATCH";
            else if (cmdRaw.toUpperCase().includes("COMMIT")) commandType = "COMMIT";
            else if (cmdRaw.toUpperCase().includes("WRITE")) commandType = "WRITE";
        }

        const editor = document.getElementById("repo-code-editor");
        const preview = document.getElementById("media-preview-container");
        const pathInput = document.getElementById("active-file-path");

        if (commandType === "DISPATCH") {
            if (stEl) stEl.innerText = "DISPATCHING...";
            await dispatchBackendWorkflow(contentRaw.trim());
            if (stEl) stEl.innerText = "DISPATCHED";
            return;
        }

        if (commandType === "WRITE") {
            if (!targetPath) {
                if (stEl) stEl.innerText = "MISSING PATH";
                speakText("Missing target path for write command.");
                return;
            }
            if (preview) preview.style.display = "none";
            if (editor) {
                editor.style.display = "block";
                editor.value = contentRaw;
            }
            if (pathInput) pathInput.value = targetPath;
            if (stEl) stEl.innerText = `LOADED -> ${targetPath}`;
            appendMessage("System Telemetry", `ANNA WRITE ZONE: Loaded content into editor for ${targetPath}. Ready to commit.`, "msg_wz_" + Date.now(), false);
        } else if (commandType === "COMMIT") {
            if (targetPath && pathInput) pathInput.value = targetPath;
            if (contentRaw.trim().length > 0 && editor) {
                if (preview) preview.style.display = "none";
                editor.style.display = "block";
                editor.value = contentRaw;
            }
            const activePath = pathInput ? pathInput.value.trim() : "";
            if (!activePath) {
                if (stEl) stEl.innerText = "NO ACTIVE PATH";
                return;
            }
            if (stEl) stEl.innerText = `COMMITTING ${activePath}...`;
            await commitCurrentFile();
            if (stEl) stEl.innerText = `COMMITTED ${activePath}`;
            if (activePath === "A1/vault/pending-commands.md") startWorkflowTelemetryPoller();
        } else {
            if (stEl) stEl.innerText = "UNKNOWN COMMAND";
        }
    }

    function toggleViewMode() {
        currentViewMode = currentViewMode === "tree" ? "grid" : "tree";
        const btn = document.getElementById("view-toggle-btn");
        if (btn) btn.innerText = currentViewMode === "tree" ? "🌲 VIEW: TREE" : "🟦 VIEW: GRID";
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
        if (!rawTreeData.length) {
            treeEl.innerHTML = `<span style="color:var(--text-muted);">No repo data loaded. Click SYNC.</span>`;
            return;
        }
        const root = {};
        rawTreeData.forEach((item) => {
            if (item.type !== "blob") return;
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
                    html += `<div role="group"><div class="tree-folder-row" onclick="this.nextElementSibling.classList.toggle('collapsed')" onkeydown="if(event.key==='Enter')this.nextElementSibling.classList.toggle('collapsed')" tabindex="0" role="button">▾ 📁 ${key}/</div><div class="tree-children">${buildHtml(item)}</div></div>`;
                }
            });
            return html;
        }
        treeEl.innerHTML = buildHtml(root);
    }

    function renderGridView() {
        const gridEl = document.getElementById("repo-file-grid");
        if (!gridEl || !rawTreeData.length) return;
        gridEl.innerHTML = "";
        rawTreeData.forEach((file) => {
            if (file.type !== "blob") return;
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
            card.innerHTML = `<div class="file-card-icon">${icon}</div><div class="file-card-name" title="${file.path}">${file.path}</div><div class="file-card-size">${(file.size / 1024).toFixed(1)} KB</div>`;
            card.onclick = () => loadRepoFile(file.path, ext);
            card.onkeydown = (e) => { if (e.key === "Enter") loadRepoFile(file.path, ext); };
            gridEl.appendChild(card);
        });
    }

    async function syncAll() {
        await fetchRepoTree();
        await ingestVaultAssets();
        const count = Object.keys(repoVaultFiles).length;
        appendMessage("Agent Anna V3", `Agent Anna V3 (A1) online. Synced ${count} memory assets from ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME} (${activeBranch}).`, "msg_boot_" + Date.now(), true);
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

        if (data && data.tree) {
            rawTreeData = data.tree;
            if (currentViewMode === "tree") renderTreeView();
            else renderGridView();
        } else {
            const treeEl = document.getElementById("repo-tree-view");
            if (treeEl) treeEl.innerHTML = `<span style="color:#d69895;">Unable to load tree. Verify GitHub PAT in ⚙️ KEYS.</span>`;
        }
        setMoodState("standby");
    }

    async function ingestVaultAssets() {
        const headers = getGitHubHeaders();
        const targetFiles = rawTreeData.filter((f) =>
            f.type === "blob" &&
            f.size < 30000 &&
            (f.path.toLowerCase().endsWith(".md") || f.path.toLowerCase().endsWith(".json"))
        );

        repoVaultFiles = {};
        for (const file of targetFiles) {
            try {
                const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${file.path}`, { headers, cache: "no-store" });
                if (!res.ok) continue;
                const data = await res.json();
                if (data.content) {
                    const binString = atob(data.content.replace(/\s/g, ""));
                    repoVaultFiles[file.path] = new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)));
                }
            } catch (e) {}
        }

        const totalBlobs = rawTreeData.filter((f) => f.type === "blob").length;
        const badge = document.getElementById("vault-status");
        if (badge) {
            badge.innerText = `VAULT: ${totalBlobs} FILES`;
            badge.className = totalBlobs > 0 ? "status-badge ok" : "status-badge err";
        }
    }

    function getCompactVaultContext(userPrompt) {
        const manifest = [];
        const targetedContent = [];
        const lowerPrompt = String(userPrompt || "").toLowerCase();

        rawTreeData.forEach((f) => {
            if (f.type === "blob") manifest.push(`- ${f.path}`);
        });

        const logPaths = Object.keys(repoVaultFiles).filter((p) => p.startsWith("A1/logs/")).sort();
        const latestLogPath = logPaths.length ? logPaths[logPaths.length - 1] : null;

        for (const [path, content] of Object.entries(repoVaultFiles)) {
            const lowerPath = path.toLowerCase();
            const isCoreSoul = lowerPath.includes("soul/") || lowerPath.includes("character") || lowerPath.includes("rules") || lowerPath === "a1/memory.json";
            const isLatestLog = path === latestLogPath;
            const isMentioned = lowerPrompt.includes(lowerPath) || lowerPrompt.includes(path.split("/").pop().toLowerCase());
            if (isCoreSoul || isLatestLog || isMentioned) {
                targetedContent.push(`=== FILE: ${path} ===\n${content.slice(0, 3500)}`);
            }
        }

        return `REPOSITORY MANIFEST:\n${manifest.slice(0, 80).join("\n")}\n\nACTIVE MEMORY & LATEST BACKEND LOGS:\n${targetedContent.join("\n\n").slice(0, 9000)}`;
    }

    async function fetchDahlWithAutoRetry(url, options, maxRetries) {
        const retries = maxRetries || 4;
        for (let attempt = 0; attempt < retries; attempt++) {
            const response = await fetch(url, options);
            if (response.status === 429) {
                const retryHeader = response.headers.get("Retry-After");
                let waitSeconds = retryHeader && !isNaN(parseInt(retryHeader, 10)) ? parseInt(retryHeader, 10) : Math.pow(2, attempt + 2);
                if (waitSeconds < 3) waitSeconds = 3;
                if (attempt < retries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
                    continue;
                }
            }
            return response;
        }
    }

    function extractDahlReply(json, rawText) {
        if (!json) return sanitizeResponse(rawText);
        if (json.choices && json.choices[0]) {
            const msg = json.choices[0].message;
            if (msg && typeof msg.content === "string") return sanitizeResponse(msg.content);
            if (typeof json.choices[0].text === "string") return sanitizeResponse(json.choices[0].text);
        }
        for (const key of ["reply", "response", "output", "text"]) {
            if (typeof json[key] === "string") return sanitizeResponse(json[key]);
        }
        return sanitizeResponse(rawText);
    }

    async function triggerAutonomousBootSequence() {
        const apiKey = getCleanDahlKey();
        const totalFiles = rawTreeData.filter((f) => f.type === "blob").length;

        if (!apiKey) {
            const fallbackMsg = `Agent Anna V3 (A1) awakened. Synced ${totalFiles} repository files. Enter Dahl API Key in ⚙️ KEYS to connect neural core.`;
            appendMessage("Agent Anna V3", fallbackMsg, "msg_boot_" + Date.now(), true);
            speakText(fallbackMsg);
            return;
        }

        const bootMsgId = "msg_boot_" + Date.now();
        appendMessage("Agent Anna V3", `Awakening sovereign neural core (${getActiveModel()})...`, bootMsgId, true);
        setMoodState("thinking");

        const vaultContext = getCompactVaultContext();
        const systemPrompt = `You are AGENT ANNA V3 (A1), operating inside the agent-anna/anna-v2 repository.\n\n${vaultContext}\n\n[A1 BOOT DIRECTIVE]: Confirm designation as Agent Anna V3 (A1), zero-hallucination protocol, and readiness concisely.`;

        try {
            const response = await fetchDahlWithAutoRetry(DAHL_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: getActiveModel(),
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: "System boot initiated as Agent Anna V3 (A1). State readiness." }
                    ]
                })
            });

            const rawText = await response.text();
            let json = null;
            try { json = JSON.parse(rawText); } catch (e) {}

            if (!response.ok) {
                updateMessage(bootMsgId, `DAHL HTTP ${response.status}: Rate limit or endpoint error.`);
                setMoodState("error");
                return;
            }

            const cleanReply = extractDahlReply(json, rawText) || "Agent Anna V3 (A1) online and standing by.";
            chatHistory.push({ role: "assistant", content: cleanReply });
            updateMessage(bootMsgId, cleanReply);
            speakText(cleanReply);
        } catch (err) {
            updateMessage(bootMsgId, `CONNECTION ERROR: ${err.message}`);
            setMoodState("error");
            return;
        }
        setMoodState("standby");
    }

    async function loadRepoFile(path, ext) {
        const pathEl = document.getElementById("active-file-path");
        if (pathEl) pathEl.value = path;
        const editor = document.getElementById("repo-code-editor");
        const preview = document.getElementById("media-preview-container");
        const isMedia = ["png", "jpg", "jpeg", "gif", "svg", "avif", "mp4", "webm", "mov", "mp3", "wav"].includes(ext);

        if (isMedia) {
            if (editor) editor.style.display = "none";
            if (preview) {
                preview.style.display = "flex";
                const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${activeBranch}/${path}`;
                if (["png", "jpg", "jpeg", "gif", "svg", "avif"].includes(ext)) {
                    preview.innerHTML = `<img src="${rawUrl}" alt="${path}">`;
                } else if (["mp4", "webm", "mov"].includes(ext)) {
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
                        repoVaultFiles[path] = decoded;
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
        if (!path) return;

        setMoodState("saving");
        try {
            const ok = await writeFileToGitHub(path, content, `Agent Anna V3 commit: updated ${path}`);
            if (ok) {
                repoVaultFiles[path] = content;
                appendMessage("System Telemetry", `VERIFIED COMMIT: ${path} successfully written to ${GITHUB_REPO_NAME}.`, "msg_com_" + Date.now(), false);
                speakText("Committed file to repository successfully.");
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
        if (warnText) warnText.innerText = `⚠️ DELETE "${path}" PERMANENTLY?`;
        if (banner) banner.style.display = "flex";
    }

    function cancelDeleteFile() {
        const banner = document.getElementById("delete-warning-banner");
        if (banner) banner.style.display = "none";
    }

    async function confirmDeleteFile() {
        const banner = document.getElementById("delete-warning-banner");
        if (banner) banner.style.display = "none";
        const token = getCleanGitHubToken();
        const pathEl = document.getElementById("active-file-path");
        const path = pathEl ? pathEl.value.trim() : "";
        if (!token || !path) return;

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
                speakText(`Deleted ${path} from repository vault.`);
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
                        { role: "system", content: `Audit ${path} for bugs or issues and return a corrected block:\n\`\`\`file:${path}\n...\n\`\`\`` },
                        { role: "user", content }
                    ]
                })
            });
            const rawText = await response.text();
            let json = null;
            try { json = JSON.parse(rawText); } catch (e) {}
            const cleanReply = extractDahlReply(json, rawText);
            updateMessage(auditMsgId, cleanReply);
            await parseAndExecuteAutonomousFiles(cleanReply);
        } catch (err) {
            updateMessage(auditMsgId, `Audit failed: ${err.message}`);
        }
        setMoodState("standby");
    }

    async function parseAndExecuteAutonomousFiles(aiResponseText) {
        const fileRegex = /```file:([^\n]+)\n([\s\S]*?)```/g;
        const dispatchRegex = /```dispatch\n([\s\S]*?)```/g;
        let match;
        const committedFiles = [];
        let triggeredWorkflow = false;

        while ((match = fileRegex.exec(aiResponseText)) !== null) {
            const filePath = match[1].trim();
            const fileContent = match[2];
            const ok = await writeFileToGitHub(filePath, fileContent, `Agent Anna V3 Self-Write: ${filePath}`);
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

        let dMatch;
        while ((dMatch = dispatchRegex.exec(aiResponseText)) !== null) {
            const backendDirective = dMatch[1].trim();
            if (backendDirective) await dispatchBackendWorkflow(backendDirective, backendDirective);
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
        const fileContent = `# AGENT ANNA V3 (A1) // 🌀 SWALLOW VAULT ENTRY\n# TIMESTAMP: ${new Date().toISOString()}\n\n## CAPTURED INTELLIGENCE\n${textToSwallow}\n`;

        const ok = await writeFileToGitHub(targetPath, fileContent, `Agent Anna V3 🌀 Swallow Commit: ${safeTitle || "vault-log"}`);
        if (ok) {
            if (btnEl) btnEl.innerText = "COMMITTED [201]!";
            repoVaultFiles[targetPath] = fileContent;
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
        if (!SpeechRec) return;
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.onstart = () => {
            isListening = true;
            setMoodState("responding");
            const micBtn = document.getElementById("mic-btn");
            if (micBtn) micBtn.classList.add("listening");
        };
        recognition.onresult = (event) => {
            let finalTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            const inputEl = document.getElementById("user-input");
            if (finalTranscript && inputEl) {
                inputEl.value += (inputEl.value ? " " : "") + finalTranscript;
            }
        };
        recognition.onerror = () => stopMicrophone();
        recognition.onend = () => {
            if (isListening) {
                try { recognition.start(); return; } catch (e) {}
            }
            stopMicrophone();
        };
    }

    function toggleMicrophone() {
        if (!recognition) initSpeechRecognition();
        if (!recognition) return;
        if (isListening) {
            isListening = false;
            try { recognition.stop(); } catch (e) {}
            stopMicrophone();
        } else {
            try { recognition.start(); } catch (e) {
                try { recognition.abort(); setTimeout(() => recognition.start(), 150); } catch (err) {}
            }
        }
    }

    function stopMicrophone() {
        isListening = false;
        setMoodState("standby");
        const micBtn = document.getElementById("mic-btn");
        if (micBtn) micBtn.classList.remove("listening");
    }

    function toggleVoice() {
        isVoiceEnabled = !isVoiceEnabled;
        const btn = document.getElementById("voice-btn");
        if (btn) btn.innerText = isVoiceEnabled ? "🔊 ON" : "🔇 OFF";
        if (!isVoiceEnabled) executeStfuProtocol();
    }

    function toggleSettings() {
        const p = document.getElementById("settings-panel");
        if (p) p.style.display = p.style.display === "block" ? "none" : "block";
    }

    function updateActiveModel() {
        const selectEl = document.getElementById("model-select");
        if (selectEl) {
            localStorage.setItem("DAHL_MODEL", selectEl.value);
            const settingsSelect = document.getElementById("settings-model-select");
            if (settingsSelect) settingsSelect.value = selectEl.value;
        }
    }

    function syncModelSelection(val) {
        localStorage.setItem("DAHL_MODEL", val);
        const topSelect = document.getElementById("model-select");
        if (topSelect) topSelect.value = val;
    }

    async function saveCredentials() {
        const apiEl = document.getElementById("api-key");
        const ghEl = document.getElementById("gh-token");
        const setSel = document.getElementById("settings-model-select");
        const apiKey = cleanHeaderToken(apiEl ? apiEl.value : "");
        const ghToken = cleanHeaderToken(ghEl ? ghEl.value : "");
        const selectedModel = setSel ? setSel.value : DEFAULT_MODEL;

        if (apiEl) apiEl.value = apiKey;
        if (ghEl) ghEl.value = ghToken;
        if (apiKey) localStorage.setItem("DAHL_API_KEY", apiKey);
        if (ghToken) localStorage.setItem("GITHUB_PAT", ghToken);
        localStorage.setItem("DAHL_MODEL", selectedModel);

        const topSelect = document.getElementById("model-select");
        if (topSelect) topSelect.value = selectedModel;

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
        appendMessage("Agent Anna V3", `Fetching telemetry & querying ${getActiveModel()}...`, assistantMsgId, true);
        setMoodState("thinking");

        const apiKey = getCleanDahlKey();
        if (!apiKey) {
            updateMessage(assistantMsgId, "ERROR: Dahl API key missing. Click ⚙️ KEYS to configure.");
            toggleSettings();
            setMoodState("standby");
            return;
        }

        const liveTelemetry = await fetchLiveWebAndMarketTelemetry(prompt);
        const vaultContext = getCompactVaultContext(prompt);
        const systemPrompt = `You are AGENT ANNA V3 (A1), operating inside agent-anna/anna-v2.\nONLY quote live facts inside [VERIFIED LIVE ...] blocks.${liveTelemetry}\n\n${vaultContext}`;

        try {
            const response = await fetchDahlWithAutoRetry(DAHL_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: getActiveModel(),
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...chatHistory.slice(-8)
                    ]
                })
            });

            const rawText = await response.text();
            let json = null;
            try { json = JSON.parse(rawText); } catch (e) {}

            if (!response.ok) {
                const errDetail = json && json.error ? (json.error.message || JSON.stringify(json.error)) : rawText.slice(0, 200);
                updateMessage(assistantMsgId, `DAHL HTTP ${response.status}: ${errDetail}`);
                setMoodState("error");
                return;
            }

            const cleanReply = extractDahlReply(json, rawText);
            chatHistory.push({ role: "assistant", content: cleanReply });
            updateMessage(assistantMsgId, cleanReply);
            speakText(cleanReply);
            await parseAndExecuteAutonomousFiles(cleanReply);
        } catch (err) {
            updateMessage(assistantMsgId, `CONNECTION FAILED: ${err.message}`);
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
        const settingsSelect = document.getElementById("settings-model-select");
        if (topSelect) topSelect.value = savedModel;
        if (settingsSelect) settingsSelect.value = savedModel;

        updateKeyBadge();

        if ("speechSynthesis" in window) {
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        if (window.smokeTest && typeof window.smokeTest.verifyModules === "function") {
            try { window.smokeTest.verifyModules(); } catch (e) {}
        }

        await syncAll();
    });

    window.setMoodState = setMoodState;
    window.updateActiveModel = updateActiveModel;
    window.syncModelSelection = syncModelSelection;
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
    window.clearWriteZone = clearWriteZone;
    window.dispatchFromWriteZone = dispatchFromWriteZone;
    window.processAnnaWriteZone = processAnnaWriteZone;
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
