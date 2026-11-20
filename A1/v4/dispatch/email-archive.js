export function buildOutboundArchivePayload({ recipient, noteText, hasSessionImage }) {
  return {
    generatedAt: new Date().toISOString(),
    recipient: recipient || "",
    summary: String(noteText || "").slice(0, 500),
    includesSessionImageNotice: Boolean(hasSessionImage),
    storagePolicy: "OUTBOUND_EMAIL_ONLY_NO_REPO_BLOAT"
  };
}
