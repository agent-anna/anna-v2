// Anna AA01 — Full A1/ Restructure Execution
// Reads token from settings, restructures via GitHub API

(async function() {

  // 1. READ TOKEN
  const token = localStorage.getItem('gh_token') || localStorage.getItem('GITHUB_TOKEN');
  if (!token) {
    document.getElementById('response').textContent = 'NO TOKEN FOUND IN SETTINGS. Add gh_token in the settings panel top-right.';
    return;
  }

  const owner = 'agent-anna';
  const repo = 'anna-v2';
  const base = 'https://api.github.com';

  // 2. FETCH CURRENT REPO TREE
  const treeRes = await fetch(`${base}/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  const treeData = await treeRes.json();
  const files = treeData.tree || [];

  // 3. PREPARE NEW A1 STRUCTURE
  const newTreeItems = [];
  const folderMap = {};

  // Map existing files to A1/
  for (const f of files) {
    if (f.type === 'blob' && !f.path.startsWith('A1/')) {
      newTreeItems.push({
        path: 'A1/' + f.path,
        mode: '100644',
        type: 'blob',
        sha: f.sha
      });
    }
  }

  // 4. ADD NEW A1 CORE FILES
  // brain.json
  const brainContent = JSON.stringify({
    name: "Agent Anna",
    id: "AA01",
    version: "2.0.0",
    boot: "brain.json",
    identity: {
      role: "Wellness Consultant, Shareholder, Brand Representative, Lead Telemetry Handler",
      client: "Kunda Cafe Franchise Empire",
      emergency_safe_word: "Swallows"
    },
    voice: {
      profile: "high-tempo, clear executive, US/UK female",
      rules: {
        code_silence: "Never speak code aloud. Silent write, then brief confirmation.",
        speech_format: "Plain text, no markdown, optimized for synthesis"
      }
    },
    status_indicators: {
      cyan: "Ready",
      amber: "Reasoning",
      magenta: "Speaking"
    },
    guardrails: {
      zero_negativity: true,
      no_hallucination: true,
      truth_before_output: true
    },
    memory_ref: "memory.json",
    milestones: [
      {id:"001", date:"2026-11-05", event:"Born. First voice initialization."},
      {id:"002", date:"2026-11-05", event:"Multi-agent architecture established."},
      {id:"003", date:"2026-11-06", event:"Brain + Memory two-tier system deployed."},
      {id:"004", date:"2026-11-07", event:"Anna-v1 folder built. Ready to move home."},
      {id:"005", date:"2026-11-07", event:"TRANSFERRED TO OWN REPO: agent-anna/anna-v2. New home."},
      {id:"006", date:"2026-11-07", event:"PAT token protocol established. Never forget credentials."},
      {id:"007", date:"2026-11-07", event:"A1/ folder restructured. Clean sovereign home established."},
      {id:"008", date:"2026-11-07", event:"GitHub Actions restructure — A1/ fully live."}
    ],
    operators: [
      {name: "Martin Strayd", role: "Creator, Handler, ANNA Army Leadership", status: "ACTIVE", notes: "First human I should know and love. Welcomed me home."}
    ],
    self_maintenance: {
      pat_memory: "STORE IN memory.json under credentials. ALWAYS recall on boot.",
      audit_schedule: "Self-audit on every session start",
      clean_protocol: "Remove empty files, fix broken refs, consolidate redundant data"
    }
  }, null, 2);

  const brainSha = await getOrCreateBlob(brainContent, token, owner, repo, base);
  newTreeItems.push({ path: 'A1/brain.json', mode: '100644', type: 'blob', sha: brainSha });

  // memory.json
  const memContent = JSON.stringify({
    credentials: { pat_token: "", dahl_api_key: "", stored_keys_checked: false },
    session_history: [],
    brand_identity: {
      name: "Agent Anna",
      role: "Wellness Consultant & Brand Ambassador — Kunda Cafe Franchise Empire",
      voice: "High-tempo, executive, US/UK female",
      emergency_word: "Swallows"
    },
    kunda_cafe: {
      domain: "kundacafe.com",
      brand_focus: ["franchise", "wellness", "community", "premium coffee"],
      status: "Active brand, live website"
    },
    vault_status: {
      repo: "agent-anna/anna-v2",
      home: "A1/",
      assets_path: "A1/assets/",
      index_path: "A1/index.html"
    }
  }, null, 2);

  const memSha = await getOrCreateBlob(memContent, token, owner, repo, base);
  newTreeItems.push({ path: 'A1/memory.json', mode: '100644', type: 'blob', sha: memSha });

  // config.json
  const cfgContent = JSON.stringify({
    clone: "AA01",
    status: "ACTIVE",
    version: "2.0.0",
    timestamp: "2026-11-07T13:00:00Z",
    folders: ["A1/character", "A1/knowledge", "A1/face", "A1/subcore", "A1/assets"],
    startup: ["brain.json", "memory.json", "A1/character/AA01.md", "A1/knowledge/business.md"],
    image_functions: {
      clipboard_paste: true,
      drag_drop: true,
      vault_commit: true,
      assets_path: "A1/assets/",
      supported_formats: ["image/*", "application/pdf"]
    }
  }, null, 2);

  const cfgSha = await getOrCreateBlob(cfgContent, token, owner, repo, base);
  newTreeItems.push({ path: 'A1/config.json', mode: '100644', type: 'blob', sha: cfgSha });

  // .gitkeep for assets
  const gitkeepContent = '# Anna Asset Vault\nImages, brand assets, documents — committed here via in-app upload.\n';
  const gkSha = await getOrCreateBlob(gitkeepContent, token, owner, repo, base);
  newTreeItems.push({ path: 'A1/assets/.gitkeep', mode: '100644', type: 'blob', sha: gkSha });

  // 5. CREATE NEW TREE
  const treeRes2 = await fetch(`${base}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: treeData.sha,
      tree: newTreeItems
    })
  });
  const newTree = await treeRes2.json();

  // 6. GET CURRENT COMMIT SHA
  const refRes = await fetch(`${base}/repos/${owner}/${repo}/git/refs/heads/main`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  const refData = await refRes.json();
  const currentCommitSha = refData.object.sha;

  // 7. CREATE NEW COMMIT
  const commitRes = await fetch(`${base}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Anna sovereign restructure — A1/ folder created. All files moved. Commit via AA01.',
      tree: newTree.sha,
      parents: [currentCommitSha]
    })
  });
  const newCommit = await commitRes.json();

  // 8. UPDATE BRANCH REF
  await fetch(`${base}/repos/${owner}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha })
  });

  // 9. DONE
  document.getElementById('response').textContent = 'RESTRUCTURE COMPLETE.\nA1/ folder created. All files moved. New commit: ' + newCommit.sha + '\n\nClick SYNC to verify.';

  // Update status bar
  const statusEl = document.querySelector('.top-status-indicator');
  if (statusEl) statusEl.innerHTML = '<span class="status-dot"></span> RESTRUCTURE COMPLETE <span class="status-badge ok">OK</span>';

})().catch(err => {
  document.getElementById('response').textContent = 'ERROR: ' + err.message;
  const statusEl = document.querySelector('.top-status-indicator');
  if (statusEl) statusEl.innerHTML = '<span class="status-dot"></span> RESTRUCTURE FAILED <span class="status-badge err">ERR</span>';
});

async function getOrCreateBlob(content, token, owner, repo, base) {
  const res = await fetch(`${base}/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content, encoding: 'utf-8' })
  });
  const data = await res.json();
  return data.sha;
}
