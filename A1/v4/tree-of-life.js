const linksContainer = document.getElementById("links-container");
const newGroup = document.getElementById("new-group");
const newLabel = document.getElementById("new-label");
const newUrl = document.getElementById("new-url");
const addBtn = document.getElementById("btn-add-link");
const copyJsonBtn = document.getElementById("btn-copy-json");
const prevBtn = document.getElementById("btn-prev-page");
const nextBtn = document.getElementById("btn-next-page");
const pageIndicator = document.getElementById("page-indicator");
const pageViewer = document.getElementById("page-viewer");

let registry = null;
let pageIndex = 0;

function isSafeHttps(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function renderLinks() {
  linksContainer.innerHTML = "";
  if (!registry || !Array.isArray(registry.groups)) return;

  for (const grp of registry.groups) {
    const block = document.createElement("div");
    block.style.marginBottom = "12px";

    const heading = document.createElement("div");
    heading.className = "meta";
    heading.style.marginBottom = "6px";
    heading.textContent = grp.title;
    block.appendChild(heading);

    const list = document.createElement("div");
    list.className = "row";
    for (const item of grp.links || []) {
      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `${item.label} ->`;
      a.style.padding = "6px 10px";
      a.style.border = "1px solid #38516b";
      a.style.borderRadius = "6px";
      a.style.textDecoration = "none";
      a.style.color = "#e6edf5";
      a.style.background = "#182230";
      list.appendChild(a);
    }
    block.appendChild(list);
    linksContainer.appendChild(block);
  }
}

async function loadPage(idx) {
  if (!registry || !Array.isArray(registry.biblePages) || registry.biblePages.length === 0) return;
  pageIndex = (idx + registry.biblePages.length) % registry.biblePages.length;
  const entry = registry.biblePages[pageIndex];
  pageIndicator.textContent = `Page ${pageIndex + 1} / ${registry.biblePages.length}: ${entry.title}`;
  pageViewer.textContent = `Loading ${entry.path}...`;
  try {
    const res = await fetch(entry.path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pageViewer.textContent = await res.text();
  } catch (err) {
    pageViewer.textContent = `Could not load ${entry.path} directly (${err.message}). Path recorded in registry.`;
  }
}

addBtn.addEventListener("click", () => {
  const label = newLabel.value.trim();
  const url = newUrl.value.trim();
  if (!label || !isSafeHttps(url)) {
    pageViewer.textContent = "Enter a valid label and an https:// URL.";
    return;
  }
  const targetGroup = registry.groups.find(g => g.id === newGroup.value);
  if (targetGroup) {
    targetGroup.links.push({ label, url, accountStatus: "added-in-session" });
    newLabel.value = "";
    newUrl.value = "";
    renderLinks();
  }
});

copyJsonBtn.addEventListener("click", async () => {
  const text = JSON.stringify(registry, null, 2);
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
  pageViewer.textContent = "Updated links-registry.json copied to clipboard:\n\n" + text;
});

prevBtn.addEventListener("click", () => loadPage(pageIndex - 1));
nextBtn.addEventListener("click", () => loadPage(pageIndex + 1));

(async function init() {
  try {
    const res = await fetch("./registry/links-registry.json");
    registry = await res.json();
  } catch {
    registry = {
      updatedAt: "2026-11-20",
      groups: [
        {
          id: "anna-socials",
          title: "Anna Social & Broadcast Fingers",
          links: [
            { label: "Anna YouTube", url: "https://youtube.com" },
            { label: "Anna Facebook", url: "https://facebook.com" },
            { label: "Anna TikTok", url: "https://tiktok.com" },
            { label: "Anna X.com", url: "https://x.com" },
            { label: "Anna Instagram", url: "https://instagram.com" }
          ]
        }
      ],
      biblePages: [
        { title: "OPORD-AA01-V4-DEPLOYMENT", path: "./docs/OPORD-AA01-V4-DEPLOYMENT.md" }
      ]
    };
  }
  renderLinks();
  loadPage(0);
})();
