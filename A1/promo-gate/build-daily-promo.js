const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const QUEUE_PATH = path.join(REPO_ROOT, "A1/strayd/promo-queue.json");
const OUT_DIR = path.join(REPO_ROOT, "A1/promo-gate");
const REVIEW_HTML_PATH = path.join(OUT_DIR, "latest-review.html");
const LATEST_JSON_PATH = path.join(OUT_DIR, "latest-package.json");

const mode = (process.env.PROMO_MODE || "PREPARE_DAILY").trim();
const targetId = (process.env.PROMO_TASK_ID || "").trim();
const reviewNote = (process.env.PROMO_NOTE || "").trim();
const repoFull = (process.env.GITHUB_REPOSITORY || "agent-anna/anna-v2").trim();
const [owner, repo] = repoFull.includes("/") ? repoFull.split("/") : ["agent-anna", "anna-v2"];

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPromptsForSong(item) {
  const title = item.title || "Untitled Track";
  const artist = item.artist || "Martin Strayd";
  const id = item.id || "STRAYD-DAILY";
  const art = item.art || "store-art/Martin Strayd - Andaman Escape.png";
  const link = item.link || "https://strayd.com";

  return {
    xPost: `${artist} — "${title}" (${id})\nDirect digital MP3 + artwork bundle — own & share with friends.\n${link}\n#MartinStrayd #STRAYD`,
    fbMainPost: `"${title}" — ${artist}\n\nPersonal digital MP3 + artwork edition ready to own and share with friends. Drop a comment or check the direct link for full details.`,
    fbFirstComment: `Direct link & bundle info: ${link} | Cover art: ${art}`,
    instagramCaption: `"${title}" by ${artist} (${id}) — digital MP3 + artwork edition.\nLink: ${link}\n#MartinStrayd #STRAYD #IndependentMusic #Rock`,
    tiktokCaption: `"${title}" by ${artist} — real sound, personal MP3 + art bundle you can own and share. ${link} #MartinStrayd #STRAYD #Music #Indie`,
    youtubeTitle: `${artist} – "${title}" (${id}) | Official Audio & Bundle`,
    youtubeDescription: `"${title}" (${id}) by ${artist}. Personal digital MP3 + artwork edition available to own and share with friends.\nLink: ${link}\nCover Art: ${art}`,
    liveActionVisualPrompt: `STRICTLY REALISTIC LIVE-ACTION CINEMATOGRAPHY ONLY — ZERO CARTOON, ZERO ILLUSTRATION, ZERO ANIMATION. Real camera footage paired with cover art "${art}" for "${title}" by ${artist}. Natural lighting, authentic locations, real people and real instruments/environments in motion, clean framing with space for "${title}" and ${artist}.`
  };
}

