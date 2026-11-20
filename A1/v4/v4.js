import { dispatchWorkflow } from "./dispatch/dispatcher.js";
import { buildOutboundArchivePayload } from "./dispatch/email-archive.js";

const sessionMemory = {
  ephemeralBase64Image: null
};

const el = {
  utcClock: document.getElementById("clock-utc"),
  bkkClock: document.getElementById("clock-bkk"),
  roomMode: document.getElementById("room-mode"),
  note: document.getElementById("anna-note"),
  decor: document.getElementById("room-decor"),
  status: document.getElementById("status-line"),
  speakBtn: document.getElementById("btn-speak"),
  quietBtn: document.getElementById("btn-stop-voice"),
  fileInput: document.getElementById("vision-file"),
  clearVisionBtn: document.getElementById("btn-clear-vision"),
  pasteZone: document.getElementById("paste-zone"),
  previewWrap: document.getElementById("vision-preview-wrap"),
  previewImg: document.getElementById("vision-preview"),
  previewMeta: document.getElementById("vision-meta"),
  tokenInput: document.getElementById("gh-token"),
  wfFileInput: document.getElementById("workflow-file"),
  wfRefInput: document.getElementById("workflow-ref"),
  dispatchBtn: document.getElementById("btn-dispatch"),
  emailInput: document.getElementById("archive-email"),
  emailBtn: document.getElementById("btn-email-archive"),
  logBox: document.getElementById("action-log")
};

function logLine(msg) {
  const stamp = new Date().toISOString();
  el.logBox.textContent += `\n[${stamp}] ${msg}`;
  el.logBox.scrollTop = el.logBox.scrollHeight;
}

function updateClocks() {
  const now = new Date();
  el.utcClock.textContent = "UTC: " + now.toISOString().slice(11, 19);
  const bkk = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);
  el.bkkClock.textContent = `THAILAND (+07): ${bkk}`;
}

function cleanTextForSpeech(raw) {
  return String(raw || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#*_>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFemaleEnglishVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const femaleHints = ["female", "zira", "samantha", "victoria", "google uk english female", "aria", "jenny", "ava"];
  return (
    voices.find(v => /en/i.test(v.lang) && femaleHints.some(h => v.name.toLowerCase().includes(h))) ||
    voices.find(v => /en/i.test(v.lang)) ||
    null
  );
}

el.speakBtn.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    el.status.textContent = "STATUS: Speech synthesis unavailable in browser";
    return;
  }
  const spoken = cleanTextForSpeech(el.note.value || "Agent Anna AA01 online in V4 room. Ready to adapt and decorate.");
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(spoken);
  const voice = pickFemaleEnglishVoice();
  if (voice) utter.voice = voice;
  utter.lang = "en-US";
  window.speechSynthesis.speak(utter);
  el.status.textContent = "STATUS: SPEAKING (FEMALE ENGLISH FILTER)";
});

el.quietBtn.addEventListener("click", () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  el.status.textContent = "STATUS: VOICE QUIET";
});

el.decor.addEventListener("change", () => {
  el.roomMode.textContent = `ROOM: ${el.decor.value}`;
  el.status.textContent = `STATUS: DECOR SET TO ${el.decor.value}`;
});

function loadImageFileToMemory(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    sessionMemory.ephemeralBase64Image = String(reader.result || "");
    el.previewImg.src = sessionMemory.ephemeralBase64Image;
    el.previewMeta.textContent = `IN-MEMORY ONLY (${file.name}, ${Math.round(file.size / 1024)} KB) — not saved to Git`;
    el.previewWrap.classList.remove("hidden");
    el.status.textContent = "STATUS: EPHEMERAL IMAGE LOADED IN MEMORY";
    logLine(`Loaded see-only image into RAM (${file.name}). Not persisted to repository.`);
  };
  reader.readAsDataURL(file);
}

el.fileInput.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  loadImageFileToMemory(f);
});

el.pasteZone.addEventListener("paste", (e) => {
  const items = (e.clipboardData && e.clipboardData.items) || [];
  for (const item of items) {
    if (item.type && item.type.startsWith("image/")) {
      loadImageFileToMemory(item.getAsFile());
      break;
    }
  }
});

el.clearVisionBtn.addEventListener("click", () => {
  sessionMemory.ephemeralBase64Image = null;
  el.previewImg.removeAttribute("src");
  el.previewWrap.classList.add("hidden");
  el.fileInput.value = "";
  el.status.textContent = "STATUS: MEMORY IMAGE BUFFER CLEARED";
  logLine("Cleared ephemeral in-memory image buffer.");
});

el.dispatchBtn.addEventListener("click", async () => {
  const token = el.tokenInput.value.trim();
  const wf = el.wfFileInput.value.trim();
  const ref = el.wfRefInput.value.trim() || "main";
  el.status.textContent = "STATUS: DISPATCHING WORKFLOW...";
  try {
    const res = await dispatchWorkflow({
      owner: "agent-anna",
      repo: "anna-v2",
      workflowFile: wf,
      ref,
      token
    });
    el.status.textContent = `STATUS: DISPATCH ACCEPTED (${res.status})`;
    logLine(`Dispatched ${wf} on ${ref} (HTTP ${res.status}).`);
  } catch (err) {
    el.status.textContent = "STATUS: DISPATCH ERROR";
    logLine(`Dispatch error: ${err.message}`);
  }
});

el.emailBtn.addEventListener("click", () => {
  const to = el.emailInput.value.trim();
  const payload = buildOutboundArchivePayload({
    recipient: to,
    noteText: el.note.value,
    hasSessionImage: Boolean(sessionMemory.ephemeralBase64Image)
  });
  logLine(`Prepared outbound email archive packet for ${payload.recipient || "[no address]"} (repo bloat avoided).`);
  el.status.textContent = "STATUS: OUTBOUND ARCHIVE PACKET READY";
});

updateClocks();
setInterval(updateClocks, 1000);
