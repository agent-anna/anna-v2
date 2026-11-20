export async function dispatchWorkflow({ owner, repo, workflowFile, ref = "main", token, inputs = {} }) {
  if (!token) throw new Error("GitHub PAT required in session field.");
  if (!workflowFile) throw new Error("Workflow filename required.");

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ref, inputs })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub Actions dispatch failed (${response.status}): ${text}`);
  }

  return { ok: true, status: response.status };
}
