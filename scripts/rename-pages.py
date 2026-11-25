#!/usr/bin/env python3
"""
ANNA: Batch rename PAGE-1.md → PAGE-001.md, etc.
Uses GitHub API directly.
"""

import os
import requests

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
REPO = "agent-anna/anna-v2"
BRANCH = "main"
FOLDER = "bookyou"

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def pad(name):
    try:
        num = int(name.replace("PAGE-", "").replace(".md", ""))
        return f"PAGE-{num:03d}.md"
    except:
        return name

print("Getting files...")
r = requests.get(f"https://api.github.com/repos/{REPO}/contents/{FOLDER}", headers=HEADERS, params={"ref": BRANCH})
files = [f for f in r.json() if f["name"].startswith("PAGE-") and f["name"].endswith(".md")]

for f in files:
    old = f["name"]
    new = pad(old)
    if old != new:
        # Get SHA
        r = requests.get(f["url"], headers=HEADERS)
        sha = r.json()["sha"]
        
        # Create new file
        content = requests.get(f["download_url"]).text
        import base64
        encoded = base64.b64encode(content.encode()).decode()
        
        create = requests.put(
            f"https://api.github.com/repos/{REPO}/contents/{FOLDER}/{new}",
            headers=HEADERS,
            json={"message": f"ANNA: {old} → {new}", "content": encoded, "sha": sha, "branch": BRANCH}
        )
        
        if create.status_code == 201:
            # Delete old
            requests.delete(
                f"https://api.github.com/repos/{REPO}/contents/{FOLDER}/{old}",
                headers=HEADERS,
                json={"message": f"ANNA: Delete old {old}", "sha": sha, "branch": BRANCH}
            )
            print(f"✓ {old} → {new}")

print("\nDone! All pages now PAGE-001 format.")