function renderReviewHtml(item, prompts, meta) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Song Promo Gate — ${escHtml(item.title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1419; color: #e6edf3; margin: 0; padding: 24px; line-height: 1.5; }
    .wrap { max-width: 860px; margin: 0 auto; }
    .card { background: #161d26; border: 1px solid #2b3645; border-radius: 10px; padding: 18px; margin-bottom: 16px; }
    h1, h2, h3 { margin: 0 0 10px; }
    .meta { color: #9fb0c3; font-size: 14px; }
    pre { background: #0c1015; border: 1px solid #25303d; border-radius: 8px; padding: 12px; white-space: pre-wrap; word-break: break-word; font-size: 13px; color: #f0f6fc; }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    input[type="password"], input[type="text"] { background: #0c1015; border: 1px solid #334155; color: #f8fafc; padding: 9px 12px; border-radius: 6px; font-size: 14px; }
    input[type="password"] { min-width: 280px; }
    input[type="text"] { flex: 1; min-width: 220px; }
    button { padding: 10px 16px; border: 0; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 14px; }
    .btn-push { background: #16a34a; color: #ffffff; }
    .btn-fail { background: #dc2626; color: #ffffff; }
    #status-log { margin-top: 12px; font-size: 13px; color: #7dd3fc; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="meta">A1 DAILY PROMO REVIEW GATE • 1 SONG PER DAY • NO V4 CORE</div>
      <h1>${escHtml(item.title)} <span class="meta">(${escHtml(item.id || "NO-ID")})</span></h1>
      <div class="meta">Artist: ${escHtml(item.artist || "Martin Strayd")} • Status: <strong>${escHtml(item.status)}</strong> • Updated: ${escHtml(meta.updatedAt)}</div>
      <div class="meta">Cover Art: <code>${escHtml(item.art || "")}</code> • Link: <code>${escHtml(item.link || "")}</code></div>
      <div class="meta">Visual Rule: <strong>Realistic live-action only (no cartoon)</strong></div>
    </div>

    <div class="card">
      <h2>Human Gate Decision (OK PUSH or FAIL)</h2>
      <div class="meta">Enter a GitHub PAT with <code>Actions: write</code> &amp; <code>Contents: write</code> for <code>${escHtml(owner)}/${escHtml(repo)}</code> (kept in browser memory only, never saved to file).</div>
      <div class="controls">
        <input id="gh-pat" type="password" placeholder="Session GitHub PAT (workflow dispatch)" autocomplete="off" />
        <input id="gate-note" type="text" placeholder="Optional note (e.g. reason if FAIL)" value="${escHtml(meta.note || "")}" />
      </div>
      <div class="controls">
        <button class="btn-push" onclick="sendDecision('OK_PUSH')">OK PUSH</button>
        <button class="btn-fail" onclick="sendDecision('FAIL')">FAIL</button>
      </div>
      <div id="status-log">Ready for review.</div>
    </div>

    <div class="card">
      <h3>Live-Action Visual Prompt (No Cartoon)</h3>
      <pre>${escHtml(prompts.liveActionVisualPrompt)}</pre>
      <h3>X / Short Post</h3>
      <pre>${escHtml(prompts.xPost)}</pre>
      <h3>Facebook Main Post &amp; First Comment</h3>
      <pre>${escHtml(prompts.fbMainPost + "\n\n[First Comment]\n" + prompts.fbFirstComment)}</pre>
      <h3>Instagram &amp; TikTok</h3>
      <pre>${escHtml("[Instagram]\n" + prompts.instagramCaption + "\n\n[TikTok]\n" + prompts.tiktokCaption)}</pre>
      <h3>YouTube</h3>
      <pre>${escHtml("Title: " + prompts.youtubeTitle + "\n\n" + prompts.youtubeDescription)}</pre>
    </div>
  </div>

  <script>
    async function sendDecision(decision) {
      const logEl = document.getElementById("status-log");
      const pat = document.getElementById("gh-pat").value.trim();
      const note = document.getElementById("gate-note").value.trim();
      if (!pat) {
        logEl.textContent = "Paste a session GitHub PAT first to dispatch " + decision + ".";
        return;
      }
      logEl.textContent = "Dispatching " + decision + "...";
      try {
        const res = await fetch(
          "https://api.github.com/repos/${escHtml(owner)}/${escHtml(repo)}/actions/workflows/daily-song-promo.yml/dispatches",
          {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + pat,
              "Accept": "application/vnd.github+json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              ref: "main",
              inputs: {
                action: decision,
                task_id: ${JSON.stringify(String(item.id || item.title || ""))},
                note: note
              }
            })
          }
        );
        if (res.status === 204 || res.ok) {
          logEl.textContent = "Dispatched " + decision + " for " + ${JSON.stringify(String(item.title || ""))} + ". Check GitHub Actions to confirm commit.";
        } else {
          const errText = await res.text();
          logEl.textContent = "Dispatch failed (HTTP " + res.status + "): " + errText.slice(0, 200);
        }
      } catch (err) {
        logEl.textContent = "Network error dispatching " + decision + ": " + (err && err.message ? err.message : String(err));
      }
    }
  </script>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(QUEUE_PATH)) {
    throw new Error("Missing A1/strayd/promo-queue.json");
  }

  const raw = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
  const items = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : []);

  let item = null;
  if (targetId) {
    item = items.find(
      (x) =>
        String(x.id || "").toLowerCase() === targetId.toLowerCase() ||
        String(x.title || "").toLowerCase() === targetId.toLowerCase()
    );
  }
  if (!item) {
    item =
      items.find((x) => x.status === "awaiting_review") ||
      items.find((x) => !x.status || x.status === "pending");
  }

  if (!item) {
    console.log("No pending or awaiting_review song found in A1/strayd/promo-queue.json.");
    return;
  }

  const now = new Date().toISOString();
  if (mode === "OK_PUSH") {
    item.status = "pushed";
    item.pushedAt = now;
    if (reviewNote) item.reviewNote = reviewNote;
  } else if (mode === "FAIL") {
    item.status = "failed";
    item.failedAt = now;
    item.failReason = reviewNote || "Marked FAIL at human review gate";
  } else {
    item.status = "awaiting_review";
    item.preparedAt = now;
  }

  const prompts = buildPromptsForSong(item);
  const pkg = {
    updatedAt: now,
    mode,
    item,
    prompts
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LATEST_JSON_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  fs.writeFileSync(REVIEW_HTML_PATH, renderReviewHtml(item, prompts, { updatedAt: now, note: reviewNote }), "utf8");

  if (Array.isArray(raw)) {
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2) + "\n", "utf8");
  } else {
    raw.items = items;
    raw.lastUpdated = now;
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(raw, null, 2) + "\n", "utf8");
  }

  console.log(`MODE=${mode} | SONG=${item.title} (${item.id || "no-id"}) | STATUS=${item.status}`);
  console.log(`REVIEW_HTML=A1/promo-gate/latest-review.html`);
}

main();