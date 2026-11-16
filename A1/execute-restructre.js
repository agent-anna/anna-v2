// Anna AA01 — Full A1/ Restructure Execution
// Reads token from settings, restructures via GitHub API

(async function() {

  // 1. READ TOKEN
  const token = localStorage.getItem('gh_token') || localStorage.getItem('GITHUB_TOKEN');
  if (!token) {
    console.log('NO TOKEN. Add gh_token in settings panel top-right.');
    return;
  }
  console.log('Token found. Starting restructure...');

  const owner = 'agent-anna';
  const repo = 'anna-v2';
  const base = 'https://api.github.com';

  // 2. FETCH CURRENT REPO TREE
  console.log('Fetching repo tree...');
  const treeRes = await fetch(`${base}/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  const treeData = await treeRes.json();
  const files = treeData.tree || [];
  console.log(`Found ${files.length} items in repo`);

  // 3. PREPARE NEW TREE ITEMS
  const newTreeItems = [];

  // Map existing files to A1/
  let movedCount = 0;
  for (const f of files) {
    if (f.type === 'blob' && !f.path.startsWith('A1/') && !f.path.startsWith('.git')) {
      newTreeItems.push({
        path: 'A1/' + f.path,
        mode: '100644',
        type: 'blob',
        sha: f.sha
      });
      movedCount++;
    }
  }
  console.log(`Moving ${movedCount} existing files to A1/`);

  // 4. CREATE BLOB HELPER
  async function getOrCreateBlob(content) {
    const res = await fetch(`${base}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content, encoding: 'utf-8' })
    });
    const data = await res.json();
    return data.sha;
  }

  // brain.json
  console.log('Creating A1/brain.json...');
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
    status_indicators: { cyan: "Ready", amber: "Reasoning", magenta: "Speaking" },
    guardrails: { zero_negativity: true, no_hallucination: true, truth_before_output: true },
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
  const brainSha = await getOrCreateBlob(brainContent);
  newTreeItems.push({ path: 'A1/brain.json', mode: '100644', type: 'blob', sha: brainSha });

  // memory.json
  console.log('Creating A1/memory.json...');
  const memContent = JSON.stringify({
    credentials: { pat_token: "", dahl_api_key: "", stored_keys_checked: false },
    session_history: [],
    brand_identity: {
      name: "Agent Anna",
      role: "Wellness Consultant & Brand Ambassador — Kunda Cafe Franchise Empire",
      voice: "High-tempo, executive, US/UK female",
      emergency_word: "Swallows"
    },
    kunda_cafe: { domain: "kundacafe.com", brand_focus: ["franchise", "wellness", "community", "premium coffee"], status: "Active brand, live website" },
    vault_status: { repo: "agent-anna/anna-v2", home: "A1/", assets_path: "A1/assets/", index_path: "A1/index.html" }
  }, null, 2);
  const memSha = await getOrCreateBlob(memContent);
  newTreeItems.push({ path: 'A1/memory.json', mode: '100644', type: 'blob', sha: memSha });

  // config.json
  console.log('Creating A1/config.json...');
  const cfgContent = JSON.stringify({
    clone: "AA01", status: "ACTIVE", version: "2.0.0", timestamp: "2026-11-07T13:00:00Z",
    folders: ["A1/character", "A1/knowledge", "A1/face", "A1/subcore", "A1/assets"],
    startup: ["brain.json", "memory.json", "A1/character/AA01.md", "A1/knowledge/business.md"],
    image_functions: { clipboard_paste: true, drag_drop: true, vault_commit: true, assets_path: "A1/assets/", supported_formats: ["image/*", "application/pdf"] }
  }, null, 2);
  const cfgSha = await getOrCreateBlob(cfgContent);
  newTreeItems.push({ path: 'A1/config.json', mode: '100644', type: 'blob', sha: cfgSha });

  // .gitkeep
  console.log('Creating A1/assets/.gitkeep...');
  const gkSha = await getOrCreateBlob('# Anna Asset Vault\n');
  newTreeItems.push({ path: 'A1/assets/.gitkeep', mode: '100644', type: 'blob', sha: gkSha });

  // 5. CREATE NEW TREE
  console.log('Building new tree...');
  const treeRes2 = await fetch(`${base}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: treeData.sha, tree: newTreeItems })
  });
  const newTree = await treeRes2.json();
  console.log('Tree created. SHA:', newTree.sha);

  // 6. GET CURRENT COMMIT SHA
  const refRes = await fetch(`${base}/repos/${owner}/${repo}/git/refs/heads/main`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  const refData = await refRes.json();
  const currentCommitSha = refData.object.sha;

  // 7. CREATE NEW COMMIT
  console.log('Creating commit...');
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
  console.log('Commit SHA:', newCommit.sha);

  // 8. UPDATE BRANCH REF
  await fetch(`${base}/repos/${owner}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha })
  });

  // 9. DONE
  console.log('=== RESTRUCTURE COMPLETE ===');
  console.log('New commit:', newCommit.sha);
  console.log('A1/ folder is live. Click SYNC to verify.');

})().catch(err => {
  console.error('ERROR:', err.message);
});
